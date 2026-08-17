# STATE

Rewritten after every step of the build order. This is how the run survives losing its
conversation.

## Current step

**Section 16, steps 7 and 8 — the hazard roster and the other five courses.** This is the
step section 18 is about: four of the six complaints on it are about level content, they
were all made AFTER the level model was already correct, and three of them were made twice.
Read section 18 and LAW 6.9 before authoring each course and again after it.

## Last three things done

1. Step 5: `src/render.js` — the banded sweep in WORLD bands, slab side faces where the
   neighbour is void, the graded parallax backdrop, the cup shaft, the rotating-dimple
   ball, the wind oscillator. Verified by capturing real frames from `file://`.
2. Step 6: `game.js` / `ui.js` / `save.js` / `audio.js` / `main.js`. The eight states, the
   clock read as golf, `localStorage`, the iris, the HUD. Tests 19-23 green.
3. Built two browser harnesses against installed Chrome via `puppeteer-core` (which
   downloads no browser of its own — the failure mode the brief warns about was avoided
   by construction, and it worked on the first attempt):
   - `tests/shots.js` — posed frames, hashed, PNGs to `tests/_out/`.
   - `tests/play.js` — a live play run through real UI from `file://`.

## Bugs the harnesses found that no unit test would have

1. **Sprite depth keys were world-space, band keys were grid-index.** They disagreed by
   the grid origin (-2,-2), so the ball sorted BEHIND the ground it was standing on and
   was invisible. Found by looking at the first captured frame.
2. **Every wall was one flat colour keyed to its own top edge**, so a wall starting near
   the horizon stayed bright all the way to the bottom of the frame and the abyss stopped
   reading as depth. Now one vertical gradient per surface per band — same fill count.
3. **Arrow keys were claimed by the movement map before any menu saw them**, so no menu
   cursor could move at all. Found by `tests/play.js`, which now navigates by ITEM NAME
   and fails loudly if a cursor does not move.

## Next three up

1. Step 7: `hazardIssues()` is already written; place the roster and run the prop sheet.
2. Step 8: courses 2-6, one at a time, each oracle-clean on every route before the next.
3. Step 9-11: the clock tests, audio test 35, then validators 36-39 and 44-52.

## Measured numbers

Derived, checked against the brief's stated values:

| number | derivation | value |
|---|---|---|
| `SLOPE_CRIT` | `K / (ROLL·G)` = `9.0 / ((5/7)·30)` | `0.42` |
| `TILE` | `floor(H·(1−BALL_Y) / ((√2/4)·MAX_SPEED·1.2))` = `floor(558 / 11.031)` | `50` |
| `Z_SCALE` | `round(TILE·0.36)` = `round(18)` | `18` |
| `Z_BAND` | `(TILE/2)/Z_SCALE` = `25/18` | `1.3889` |
| drag time constant | `1/MU` = `1/0.32` | `3.125 s` |
| ballistics (test 15) | launch off a flat lip, 50 airborne ticks | x linear to 1e-9, z = semi-implicit parabola to 1e-9 |
| clamp (test 18) | 100,000 ticks down a 0.9 slope with a belt and full input | peak speed 26.000000, no NaN |
| determinism (test 17) | two runs, ball + every body traced every 7 ticks, 20 s | byte-identical |
| course 1 seams | perimeter disagreements over 0.02 | **0** |
| course 1 route length | route 0 / route 1 | 109.5 / 107.9 tiles (brief: 110) |
| course 1 gates | every flag's derived trigger | cross 3 tiles, r = 1.38 |
| course 1 declared slope | steepest piece compiled alone | 0.381 (the pond's rim) |
| course 1 interior slope | LAW 5.2 margin-2 sweep | 0.381 — under SLOPE_CRIT, correct for course 1 |
| course 1 largest flat square | LAW 6.8 DP | 8 (the tee), at (0,0) |
| course 1 rest ratio | LAW 6.7 | 1.0% (target under 7%) |
| oracle, course 1 | route 0 / route 1 | cleared, 0 falls, clock 21.8 / 21.9, credit 9 |
| course 1 net time | clock - credit vs parTime 16, bandStep 4 | 12.8 -> -1 shot = BIRDIE |
| frame cost, posed | course 1, five poses, recording canvas | 151 fills, 79 strokes |
| frame cost, live | course 1 in the browser, ball moving | 192 fills, 97 strokes |
| build-01's worst frame, for scale | from the brief | 681 fills, 571 strokes (275/192 painting nothing) |
| live play | held D for 1.2 s from the tee | ball moved 9.44 tiles, speed 8.99 |
| LAW 12.1 check | flat / plain ramp 0.14 / camber 0.175 | shade bucket 7 / 8 / 9 — the camber does move |

## Deviations from the build order, and why

- **`src/hazards.js` was written at step 2, not step 7.** `physics.js`'s collide loop is
  the two-body impulse of LAW 5.5, and the bodies it collides against are hazards, so
  writing physics without them leaves either a stub that ships or a duplicate definition
  that shadows itself. Nothing is *placed* early — `hazardIssues()` and the roster still
  come at step 7/8, which is where the risk actually was. Recorded per section 0 rule 1.

## Decisions taken where the brief left a choice

- **THE AERIAL's tier shortcut being a wash at `bonus = 3`.** The brief names this as a
  one-number design call and says to pick one and move on. **Decision: leave `bonus` at
  3 on all six and make the skipped leg long enough that the shortcut is genuinely
  faster.** Reason: `bonus` is asserted at 3 across the six by the clock spec, and
  changing one course's bonus makes the round card's arithmetic inconsistent for no
  gain. Lengthening the skipped leg is a course edit, which is what test 33 measures
  anyway. Recorded here per the brief's instruction.
- Git identity for commits is a non-personal placeholder — no real name or email in any
  committed artifact (section 0 rule 11).

## Gaps / known unresolved

- **Headless browser: resolved, first attempt.** `puppeteer-core` (no bundled download)
  against `C:\Program Files\Google\Chrome\Application\chrome.exe` with
  `--allow-file-access-from-files`. Both harnesses work. No fallback needed.
- `game.html` is deliberately NOT wrapped in an IIFE: top-level `var` in a classic script
  becomes a `window` property, which is how `tests/load.js` reads the same sources into a
  vm context. The posed-frame harness therefore drives the shipped artifact through the
  engine's own symbols rather than a parallel debug surface that could drift from it.
