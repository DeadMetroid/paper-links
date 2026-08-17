# Stop hook - refuses to let the agent finish before the Floor is met.
# Blocks with an actionable reason; capped so it can never spin forever.
# Fails OPEN (allows the stop) on any internal error, so a broken gate
# cannot burn the whole run.

$MAX_BLOCKS = 25

function Allow([string]$msg) {
    if ($msg) { @{ systemMessage = $msg } | ConvertTo-Json -Compress -Depth 5 }
    exit 0
}
function Block([string]$reason) {
    # Exit code 2 is what actually blocks the stop. Verified 2026-08-12 by probe:
    # emitting hookSpecificOutput.decision='block' with exit 0 - the form the docs
    # describe - logged the block and let the agent stop anyway. Exit 2 with the
    # reason on stderr genuinely drove another turn. Both are emitted here so the
    # gate holds whichever path this build honours; exit 2 is the one proven to work.
    @{ hookSpecificOutput = @{
        hookEventName = 'Stop'
        decision      = 'block'
        reason        = $reason
    } } | ConvertTo-Json -Compress -Depth 5
    [Console]::Error.WriteLine($reason)
    exit 2
}

try {
    $raw = [Console]::In.ReadToEnd()
    $in  = $raw | ConvertFrom-Json
    $proj = if ($in.cwd) { $in.cwd } else { (Get-Location).Path }

    $countFile = Join-Path $proj '.claude\.floor-gate-count'
    $logFile   = Join-Path $proj '.claude\floor-gate.log'

    $n = 0
    if (Test-Path $countFile) {
        $t = (Get-Content $countFile -Raw -ErrorAction SilentlyContinue)
        if ($t) { [int]::TryParse($t.Trim(), [ref]$n) | Out-Null }
    }

    # ---- collect every reason the Floor is not met ----
    $fail = @()

    # 1. Artifacts named in the prompt's own stop condition (section 16 step 13).
    foreach ($f in @('CLAUDE.md', 'game.html', 'build.js', 'README.md', 'ASSETS.md',
                     'tests\run.js', 'docs\spec.md', 'docs\state.md',
                     'docs\VIDEO_GUIDE.md')) {
        if (-not (Test-Path (Join-Path $proj $f))) {
            $fail += "Required artifact missing: $($f -replace '\\','/')"
        }
    }

    $floor = Join-Path $proj 'docs\FLOOR.md'
    if (-not (Test-Path $floor)) {
        $fail += 'Required artifact missing: docs/FLOOR.md'
    } else {
        $un = @(Select-String -Path $floor -Pattern '^\s*-\s*\[\s\]' -ErrorAction SilentlyContinue)
        foreach ($u in $un) { $fail += "Floor item not verified: $($u.Line.Trim())" }
    }

    # 3. Context files and the deliverable are actually in the repo.
    #    git ls-files is the check that matters. check-ignore only answers for the
    #    paths you thought to name, and the file that gets dropped is the one you
    #    did not think of - a global gitignore can exclude .claude/settings.local.json
    #    with nothing in this repo mentioning it.
    $git = (Get-Command git -ErrorAction SilentlyContinue)
    if (-not $git) {
        $fail += 'git not found on PATH - cannot verify what is committed.'
    } elseif (-not (Test-Path (Join-Path $proj '.git'))) {
        $fail += 'No git repository yet - git init and commit (spec section 1).'
    } else {
        $tracked = @(& $git.Source -C $proj ls-files 2>$null)
        if ($LASTEXITCODE -ne 0) {
            $fail += 'git ls-files failed - cannot verify what is committed.'
        } else {
            $set = [System.Collections.Generic.HashSet[string]]::new(
                       [string[]]$tracked, [StringComparer]::OrdinalIgnoreCase)

            foreach ($must in @('CLAUDE.md', 'game.html', 'build.js',
                                'README.md', 'ASSETS.md',
                                'docs/FLOOR.md', 'docs/VIDEO_GUIDE.md',
                                '.claude/settings.json',
                                '.claude/hooks/floor-gate.ps1')) {
                if (-not $set.Contains($must)) {
                    $fail += "NOT COMMITTED (contest rule 3.1/11.3): $must -- run: git add -f `"$must`" && commit"
                }
            }

            # Anything present under .claude\ but untracked is an undisclosed
            # context file. This is exactly what a check-ignore spot-check misses.
            $cdir = Join-Path $proj '.claude'
            if (Test-Path $cdir) {
                foreach ($cf in Get-ChildItem $cdir -Recurse -File -Force -ErrorAction SilentlyContinue) {
                    $rel = ($cf.FullName.Substring($proj.Length).TrimStart('\','/')) -replace '\\','/'
                    if ($rel -match '^\.claude/(\.floor-gate-count|floor-gate\.log)$') { continue }
                    if (-not $set.Contains($rel)) {
                        $fail += "UNDISCLOSED context file (rule 11.3): $rel -- run: git add -f `"$rel`" && commit"
                    }
                }
            }
        }
    }

    $stamp = (Get-Date).ToString('HH:mm:ss')
    if ($fail.Count -eq 0) {
        Add-Content $logFile "[$stamp] PASS after $n block(s) - stop allowed." -ErrorAction SilentlyContinue
        Allow
    }

    if ($n -ge $MAX_BLOCKS) {
        Add-Content $logFile "[$stamp] CAP HIT ($MAX_BLOCKS) - stop allowed with $($fail.Count) item(s) outstanding." -ErrorAction SilentlyContinue
        Allow "floor-gate: iteration cap reached with $($fail.Count) item(s) outstanding. Review docs/FLOOR.md."
    }

    $n++
    Set-Content $countFile $n -ErrorAction SilentlyContinue
    Add-Content $logFile "[$stamp] BLOCK #$n - $($fail.Count) outstanding" -ErrorAction SilentlyContinue

    $list = ($fail | ForEach-Object { "  - $_" }) -join "`n"
    Block @"
You are not finished. The Floor in docs/FLOOR.md is not met yet ($n/$MAX_BLOCKS).

Outstanding:
$list

Do not stop, do not summarise, and do not ask a question - no human will answer.
Pick the topmost outstanding item, do the work, verify it by actually running the
game, then tick its box in docs/FLOOR.md. Only tick a box after you have observed
the behaviour yourself. Then continue to the next item.
"@
}
catch {
    Allow "floor-gate hook errored and was skipped: $($_.Exception.Message)"
}
