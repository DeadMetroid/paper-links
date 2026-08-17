# STATE

Rewritten after every step of the build order. This is how the run survives losing its
conversation.

## Current step

**Section 16, step 3 — `src/level.js`, the piece compiler.** Tests 1–7 next.

## Last three things done

1. Step 1 complete and committed: `CLAUDE.md`, `docs/spec.md`, `docs/state.md`,
   `README.md`, `ASSETS.md`, `docs/VIDEO_GUIDE.md`, `build.js`, the 52-test manifest,
   the oracle verbatim.
2. Step 2 complete: `src/tuning.js`, `src/heightfield.js`, `src/physics.js`,
   `src/hazards.js`. Tests 15–18 green. 100,000 ticks with no NaN and no clamp breach.
3. Built `tests/mutate.js` — a reusable mutation harness. 9 mutations, every one
   reddens exactly the tests it declares. Two of them found test 17 was too narrow
   (it only traced the ball) and the TEST was fixed, not the mutation.

## Next three up

1. Step 3: `src/level.js` — piece compiler, two-ring dilation, seam report,
   reachability, routes, the validators. Tests 1–7.
2. Step 4: `src/levels.js` with PRACTICE GREEN verbatim + wire the oracle.
   Tests 11 and 12 green on course 1 alone.
3. Step 5: `src/render.js` — banded sweep, slab sides, parallax void, cup shaft.

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
