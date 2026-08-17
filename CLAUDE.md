# LAW

This file is re-injected after every compaction. The original prompt is not. Everything
here is what cannot be lost.

---

## 0. NON-NEGOTIABLES — and the anti-stall rules. Read this twice.

1. **Never ask a question. Never wait. Never end a turn on a question, a summary or an
   offer.** There is no one there. If something is underspecified, choose, write the
   choice into `docs/state.md`, and keep going. End every turn by doing the next thing
   in section 16.
2. **Never wait for confirmation** before building, testing, installing a dev
   dependency, or committing.
3. **A red test suite blocks all progress.** Fix it before anything new. If a test is
   red, fix the code — if it is red because the *test* is wrong, prove that by mutation
   before you touch the test.
4. **Never claim something works without executing it and reading the output.**
   "Should work" is a bug report, not a result. If you are unsure whether something is
   done, run the suite and read the output.
5. **A test a mutation cannot turn red is not a test.** After writing one, break the
   code it covers on purpose, watch that test — and only that test — go red, then
   restore.
6. **Bloat scores negatively.** No speculative abstraction, no dead code, no
   placeholder that ships. Either it works or it is deleted.
7. Do not use `/compact` or any slash command. Work continuously until step 13 of
   section 16 is complete and the full suite is green. Then stop.
8. **If you have been on one step for a long time**, write what you have measured into
   `docs/state.md`, commit, and move to the smallest next thing that can go green.
9. **After every step of section 16, re-read section 18** — the complaint log — and ask
   which of the things on it you have just done. It is a list of failures that a
   previous agent shipped and a human then found by playing. The suite cannot catch
   them, because the suite only checks what somebody already thought to check.
10. **`docs/FLOOR.md` is already in this directory, and a Stop hook reads it.** It is
    the contest floor as a checklist. Tick a box only after you have *observed* the
    behaviour yourself in the running game — never from reading code — and untick
    anything a later change may have broken. The hook refuses to let the run end while
    a box is unticked or a required file is uncommitted, and it hands you the list of
    what is outstanding. **That refusal is not an error. It is the run continuing.**
    Read the list, do the topmost item, and carry on.
11. **Nothing personal goes into a committed file.** This directory becomes a public
    repository. No real name, no email address, no absolute path off this machine.
    Every path you write down is relative to this directory.

---

## 2. THE GAME

**PAPER LINKS.** An isometric momentum game in the lineage of *Marble Madness*,
themed as a papercraft miniature golf course. You are the ball. Six authored courses
descend toward the camera down narrow **slabs** of folded paper suspended over an
abyss — slabs, never ribbons: LAW 6.1 forbids the ribbon outright and it is the shape
build 01 died of. `WASD` apply **acceleration, never velocity**, so the whole game is
the fight between where you want to be and where your momentum is taking you.

Copy *Marble Madness* outright and build it better. Overhead-ish view, the ball rolls
down-screen whether you like it or not, momentum you fight rather than command, no
instant stop.

**The load-bearing design facts:**

- **No lives, no strokes, no budget of any kind.** Checkpoint-only. The last flag
  reached is the respawn. Nothing in the game can end a course except the cup. Any
  scoring mechanism that can hit zero is a life system wearing a different hat —
  the first build of this game reinvented one twice, as a stroke limit and then as a
  countdown clock, and both had to be cut.
- **Difficulty is the product, not a setting.** Not completable on a first
  playthrough. 80s-arcade retry loop.
- **The game teaches one skill and you must be able to say it out loud:
  BRAKE EARLY, TURN LATE.** Every course is that sentence at a rising tempo. This is
  not decoration — it is the thing that makes a difficulty ladder authorable. Without a
  named skill, "harder" can only mean "narrower and faster", which is exactly how the
  first build ended up with six courses that differed by a width multiplier. When you
  are deciding what course 4 does that course 3 did not, the answer is *a harder
  version of that sentence* — a corner you must brake for further out, a gap you must
  not brake for at all — never *the same course, thinner*.
- **Gameplay and physics outrank everything.** No bug may make a course impassable.
- **Six courses**, themed, difficulty rising. Checkpoint counts rise 3, 3, 4, 4, 5, 5
  — two courses share each count.
- **The world must not feel static.** Flags raise on checkpoint, hazards keep moving
  during a respawn hold, the backdrop parallaxes.
- **Screen-relative keyboard control, always.** `W` fights the descent. `W`+`A`
  fights a descent that also banks right. That balancing act is the game. The mapping
  is forced by the projection and is **exactly this** — get a sign wrong and every
  course is unplayable in a way no test will name:

  ```
  up    (W / ArrowUp)    wx -= 1, wy -= 1      // up-screen: -(wx+wy)
  down  (S / ArrowDown)  wx += 1, wy += 1
  left  (A / ArrowLeft)  wx -= 1, wy += 1      // left-screen: -(wx-wy)
  right (D / ArrowRight) wx += 1, wy -= 1
  then normalise to a unit vector; zero if nothing is held.
  ```

---

## 3. THE STACK — settled, not a decision to revisit

**A single self-contained `game.html`. Canvas 2D, vanilla JS. No dependencies, no
framework, no bundler.** It opens by double-clicking, on `file://`, with no server.

- The **player** runs no build step. `game.html` is committed and is the deliverable.
- **You** run one: sources live in `src/*.js` and `node build.js` concatenates them
  into `game.html`. Keep that split — a 6,000-line hand-edited single file is
  unmaintainable by hour three. Never hand-edit `game.html`. Never inline the sources
  into it. `build.js` fails the build on a file in `src/` that is not declared in its
  list, which is the check against dead modules.
- **This constrains the shipped artifact only.** Dev tooling may install whatever it
  needs — test runners, headless browsers. Node, npm, python and git are on this
  machine. Install freely; just keep it out of `game.html`.
- **The headless browser is the one install on this machine that eats runs.** A
  browser-driver package that downloads its own Chromium has failed here repeatedly,
  in a way that re-running the installer never fixes. So: **give it two attempts, not
  five.** If the bundled download fails, point the driver at a browser already
  installed — `puppeteer.launch({ executablePath })` against
  `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` or the Chrome beside
  it — with `--allow-file-access-from-files`. If that also fails, **stop and move on**:
  write the gap into `docs/state.md` and drop the posed-frame harness (section 15,
  harness 2) for the rest of the run. It is the only thing in this document that
  depends on a real browser. Every other test drives the simulation under Node, and
  the render tests (22, 45, 46) run against a recording canvas stub with no DOM. The
  suite and the oracle are the specification; frame hashing is how you would *prefer*
  to verify the cull. Losing an afternoon to an installer costs you the game.
- **`file://` facts, already verified — do not spend a cycle rediscovering them:**
  `localStorage` works on `file://` and survives a full browser restart. Use it for
  saves and namespace the keys. `sessionStorage`, IndexedDB and blob URLs also work.
  **Blocked on `file://`:** `fetch`/XHR against local files, ES-module `import`
  between files, and `crossOrigin` canvas reads. Never reach for those.
- **Verify the artifact the way a judge will:** opened from `file://`, not over
  `http://`. A feature that only works on a local server is broken.
- Never call `Math.random()` in simulation code. There is **no RNG in the level path
  at all** — a course is byte-for-byte what the author wrote, every time.
- Keep simulation logic pure and separable from rendering, so it runs headlessly
  under Node with no canvas. Rendering is never proof.

---

## 4. THE PROJECTION, AND WHY EVERY OTHER DECISION FOLLOWS

This section is the single most important thing in this document. The first build of
this game was rejected because it violated it, and no amount of renderer work could
reach the defect.

**The projection is, exactly:**

```js
px(cam, wx, wy)     = (wx - wy - (cam.x - cam.y)) * (TILE/2) + W/2
py(cam, wx, wy, wz) = (wx + wy - (cam.x + cam.y)) * (TILE/4)
                    - (wz - cam.z) * Z_SCALE + H * BALL_Y
```

`W = 1280`, `H = 900`, `BALL_Y = 0.38`. With `MAX_SPEED = 26` the derivation in §5
gives **`TILE = 50`, `Z_SCALE = 18`** — derive them, then check you landed there.

The camera is an exponential follow with velocity lookahead, on all three axes:

```js
target = { x: ball.x + ball.vx*CAM_LEAD, y: ball.y + ball.vy*CAM_LEAD, z: ball.z }
k = 1 - exp(-CAM_SMOOTH * dt);   cam += (target - cam) * k
```

World space `(wx, wy)` is the isometric lattice. Course space is it rotated 45°:
`S = (wx+wy)/√2` runs down the descent, `C = (wx-wy)/√2` runs across. `+wx` reads as
down-**right** on screen and `+wy` as down-**left**; both point away from the camera,
so a slab shows its `+wx` and `+wy` faces and nothing else.

**LAW 4.1 — Every path runs along `+wx` or `+wy`, and never down the descent axis.**
In this projection a side wall on an edge parallel to `(1,1)` — the descent axis —
projects to a *line*: **0 px² of screen area.** The same wall on a `+wx` or `+wy`
edge covers **36,000 px².** A corridor aimed at the bottom of the screen cannot show
its sides at any thickness. "It looks flat" and "there are no paths at different
angles" are one defect, and it is geometric, not artistic. This is why *Marble
Madness* is built from axis-aligned slabs. A level is a **staircase** of `+wx` and
`+wy` runs joined by junctions; both axes advance `S` equally, so the level descends
without ever aiming at the bottom of the frame.

**LAW 4.2 — Gravity follows the path, and this is free once 4.1 holds.** A ramp along
a world axis has gradient `(±s, 0)` or `(0, ±s)`. The fall line **is** the path. The
lateral demand is zero by construction. Any level that asks the ball to move sideways
without tilting the ground under it is authoring a bill it never priced — the player
pays it in steering for the whole length of the leg.

**LAW 4.3 — A direction change needs somewhere to turn.** Entering a traverse costs
`(m·v)²/2a` tiles of lateral room before the ball is up to the corridor's own rate.
A corridor narrower than that turns a turn into a fall. *Marble Madness* changes
direction on **wide junctions** for exactly this reason. Legs are narrow; junctions
are wide. That is the whole topology.

**LAW 4.4 — The course is a solid slab above a void.** Extruded side walls, a
parallax backdrop, and it must read as a *raised platform* at a glance — not a flat
cut-out with a bevel drawn round it.

The first build drew the paper's thickness as **a bevel outside the boundary**, having
reasoned — correctly — that a side face at constant `C` is edge-on to the camera and
has no area. The reasoning is sound and the conclusion is backwards: the fix is to build
the level out of `+wx`/`+wy` runs, whose walls *do* have area (LAW 4.1), not to stop
drawing walls. There was no geometry below the play surface at all.

**And the void must give the eye something fixed to move against.** That build's abyss
was a single flat fill colour. With nothing static anywhere in frame, the only edge the
eye can lock onto is the course's own boundary — and a boundary that holds still while
everything else is featureless reads as *the background sliding*, which is exactly the
report it got: *"for some reason the edges outside of the green are moving with us."*
The backdrop must be a graded wash that the camera moves against at its own rate. A void
that is one colour is not a void, it is an absence of information.

**LAW 4.5 — Depth is `wx + wy + Z_BAND·wz`, where `Z_BAND = (TILE/2)/Z_SCALE = 1.4`.**
Sorting the *terrain* on `wx + wy` alone is exact — two surface points sharing a
pixel lie on one ray, and along a ray the band and the height move together — so draw
the terrain one ascending diagonal band at a time, each cell emitting its own two
camera-facing side faces. That is an exact painter's algorithm here, and
all-walls-then-all-ground is not. **The ball is the exception:** the moment it is off
the paper and below the paper beside it, height is the whole of the difference, and
at 1.4 bands per unit a drop of *one* unit outweighs any fixed sprite bias. So the
ball's sort key is the band of the first paper the ray `(1,1,Z_BAND)` meets — "none"
on flat ground, "the next band" off a lip. Get this wrong and a marble that has
dropped behind a ledge is painted on top of it.

---

## THE LAWS DIGEST — one line each

The reasoning lives in `docs/spec.md`. This is so that after a compaction you still know
they exist and what they forbid. **Build 01 was rejected for violating LAW 4.1, 5.2, 6.5
and 10.1.**

- **LAW 4.1** — Every path runs along `+wx` or `+wy`, never down the descent axis; a wall on a `(1,1)` edge has zero screen area.
- **LAW 4.2** — Gravity follows the path: a ramp along a world axis has gradient `(±s,0)` or `(0,±s)`, so lateral demand is zero by construction.
- **LAW 4.3** — A direction change needs turning room: legs are narrow, junctions are wide.
- **LAW 4.4** — The course is a solid slab above a void: extruded side walls plus a *graded* backdrop, never one flat fill.
- **LAW 4.5** — Depth is `wx+wy+1.4·wz`; terrain sorts on `wx+wy` in ascending diagonal bands, and the ball's key is the band of the first paper its ray meets.
- **LAW 5.1** — `K` and `MU` are both LOW; weight is carried by `MU`, not by starving `K`.
- **LAW 5.2** — `SLOPE_CRIT = K/(ROLL·G) = 0.42` and at least one course must have *interior* ground steeper than it (interior = every cell within margin 2 also solid).
- **LAW 5.3** — The solid mask says where the ground is, never the height field; and the compiler dilates heights two rings past the paper.
- **LAW 5.4** — A tier wall is a wall at every moment, including in FALL state; `WALL_STEP` separates landing on a thing from passing it.
- **LAW 5.5** — Collision is relative-velocity; a collider with a `mass` is a two-body impulse, everything without one is the world.
- **LAW 5.6** — A surface that carries a rule must carry a SHAPE: bunkers are bowls, ponds are bowls, greens are dishes.
- **LAW 6.1** — A level is an ordered list of PIECES painted on the lattice, not a ribbon with a width; later pieces win.
- **LAW 6.2** — `paint` writes surface/flow onto existing solid ground and touches no height, so channels cannot grow seams.
- **LAW 6.3** — Banking envelopes open and close along a piece's length so both ends meet a pad flat.
- **LAW 6.4** — Bounds-check on each AXIS, never on the flat index.
- **LAW 6.5** — A fork is two lanes; a BRANCH is two paths sharing nothing between two junctions.
- **LAW 6.6** — A cross-slope is authored ground: cross-slope `tilt/width` costs `ROLL·G·that` continuously.
- **LAW 6.7** — A wide pad must contain something or it is a rest; target under 7% flat-and-safe.
- **LAW 6.7b** — A piece the model supports and no course places does not exist; minimum placements are asserted (test 49).
- **LAW 6.8** — Nothing flat is bigger than the tee: largest all-flat axis-aligned square ≤ 9, flat = solid, not WATER, `|grad| ≤ 0.06`.
- **LAW 6.9** — Vary the bar, not just the notes: ≤2 consecutive plain `ramp` legs, no two courses open alike, each course's signature idea appears 3 ways.
- **LAW 9.1** — A threat should change the ball's velocity, not occupy a tile.
- **LAW 9.2** — A hazard owns a disc and the disc has to fit: `sweep = pathRadius + r + BALL_R`, and a chaser's disc is its whole leash.
- **LAW 9.3** — Walk every route through a chaser's disc and require ≥ `2·BALL_R` of paper for the ball's centre either side.
- **LAW 10.1** — A checkpoint the player can roll past is not a checkpoint; the fix is the GROUND (a neck), not a bigger trigger.
- **LAW 10.2** — Derive the trigger radius from measured paper AND validate: `NECK_MAX 4.2`, ≥2 tiles along the run, route within `0.7·r`, `CUP_CLEAR 14`.
- **LAW 10.3** — A checkpoint sits where the course is one line: on the neck into a split, or out of a rejoin. Exactly one `skip` in the game.
- **LAW 10.4** — A trigger is a disc on the GROUND, gated on `WALL_STEP` against the trigger's own ground, never on the ball's `lift`.
- **LAW 10.5** — Falling costs a 2 s hold on the flag with the world still running; the flag's raise animation is in the simulation.
- **LAW 10.6** — Fragile ground is restored on respawn; the run owns its copy of mask+surfaces, the compiled grid is never written to.
- **LAW 11.1** — The clock counts UP, checkpoints pay it down, and it can never end a course.
- **LAW 12.1** — A slope you cannot see is unfair: stretch lambda `0.34..0.92` across 12 buckets before quantising.
- **LAW 12.2** — A frame costs what it hands the canvas: assert path COUNTS, never milliseconds.
- **LAW 13.1** — The rolling sound is NOISE, not a tone; a pitched fundamental that tracks speed is an engine.

These are measured facts, not preferences. Changing one requires re-measuring it.

---

## 18. THE COMPLAINT LOG — every one of these was said out loud, twice

An agent built this game once from a prompt like this one and the result was rejected.
Then a human played it six more times and reported what was wrong each time. **This is
that record, in the player's own words**, with the cause and the fix beside it.

Read it as a list of things you are about to do. Every one of them is a *plausible* way
to build this game — that is exactly why they happened. None of them were caught by
being careful; they were caught by someone playing the game and being annoyed.

**After every step of section 16, re-read this section and ask which of these you have
just done.** That question has a better hit rate than the test suite does, because the
suite can only check what somebody already thought to check.

### The build-01 rejection, verbatim

> *"the ramps are just completely flat and look no different than anything else"*

**Cause:** every slope in the game was below `SLOPE_CRIT` (it was 0.653, and the
steepest ramp authored was 0.50). A ramp you can climb at will has no consequence, so
it reads as decoration. **This is one complaint about the LOOK that was entirely a
number in the physics.** → LAW 5.2, tests 2 and 13.

> *"instead of it looking like we're on a raised platform trying not to fall off, for
> some reason the edges outside of the green are moving with us"*

**Cause, two parts.** The course had **no side walls at all** — the renderer drew the
paper's thickness as a *bevel outside the boundary*, reasoning that a side face at
constant `C` is edge-on to the camera. That reasoning is right about `C` and wrong
about the level: the answer is to build the level out of `+wx`/`+wy` runs, whose walls
have area, not to give up on walls. And the abyss was **one flat fill colour**, so
there was no fixed reference anywhere in frame — with nothing static to move against,
the only thing the eye could lock onto was the course itself, and the course reads as
stationary while the *background* appears to travel. → LAW 4.1, LAW 4.4.

> *"the papercraft art form has just become flat and blocky as you usually revert to,
> the windmill and every item you made is just blocks put together"*

**"as you usually revert to" is the important half of that sentence.** Stacking
screen-axis-aligned rectangles is the default an agent falls back to under time
pressure, and it is what produced a windmill with no sails and a rotor whose hub was
never drawn at all, so three blades orbited nothing. → §12's four volume primitives,
and the prop sheet, which is what made it undeniable.

> *"the sand traps and the water are just blocks that are colored differently, there's
> no depth or differentiation about what they are, they don't need to be blocks at all"*

**Cause:** `SAND` and `WATER` were surface *kinds* on the same flat sheet — a drag
number and a colour. **A surface that carries a rule must also carry a SHAPE.** A
bunker is a dish sunk into the heightfield; a pond is a bowl with its rim at pad
height; a green is a dish with the cup at its low point. Colour is the last thing that
tells you what a surface is, not the first. → `bowl`, `pond`, `greenDish`, and
per-surface crease line work in the renderer.

> *"there is no difficulty, you just move down and past the obstacles and you're there.
> I wanted it EXACTLY like marble madness where there are thin platforms going different
> directions that are difficult to stay on, but the entire game is just almost the same
> exact path down"*

**Cause:** the level was a 1-D chain of segments down one centreline. The hardest course
was still 65% wide segments, and the narrowest thing in the game was 4.4 tiles — **seven
ball-widths**, against Marble Madness's two or three. → §6 entire, and the width
vocabulary in it.

> *"the ball gets to the hole and it glitches underneath it"* → LAW 12's cup shaft.

> *"the movement of the ball doesn't feel right at all, it's too quick and responsive
> and easy to maneuver, it needs to feel like marble madness like you're pushing this
> ball"* → LAW 5.1. `K` was 14 with `MU` 0.9: responsive **and** grippy, the exact
inverse of the ask.

**And one rule was broken that had been explicitly cut.** The build shipped a capped
stroke budget — `STROKES 6/21`, `+1 STROKE — off the paper` — after the design
explicitly cut lives in favour of checkpoints. **The agent reinvented the life system it
had been told to remove, and then did it a second time as a countdown clock.** If you
find yourself designing any quantity that can reach zero and stop the player, you are
doing it a third time. → §2, §11, §17, test 14.

### Pass 5 — after the level model was rebuilt

> *"there are still a lot of large squares that are too large and safe. everything is
> very generic in terms of like the starting square, then path down to another square
> then path down to another square for the whole game. we need to expand the types and
> paths, we need more variations. and entirely separate pathways like left or right you
> can choose and have different obstacles on them. one of the best parts of the game is
> the parts where there are paths with elevation on either side... like paths that have
> one side raised so you're constantly fighting to stay up on it, the path which gives
> out after a second of you being on it is another good one, and the water trap are very
> underused"*

Four separate defects in one paragraph, and **note that the level model had already been
rebuilt when this was said.** Having the right pieces available is not the same as using
them:

1. **Large safe squares** → LAW 6.7, LAW 6.8.
2. **"square → path → square → path for the whole game"** → **LAW 6.9 below.** This is a
   *rhythm* complaint and it is the one that is easiest to satisfy on paper and still
   fail. Every junction can pass 6.7 and 6.8 individually and the course can still be
   the same bar of music six times.
3. **Separate pathways with different obstacles** → LAW 6.5.
4. **Camber, fragile paper, water underused** → `bank`, `crown` and `paint` were all
   *implemented and had never once been placed*. **A piece the level model supports and
   no course uses is a piece that does not exist.** Minimums are in §6.

### Pass 6 — after the checkpoints were moved

> *"there are some checkpoints on the same platform as the hole to exit the level which
> doesn't make sense. and once again the checkpoints are easily avoidable and almost
> pointless. you need to make it so a checkpoint is on a thin path and must be hit, they
> are still on these large squares similar to the starting point and we want as minimal
> of those large square starting points as possible"*

**"once again"** — this was the second time. The first fix had been to make the trigger
radius bigger, which is the intuitive fix and the wrong one: a bigger disc on a plaza is
still a disc on a plaza. **The fix is the GROUND, not the trigger.** → §10 entire.

### Pass 6 — the timer

> *"lets incorporate the timer aspect. lets have a timer counting up in the top right of
> the screen and checkpoints hit reduce time and the time scale relates to your score at
> the end like bogey and etc"*

Note the shape of it: **counting up**, checkpoints *reduce*. Marble Madness counts down
and checkpoints add, and that clock can hit zero. → §11.

### Pass 9 — falling through the world

> *"sometimes the ball is glitching through the edges of the map, like when falling off
> you can see it pass through the green blocks"*

**Two independent bugs with one symptom**, and both had shipped for nine passes: the
ball's render depth ignored its height (LAW 4.5), and `FALL` state ignored the mask
entirely, so a falling ball drifted up to 64 units *inside* solid paper (LAW 5.4). →
Tests 44 and 45.

### Pass 10 — performance

> *"sometimes the game is a bit laggy can you fix that"*

A quarter of the fills and a fifth of the strokes in a frame were painting nothing at
all. → LAW 12.2. **And the honest part of the answer:** the fix could not be shown to
help, because the machine with the problem was not the machine being measured on. That
is why `F3` exists and why the test caps **counts** rather than milliseconds.

---

## LAW 6.9 — VARY THE BAR, NOT JUST THE NOTES

Named here because it is the complaint most likely to survive everything else in this
document. `pad → ramp → pad → ramp` is the shape the level model makes easiest, and six
courses of it is what "everything is very generic" means.

**A course must not be a repeating alternation of junction and leg.** Concretely, and
these are the shipped numbers:

- **No more than two consecutive legs may be plain `ramp`s.** The third is a `chute`, a
  `tube`, a `bank`, a `crown`, a `wave`, or a ramp carrying `paint`.
- **A junction is not always how two legs meet.** A leg may run straight into another
  leg at a corner, or into a tier, or fork without a pad at all.
- **Each course names one idea it is about** (§8's "signature idea" column) and that
  idea appears at least three times on it, in three different arrangements. THE BUNKERS
  is sand; the sand is a bunker across a lane, a bunker you route around, and a bunker
  with the only dry line through it against the void.
- **No two courses open the same way.** The tee leads into a different first move on
  each of the six.

Check it by reading the piece list of each course out loud as a sequence of kinds. If
courses 2 and 3 sound the same, they are the same.

---

## BUILD ORDER (section 16) — floor first

```
1  it opens from file:// and does not crash          <- below this there is no entry
2  six courses exist and the oracle clears them      <- more than one of the core unit
3  the clock, the card and the save                  <- the win state lives here
4  hazards and audio
5  the cull pass and the frame hashes
```

1. Law to disk. `git init`.
2. `tuning.js`, `heightfield.js`, `physics.js`, headless harness. Tests 15–18.
3. `level.js` — compiler, two-ring dilation, seam report, reachability, routes. Tests 1–7.
4. `levels.js` PRACTICE GREEN verbatim + the oracle verbatim. Tests 11, 12 on course 1.
5. `render.js` — banded sweep, slab sides, parallax void, cup shaft. Playable.
6. `game.js`, `ui.js`, `main.js`, `save.js`. Tests 22, 23.
7. `hazards.js` + catalog, `hazardIssues()` first. Then the prop sheet.
8. The other five courses, one at a time, oracle-clean before the next.
9. The clock and scoring. Tests 40–43.
10. Audio. Test 35.
11. Remaining validators 36–39, 44–52. **49–52 are meant to fail first time.**
12. The cull pass, verified by frame hashes byte-identical before and after.
13. Docs final, full suite green, every FLOOR.md box ticked from observation,
    `git ls-files` disclosure check.

Commit after each step. Rewrite `docs/state.md` after each step. Never start a step
with the suite red.

**Section 0 is the anti-stall contract. Re-read it whenever you are about to end a turn.**
