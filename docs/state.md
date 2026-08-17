# STATE

Rewritten after every step of the build order. This is how the run survives losing its
conversation.

## Current step

**Section 16, step 5 — `src/render.js`.** The banded sweep, slab sides, the parallax
void, the cup shaft. After it: a playable game.

## Last three things done

1. Step 3: `src/level.js` — the piece compiler, the perimeter-only seam check, the
   two-ring dilation, `paperSpan`/`gateAt`, routes. Tests 1-9 green.
2. Step 4: `src/levels.js` with PRACTICE GREEN verbatim, and the oracle wired.
   **Both authored routes cleared, zero falls, first attempt.** Tests 11, 12 green.
3. Mutation harness now at 17 mutations, every one reddening exactly what it declares.
   Two of them found real weaknesses in the TESTS, both fixed in the test:
   - test 2 sampled only cell centres, and `gradAt` at a cell centre reads that cell's
     own two corner lines and nothing else — so it could not see the dilation being
     removed at all. It now samples nine points per cell.
   - test 2's "declared" bound compared a 1-D corner step against a 2-D gradient
     magnitude. Each piece is now compiled ALONE through the same compiler and read
     with the same sweep.
   - test 8's branch signature recorded the SET of widths along the divergence, which
     includes the junction both branches leave by, so two identical lanes looked
     different. It now records the narrowest point.

## Next three up

1. Step 5: `src/render.js` + `main.js`. Verify by loading `game.html` from `file://`.
2. Step 6: `game.js`, `ui.js`, `save.js`. Tests 22, 23.
3. Step 7/8: the hazard roster and the other five courses.

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

- Headless browser not yet attempted. Two attempts allowed; on failure the posed-frame
  harness (section 15, harness 2) is dropped and that fact is recorded here.
