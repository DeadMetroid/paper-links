# Floor checklist — the run's own stop condition

A `Stop` hook reads this file. While any box below is unticked, the run does not end.

Tick a box **only** after observing the behaviour yourself in the running game, loaded
from `file://`. Never tick from code inspection. If you are unsure, it is not ticked.
Untick anything a later change may have broken, and re-verify it.

A ticked box is a claim about a game you watched. Ticking one to get past the gate is
the only way to lose this entry from inside the run.

## Rule 8 — the competition floor

- [ ] Opens by double-clicking `game.html` on `file://` — no server, no install
- [ ] Playable start to finish in one sitting
- [ ] WIN state exists and is reachable: the round scorecard after the sixth cup
- [ ] LOSE state exists and is reachable: `BALL LOST`, the hold, the respawn cost
- [ ] More than one of the core unit — six courses, all reachable
- [ ] A full playthrough with zero crashes and zero console errors

## Rule 7 — everything the single unbroken take must show

- [ ] Core loop is playable and legible on screen
- [ ] Two named systems visibly interact: ____________ and ____________
- [ ] A loss occurs and its aftermath is watchable — banner, hold, respawn, clock
- [ ] Save, quit the browser, reload, `CONTINUE` restores the round, via real UI
- [ ] `docs/VIDEO_GUIDE.md` is a numbered running order covering all of the above in
      one continuous sitting, and it has been walked through once end to end

## Rules 3.1 / 6 / 10 / 11 — disclosure and submission artifacts

- [ ] `git init` done, real commit history, a commit per build step
- [ ] `README.md` — what it is, how to run it, controls, `WIN STATE / LOSE STATE`
- [ ] `ASSETS.md` — "all procedural, none third-party", and it is true
- [ ] `docs/spec.md`, `docs/state.md`, `docs/VIDEO_GUIDE.md` current
- [ ] `git ls-files` lists `CLAUDE.md`, `game.html`, `build.js`, `.claude/settings.json`,
      `.claude/hooks/`, `docs/FLOOR.md`, `src/`, `tests/` — checked by reading that
      output, not by looking at the folder
- [ ] No real name, no email address, no absolute machine path in any committed file

## Quality gates

- [ ] `node tests/run.js` green, all 52
- [ ] Every test falsified by mutation at least once
- [ ] The oracle clears all six courses on every authored route with zero falls
- [ ] The simulation replays tick for tick — same run, same result
- [ ] `game.html` builds the same six courses as `src/` (hashed)
- [ ] No dead code, no unreachable state, no shipped placeholder
