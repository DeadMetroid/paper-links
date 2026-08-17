# PAPER LINKS

An isometric momentum game in the lineage of *Marble Madness*, themed as a papercraft
miniature golf course. You are the ball. Six authored courses descend toward the camera
down narrow slabs of folded paper suspended over an abyss.

`WASD` apply **acceleration, never velocity**. The whole game is the fight between
where you want to be and where your momentum is taking you.

**The game teaches one skill: BRAKE EARLY, TURN LATE.** Every course is that sentence
at a rising tempo.

There are no lives, no strokes, and no budget of any kind. Nothing can end a course
except the cup.

---

## RUN IT

**Double-click `game.html`.** That is the whole install.

It runs from `file://` with no server, no build step, and no dependencies — one
self-contained HTML file, Canvas 2D and vanilla JS.

## RUN THE TESTS

```
node tests/run.js
```

52 tests, all driving the real simulation headlessly under Node. No browser required.

To rebuild `game.html` from `src/*.js` after editing a source file:

```
node build.js
```

`game.html` is committed and is the deliverable — a player never runs the build.

---

## WIN STATE / LOSE STATE

**WIN — the round scorecard.** Holing out on the sixth course, THE LONG SIXTH, ends the
round and prints the card: all six courses added twice, in seconds and in shots to par,
with a title on it — `CLUB CHAMPION` at four under or better. Reach it by holing out on
course 6; from the main menu, `Ctrl+Shift+U` unlocks every course so it is one course
away rather than six.

**LOSE — `BALL LOST`.** Rolling off the paper, touching water, or being taken by a
muncher loses the ball: a banner names the cause (`VOID` / `WATER` / `EATEN`), a
two-second hold runs with the world still moving around you, the ball respawns at the
last flag, you drive the leg again, and the clock keeps the receipt. It is reachable in
the first thirty seconds of course 1 by steering off the first ramp, and it costs
something every time. There is no lose *screen* and there must not be one — the loss is
losing the marble, which is the older and better shape.

---

## CONTROLS

| key | what it does |
|---|---|
| `W` `A` `S` `D` / arrow keys | accelerate — screen-relative, never velocity |
| `Esc` | pause → `RESUME` / `RESTART COURSE` / `QUIT TO MENU` |
| `Enter` / `Space` | confirm on any menu |
| `↑` `↓` | move the menu cursor |
| `M` | mute, from any screen |
| `F3` | frame-time readout (off by default) |
| `Ctrl+Shift+U` | on the main menu: unlock every course |

`Ctrl+Shift+U` is the only fast path to the win state and it exists so the game can be
demonstrated in one sitting.

---

## THE CLOCK

The clock counts **up**, in simulation ticks, from the tee. Every checkpoint pays three
seconds back off it, once. It can never end a course — it is a score, not a budget.

Net time is read as golf against each course's authored par, in bands a quarter of par
wide: `ALBATROSS · EAGLE · BIRDIE · PAR · BOGEY · DOUBLE BOGEY`.

---

## WHAT IS IN HERE

```
game.html            the deliverable — open this
build.js             concatenates src/*.js into game.html
src/                 the sources: tuning, heightfield, physics, level, levels,
                     hazards, render, audio, game, ui, save, main
tests/run.js         the 52-test acceptance suite
docs/spec.md         the systems in full
docs/state.md        build state and every measured number
docs/FLOOR.md        the contest floor as a checklist
docs/VIDEO_GUIDE.md  a numbered running order for a single unbroken take
ASSETS.md            all procedural, none third-party
CLAUDE.md            the laws this build is held to
```

## ASSETS

All procedural, none third-party. Every visual is Canvas 2D, every sound is WebAudio.
See `ASSETS.md`.
