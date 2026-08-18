# STATE

Rewritten after every step of the build order. This is how the run survives losing its
conversation.

## Current step

**Step 13 — DONE.** All 52 tests green, every FLOOR box ticked from something observed in
the running game, the disclosure check read off `git ls-files`.

## Last three things done

1. **Step 13.** `README.md`, `ASSETS.md`, `docs/VIDEO_GUIDE.md` finished; every box in
   `docs/FLOOR.md` ticked with the frame or the command that was watched written beside it.
2. Built `tests/playthrough.js` — **all six courses played start to finish in a real
   browser over `file://`, through the game's own key path**, with the oracle injected into
   the page and its eight directions turned back into W/A/S/D. Nothing teleported, no state
   poked. Six courses, zero falls, zero crashes, zero console errors, ~110 s of play.
3. Dead-code sweep. Removed from the artifact: `gradMag` and `hazSweep` (only the
   validators ever called them — they now live in `tests/validate.js`), and `drySlot` (an
   alias of `dry` no course ever placed). `COL_EDGE` was declared and then the renderer
   typed the same colour out again — the fold lines derive from it now. `waveY` existed and
   no course placed it, so THE LONG SIXTH's rival leg is a washboard: three whole waves, so
   the term is zero at both ends and nothing downstream of it moved.

## Disclosure

`git ls-files` lists 41 files including `CLAUDE.md`, `game.html`, `build.js`, `README.md`,
`ASSETS.md`, `.claude/settings.json`, `.claude/hooks/floor-gate.ps1`, `docs/FLOOR.md`,
`docs/spec.md`, `docs/state.md`, `docs/VIDEO_GUIDE.md`, all of `src/` and all of `tests/`.
Nothing under `.claude/` is untracked. A grep over every tracked file for the machine user,
the absolute drive paths and any email address returns nothing.

**One thing that is disclosed rather than fixed:** commit AUTHORSHIP. This environment sets
`GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL`/`GIT_COMMITTER_*`, which override the repository's own
`user.name` / `user.email` (set at the first commit to a non-personal placeholder, and
still set — `git config user.name` reads "Paper Links Build Agent"). Every commit is
therefore authored by the machine owner's pseudonymous GitHub handle and their
`users.noreply.github.com` alias, which is what that alias exists for. No FILE contains it.
Rewriting ten commits to strip the owner's authorship of their own repository would be a
destructive, outward-facing change and is not one to make unasked.

## What the mutation pass found — four tests that were not tests

| test | it stayed green under a mutation that should have killed it |
|---|---|
| 27 | it read the rival's velocity AFTER the collision, which is what the rival CHASED with. Deleting the impulse entirely changed nothing it looked at. It now reads `kx/ky` in the tick the collision banks them. |
| 31 | it drove the ball off the high lip the other way, so the ball never came back to the tier's footprint and the assertion never ran. And once a broken build snapped the ball ONTO the tier, the "while it is below the tier" gate stopped it being checked at all. It now asserts the ball never ROSE. |
| 14 | it read `src/*.js` straight off disk, so the mutation harness — which patches the text as it loads — could not reach it. Adding a `GAMEOVER` state left it green. |
| 20, 21 | same, for `game.html`. All three now read through `tests/load.js`, which applies the mutations. |

## What the last four tests found

| test | what it caught |
|---|---|
| 45 | a REAL renderer defect: `ballDepth`'s fixed 0.1 stride can cross an x boundary and a y boundary inside one step and miss the cell between them, so the ball got painted over a one-cell sliver of paper that occluded it. The march now samples at whichever comes first, the stride or the next lattice line. |
| 46 | the worst frame at 524 fills, and 16.7% of every frame's paths landing off the canvas — a number I had never actually seen, because the count assertion failed first and the waste assertion never ran. |
| 50 | course 1 is ramps and one camber, and my first draft of the test demanded three distinct leg kinds per course. Course 1 is authored verbatim from the brief; the floor is two, and the vocabulary check moved to the whole game. |
| 51 | course 3 had a 79.5-tile stretch between checkpoints. Trimming legs could not fix it: the stretch between two flags is MANHATTAN-BOUND by where the flags are, and from (26,4.5) to (64,42.5) the floor was 76. Moving gate 2 three rows up fixed it. Course 4's shortcut route legitimately merges two legs, so a declared skip gets the two legs it gave up and not a tile more. |

## Next three up

1. `README.md`, `ASSETS.md`, `docs/VIDEO_GUIDE.md` final; walk the video guide through once.
2. Tick every box in `docs/FLOOR.md` from OBSERVED behaviour, never from code.
3. `git ls-files` disclosure check, final commit.

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
| frame cost, worst of all six | 306 posed frames, recording canvas | **461 fills, 138 strokes** |
| ...before cross-band batching | same sweep | 524 fills |
| paths landing >200px off canvas | the defect the complaint names | **2.2%** |
| paths landing just off canvas | the CELL_UP/CELL_DOWN margins' deliberate slack | 12.5% |
| build-01's worst frame, for scale | from the brief | 681 fills, 571 strokes, of which 275 and 192 painted NOTHING |
| live play | held D for 1.2 s from the tee | ball moved 9.44 tiles, speed 8.99 |
| LAW 12.1 check | flat / plain ramp 0.14 / camber 0.175 | shade bucket 7 / 8 / 9 — the camber does move |

### The six courses, as built

| # | name | flags | par | route 0 / 1 | oracle clock | net -> shots |
|---|---|---|---|---|---|---|
| 1 | PRACTICE GREEN | 3 | 16 | 109.5 / 107.9 | 21.8 / 21.9 | 12.8 / 12.9 -> -1 / -1 |
| 2 | THE LADDER | 3 | 16 | 131.9 / 128.6 | 23.1 / 20.9 | 14.1 / 11.9 -> 0 / -1 |
| 3 | THE BUNKERS | 4 | 20 | 176.8 / 172.8 | 34.2 / 28.8 | 22.2 / 16.8 -> 0 / -1 |
| 4 | THE AERIAL | 4 | 29 | 181.7 / 173.4 | 31.5 / 32.7 | 19.5 / 23.7 -> -1 / -1 |
| 5 | THE WATER HOLE | 5 | 18 | 191.1 / 183.2 | 34.5 / 32.4 | 19.5 / 17.4 -> 0 / 0 |
| 6 | THE LONG SIXTH | 5 | 30 | 229.1 / 226.9 | 37.8 / 34.9 | 22.8 / 19.9 -> -1 / -1 |

Every route: **zero falls**. Route length rises monotonically. Flags 3/3/4/4/5/5.

### Rules measured while authoring, all now in the course comments

| rule | why |
|---|---|
| a void gap is **at least 3 cells** | at 2, the two-ring dilation reaches across from both sides and averages the two tiers into one corner — a phantom slope of 1.05 at the landing |
| a bunker's rim slope is `2*depth/halfwidth` and must stay **under 0.42** | past critical no input climbs out, and a bunker you cannot leave is the end of the attempt, not a cost. Nothing exceeds 0.30 |
| a crown's steepest cross-slope is `rise*4/width`, and it lives **at the edge** | 0.8 across 5 is 0.64 and the ridge is a pair of cliffs; 0.5 across 7 is 0.29 |
| an elbow pad goes at a ramp's **end**, never under it | a rampX's height varies along x, so a flat pad over its last cells disagrees with every corner it touches — 8 seams from one line |
| **nothing moving sits on a narrow leg that already has a camber or water** | the leg is the threat; a chaser on top of it is two prices for one decision, and the oracle loses the ball every run |
| a static **on** the racing line is a wall, not an obstacle | a banked chute centres the ball exactly, so it jams against an infinite mass and no input gets past |
| a donut's hole must be somewhere you **can miss** | cut where both routes crossed, the oracle drove into it four runs out of four |

## The cull pass (step 12), and what it actually concluded

Batching terrain tops ACROSS bands is exact in the ordering sense — two top quads never
overlap, because the surface only folds in screen space at a gradient of 1.39 along the
view ray and the steepest piece declares 0.82 — and it cut the worst frame from 524 fills
to 461. It is **not** byte-identical, and the reason is worth writing down: adjacent quads
inside ONE path fill as a union with no internal seam, so batching removes the hairline
anti-aliased seams between neighbouring cells. That is an improvement in the picture, not
a regression, but it is a pixel change and it is recorded as one.

Everything else tried was reverted:

| attempted | why it was dropped |
|---|---|
| cull a top quad whose four corners are all past one edge of the canvas | looks provably invisible; moved three of five posed frames. Removing a quad from a batched path turns a survivor's shared edge into an anti-aliased boundary. |
| cull a wall whose top edge is already below the canvas | moved one frame, and saved nothing anyway: walls bucket by SURFACE, so dropping quads does not remove a fill unless it empties the bucket. |
| cull a wall by X | changes which wall is the highest in its bucket, and the bucket's vertical gradient starts there — so it repaints every wall that stays. |
| cull flags like props | **KEPT.** Byte-identical, and it removes six paths per off-screen flag on courses that carry five. |

The brief says the cull bound "was got wrong twice by reasoning about it". This is the
third and fourth time, and the frame hashes caught both. The margins are left exactly as
measured.

## Deviations from the build order, and why

- **`src/hazards.js` was written at step 2, not step 7.** `physics.js`'s collide loop is
  the two-body impulse of LAW 5.5, and the bodies it collides against are hazards, so
  writing physics without them leaves either a stub that ships or a duplicate definition
  that shadows itself. Nothing is *placed* early — `hazardIssues()` and the roster still
  come at step 7/8, which is where the risk actually was. Recorded per section 0 rule 1.

## Decisions taken where the brief left a choice

- **THE AERIAL's tier shortcut being a wash at `bonus = 3`.** Decision recorded before
  building it: leave `bonus` at 3 and lengthen the skipped leg. **Revised after
  measuring, and this is the honest version:** two branches between the same two
  junctions have the SAME Manhattan length whatever route they take, because every leg
  runs `+wx` or `+wy` and nothing ever runs back — so a shortcut's saving in distance is
  bounded by how far apart the two ENTER the rejoin, and lengthening the skipped leg
  lengthens both. A jump additionally spends descent the later legs then cannot spend on
  speed. Measured: the shortcut is **7 tiles shorter in course** (which is what test 33
  asks) and **about 1.3 s slower on the clock**. Against a 3 s flag it is a wash, exactly
  as the brief predicted. `bonus` stays 3 on all six: changing one course's would make
  the round card's arithmetic inconsistent for a gain the geometry caps anyway.
- **THE WATER HOLE's par is 18, not the 17 the brief names.** Measured: 191 tiles at
  5.5 tiles/s, and a flawless run of the narrow branch nets 19.5 — BOGEY at 17, PAR at
  18. The course was lengthened and steepened twice trying to reach 17; going further
  meant widening the lanes, which is the one thing that course is about. Every other par
  is the brief's number.
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
