# STATE

Rewritten after every step of the build order. This is how the run survives losing its
conversation.

## Current step

**Section 16, step 1 — law to disk.** In progress.

## Last three things done

1. Surveyed the directory: `docs/FLOOR.md`, `.claude/settings.json`,
   `.claude/hooks/floor-gate.ps1` are the human-authored entry files. Nothing else here.
2. `git init`.
3. Wrote `CLAUDE.md` (section 0, 2, 3, 4 verbatim + LAWS digest + complaint log),
   `docs/spec.md` (sections 5–14).

## Next three up

1. Finish step 1: `README.md`, `ASSETS.md`, `docs/VIDEO_GUIDE.md`, the oracle verbatim
   to `tests/oracle.js`, the 52-test manifest to `tests/run.js`. First commit.
2. Step 2: `src/tuning.js`, `src/heightfield.js`, `src/physics.js` + headless harness.
   Tests 15–18. Prove 100,000 ticks without a NaN.
3. Step 3: `src/level.js` — piece compiler, two-ring dilation, seam report,
   reachability, routes. Tests 1–7.

## Measured numbers

Derived, checked against the brief's stated values:

| number | derivation | value |
|---|---|---|
| `SLOPE_CRIT` | `K / (ROLL·G)` = `9.0 / ((5/7)·30)` | `0.42` |
| `TILE` | `floor(H·(1−BALL_Y) / ((√2/4)·MAX_SPEED·1.2))` = `floor(558 / 11.031)` | `50` |
| `Z_SCALE` | `round(TILE·0.36)` = `round(18)` | `18` |
| `Z_BAND` | `(TILE/2)/Z_SCALE` = `25/18` | `1.3889` |
| belt terminal | `BELT_SPEED·BELT_ACC / (BELT_ACC + MU·BELT_SPEED)` — see step 2 | target 8.8 u/s in ~0.6 s |
| drag time constant | `1/MU` = `1/0.32` | `3.125 s` |

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
