# PAPER LINKS



An isometric momentum game in the lineage of *Marble Madness*, themed as a papercraft
miniature golf course. You are the ball. Six authored courses descend toward the camera
down narrow slabs of folded paper suspended over an abyss.

`WASD` apply **acceleration, never velocity**. The whole game is the fight between where
you want to be and where your momentum is taking you.

**It teaches one skill, and you can say it out loud: BRAKE EARLY, TURN LATE.** Every
course is that sentence at a rising tempo.

There are no lives, no strokes, and no budget of any kind. Checkpoint-only: the last flag
reached is the respawn. **Nothing in the game can end a course except the cup.**

---
**Gameplay video (one unbroken take):** https://youtu.be/87RNzYdan48?si=EfRf_0CxxyG0Tj5I
## RUN IT

**Double-click `game.html`.** That is the whole install.

It runs from `file://` with no server, no build step and no dependencies — one
self-contained HTML file, Canvas 2D and vanilla JS, 150 KB.

## RUN THE TESTS

```
node tests/run.js
```

**52 tests**, every one driving the real simulation headlessly under Node. No browser
required, no network, nothing to install.

```
node tests/mutate.js          break the code on purpose and check the suite notices
node build.js                 rebuild game.html from src/*.js
```

`game.html` is committed and **is** the deliverable — a player never runs the build.
Test 20 hashes the six courses out of `game.html` and compares them against `src/`, so the
thing you open is provably the thing the suite tested.

---

## WIN STATE / LOSE STATE

**WIN — the round scorecard.** Holing out on the sixth course, THE LONG SIXTH, ends the
round and prints the card: all six courses added twice — in seconds and in shots to par —
with a title on it. `CLUB CHAMPION` at four under or better. Reach it by holing out on
course 6; from the main menu, **`Ctrl+Shift+U`** unlocks every course so it is one course
away rather than six.

**LOSE — `BALL LOST`.** Rolling off the paper, touching water, or being taken by a muncher
loses the ball: a banner names the cause (`VOID` / `WATER` / `EATEN`), a **two-second
hold** runs with the world still moving around you, the ball respawns at the last flag, you
drive the leg again, and the clock keeps the receipt. It is reachable in the first thirty
seconds of course 1 by steering off the opening ramp, and it costs something every time.

There is no lose *screen* and there must not be one. The loss is losing the marble, which
is the older and better shape.

---

## CONTROLS

| key | what it does |
|---|---|
| `W` `A` `S` `D` / arrow keys | accelerate — screen-relative, never steer |
| `Esc` | pause → `RESUME` / `RESTART COURSE` / `QUIT TO MENU` |
| `Enter` / `Space` | confirm on any menu |
| `↑` `↓` | move the menu cursor |
| `M` | mute, from any screen |
| `F3` | frame-time readout (off by default) |
| `Ctrl+Shift+U` | on the main menu: unlock every course |

`Ctrl+Shift+U` is the only fast path to the win state and exists so the game can be
demonstrated in one sitting.

---

## THE CLOCK

The clock counts **up**, in simulation ticks, from the tee. Every checkpoint pays three
seconds back off it, once, draining rather than jumping. It can never end a course — it is
a score, not a budget.

Net time is read as golf against each course's authored par, in bands a quarter of par
wide: `ALBATROSS · EAGLE · BIRDIE · PAR · BOGEY · DOUBLE BOGEY`. The round adds up in
shots, which is the only form a round adds up in.

## THE SIX COURSES

| # | name | flags | par | the idea |
|---|---|---|---|---|
| 1 | PRACTICE GREEN | 3 | 16 s | the ball keeps going, the gap is not floor, an edge is a move |
| 2 | THE LADDER | 3 | 16 s | a branch: paper that goes away, or the long way round |
| 3 | THE BUNKERS | 4 | 20 s | sand, three ways — round it, through it, or thread the dry line |
| 4 | THE AERIAL | 4 | 29 s | catwalks over void, and a tier shortcut that skips a checkpoint |
| 5 | THE WATER HOLE | 5 | 18 s | water as a lateral commitment, held for a whole leg |
| 6 | THE LONG SIXTH | 5 | 30 s | everything, at length, and a water gate with one dry slot |

A clean run of all six is about **110 seconds** of play. It is not meant to be clean on a
first playthrough.

---

## WHAT IS IN HERE

```
game.html            the deliverable — open this
build.js             concatenates src/*.js into game.html
src/                 tuning · heightfield · physics · level · hazards · levels
                     audio · render · save · game · ui · main
tests/run.js         the 52-test acceptance suite
tests/mutate.js      56 mutations; every test falsified on purpose at least once
tests/oracle.js      the fairness oracle — drives every authored route with keyboard input
tests/map.js         an ASCII map of any course, plus every validator, plus the oracle
tests/why.js         where the oracle lost the ball, and to what
tests/playthrough.js all six courses played in a real browser through the real key path
tests/walk.js        the video running order, driven and captured beat by beat
tests/shots.js       posed frames off the shipped artifact, hashed
tests/sheets.js      the gate sheet and the prop sheet
docs/spec.md         the systems in full
docs/state.md        build state, every measured number, and every decision taken
docs/FLOOR.md        the contest floor as a checklist
docs/VIDEO_GUIDE.md  a numbered running order for a single unbroken take
ASSETS.md            all procedural, none third-party
CLAUDE.md            the laws this build is held to
```

The browser harnesses need `puppeteer-core` (`npm install`), which downloads no browser of
its own and is pointed at an installed Chrome or Edge. **Nothing in `tests/` is part of the
game**, and `game.html` depends on none of it.

## ASSETS

All procedural, none third-party. Every visual is drawn with Canvas 2D and every sound is
synthesized with WebAudio. There is no asset file in this repository and the artifact makes
no network request of any kind — test 21 scans the built file and fails if one appears.
See `ASSETS.md`.
