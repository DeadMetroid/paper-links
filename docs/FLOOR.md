# Floor checklist — the run's own stop condition

A `Stop` hook reads this file. While any box below is unticked, the run does not end.

Tick a box **only** after observing the behaviour yourself in the running game, loaded
from `file://`. Never tick from code inspection. If you are unsure, it is not ticked.
Untick anything a later change may have broken, and re-verify it.

A ticked box is a claim about a game you watched. Ticking one to get past the gate is
the only way to lose this entry from inside the run.

> **How each box below was observed.** Three harnesses drive the shipped `game.html` over a
> real `file://` URL in headless Chrome and write frames to `tests/_out/`:
> `node tests/playthrough.js` plays all six courses start to finish through the real
> keyboard path; `node tests/walk.js` drives the whole of `docs/VIDEO_GUIDE.md` beat by
> beat, including closing the browser process and reopening it; `node tests/shots.js`
> captures and hashes twenty-two posed frames. Every frame named below was looked at.

## Rule 8 — the competition floor

- [x] Opens by double-clicking `game.html` on `file://` — no server, no install
      *(loaded from `file:///.../game.html` with no server running; menu up, `walk-1-menu.png`)*
- [x] Playable start to finish in one sitting
      *(`tests/playthrough.js`: six courses completed in one session, ~110 s of play)*
- [x] WIN state exists and is reachable: the round scorecard after the sixth cup
      *(holed out on THE LONG SIXTH → `ROUND COMPLETE`, six rows, totals, `CLUB CHAMPION` — `walk-16-win.png`)*
- [x] LOSE state exists and is reachable: `BALL LOST`, the hold, the respawn cost
      *(`walk-3-lost.png` shows `BALL LOST — VOID`; `walk-4-hold.png` the 2 s hold with the clock still running)*
- [x] More than one of the core unit — six courses, all reachable
      *(`walk-12-select.png` lists all six; the playthrough played all six in sequence)*
- [x] A full playthrough with zero crashes and zero console errors
      *(`tests/playthrough.js` listens on `pageerror` and `console` and reports zero of each)*

## Rule 7 — everything the single unbroken take must show

- [x] Core loop is playable and legible on screen
      *(`walk-2-play.png`: the ball, the slab over the void, the clock, the WASD hint)*
- [x] Two named systems visibly interact: __THE VACUUM__ and __THE WATER GATE__
      *(THE LONG SIXTH — `walk-13-muncher.png` has both in one frame: the vacuum's dashed
      point-of-no-return circle on the lane, and the water gate's dry slot with the
      checkpoint on it twenty tiles below. The vacuum pulls your line off the slot; missing
      the slot is the water. `walk-14-rival.png` is the second pair, the rival marble
      chasing on the leg beneath it — engaged, doing 2.2 units/s.)*
- [x] A loss occurs and its aftermath is watchable — banner, hold, respawn, clock
      *(banner 1.6 s naming the cause, 2 s hold with hazards still cycling, respawn at the
      last flag, `falls` 1, clock never stopped)*
- [x] Save, quit the browser, reload, `CONTINUE` restores the round, via real UI
      *(`walk-8-reload.png` — the browser PROCESS is closed and a new one opened against the
      same profile, not a page reload; `CONTINUE` live, cursor on it, resumed on course 2)*
- [x] `docs/VIDEO_GUIDE.md` is a numbered running order covering all of the above in
      one continuous sitting, and it has been walked through once end to end
      *(`tests/walk.js` follows it beat for beat; sixteen beats captured, zero errors)*

## Rules 3.1 / 6 / 10 / 11 — disclosure and submission artifacts

- [x] `git init` done, real commit history, a commit per build step
- [x] `README.md` — what it is, how to run it, controls, `WIN STATE / LOSE STATE`
- [x] `ASSETS.md` — "all procedural, none third-party", and it is true
      *(no asset file exists; test 21 scans the built artifact for any external reference)*
- [x] `docs/spec.md`, `docs/state.md`, `docs/VIDEO_GUIDE.md` current
- [x] `git ls-files` lists `CLAUDE.md`, `game.html`, `build.js`, `.claude/settings.json`,
      `.claude/hooks/`, `docs/FLOOR.md`, `src/`, `tests/` — checked by reading that
      output, not by looking at the folder
- [x] No real name, no email address, no absolute machine path in any committed file
      *(`git ls-files | xargs grep` for the machine user, the drive paths and any address:
      no hits. Commit AUTHORSHIP is set by `GIT_AUTHOR_*` in this environment and overrides
      repo config — it is the repository owner's own pseudonymous GitHub handle and a
      `users.noreply.github.com` alias. Disclosed in `docs/state.md` rather than hidden;
      no file content carries it.)*

## Quality gates

- [x] `node tests/run.js` green, all 52
- [x] Every test falsified by mutation at least once
      *(`node tests/mutate.js`: 56 mutations, 0 inadequate, and it reports the tally —
      "falsified on purpose: 52/52")*
- [x] The oracle clears all six courses on every authored route with zero falls
      *(tests 11, 12 and 42; twelve routes, `falls 0` on every one)*
- [x] The simulation replays tick for tick — same run, same result
      *(test 17: two runs traced every 7 ticks for 20 s, ball and every body, byte-identical)*
- [x] `game.html` builds the same six courses as `src/` (hashed)
      *(test 20 hashes each compiled course out of the artifact's own text)*
- [x] No dead code, no unreachable state, no shipped placeholder
      *(scanned: no unreferenced top-level function or var in `src/`. Three things the game
      does not itself call are kept deliberately and say so in place — `pointAt`/`project`
      are the level model's own route queries, and `setAudioFactory` is the one-line seam
      that makes LAW 13.1 assertable. `gradMag`, `hazSweep` and `drySlot` were found by the
      same scan and removed from the artifact.)*
