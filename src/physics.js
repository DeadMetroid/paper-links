// PHYSICS — a rolling solid sphere on a bilinearly interpolated heightfield.
// Fixed timestep, semi-implicit Euler, fully deterministic, no wall clock anywhere.
//
// Nothing in this file reads the renderer, the DOM, or Date. It is driven headlessly by
// the suite and by the fairness oracle, and rendering is never proof.

var _g0 = [0, 0], _g1 = [0, 0];   // scratch, so the tick allocates nothing

function newBall(x, y, z) {
  return {
    x: x, y: y, z: z, vx: 0, vy: 0, vz: 0,
    air: false, lift: 0, state: ST.ROLL,
    spin: 0, spinAxis: [1, 0],
    squash: 0, flat: 0, bank: 0, impact: 0,
    fallT: 0, sinkT: 0, cause: null,
  };
}

function newRun(course, routeIdx) {
  var g = forkGrid(course.grid);
  var sz = heightAt(g, course.start.x, course.start.y);
  var run = {
    course: course,
    grid: g,
    routeIdx: routeIdx | 0,
    t: 0,                 // simulation time; hazard phases read this
    clock: 0,             // counts UP from the tee (LAW 11.1). Never a budget.
    credit: 0,            // exact seconds paid back by checkpoints
    creditShown: 0,       // the drained display number — the card banks the exact one
    receipt: 0,           // seconds left on the "-3.0s" receipt
    receiptVal: 0,
    falls: 0,
    holdT: 0,             // RESPAWN_HOLD counting down; input is not answered
    banner: null,         // { cause, t } — BALL LOST, and what took it
    flagsHit: [],
    flagRaise: [],
    spawn: { x: course.start.x, y: course.start.y, z: sz },
    bodies: [],
    cracks: [],
    events: [],
    holeT: 0,
    ball: newBall(course.start.x, course.start.y, sz),
  };
  for (var i = 0; i < course.flags.length; i++) { run.flagsHit.push(false); run.flagRaise.push(0); }
  buildBodies(run);
  return run;
}

function emit(run, kind, a, b) { run.events.push({ kind: kind, a: a, b: b }); }

function clampSpeed(b) {
  var s2 = b.vx * b.vx + b.vy * b.vy;
  if (s2 > MAX_SPEED * MAX_SPEED) {
    var k = MAX_SPEED / Math.sqrt(s2);
    b.vx *= k; b.vy *= k;
  }
}

function enterFall(run, cause) {
  var b = run.ball;
  if (b.state !== ST.ROLL) return;
  b.state = ST.FALL; b.fallT = 0; b.cause = cause;
  run.banner = { cause: cause, t: BANNER_TIME };
  emit(run, 'lost', cause);
}

function enterSink(run, cause) {
  var b = run.ball;
  if (b.state !== ST.ROLL) return;
  b.state = ST.SINK; b.sinkT = 0; b.cause = cause;
  run.banner = { cause: cause, t: BANNER_TIME };
  emit(run, cause === 'eaten' ? 'eaten' : 'splash', cause);
}

// LAW 10.6 — fragile ground is restored on respawn. A course that eats its own floor one
// attempt at a time eventually cannot be finished.
function respawn(run) {
  var b = run.ball, c = run.course;
  run.falls++;
  run.grid.solid.set(c.grid.solid);
  run.grid.surf.set(c.grid.surf);
  run.cracks.length = 0;
  b.x = run.spawn.x; b.y = run.spawn.y; b.z = run.spawn.z;
  b.vx = b.vy = b.vz = 0;
  b.state = ST.ROLL; b.air = false; b.lift = 0; b.flat = 0;
  b.squash = 0; b.fallT = 0; b.sinkT = 0; b.impact = 0;
  run.holdT = RESPAWN_HOLD;
  emit(run, 'respawn');
}

// LAW 10.4 — a trigger is a disc on the GROUND. Gate it on WALL_STEP against the
// TRIGGER'S OWN ground, never on the ball's lift: lift reads zero over the void, which is
// exactly where a jumped gate is.
function triggerHit(run, tx, ty, tr) {
  var b = run.ball;
  var dx = b.x - tx, dy = b.y - ty;
  if (dx * dx + dy * dy > tr * tr) return false;
  return b.z <= heightAt(run.grid, tx, ty) + WALL_STEP;
}

// LAW 5.5 — collision is relative-velocity, and a collider with a `mass` is a two-body
// impulse. Everything WITHOUT a mass is the world: an infinite mass that takes nothing
// back. This one branch is the entire rival marble.
function collideBodies(run) {
  var b = run.ball, list = run.bodies;
  for (var i = 0; i < list.length; i++) {
    var c = list[i];
    if (!c.active || !c.bumps) continue;    // a TRIGGER is a field, not a body
    if (b.z > c.z + c.h) continue;          // a collider only bites when the ball can meet it
    var dx = b.x - c.x, dy = b.y - c.y;
    var rr = c.r + BALL_R;
    var d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) continue;
    var d = Math.sqrt(d2);
    var nx, ny;
    if (d < 1e-9) { nx = 1; ny = 0; d = 1e-9; } else { nx = dx / d; ny = dy / d; }

    var hasMass = typeof c.mass === 'number';
    var share = hasMass ? c.mass / (c.mass + 1) : 1;

    var rel = (b.vx - c.vx) * nx + (b.vy - c.vy) * ny;
    if (rel < 0) {
      var J = -(1 + E) * rel * share;
      b.vx += J * nx; b.vy += J * ny;
      if (hasMass) {
        // Banked, not integrated: physics never moves a hazard, it only hands it a number.
        c.kx -= J * nx / c.mass; c.ky -= J * ny / c.mass;
        c.knock = RIVAL_KNOCK;
      }
      emit(run, 'knock', -rel);
    }
    var pen = rr - d;
    b.x += nx * pen * share; b.y += ny * pen * share;
    if (hasMass) { c.x -= nx * pen * (1 - share); c.y -= ny * pen * (1 - share); }

    if (c.flatten && b.flat <= 0) {
      b.flat = c.flatten; b.squash = 1;
      emit(run, 'flatten');
    }
  }
}

function tick(run, ix, iy) {
  var b = run.ball, g = run.grid, c = run.course;

  run.t += DT;
  if (b.state !== ST.HOLED) run.clock += DT;

  // The credit drain is in the SIMULATION, not the renderer, so a headless test can
  // assert the credit arrives (LAW 11.1). A number that jumps reads as a glitch.
  if (run.creditShown < run.credit)
    run.creditShown = Math.min(run.credit, run.creditShown + CREDIT_DRAIN * DT);
  if (run.receipt > 0) run.receipt -= DT;
  if (run.banner) { run.banner.t -= DT; if (run.banner.t <= 0) run.banner = null; }

  // The flag's raise animation is in the simulation for the same reason (LAW 10.5).
  for (var i = 0; i < run.flagRaise.length; i++)
    if (run.flagsHit[i] && run.flagRaise[i] < 1)
      run.flagRaise[i] = Math.min(1, run.flagRaise[i] + DT / FLAG_RAISE);

  for (var q = run.cracks.length - 1; q >= 0; q--) {
    var cr = run.cracks[q];
    cr.t -= DT;
    if (cr.t <= 0) { g.solid[cr.k] = 0; run.cracks.splice(q, 1); emit(run, 'collapse'); }
  }

  // Hazards keep moving during a respawn hold — that hold is also where a player reads
  // the pattern that just took them.
  stepBodies(run);

  if (b.state === ST.HOLED) { run.holeT += DT; return; }

  if (run.holdT > 0) {
    run.holdT -= DT;
    b.x = run.spawn.x; b.y = run.spawn.y; b.z = run.spawn.z;
    b.vx = b.vy = b.vz = 0; b.air = false; b.lift = 0;
    return;                                   // the rest of the world updates around it
  }

  if (b.state === ST.SINK) {
    b.sinkT += DT;
    b.z -= SINK_RATE * DT;
    b.vx *= 0.88; b.vy *= 0.88;
    b.x += b.vx * DT; b.y += b.vy * DT;
    if (b.sinkT >= SINK_TIME) respawn(run);
    return;
  }

  if (b.state === ST.FALL) {
    b.fallT += DT;
    b.vz -= G * DT;
    b.z += b.vz * DT;
    // LAW 5.4 — the wall rule still applies here. A falling ball with no mask test
    // drifts up to 64 units INSIDE solid paper.
    var fdx = b.vx * DT * FALL_DRIFT, fdy = b.vy * DT * FALL_DRIFT;
    if (wallAt(g, b.x + fdx, b.y, b.z)) b.vx = -E * b.vx; else b.x += fdx;
    if (wallAt(g, b.x, b.y + fdy, b.z)) b.vy = -E * b.vy; else b.y += fdy;
    if (b.fallT >= FALL_TIME) respawn(run);
    return;
  }

  // ---- the rolling tick, in order -------------------------------------------
  var im = Math.hypot(ix, iy);
  if (im > 1) { ix /= im; iy /= im; }

  var onPaper = solidAt(g, b.x, b.y) === 1;                  // the MASK, never the height
  var h = onPaper ? heightAt(g, b.x, b.y) : b.z;
  var gx = 0, gy = 0;
  if (onPaper) { gradAt(g, b.x, b.y, _g0); gx = _g0[0]; gy = _g0[1]; }
  var contact = onPaper && (!b.air || (b.z - h) <= CONTACT);

  if (b.flat > 0) { b.flat -= DT; ix = 0; iy = 0; b.squash = 1; }

  var ax, ay;
  if (!contact) {
    ax = K * AIR_INPUT * ix; ay = K * AIR_INPUT * iy;
    b.vz -= G * DT;
  } else {
    var drag = MU * surfDragAt(g, b.x, b.y) * (b.flat > 0 ? FLAT_DRAG : 1);
    ax = -ROLL * G * gx + K * ix - drag * b.vx;
    ay = -ROLL * G * gy + K * iy - drag * b.vy;
    if (surfAt(g, b.x, b.y) === SURF.BELT) {
      // Only the component ALONG the belt, closing the gap to BELT_SPEED and no
      // further — a conveyor, not a hill. A ball already faster is never slowed by it.
      flowAt(g, b.x, b.y, _g1);
      var along = b.vx * _g1[0] + b.vy * _g1[1];
      var need = (BELT_SPEED - along) / BELT_SPEED;
      if (need > 0) {
        var m = BELT_ACC * Math.min(1, need);
        ax += _g1[0] * m; ay += _g1[1] * m;
      }
    }
  }

  b.vx += ax * DT; b.vy += ay * DT;
  clampSpeed(b);

  var vzSurface = gx * b.vx + gy * b.vy;                     // rate the ground falls away
  var sp = Math.hypot(b.vx, b.vy);
  b.bank = sp > 1e-6 ? Math.abs(b.vx * gy - b.vy * gx) / sp : 0;   // gradient ACROSS travel

  var nx2 = b.x + b.vx * DT, ny2 = b.y + b.vy * DT;

  // TIER WALL (LAW 5.4) — paper standing more than WALL_STEP above an airborne ball is a
  // cliff beside it, not ground it is about to land on.
  if (!contact) {
    if (wallAt(g, nx2, ny2, b.z)) {
      var blx = wallAt(g, nx2, b.y, b.z);
      var bly = wallAt(g, b.x, ny2, b.z);
      if (blx) { nx2 = b.x; b.vx = -E * b.vx; }
      if (bly) { ny2 = b.y; b.vy = -E * b.vy; }
      if (!blx && !bly) {          // caught the corner diagonally: undo both, reflect both
        nx2 = b.x; ny2 = b.y; b.vx = -E * b.vx; b.vy = -E * b.vy;
      }
    }
  }
  b.x = nx2; b.y = ny2;
  if (!contact) b.z += b.vz * DT;

  var onPaperNew = solidAt(g, b.x, b.y) === 1;
  var hNew = onPaperNew ? heightAt(g, b.x, b.y) : b.z;
  if (onPaperNew && hNew > b.z + WALL_STEP) { onPaperNew = false; hNew = b.z; }

  if (contact) {
    if (!onPaperNew) {
      b.vz = vzSurface;                       // leaves the lip tangentially
    } else if (hNew < b.z + vzSurface * DT - EPS) {
      b.vz = vzSurface;                       // LAUNCH TEST
    } else {
      b.z = hNew; b.vz = 0;
    }
  } else if (onPaperNew && b.z <= hNew) {
    b.z = hNew;
    b.impact = -b.vz;
    b.vz = 0;
    if (b.impact > IMPACT_MIN) {
      b.squash = Math.min(1, b.impact / IMPACT_REF);
      emit(run, 'land', b.impact);
    }
  }

  // `air` and `lift` are two different questions and both are needed. The launch test
  // fires on ANY downward curvature, so `air` flickers on undulating ground by design —
  // it says which force set the next tick uses. `lift` is how far the ball actually is
  // off the ground, and a five-centimetre hop is not flight.
  b.air = !onPaperNew || (b.z - hNew) > CONTACT;
  b.lift = onPaperNew ? b.z - hNew : 0;

  if (!b.air && surfAt(g, b.x, b.y) === SURF.WATER) enterSink(run, 'water');

  // FRAGILE only arms when the ball is genuinely on it, so a ball that flies the patch
  // does not arm it. Touching turns the cell CRACKED; BREAK_TIME later it is a hole.
  if (b.state === ST.ROLL && b.lift < 0.25) {
    var k = cellIndex(g, b.x, b.y);
    if (k >= 0 && g.surf[k] === SURF.FRAGILE) {
      g.surf[k] = SURF.CRACKED;
      run.cracks.push({ k: k, t: BREAK_TIME });
      emit(run, 'crack');
    }
  }

  if (sp > 1e-6) { b.spinAxis[0] = b.vx / sp; b.spinAxis[1] = b.vy / sp; }
  b.spin = (b.spin + sp * DT / BALL_R) % (Math.PI * 2);
  if (b.squash > 0) b.squash = Math.max(0, b.squash - DT / SQUASH_DECAY);

  applyTriggers(run);
  collideBodies(run);
  clampSpeed(b);

  if (b.z < c.deathZ) enterFall(run, 'void');
  if (b.state !== ST.ROLL) return;

  // ---- triggers on the ground ------------------------------------------------
  for (var f = 0; f < c.flags.length; f++) {
    if (run.flagsHit[f]) continue;
    var fl = c.flags[f];
    if (triggerHit(run, fl.x, fl.y, fl.r)) {
      run.flagsHit[f] = true;
      run.credit += c.bonus;                  // a flag pays `bonus` seconds ONCE
      run.receipt = RECEIPT_TIME; run.receiptVal = c.bonus;
      run.spawn = { x: fl.x, y: fl.y, z: heightAt(g, fl.x, fl.y) };
      emit(run, 'flag', f);
    }
  }
  if (triggerHit(run, c.cup.x, c.cup.y, c.cup.r)) {
    b.state = ST.HOLED; run.holeT = 0;
    b.vx = b.vy = b.vz = 0;
    emit(run, 'cup');
  }
}

// Net time is clock - credit, clamped at zero. There is no failure state on it.
function netTime(run) { return Math.max(0, run.clock - run.credit); }
