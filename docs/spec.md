# PAPER LINKS — the systems, in full

Sections 5 through 14 of the entry brief, with the reasoning the `CLAUDE.md` digest
strips out. `CLAUDE.md` holds the laws; this holds why they are the numbers they are.

---

# 5. PHYSICS — write it yourself; it is the heart of the game

A rolling solid sphere on a bilinearly interpolated heightfield. Fixed timestep,
semi-implicit Euler, fully deterministic, no wall clock anywhere in the simulation.

**Every number lives in `src/tuning.js` and nowhere else.**

```
G          30      gravity, world units/s²
ROLL       5/7     solid-sphere rolling factor, 1/(1 + I/mR²) with I = (2/5)mR²
K          9.0     player input acceleration, units/s²
MU         0.32    base linear rolling drag, per second
E          0.35    restitution — papercraft is dead, not bouncy
MAX_SPEED  26      hard horizontal speed clamp, applied EVERY tick
BALL_R     0.32    ball radius in tiles
DT         1/120   fixed simulation timestep
AIR_INPUT  0.25    fraction of K available while airborne
EPS        1e-4    launch-test epsilon
CONTACT    0.02    separation below which the ball still feels the ground
WALL_STEP  0.8     units a falling ball may rise onto on landing
FALL_TIME  0.9     seconds of visible fall before the respawn resolves
FALL_DRIFT 0.35    fraction of horizontal speed kept once falling
RESPAWN_HOLD 2.0   seconds after a respawn before input is answered
SINK_RATE  1.6     units/s the ball settles once in water
SINK_TIME  1.0     seconds from touching water to the respawn
FLAT_DRAG  3.4     drag multiplier while flattened
BREAK_TIME 0.55    seconds a fragile tile holds after first touch
BELT_SPEED 11      units/s a belt will carry a ball along itself
BELT_ACC   14      units/s² it closes the gap at
RIVAL_DRAG 1.2  RIVAL_KNOCK 0.7  RIVAL_DOWN 2.6
SEEK_LOOK  1.3   SEEK_CLEAR 0.45
CAM_LEAD   0.35  CAM_SMOOTH 6.0
SQUASH_DECAY 0.12  IMPACT_MIN 1.5  IMPACT_REF 12
VTERM_MAX  2.0     max terminal speed permitted at a flag or a tee (test 5)

SLOPE_CRIT = K / (ROLL * G) = 0.42     DERIVED, never typed
```

Two more live in the compiler rather than in `tuning.js`, and both are load-bearing:
**`VOID_DEPTH = 40`** — the height the whole grid is filled with before any piece is
painted, i.e. how far below the lowest surface the void sits; and **`DEATH_DROP = 4`**
— `course.deathZ = lowestSurface − 4`, the plane that ends an attempt.

**LAW 5.1 — `K` and `MU` are both LOW, and that is the feel of the game.** High
authority *and* high grip reads as a cursor, not a marble. The marble corner is the
opposite one: you lean on a heavy thing and it keeps going after you stop asking.
`MU 0.32` is a drag time constant of 3.1 s — nothing stops cleanly. On typical
interior terrain (slope ~0.12) the ball's natural rolling speed is 8.0 units/s; it is
never at rest. **Weight is carried by `MU`, not by `K`.** Starving `K` does not read
as heavy, it reads as unresponsive — at `K = 6.5` a course became unclearable because
a fork asked for a lateral commitment the ball could no longer make. Cut grip, not
control.

**LAW 5.2 — `SLOPE_CRIT` is the steepness above which input cannot arrest the ball,
and real slopes must exceed it.** The first build had every slope in the game below
critical, which alone removed the difficulty. **Gravity must be able to beat the
player.** Measure it: at least one course must contain interior ground steeper than
`SLOPE_CRIT`, and **interior means every cell within a margin of 2 is also solid**.
Measuring the whole grid instead reports the deliberately steep rim of a chute or a
funnel — decoration that exists to turn a drifting ball back — rather than the ground
anyone rolls on: course 1 reads 0.478 that way against an actual playing surface of
0.170. A gate keyed to the whole-grid maximum passes on the decoration and tells you
nothing.

**The tick, in order:**

```
if SINK:  z -= SINK_RATE*dt; v *= 0.88; integrate x,y; return
if FALL:  vz -= G*dt; z += vz*dt
          drift x,y by v*dt*FALL_DRIFT — but the WALL RULE still applies (LAW 5.4),
          per axis: if wallAt(x+dx, y) then vx = -E*vx else x = x+dx, and the same
          for y. A falling ball bounces off the tier it is falling past.
          return
if HOLED: return

onPaper = solid mask at (x,y)              <-- the MASK, never the height
h       = onPaper ? heightAt(x,y) : z
grad    = onPaper ? gradAt(x,y) : (0,0)
contact = onPaper && (!air || (z - h) <= CONTACT)

if flat > 0: flat -= dt; input = 0; squash = 1

if !contact:  a = K*AIR_INPUT*input;  vz -= G*dt
else:         drag = MU * surfDrag(x,y) * (flat>0 ? FLAT_DRAG : 1)
              a = -ROLL*G*grad + K*input - drag*v
              plus belt: only the component ALONG the belt, closing the gap to
              BELT_SPEED and no further — a conveyor, not a hill:
                along = v · beltDir
                need  = (BELT_SPEED - along) / BELT_SPEED
                if need > 0: a += beltDir * BELT_ACC * min(1, need)
              A ball already faster than the belt is never slowed by it.

v += a*dt                                   semi-implicit Euler
clampSpeed()                                MANDATORY, every tick
vzSurface = grad · v                        rate the ground falls away
bank = |cross(v, grad)| / speed             gradient ACROSS travel — see audio
x,y += v*dt;  if !contact: z += vz*dt

TIER WALL (LAW 5.4) — before the contact branch, if the ball is airborne and the
new cell stands more than WALL_STEP above it: undo the move on whichever axis
carried it in and reflect that component by -E; if neither single axis was
blocked it caught the corner diagonally, so undo both and reflect both. Then
re-read onPaperNew/hNew, and if it is STILL inside the wall, force onPaperNew
false — it is in the cliff, not on it.

if contact:
   if stepped off the paper:  vz = vzSurface     <-- leaves the lip tangentially
   elif hNew < z + vzSurface*dt - EPS: vz = vzSurface   <-- LAUNCH TEST
   else: z = hNew; vz = 0
elif landed on paper (z <= hNew): z = hNew; impact = -vz; vz = 0
                                  squash if impact > IMPACT_MIN

air  = !onPaperNew || (z - hNew) > CONTACT
lift = onPaperNew ? z - hNew : 0

if !air && surface is WATER: state = SINK          <-- CONTACT, not the cell

spin = (spin + sp*dt/BALL_R) mod 2π                <-- wrapped, for the dimples
collide();  clampSpeed()
if z < course.deathZ: state = FALL
```

**`air` and `lift` are two different questions and both are needed.** The launch test
fires on *any* downward curvature, so `air` flickers on undulating ground by design —
it says which force set the next tick uses. `lift` is how far the ball actually is off
the ground, and it is what the shadow, the rolling channel and the fragile-tile timer
read, because a five-centimetre hop is not flight.

**A collider only bites when the ball is low enough to meet it:** `if (ball.z > c.z +
c.h) continue`. Without that, a ball that jumps a tier is still stopped in mid-air by a
tree standing on the ground below it.

**LAW 5.3 — The mask says where the ground is; the height field never does.** The
grid holds a height for void cells because the array is rectangular. `gradAt` takes a
central difference half a tile either side, so on the last solid cell of a lip it
samples filler 40 units down and reports a slope of **−18** — which the launch test
converts into 300 units/s straight down, and the ball *vanishes* at the edge instead
of flying off it. Two fixes, both required: physics tests `solid`, and the compiler
**dilates the height field two rings past the paper** so the gradient at an edge is
the real slope of the ground the ball is on.

**LAW 5.4 — A tier wall is a wall, at every moment of the descent.** Terrain is
continuous across any connected run of paper — neighbouring cells share corners — so
the only true steps in this world are the cliffs across a void. Paper standing more
than `WALL_STEP` above the ball is one of those: solid to a ball beside it, not
ground it is about to land on. Without this a ball falling down a cliff drifts over
the footprint of ground metres above it, satisfies `z <= h`, and *climbs the cliff it
just fell off*. The rule applies in `FALL` state too — a falling ball with no mask
test drifts up to **64 units inside solid paper**. And "lost" is `z < deathZ` alone;
do not also require the ball to be off the mask, because a ball dropping the length
of a tier wall is inside that wall's footprint for the whole descent.

**LAW 5.5 — Collision is relative-velocity, and a collider with a `mass` is a
two-body impulse.** Take the ball's mass as 1; `J = -(1+E)·rel · m/(m+1)`, the ball
takes `+J` along the normal and the body takes `-J/m`. Separation is shared the same
way, so the light body is the one that moves. Everything *without* a mass is the
world — a tree, a mallet head — an infinite mass that takes nothing back. This one
branch is the entire rival marble: it rams you off the line and you ram it off the
paper, and it is the only threat in the game you beat rather than avoid.

**Surfaces.** `FAIRWAY GREEN ROUGH SAND WATER BELT FRAGILE CRACKED`, drag multipliers
`1.0, 0.55, 2.6, 6.0, 1.4, 1.0, 1.0, 1.0`. The first five differ only by drag. The
last three carry **rules**, which is what a drag coefficient cannot buy.

**LAW 5.6 — A surface that carries a rule must also carry a SHAPE.** *"the sand traps
and the water are just blocks that are colored differently, there's no depth or
differentiation about what they are, they don't need to be blocks at all."* That is
what a surface kind painted on flat ground looks like, and no amount of colour work
fixes it. **A bunker is a `bowl` sunk into the heightfield. A pond is a `bowl` with its
rim at pad height. A green is a `greenDish` with the cup at its low point** — never a
flat square with a hole drawn on it. The depth is geometry; the colour and the crease
line work are how you tell two pieces of geometry apart, not how you make them exist.
The three rule-carrying surfaces:

- **WATER is a decision, not a surface.** This game's acid pond: contact means the
  ball goes under. Nothing rolls across it. The rule asks for **contact**, never for
  the cell alone — so a channel you can fly is a jump, and a channel down one side of
  a lane is a lateral commitment held for the whole leg.
- **BELT** carries the ball along its own painted direction whether or not you asked,
  closing the gap between the ball's speed *along* it and `BELT_SPEED` and then
  stopping. Drag settles that at **8.8 units/s in about six tenths of a second** —
  that pair of numbers is chosen for *that* result, not for `BELT_SPEED`. Pushing
  with a constant acceleration instead gives a terminal that scales with a number the
  belt has nothing to do with and takes three seconds to get anywhere; it reads as a
  slope, not a conveyor.
- **FRAGILE** holds for `BREAK_TIME` and is then a hole for the rest of the attempt.
  A first run cannot know the line; the second one does. It only starts cracking when
  the ball is genuinely on it — `state == ROLL && lift < 0.25` — so a ball that flies
  the patch does not arm it. Touching turns the cell `CRACKED` (which is what the
  renderer and the audio read); `BREAK_TIME` later the cell's `solid` goes to 0.

**The view is DERIVED, never chosen.** The camera must see at least
`MAX_SPEED * 1.2` world units ahead of the ball on flat ground or the reaction-time
budget is unsatisfiable. Screen-vertical advances `√2/4 · TILE` px per world unit of
descent, so with the ball at 38% down a 900px canvas:
`aheadPx = H · (1 − BALL_Y)`, `TILE = floor(aheadPx / ((√2/4) · MAX_SPEED · 1.2))`,
and `Z_SCALE = round(TILE · 0.36)`. On `1280×900` that is **`TILE = 50`,
`Z_SCALE = 18`**. Pick `TILE` first and you have chosen the difficulty by accident.

**And then everything drawn is authored against that number, never against pixels.**
`MAX_SPEED` moved 14 → 26 in one pass, `TILE` fell ~96 → 50 with it, and every prop in
the game was still drawn at the size it had been authored for at 96 — a tee 20px, a
goose's neck 20px. They were not merely weak, they were half-size, and it cost a whole
pass to find. Any constant in the renderer that is a length is a multiple of `TILE` or
`Z_SCALE`.

---

# 6. THE LEVEL MODEL — pieces painted on the lattice

**LAW 6.1 — A level is an ordered list of PIECES painted onto the world lattice, not
a ribbon with a width.** Later pieces win, for both height and mask, so authoring is:
lay the big shapes down, then carve. Every run is along `+wx` or `+wy`, which
satisfies LAW 4.1 by construction and makes 4.2 free.

Do **not** build a corridor generator — a 1-D chain of segments down one centreline.
That is what the first build did. It cannot express a junction, it cannot express a
branch, and every fix to it reshuffles one seeded chain and so buys one course while
selling another.

**Heights live on lattice CORNERS and are shared between neighbouring cells**, so two
pieces that meet must agree on the boundary height or the seam is a one-cell cliff.
The compiler reports every disagreement **over 0.02 units** with coordinates. **The
seam report must be empty on all six courses.** (A piece may carry `embed: true` to opt
out of the check where it is deliberately sunk into another; use it almost never.)

**The compile pass, in order** — everything a level needs comes out of this one sweep:

```
size the grid from the bounding box of all pieces, +2 cells of pad on each side
fill every corner height with voidZ = lowestSurfaceZ - VOID_DEPTH
for each piece in order:
   cut   -> clear solid over its cells
   paint -> write surf (and belt flow) onto cells that are ALREADY solid; no height
   else  -> write corner heights over [x..x+w] x [y..y+h] INCLUSIVE (so neighbours
            share a line), recording a seam wherever a painted corner disagrees;
            then set solid=1 and surf over its cells
dilate the height field TWO RINGS past the paper (LAW 5.3): twice over, every
   unpainted corner with painted orthogonal neighbours takes their MEAN and is
   itself marked painted
deathZ = lowestSurfaceZ - DEATH_DROP
```

**The pieces.** `u` runs along the piece's own axis, `t` across it, both in `[0,1]`:

| piece | height function | what it is |
|---|---|---|
| `pad` | `z` | flat ground. Junctions, tees, gates |
| `ramp` | `lerp(z0,z1,u)` | the workhorse. Gradient is `(s,0)` or `(0,s)` |
| `chute` | `+ bank·sin(πu)·(2t-1)²` | banked half-pipe. Banking **opens and closes** along its length so both ends seam flat against a pad |
| `tube` | `+ bank·smoothstep(min(u,1-u)/0.18)·(2t-1)²` | a chute you can live in: rim held flat-topped across the middle 64%, folded away over the first and last 18% |
| `funnel` | `+ rise·sin(πu)·min(1,\|2t-1\|/lerp(1,throat,u))²` | walls that converge on a throat. A commitment, not a choice |
| `wave` | `+ amp·(1-cos(2πu·waves))/2` | washboard. Peak slope `2π·amp·waves/length` |
| `bowl` | `z + depth·r²`, `r` from centre | a dish that collects. Restoring slope grows linearly with offset |
| `crown` | `+ rise·sin(πu)·(1-(2t-1)²)` | a RIDGE — the inverse of a chute. The crest is high ground and both edges fall into the void |
| `bank` | `+ tilt·smoothstep(min(u,1-u)/0.15)·(t-0.5)` | a CAMBER. `tilt` is **signed**, the total height difference across the piece |
| `cut` | — | clears the mask. Holes, voids, donuts |
| `paint` | — | writes surface and flow onto ground that already exists and touches **no height** |

**LAW 6.2 — `paint` is why water and fragile paper are authoring moves rather than
arithmetic problems.** It lets a channel run down one side of a banked leg without the
author re-deriving the parent's height function at an offset and getting it a
hundredth wrong — which is a seam, and a seam is a cliff. It paints solid cells only,
so a strip that overhangs its parent quietly does nothing instead of quietly adding
floor.

**LAW 6.3 — Banking envelopes exist for a measured reason.** The first cut of `chute`
had full banking at its mouth, which meant the pad in front had to absorb the whole
rim in one cell: a 1.4-unit step, slope 1.4, **more than three times critical**. A
launch ramp disguised as a joint. `chute`, `crown`, `bank` and `funnel` all open and
close along their length so that both ends meet a pad flat.

**LAW 6.4 — Bounds-check on each AXIS, never on the flat index.** `j*nx + i` with `i`
past the right-hand edge is a valid offset — it is the next row — so a flat-index
guard clips nothing and silently carves a strip out of the wrong side of the course.

**Authoring helpers.** Write these so heights are never typed twice: each returns its
own exit height and the next leg is handed that number, so two pieces that meet always
agree by construction. Where two BRANCHES must arrive at one junction, the second
branch's last slope is **derived** from the height the first one landed at, never
typed, so a rejoin cannot grow a step.

```js
pad(x,y,w,h,z,surf)              rampX/rampY(x,y,w,h,z,slope,surf)
chuteX/Y(...,slope,bank,surf)    tubeX/Y(...,slope,bank,surf)
funnelX/Y(...,slope,rise,throat) bankX/Y(...,slope,tilt,surf)
crownX/Y(...,slope,rise,surf)    waveX/Y(...,slope,amp,waves,surf)
bowl(x,y,w,h,z,depth,surf)       cut(x,y,w,h)
pond(...)      = bowl with SURF.WATER, rim at pad height
greenDish(...) = bowl with SURF.GREEN — the green is a DISH with the cup at its
                 low point, never a flat square with a hole drawn on it
belt(x,y,w,h,z,dx,dy)            paint/water/fragile/sand/dry/beltOver(...)
gateX(x,y,len,w,z) / gateY(x,y,w,len,z)   -- see section 10; carry their own .flag
drySlot(x,y,w,h)                 -- a gate of dry paper through a band of water
haz(name,x,y,phase,leash)        -- one placed threat, indexed into the CATALOG
skips(flag,routes)               -- a gate a named route is ALLOWED to miss
```

**Slope vocabulary**, all against `SLOPE_CRIT = 0.42`:

```
0.10 - 0.16   a stroll. Terminal 7-11 u/s. Catwalks, teaching legs.
0.18 - 0.26   committed. Terminal 12-17 u/s. Main legs on later courses.
0.30 - 0.40   fast, still holdable. Terminal 20-27 u/s (clamped at 26).
0.50 +        past critical. A chute: you survive it, you do not steer it.
```

**Width vocabulary — and this one has a whole rejected build behind it.** The ball is
`2·BALL_R = 0.64` tiles wide. Build 01's *narrowest* piece was 4.4 tiles — **seven ball
widths** — and its fairways were 11. *Marble Madness* runs ledges at two to three ball
widths. Nothing in that build was thin, and "there is no difficulty" was the result.
These are the measured widths across the shipped six, cross-axis, in tiles:

```
3        a gate, and the thinnest thing in the game. Four and a half ball widths.
         Anything thinner cannot hold a checkpoint (LAW 10.2 wants >= 2 along
         the run) and cannot absorb a knock.
4 - 5    a catwalk. This is where the game lives. A camber, a crown or a leg
         over open void.
6        the median leg. Wide enough to carry a hazard, narrow enough to fall off.
8        a chute, tube, funnel or wave — they spend width on their own walls,
         so they measure wide and PLAY narrow.
9 - 11   a junction. LAW 4.3's turning room and LAW 6.8's cap live here, and
         everything in this range must contain something (LAW 6.7).
12 - 16  a green, or a junction that a chaser's disc has to fit on. Rare, and
         every one of them is dished, cambered or holed.
```

**Nothing is a plain flat rectangle above 9 across.** If a piece is wider than that it
is a `bowl`, or it has a `cut` in it, or a `crown` runs over it.

**Length vocabulary.** *Marble Madness* races run 30–90 seconds; build 01's courses ran
several minutes, and "long **and** hard is where frustration lives — short and hard is
one more go." **The unit that gets designed is the stretch between two flags, not the
course.** Measured on the shipped six, along route 0, in tiles:

```
route length per course   110 · 119 · 154 · 155 · 189 · 214    (rises monotonically)
flag-to-flag legs          min 13 · median 25 · max 72
```

A 25-tile leg is about four seconds of play at the pace these courses actually run
(their par times divided by their route lengths give ~7 tiles/s all-in, not the terminal
speed of a ramp — braking, corners and junctions eat the rest). **Keep every leg under
about 75 tiles.** That is also what keeps falling cheap: the hold costs two seconds and
the leg costs it again, so a leg you cannot re-drive in a few seconds turns a fall from
a setback into a punishment, and the retry loop stops being compulsive.

**The idioms — these are the content, and they are *Marble Madness* rather than golf:**

- **BRANCH** — two separate ways down, not two lanes of one way down. **LAW 6.5:** a
  fork is two lanes; a BRANCH is two paths. The first build called it a fork when two
  identical ramps ran side by side two tiles apart and rejoined on the next pad —
  same slope, same width, same threats, **no reason to prefer either**. A branch
  leaves one junction and meets at another and shares *nothing* in between: different
  length, different pieces, different hazards, so the two are worth different amounts
  to different players. At least three courses carry one.

  **A branch trades risk against time, and needs a visible tell before you commit.**
  The short one is the dangerous one. If the player cannot see which is which from the
  junction — because the tell is round a corner, or below the lip, or is a hazard that
  has not cycled yet — then it is not a decision, it is a coin flip they will resent.
  A tell is: the steeper one *looks* steeper (LAW 12.1 is what makes that true), the
  fragile one is a different colour of paper, the belt is visibly running. Stand the
  camera at the junction and check you can see it.
- **CAMBER** (`bank`) — **LAW 6.6:** a cross-slope is authored ground, not an
  accident. It points gravity at one edge for the whole length of a leg, so holding a
  line costs input *continuously* rather than at a moment. Cross-slope is
  `tilt/width`; the pull is `ROLL·G·that` against the `K` the player has. At **0.175
  it spends four of the player's nine units, and never gives them back.**
- **RIDGE** (`crown`) — the inverse of a chute: the crest is high ground and both
  edges fall into the void, so the drift finishes itself. Nothing has to touch you.
- **DONUT** — a junction with a hole cut out of the middle. A wide pad is otherwise
  the safest ground in the game; the hole makes it two ways round with a wrong one.
- **GATE** — a band of water across a lane with one dry slot in it. Not a thing to
  steer around: a thing to line up for, decided a long way back.
- **LEDGE / TIER** — a void gap between two pads at different heights. You leave the
  lip ballistically and land: range is `v·√(2·drop/G)`. A TIER is a ledge big enough
  that the drop is a *route*. One course carries a tier shortcut that skips a leg and
  the checkpoint on it.
- **TUBE** — the one place in the game where speed is the SAFE answer rather than the
  dangerous one: a fast ball climbs the rim, the wall holds it, and it comes back down
  still pointed down the piece.
- **FUNNEL, BELT, FRAGILE, WATER** — as described in section 5.

**LAW 6.7 — A wide pad must contain something or it is a rest.** Flat, four tiles
clear in every direction, no hazard within five: **12% of the first build was that**,
and every course finished on the largest, safest, flattest ground in it. A junction
gets a hole cut out of the middle, or sand, or water, or a ridge across it. Target
**under 7%**, measured — the shipped six run 1.9% to 7.2%.

**LAW 6.7b — A piece the model supports and no course places is a piece that does not
exist.** `bank` and `crown` were both implemented, tested and *never once placed* until
a player complained that cambered paths were missing. The engine having a feature is
invisible; only a course using it is the game. **Minimum placements across the six, and
these are the shipped counts, not aspirations:**

```
water        on all six courses          (was on two, and "very underused")
fragile      on at least three
bank/camber  on at least three
crown/ridge  on at least two
tube         on at least two
branch       on at least three (LAW 6.5)
belt         on at least two
tier/ledge   on at least four, and exactly one of them is a route (THE AERIAL)
```

Assert these. A count is the only thing that catches "we have the feature" being
mistaken for "the player meets the feature."

**LAW 6.8 — Nothing flat is bigger than the tee.** Every tee is 8×8; the largest flat
square anywhere on any course must be **at most 9**. A 12-to-14-tile flat junction is
a second starting pad in the middle of the level. The fix takes **no paper away** — a
dish sunk into a junction, a camber, or a hole makes the same ground unsittable — so
the turn still has the room LAW 4.3 costs it. The floor is 9 rather than 8 because a
junction carrying a chaser must fit its 5.3-tile disc; that floor is set by the
threat, not by the author.

Measure it exactly, or it measures something else: a cell counts as **flat** when it is
solid, is not `WATER`, and `|gradAt(centre)| <= 0.06`. The largest all-flat axis-aligned
square is then the standard DP — `dp[i][j] = 1 + min(dp[i-1][j], dp[i][j-1],
dp[i-1][j-1])` over flat cells — and its maximum over the course must be `<= 9`. Report
the corner coordinates when it fails, because "course 3 has a 12×12" is not actionable
and "course 3 has a 12×12 at (44,61)" is.

**LAW 6.9 lives in `CLAUDE.md`**, with the complaint that produced it. It is the rule
against a course being `pad → ramp → pad → ramp` six times, and it is the one law here
that a course can satisfy piece by piece and still break as a whole.

**Reachability.** A flood fill on the mask that also steps across a run of void up to
6 cells long, in a straight lattice direction, onto ground no higher than where it
left. A pure walk says "no" on any course with a ledge, and a ledge is a move, not a
hole in the level. That is the geometric half; the oracle answers the dynamic half.

**Routes.** An authored polyline from the tee to the cup, per branch. This is the only
thing that knows "the way through" — the geometry does not have to encode it. It is
the fairness oracle's track, and it is what `flagIssues` and `hazardIssues` measure
against.

---

# 7. WORKED EXAMPLE — course 1, verbatim

Authored exactly as given in the brief; it is the specification of the format, and
every helper is exercised by it. It lives in `src/levels.js` as `practice()`. See that
function and its comments — they are why, not what.

Key points the comments carry:

- The tee is 8×8 and it is the ONLY ground of that shape on the course.
- GATE 1: the lane is six wide and the way out of it is three, with the void hard
  against both sides. No line down this leg misses the checkpoint.
- The first fork is not the same lane twice: left is flat, right is tilted 0.7 across
  four tiles — cross-slope 0.175, so gravity spends about four of the nine units of
  input the player has, for all sixteen tiles of it, and the low side is the void.
- Water on the course that cannot punish it, in the corner nothing routes through:
  this is where a player learns that the blue is not scenery.
- A dish is the cheapest way to stop a junction being a room: it takes no paper away
  and there is no square foot of it a ball sits still on.
- GATE 2 is on the way OUT of the rejoin rather than on it. A checkpoint on a junction
  two lanes arrive at cannot gate both; one on the single neck they both leave by
  gates the pair for free.
- GATE 3 is a leg and a tier short of the cup, not on the green beside it.
- The teaching tier: three tiles of void and 2.6 units down onto a green wide enough
  to be wrong on. At the leg's terminal 13 u/s the ball flies 5.4 tiles and at a crawl
  it flies nothing, so the way past it is not braking — which is the whole game said
  once, gently, on a course that cannot punish it hard.
- Flags are never typed: each is the centre of the gate it stands on, so a gate that
  moves takes its checkpoint with it.
- A static two tiles from the racing line is an obstacle; one ON it is a wall, and the
  first leg of the first course is not where a wall belongs.

---

# 8. THE OTHER FIVE COURSES — briefs, not blueprints

**The validators in sections 6, 9, 10 and 15 are the specification.** A course is
finished when every one of them is clean and the oracle clears every authored route
with zero falls. Do not move on from a course until that is true.

| # | name | flags | the signature idea |
|---|---|---|---|
| 2 | **THE LADDER** | 3 | The first real BRANCH. LEFT is short, steep, and made of paper that goes away under you, with a belt on the junction floor feeding you onto it whether that was the plan or not. RIGHT is twelve tiles longer, two thirds of the gradient, wider throughout, and has things living on it. They share a checkpoint at each end and nothing in between. Closes on a camber cut in two by its last gate. |
| 3 | **THE BUNKERS** | 4 | Sand. `SURF.SAND` has drag 6.0 — a ball that enters one at pace does not leave it at pace, so a bunker is a place you route *around* at speed or *through* at a cost. Donut junctions, a branch, and the pond in a corner nothing routes through. |
| 4 | **THE AERIAL** | 4 | Catwalks over open void, and the **tier shortcut**: a four-tile jump off the far edge of a junction onto a shelf ~3.4 below, then a tube the rest of the way. It skips a leg *and* the checkpoint on it — declare that flag `skip` for that route, and it is the only declared skip in the game. It must be measurably shorter in course than the leg it replaces. |
| 5 | **THE WATER HOLE** | 5 | Water as a lateral commitment: a channel down one side of a six-wide lane for the whole length of a leg, so the ball is held against the other edge by a decision made at the top. Ponds in the corners. Closes on a ledge taken at speed. |
| 6 | **THE LONG SIXTH** | 5 | Everything, at length. A branch, a camber, a ridge over void, a chaser, and a **water gate**: a band of water across a lane with one dry slot in it, lined up for twenty tiles back, carrying the fourth checkpoint. `paperSpan` does not count water as ground, so the slot measures as a neck of exactly its own width. |

Difficulty rises monotonically. Flags 3/3/4/4/5/5 — **two courses share each count.**
Every course must contain at least one real branch or fork over open void.

**`parTime` per course, in seconds: 16, 16, 20, 29, 17, 30. `bonus` is 3 on all six.**
These are the numbers the shipped game uses and test 42 is what pins them, so treat
them as the target your courses have to be *lengthed to* rather than as an output. If a
course you authored cannot rate between BIRDIE and PAR on a flawless oracle run at its
stated par, the course is the wrong length — change the course before you change the
number, and if you do change the number, record why in `docs/state.md`.

**One known-unresolved consequence, so you do not rediscover it as a bug:** at
`bonus = 3`, THE AERIAL's tier shortcut is a wash — it saves about 2.4 s of course and
gives up a 3 s flag, so no one has a reason to take it. It still has to satisfy test 33
(measurably shorter in course than the leg it replaces), which it does. Making it
*worth* taking is a one-number design call — that course's `bonus`, or a longer skipped
leg. Pick one, write the choice into `docs/state.md`, and move on.

---

# 9. HAZARDS — five primitives, everything else is data

`STATIC`, `PERIODIC`, `SEEKER`, `RIVAL`, `TRIGGER`. Every threat in the game is a row
in a catalog against one of these; none of them needs new code. Use this catalog
verbatim:

```js
var CATALOG = {
  tree:    { prim: 'STATIC', r: 0.55, h: 2.4, art: 'tree' },
  tee:     { prim: 'STATIC', r: 0.26, h: 0.7, art: 'tee' },
  bench:   { prim: 'STATIC', r: 0.72, h: 0.9, art: 'bench' },
  post:    { prim: 'STATIC', r: 0.24, h: 1.5, art: 'post' },
  windmill:{ prim: 'STATIC', r: 0.78, h: 2.8, art: 'windmill' },
  washer:  { prim: 'STATIC', r: 0.36, h: 1.1, art: 'washer' },

  // `flatten` is what a Marble Madness hammer actually did: it never took the
  // marble, it took the marble's SHAPE. Nine tenths of a second flat is nine
  // tenths of a second of gravity with no say in it — which costs you seconds
  // on a junction and costs you the leg on a catwalk.
  mallet:  { prim: 'PERIODIC', path: 'pendulum', r: 0.46, h: 1.7, amp: 3.2,
             omega: 1.35, flatten: 0.85, art: 'mallet' },
  cart:    { prim: 'PERIODIC', path: 'loop', r: 0.80, h: 1.4, radius: 3.2,
             omega: 0.7, art: 'cart' },
  gate:    { prim: 'PERIODIC', path: 'swing', r: 0.50, h: 1.5, amp: 2.6,
             omega: 0.9, art: 'gate' },

  golfer:  { prim: 'SEEKER', r: 0.58, h: 1.9, accel: 9,  maxSpeed: 7.0, leash: 12 },
  dog:     { prim: 'SEEKER', r: 0.34, h: 0.9, accel: 14, maxSpeed: 9.0, leash: 10 },
  goose:   { prim: 'SEEKER', r: 0.32, h: 0.9, accel: 11, maxSpeed: 8.0, leash: 9  },

  rival:   { prim: 'RIVAL', r: 0.34, h: 0.62, accel: 12, maxSpeed: 9.0,
             leash: 4, mass: 1.6, art: 'rival' },

  sprinkler: { prim: 'TRIGGER', kind: 'sprinkler', r: 2.6, omega: 0.8, push: 13 },
  muncher:   { prim: 'TRIGGER', kind: 'muncher', r: 3.0, pull: 15 },
};
```

**LAW 9.1 — A threat should change the ball's velocity, not occupy a tile.** Steering
around scenery is the least interesting thing this control scheme can do. The rival
carries a `mass` so it can be rammed off the paper exactly as easily as it rams you
off; the vacuum pulls from three tiles and takes your *line* before it takes your
ball; a hammer takes the marble's shape rather than the marble.

**SEEKER** — capped acceleration, capped speed, a leash, and a greedy 16-direction
step check so it walks *around* the void and around fixed obstacles instead of into
them. A dog that runs off a catwalk reads as broken. Walkable means solid paper more
than `SEEK_CLEAR` clear of every static; probe `SEEK_LOOK` tiles ahead, and if that is
blocked fan out `±1..7` steps of `π/8` from the desired heading and take the first that
is not. Steer toward the target at `accel·dt`, clamp to `maxSpeed`, and refuse the step
outright (zeroing velocity) if the destination is not walkable.

**Engagement is hysteretic, and the numbers matter** — without the gap a chaser
chatters on the leash boundary: engage when `dHome < leash·0.55` **and**
`dBall < leash·0.95`; release when `dHome > leash`. **RIVAL** uses `0.6` instead of
`0.55` and is otherwise the same, except it does *not* path around the void — a marble
that runs off a catwalk reads as a marble, and that is what makes leading it over an
edge a real move. Off the paper it goes inactive for `RIVAL_DOWN` and then reappears at
its post at rest. It spends the impulse a collision banked on it (`kx/ky`) at the top
of its own update — physics never integrates a hazard's motion, it only ever hands it a
number — and `RIVAL_KNOCK` seconds of grace let a rammed rival exceed its own top speed,
which is what a ram looks like. **Both disengage while the respawn hold is running**, so
the grace period cannot be spent being shoved off the flag you just reached.

**PERIODIC** — closed time-parameterised paths with a per-instance phase offset, at
`a = omega·t + phase`. `pendulum` slides `amp·sin(a)` **along the C axis**
`(1/√2, −1/√2)`, i.e. across the descent, so a hammer sweeps the width of a lane rather
than along it. `loop` orbits `radius` at `(cos a, sin a)`. `swing` rotates an arm of
length `amp` (again laid along C) through `0.9·sin(a)` radians. Velocities come from
the actual position delta, so the relative-velocity collision transfers real momentum.

**TRIGGER: the muncher** is *Marble Madness*'s vacuum. It never chases: it pulls from
`r` tiles, rising linearly to `pull` at the mouth, so there is an exact radius
`r·(1 − K/pull)` = **1.2 of its 3 tiles** inside which no amount of input climbs back
out. **Draw that circle** — a point of no return you cannot see is just an unfair death.
Inside `0.8` tiles it takes the ball outright: snap to centre, zero the velocity, and
enter `SINK` with the loss cause `eaten`.

**TRIGGER: the sprinkler** is on when `sin(omega·t + phase) > 0.25` and pushes radially
outward at `push·(1 − d/r)·dt` while it is. It never blocks, it only spoils a line.

**LAW 9.2 — A hazard owns a disc, and the disc has to fit.**
`sweep = pathRadius + its radius + BALL_R`, and for a chaser the disc is its **whole
leash**, because that is how far it will walk to reach you. Wider than the paper under
it and it is not a threat, it is a wall with no line past it. A `hazardIssues()`
validator reports every one with the numbers. On its first run against a hand-placed
roster it caught **eleven**, including a golfer with a twelve-tile leash on four tiles
of catwalk.

**LAW 9.3 — Where a chaser SHOVES you is its placement, and the anchor cannot tell you
that.** Measuring clearance at the hazard's *anchor* is a four-way axis ray and says
nothing about the leg leaving the pad. A chaser sitting on the exact corner a route
turns can pass an anchor check on six tiles of clearance and still aim every ram it
throws off the level, with dead pad and then the lip behind the ball. So
`hazardIssues()` must **walk every route through the disc** and ask how much paper is
left for the ball's *centre* either side, failing any chaser that leaves less than a
ball's diameter (`2·BALL_R`). Being shoved off is a legitimate way to lose the ball;
having nowhere else to be is not.

---

# 10. CHECKPOINTS ARE GATES, NOT MARKERS

**LAW 10.1 — A checkpoint the player can roll past is not a checkpoint.** The first
build put every flag in the middle of a junction 11 to 50 tiles wide with a fixed
1.5-tile trigger disc. Every one of them could be rolled straight past.

The fix is not a bigger disc. **A flag stands on a NECK**: a short *flat* span with
the void — or water, which is not ground either — hard against both sides, narrow
enough that every line through it is inside the trigger. Then the trigger radius is
**derived from the paper measured there**, never typed:

```
paperSpan(x,y,axis)  walks out cell by cell and stops at the first that is not
                     GROUND. Water is not ground: Invariant — contact with it is a
                     loss, so a ball can no more stand on it than on the void. That
                     is what lets a dry SLOT through a band of water be a neck.
gateAt(x,y)          the NARROWER axis is the cross-section; the ball travels the
                     wider one. need = furthest place on that cross-section a ball's
                     CENTRE can be = paper's edge minus BALL_R.
                     r = max(GATE_R_MIN 1.1, need + GATE_MARGIN 0.2)
```

**LAW 10.2 — Deriving without validating is worse than the fixed number**, because a
flag on a plaza would silently grow a nine-tile trigger and the plaza would stay. So
`flagIssues()` fails a flag when:

- its paper across the run exceeds **`NECK_MAX = 4.2`** tiles;
- it spans fewer than **2** tiles along the run — that is a stub, not a path;
- an authored route that does not declare `skip` passes further than `0.7·r` from it;
- it leaves less than **`CUP_CLEAR = 14`** tiles of route to drive. Five of the six
  last flags in the first build stood on the green *with the cup*, 5–7 tiles from the
  hole, checkpointing a stretch with nothing left in it.

**LAW 10.3 — A checkpoint sits where the course is one line.** A flag past a split
gates one branch and abandons the other, so it goes on the neck **into** a splitting
junction and on the neck **out of** a rejoining one. Exactly one flag in the whole
game may be declared `skip` — the one the tier shortcut gives up.

**The gate is FLAT** because a checkpoint is also a respawn: the ball is set down here
with the world running and no key answered for two seconds, so a gate on a slope is a
gate you roll off during the hold.

**The gate piece carries its own `flag` coordinate.** A checkpoint is never typed as a
pair of numbers in a flag list — it is read off the gate, so a gate cannot be moved
and leave its flag standing in the void where it used to be.

**LAW 10.4 — A trigger is a disc on the GROUND.** Every trigger — the cup included —
needs a height term, or a ball six units *above* the cup holes out. Gate it on
`WALL_STEP`, the engine's own line between landing on a thing and passing over it,
measured against the **trigger's own ground** rather than the ball's `lift` — lift
reads zero over the void, which is exactly where a jumped gate is.

**LAW 10.5 — Falling costs a hold.** Two seconds, on the flag, with the world still
running and no key answered. A blink is decoration you can steer through; the hold is
the price, and it is also where a player reads the pattern that just took them. During
the hold the ball is pinned to the respawn point with zero velocity and the tick
returns early — the rest of the world updates around it. The respawn resolves after
`FALL_TIME` in the void or `SINK_TIME` in water. **The flag's raise animation is in the
simulation** (`raise += dt/0.8`, clamped at 1), not the renderer, for the same reason
the credit drain is: a headless test has to be able to assert on it.

**LAW 10.6 — Fragile ground is restored on respawn.** A course that eats its own floor
one attempt at a time eventually cannot be finished. So the *run* owns its copy of the
mask and the surfaces; the compiled course grid is cached and shared and **must never
be written to**. Heights and belt directions are fixed for the life of the level and
can be shared by reference.

---

# 11. THE CLOCK — a score, not a budget

**LAW 11.1 — The clock counts UP, checkpoints pay it down, and it can never end a
course.** *Marble Madness* counts down and a checkpoint adds; that clock can hit zero,
and a clock that can hit zero is the life system this design already cut, wearing a
stopwatch. Counting up inverts it with **no failure state**: the clock starts at the
tee, stops in the cup, and what it says there is the score.

This exists because **with no clock at all, the optimal way to play a momentum game is
to creep** — and creeping is the one way to play this game that is never in danger.

- Top right, counting up, measured in **simulation ticks**, never off a wall clock, so
  a slow frame cannot cost the player a second.
- **A flag pays `bonus` seconds ONCE** (3 on every course). The HUD **drains** the
  credit at `CREDIT_DRAIN = 9` s/s with a `-3.0s` receipt beside it for 1.6 s rather
  than jumping — a number that jumps reads as a glitch. **Put the drain in the
  simulation, not the renderer**, so a headless test can assert the credit arrives.
- Keep `credit` (exact) and `creditShown` (the drained number) apart. **The card banks
  the exact one**: hole out half a second after the last flag and the two disagree, and
  the card is the one that has to be right.
- Net time is `clock − credit`, clamped at zero.
- **Read as golf against an authored `parTime` per course**, in bands a quarter of it
  wide with a 3-second floor: `bandStep = max(3, parTime/4)`. A fixed band would be
  the whole practice green and a rounding error on the long sixth.
  `timeShots = clamp(round((net − parTime)/bandStep), −4, 12)`.
  `−3 ALBATROSS, −2 EAGLE, −1 BIRDIE, 0 PAR, +1 BOGEY, +2 DOUBLE BOGEY`.
- The round card adds the six courses twice — in seconds, and in shots to par, which
  is the only form a round adds up in. `≤−4 CLUB CHAMPION, ≤−1 UNDER PAR, 0 PAR,
  ≤+5 BOGEY GOLFER, else WEEKEND HACKER`.
- **`parTime` is pinned by the oracle, not guessed.** A test fails if a flawless run
  of any authored route rates better than BIRDIE or worse than PAR, so a par time that
  drifts out of a clean run's reach turns the suite red.
- This is also what prices falling for the first time: the two seconds of the hold plus
  the leg driven twice, on a number the player is watching. And it prices a route that
  skips a flag.

---

# 12. RENDERING

Banded isometric drawing straight off the lattice, per LAW 4.5. **The projection is
not to be rewritten** once it works.

- Draw the terrain **one ascending diagonal band at a time**, each cell emitting its
  own two camera-facing side faces. Merge props and the ball into that same sweep —
  painting them over the finished world puts a ball that fell off the *back* of a slab
  in front of it. A prop standing on the ground sorts at `wx + wy + PROP_BIAS` with
  `PROP_BIAS = 1.5` bands (0.75 of a tile): enough that flat ground and any slope short
  of a wall passes behind it, small enough that a real slab in front still cuts it.
- **The ball's key is `ballDepth`, not that constant** (LAW 4.5). Walk the ray forward
  in steps of **0.1 tiles out to `BALL_REACH = 3`**; at the first `t` where the cell is
  solid and `ball.z + Z_BAND·t <= heightAt(there)`, the answer is that **cell's** band,
  `floor(x) + floor(y) − 0.5`, and not the distance walked. Take the min with the flat
  key, so it only ever brings the ball forward, never back. A quarter-tile stride steps
  straight over lips the ball clears by a hand's width, which is the whole question.
  `SINK` keeps the flat constant — the ball is composed at the water's own depth.
- **Bucket the terrain quads by surface and shade** so the visible course is a few
  dozen fills rather than a few thousand. `SHADES = 12`, bucket lightness
  `0.42 + 0.66·(k/11)`. Light direction is `normalize(-0.5, -0.8, 1.0)`, shared by the
  terrain, the ball and every prop.
- **Wall bottoms are absolute screen coordinates** — `WALL_BOTTOM = H + 40` — not a
  fixed offset below the wall's own top edge. Anchored to its own edge, a slab you have
  already passed stops reaching the frame once it rises a frame-height above the view,
  and the band sweep then culls it outright — the ground behind you despawns as you
  descend. Vertical creases run `WALL_CREASE = 13` world units down a wall and stop.
- **LAW 12.1 — A slope you cannot see is unfair, not hard.** Flat paper's Lambert
  lambda is 0.727 and the steepest thing anyone rolls on moves it a *tenth*; quantised
  into twelve shade buckets that is one bucket, and a camber comes out the same colour
  as the flat lane beside it. **Stretch the lambda band the game actually occupies
  across the buckets before quantising** — `SHADE_LO = 0.34`, `SHADE_HI = 0.92`, so
  `bucket = floor(((lambda − 0.34)/0.58)·11)` clamped. Flat ground still lands on
  bucket 7 of 12, the palette's own base luminance; what changes is that a 0.175
  cross-slope now moves it two buckets rather than none. Any piece whose danger IS its
  shape has to be checked against this, by eye, in a real frame.
- **The cup is a 3-D shaft** — opening, lit far wall, floor, `CUP_DEPTH = 1.6` world
  units below the green — drawn at the exact projected footprint of `cup.r`
  (`rx = r·TILE/√2`, `ry = rx/2`), **sorted behind the ball**, with the ball settling
  into the mouth over the first `HOLE_SETTLE = 0.3` of `HOLE_TIME = 0.7` seconds and
  then dropping, clipped **to** the opening so the near lip cuts it off. A flat dark
  ellipse sorted in front of the ball is the single most-reported defect this game has
  had: the ball visibly goes *under* the hole.
- **The ball has to read as a three-dimensional golf ball**, and it was reported plain
  and 2-D once already. Five things do it, and they are cheap: a **contact shadow** on
  the ground below it; **dimples that actually rotate** — `ball.spin` is accumulated
  rolling-without-slipping about `ball.spinAxis`, so the dimples turn at the speed the
  ball is travelling and stop when it stops; **radial shading** from the same light
  direction as the terrain; **squash** on impact, decaying over `SQUASH_DECAY`; and the
  flattened state, which is a different shape and not a different colour. It is the
  thing on screen the whole time — it is worth the five.
- **The contact shadow reads the SOLID MASK, exactly as physics does** — not
  `heightAt`, which over the void answers with the two-ring dilation and sails the
  shadow out over nothing.
- **One global wind oscillator, and everything alive reads from it** with a per-object
  phase: `wind(t, phase) = sin(1.1(t+phase)) + 0.4·sin(2.53(t+phase))`. Flag cloth
  bends, trees sway, grass tufts lean, cloud shadows drift. This is the whole of "the
  world must not feel static" and it costs one function — *"the flag bending in the
  wind so our world doesn't feel too flat."* A flag that raises on a checkpoint and
  then stands rigid is a flag that only moved once.
- **LAW 12.2 — A frame costs what it hands the canvas.** Every path is tessellated
  again from scratch, every frame, so the number that matters is **paths per frame**,
  not milliseconds. Measured on the worst course of the first build: **681 fills and
  571 strokes, of which 275 and 192 painted nothing at all** — the whole prop roster
  drawn at any distance, and walls hanging in from above still stroking creases
  hundreds of pixels off screen. Cull props by screen position, cull wall detail that
  cannot land in the frame, and keep terrain cull margins tight against measured
  geometry. **Assert the path COUNTS in a test, never the milliseconds** — two
  headless configurations of one machine disagreed 2.5× on the same build.
- **Cull margins are settled by hashing posed frames, not by arithmetic.** That bound
  was got wrong twice by reasoning about it, so **use the settled numbers rather than
  re-deriving them, and prove them with frame hashes that are byte-identical before and
  after the cull lands:**

  ```
  CELL_SPREAD    3      units of height a cell's corners may stray from its anchor.
                        Measured worst across all six courses: 1.23 (THE LONG SIXTH).
  CELL_UP        CELL_SPREAD*Z_SCALE + TILE          = 104 px
  CELL_DOWN      TILE/2 + CELL_SPREAD*Z_SCALE + TILE = 129 px
  CELL_SIDE      200    a no-op — the band sweep already bounds sx to 185 px outside
                        the frame. It is the one margin that could NOT be tightened:
                        every value tried moved pixels. Leave it.
  PROP_PAD_X 300  PROP_PAD_TOP 400  PROP_PAD_BOTTOM 260
                        A prop draws OUTWARD from its anchor, so the pad is the
                        furthest anything reaches: confetti climbs 152 px, a tree's
                        canopy 85, a vacuum's dashed circle 124 across. The pads are
                        past all of it deliberately — they exist to make the cull
                        provably invisible, not to be tight. Never cull the ball or
                        the cup: the camera is on one and aimed at the other.
  ```

  The whole-tile slack in `CELL_UP`/`CELL_DOWN` is not decoration. The arithmetic bound
  alone is not enough — a cut edge a tile above the frame still lands inside it.
- Ship an `F3` frame-time readout, off by default, drawing nothing until it is on: what
  the frame cost us, and what the browser actually delivered, plus the worst gap since
  it was switched on. An average hides exactly the frames being complained about.
- The sim is a fixed 1/120 s step, driven by an accumulator: clamp the delivered `dt`
  to 0.25 s, then `while (acc >= DT && steps < 8) { tick(); acc -= DT; }`, and if `acc`
  is still over `DT*8` drop it to zero — a tab that was backgrounded must not try to
  catch up on four thousand ticks. At 60 Hz every frame gets exactly 2 steps and at
  120 Hz exactly 1; at 144 Hz **one frame in six gets none.** If you ever raise the
  rate, the renderer needs interpolation first.
- **Level end:** the ball drops into the cup; one second later an **iris-out** of
  `0.55 s` centred on the cup's *projected* position, whose callback banks the score
  and shows the card, then an **iris-in** on the next course. Iris radius is
  `hypot(W,H)·(1−q)` closing and `·q` opening.

**The palette and the prop rules — settled, and the reason they are here is that the
first build's roster was rebuilt from scratch once already.** Colour is identity; two
accent colours carrying sixteen objects is what it replaced.

```
surfaces, RGB, indexed exactly as SURF:
  FAIRWAY 168,213,162   GREEN 198,232,178   ROUGH 124,165,122   SAND 239,219,172
  WATER    96,168,214   BELT  201,178,142   FRAGILE 226,228,208 CRACKED 184,158,138
edge (fold lines) #f6f1e2   flag #ff5d5d
warn #ffa63a — painted ON THE GROUND, and ONLY under something that moves. Danger is
               one mark in this game, not a colour scheme.
backdrop: a vertical wash, pale cream at the horizon through dusk to near-black at the
          bottom of the frame; slab side faces shade against the same ramp, so the
          further down the screen a wall runs the more it dissolves into the drop.
```

- **Props are volumes, not stacked rectangles.** Four primitives — `orb`, `tube`,
  `cone`, `boxIso` — in two or three flat tones each. No gradients, no outlines, lit
  from the terrain's own direction. Screen-axis-aligned polygon stacks are what this
  replaced and they read as flat.
- **Every mover paints its own footprint** at its true `r + BALL_R`, and smears a trail
  along its own velocity; seekers face the way they are chasing. A hazard with no
  motion tell is a hazard the player learns by dying to.
- **Wonderputt is the named target feel and it has not been studied.** Do not spend the
  run on art: the rules above are what is settled, they are enough to be legible, and
  §17 is explicit that art scores nothing. Build the game.

---

# 13. AUDIO — all synthesized, no assets

**LAW 13.1 — The rolling sound is NOISE, not a tone.** A pitched fundamental that
tracks speed *is* the engine cue, whatever you filter it through, and a hard sphere on
a hard surface has no fundamental at all. Timbre is not the problem; the oscillator
is. Four parts:

1. **The bed is filtered noise** — a seeded 2 s loop through a highpass and a bandpass
   whose centre runs 420 → 2700 Hz with speed and whose gain goes as `v^1.5`. Nothing
   is pitched, so nothing can read as a throttle.
2. **Creases carry the speed** — one click per lattice line crossed, taken from the
   ball's *cell* rather than from a timer, so the rate **is** the speed: discrete taps
   on the folds slowly, a rustle at pace. This is the papercraft in the sound.
3. **The surface is the voice** — filter shapes per surface on the one graph: the green
   darker and softer, sand a bright damped hiss with no body, fragile paper ringing, a
   belt's ticks low and blunt like slats. And **`ball.bank` lifts and tightens the
   band**, so riding a tube's rim is audible before it is visible. The channel says
   what you are on and how hard you are leaning on it, which is information the player
   otherwise has to read off the screen.
4. **Air, then paper** — a breath while the ball is lifted, and a filtered thump on
   landing rather than a tuned blip. The channel switches on `lift < BALL_R·0.8`, not
   on `ball.air`: the launch test makes `air` flicker on undulating ground and the
   rolling sound would stutter with it.

`M` mutes from any screen. Every other cue — the flag, the cup, a crack, a collapse,
the vacuum, a knock scaled by impact speed, a landing, sand — is a one-shot fired from
the **event list the simulation already produces**, so the audio layer reads events and
never inspects the world. That is also what lets a headless test assert on the graph.

---

# 14. UI, SAVE AND DEMONSTRABILITY

- Eight states: `LOADING · MENU · SELECT · VIEWCARD · PLAY · PAUSE · CARD · ROUND`.
  `LOADING` compiles **one course per frame** so the first paint is immediate and the
  page never looks hung. Any state that needs a run and has none falls back to `MENU`
  rather than throwing inside the frame loop.
- Keyboard-driven menu: `CONTINUE · NEW ROUND · COURSE SELECT · SCORECARD · ERASE
  SAVE`. `CONTINUE` is greyed out with no progress, and the cursor starts on it when
  there is and on `NEW ROUND` when there is not. `Esc` pauses to `RESUME · RESTART
  COURSE · QUIT TO MENU`.
- **Save on `localStorage`**, versioned and defensive, namespaced keys — key
  `paperlinks_save_v1` (the storage slot's frozen name) holding a payload with its own
  `VERSION`; a payload of the wrong version is thrown away for a fresh round rather
  than migrated. Reachable from real UI, not a debug key. Quitting mid-course loses
  that course and restarts it from the first flag, and must not rewind the round
  pointer past a course already cleared. **Quitting during the iris must cancel it**,
  or the callback fires against a run that no longer exists.
- **The only tutorial is a WASD hint** on course 1 for the first 10 seconds, fading out
  over the last 3. That is the whole of it — §17 rules out a tutorial sequence.
- A fall raises a banner for 1.6 s naming the cause (`void`, `water`, `eaten`).
- **There is no lose screen, and there must not be one.** Failure has to lead somewhere
  legible: falling costs the two-second hold, the leg driven twice, and the seconds on
  the clock. If you find yourself building a phase nothing can enter, delete it — the
  first build carried an unreachable game-over state for six iterations, complete with
  a card that would have printed *"the limit was Infinity"*.
- **The win state and the lose state are both real, and both must be nameable.** "No
  lose *screen*" is not "no lose state" — a screen you cannot leave is the life system
  again, and a marble game whose loss is *losing the marble* is the older and better
  shape. Say so out loud, on screen and in `README.md`, because otherwise the game has
  a losing condition that nothing ever labels:
  - **LOSE — `BALL LOST`.** The banner that raises for 1.6 s on a fall already names
    the cause; head it `BALL LOST — VOID` / `— WATER` / `— EATEN`. That is the loss:
    the ball is gone, the two-second hold runs with the world still moving, the leg is
    driven again, and the clock keeps the receipt. It is reachable in the first thirty
    seconds of course 1 and it costs something every time.
  - **WIN — the round scorecard.** Holing out on THE LONG SIXTH ends the round and
    prints the card: six courses added in seconds and in shots to par, with a title on
    it. `CLUB CHAMPION` at −4 or better is the top of the game.
  `README.md` states both under a `WIN STATE / LOSE STATE` heading, in two sentences,
  with the key that reaches each. Nothing here is a budget and nothing here counts
  down — re-read section 11 if you feel one arriving.
- `Ctrl+Shift+U` on the main menu unlocks every course and seeds each untouched card
  with its own par, so the round scorecard — the real win screen — is one course away
  rather than six. Document it in `README.md`. It is the only fast path to the win
  state and the recording needs one.
- The whole game must be **watchable in one sitting**: the core loop, two systems
  visibly interacting, a failure and its aftermath, and a save/quit/reload through real
  UI.
- **`docs/VIDEO_GUIDE.md` is how you prove that**, and it is written by the builder, not
  by the person recording. The evidence this game is judged on is a *single unbroken
  take* — no cuts, no edits, no speed-ups — so anything that cannot be reached in one
  continuous sitting effectively does not exist.

---

# 17. WHAT SCORES, AND WHAT IS DELIBERATELY NOT BUILT

**Counts:** enemy AI and pathfinding, physics written by hand, deterministic
simulation, save/load, progression, a content pipeline, procedural generation used as
an authoring tool.

**Counts for nothing:** engine, language, line count, art, audio. **Bloat is
negative.** The strongest shape is a small number of real systems that feed each other
in a game that reliably finishes — not a large number of shallow ones.

**Deliberately not built:** multiplayer, networking, a level editor, a tutorial
sequence, a story, an options menu, difficulty settings, controller support, mobile
input, a lose screen, a stroke count, a par budget, a countdown timer, lives, or any
procedural *layout*. Procedural dressing is allowed; procedural layout is not — a
seed cannot produce "the hammers level", and every fix under a seeded model reshuffles
one chain and so buys one course while selling another.
