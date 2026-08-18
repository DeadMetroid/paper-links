# VIDEO GUIDE — a single unbroken take

No cuts, no edits, no speed-ups. **Target 5 minutes; hard ceiling 6.** Every line names the
key pressed and what appears on screen. The order never needs a restart, and there are two
marked places to cut it short if the run goes badly.

Every beat below has been walked end to end against the shipped `game.html` from `file://`
— `node tests/walk.js` drives exactly this order and writes a frame per beat to
`tests/_out/walk-*.png`. Run it once before recording if you want to see what each beat
looks like.

**Before you start:** open `game.html`, press `ERASE SAVE` on the menu, and close the tab.
The take begins from a clean save so `CONTINUE` starts greyed out.

---

## 0:00 — Boot from `file://`

1. **Double-click `game.html`.** No server, no install, no build step. Let the title sit
   for two seconds: `PAPER LINKS` over `BRAKE EARLY, TURN LATE`, with `CONTINUE` greyed
   out because there is no save.
2. Press **`↓`** to `NEW ROUND`, then **`Enter`**. The iris opens on PRACTICE GREEN.

## 0:10 — The core loop, thirty seconds of it

3. Play the first leg with **`W A S D`**. Say out loud what the hint on screen says: the
   keys are acceleration, not steering. Let the ball run down the ramp and *deliberately
   over-brake into the first gate* so the fight with momentum is visible.
4. Take the **first checkpoint** (the three-tile gate at the end of the opening ramp).
   Watch for all three of: the flag raising, the green **`-3.0s`** receipt beside the
   clock, and the clock **draining** rather than jumping.
5. At the junction, take the **right-hand lane** — the cambered one. It is tilted 0.175
   across four tiles, so holding it costs input for its whole length. Drift toward the low
   edge on purpose and recover.

## 1:00 — A loss and its aftermath  *(the required beat)*

6. On the way down, **hold one key into the void** and lose the ball.
   - **`BALL LOST — VOID`** raises for 1.6 s and names the cause.
   - The **two-second hold** runs with the world still moving behind it — the hammer on
     the next course keeps swinging through it; here the flag cloth keeps moving in the
     wind.
   - The ball comes back **at the last flag**, not at the tee.
   - The **clock keeps the receipt**: it never stopped, and the leg has to be driven again.
   Say the sentence: *there is no lose screen; losing the marble is the loss, and it costs
   two seconds and a leg.*
7. Drive the leg again and hole out on the practice green. Watch the ball **settle into the
   cup shaft** — the near lip cuts it off — then the iris closes and the **course card**
   prints TIME, CHECKPOINTS, NET, PAR and the rating.

## 2:00 — Save, quit, reload  *(the required beat)*

8. Press **`Enter`** on the card to bank it, then **`Esc`** on the next course, **`↓ ↓`**
   to `QUIT TO MENU`, **`Enter`**.
9. **Close the browser tab entirely.** Reopen `game.html` from `file://`.
10. The menu comes back with **`CONTINUE` live and the cursor already on it**. Press
    **`Enter`**: the round resumes on course 2 with course 1 banked. All of it through real
    UI — no debug key, no console.

> **CUT-SHORT POINT A.** If the take is running long or has gone badly, stop here: boot,
> core loop, a checkpoint, a loss and its aftermath, and a save/quit/reload are all done.

## 2:40 — Two named systems visibly interacting  *(the required beat)*

11. **`Esc` → `QUIT TO MENU`**, then on the menu press **`Ctrl+Shift+U`**. A toast reads
    `ALL COURSES UNLOCKED`. Choose **`COURSE SELECT`**, press **`↓`** five times to
    **`6 THE LONG SIXTH`**, **`Enter`**.
12. Drive to the long straight lane above the water gate. **The pair to name is
    THE VACUUM and THE WATER GATE**, and they are about twenty tiles apart on purpose:
    - the **water gate** is a band of water across the whole lane with one three-tile dry
      slot in it, carrying the fourth checkpoint. You line the slot up from a long way
      back — that is the whole point of it;
    - the **vacuum** sits in the middle of that lane with its point of no return drawn on
      the ground as a dashed orange circle. It never chases. It pulls, and what it takes
      first is your *line*.
    Drive the lane deliberately close to the vacuum so it drags you sideways, then fight
    back onto the slot. Do it twice: once making the slot, once missing it into the water
    so `BALL LOST — WATER` shows the second cause.
13. Immediately below the gate: **THE RIVAL MARBLE**, the pink one. It is the only threat
    in the game you beat rather than avoid, because it carries a mass and the collision is
    a two-body impulse **both ways**. Let it ram you toward the edge, then turn and ram it
    back — on a seven-wide catwalk one of you goes off. If it does, it lies down for
    2.6 seconds and reappears at its post.

    *(If the rival will not cooperate on the day, the vacuum-and-water-gate pair in step 12
    is on its own a complete "two systems interacting" beat — name that one instead.)*

## 4:00 — The win state  *(the required beat)*

14. **`Esc` → `QUIT TO MENU`**. Choose **`COURSE SELECT`**, **`6 THE LONG SIXTH`**,
    **`Enter`**, and hole out. The course card prints, **`Enter`**, and the round is over.
15. **`ROUND COMPLETE`**: all six courses added twice — in seconds and in shots to par —
    with the title underneath. `CLUB CHAMPION` at four under or better.

> **CUT-SHORT POINT B.** If step 13 is eating the clock, skip straight from 12 to 14. The
> vacuum/water-gate pair already satisfies the two-systems beat.

## Optional tail, if there is time

16. **`F3`** during play: what the frame cost us, what the browser delivered, the worst gap
    since it was switched on, and the paths handed to the canvas. **`M`** mutes.
17. `SCORECARD` from the menu shows the same card at any time.

---

## What each required beat is, in one line

| beat | where in this order |
|---|---|
| opens from `file://`, no server | step 1 |
| core loop playable and legible | steps 3–5 |
| two named systems visibly interacting | steps 12–13 — **THE VACUUM and THE WATER GATE**, then **THE RIVAL and the void** |
| a loss and its aftermath | step 6 |
| save, quit the browser, reload, `CONTINUE` | steps 8–10 |
| WIN state reachable | steps 14–15 |
| LOSE state reachable and named | step 6, and again at step 12 with `— WATER` |
