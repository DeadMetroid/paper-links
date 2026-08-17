// HAZARDS — five primitives, everything else is data.
//
// LAW 9.1 — a threat should change the ball's VELOCITY, not occupy a tile. Steering
// around scenery is the least interesting thing this control scheme can do.

var CATALOG = {
  tree:    { prim: 'STATIC', r: 0.55, h: 2.4, art: 'tree' },
  tee:     { prim: 'STATIC', r: 0.26, h: 0.7, art: 'tee' },
  bench:   { prim: 'STATIC', r: 0.72, h: 0.9, art: 'bench' },
  post:    { prim: 'STATIC', r: 0.24, h: 1.5, art: 'post' },
  windmill:{ prim: 'STATIC', r: 0.78, h: 2.8, art: 'windmill' },
  washer:  { prim: 'STATIC', r: 0.36, h: 1.1, art: 'washer' },

  // `flatten` is what a Marble Madness hammer actually did: it never took the marble, it
  // took the marble's SHAPE. Nine tenths of a second flat is nine tenths of a second of
  // gravity with no say in it — seconds on a junction, the leg on a catwalk.
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

// One placed threat, indexed into the catalog. Authored in levels.js.
function haz(name, x, y, phase, leash) {
  return { name: name, x: x, y: y, phase: phase || 0, leash: leash };
}

// The C axis: across the descent. A hammer sweeps the WIDTH of a lane, not its length.
var C_AX = 1 / Math.SQRT2, C_AY = -1 / Math.SQRT2;

function buildBodies(run) {
  var list = run.course.hazards || [];
  run.bodies.length = 0;
  for (var i = 0; i < list.length; i++) {
    var p = list[i], def = CATALOG[p.name];
    if (!def) throw new Error('unknown hazard: ' + p.name);
    var b = {
      name: p.name, def: def, prim: def.prim, art: def.art || p.name,
      hx: p.x, hy: p.y, x: p.x, y: p.y,
      z: heightAt(run.grid, p.x, p.y),
      r: def.r, h: def.h || 1.4,
      vx: 0, vy: 0, kx: 0, ky: 0, knock: 0, downT: 0,
      phase: p.phase || 0, leash: p.leash || def.leash || 0,
      engaged: false, active: true, face: 0,
      bumps: def.prim !== 'TRIGGER',      // a trigger is a field, not a body
      mass: def.mass, flatten: def.flatten,
      on: false,
    };
    run.bodies.push(b);
  }
}

// The sweep a hazard's disc covers. For a chaser the disc is its WHOLE LEASH, because
// that is how far it will walk to reach you (LAW 9.2).
function hazSweep(b) {
  var path = 0;
  if (b.prim === 'PERIODIC') {
    path = b.def.path === 'loop' ? b.def.radius : b.def.amp;
  } else if (b.prim === 'SEEKER' || b.prim === 'RIVAL') {
    path = b.leash;
  }
  // A TRIGGER never moves, so its path radius is zero and its `r` IS the disc — counting
  // the field as both the path AND the body reported a sprinkler as 5.52 wide when it
  // reaches 2.92, and refused lanes it fits on comfortably.
  return path + b.r + BALL_R;
}

// Walkable means solid paper more than SEEK_CLEAR clear of every static. A dog that runs
// off a catwalk reads as broken.
function walkable(run, x, y) {
  if (solidAt(run.grid, x, y) !== 1) return false;
  if (surfAt(run.grid, x, y) === SURF.WATER) return false;
  var list = run.bodies;
  for (var i = 0; i < list.length; i++) {
    var s = list[i];
    if (s.prim !== 'STATIC') continue;
    var dx = x - s.x, dy = y - s.y, rr = s.r + SEEK_CLEAR;
    if (dx * dx + dy * dy < rr * rr) return false;
  }
  return true;
}

// Greedy 16-direction step check: probe SEEK_LOOK ahead, and if that is blocked fan out
// +/-1..7 steps of pi/8 from the desired heading and take the first that is not.
function seekHeading(run, c, tx, ty) {
  var dx = tx - c.x, dy = ty - c.y;
  if (Math.hypot(dx, dy) < 1e-6) return null;
  var base = Math.atan2(dy, dx);
  for (var k = 0; k <= 7; k++) {
    for (var s = 0; s < (k === 0 ? 1 : 2); s++) {
      var a = base + (s === 0 ? k : -k) * (Math.PI / 8);
      if (walkable(run, c.x + Math.cos(a) * SEEK_LOOK, c.y + Math.sin(a) * SEEK_LOOK))
        return a;
    }
  }
  return null;
}

// Engagement is hysteretic, and the numbers matter — without the gap a chaser chatters on
// the leash boundary. Both a seeker and a rival disengage while the respawn hold is
// running, so the grace period cannot be spent being shoved off the flag you just reached.
function engagement(run, c, gate) {
  if (run.holdT > 0) { c.engaged = false; return; }
  var b = run.ball;
  var dHome = Math.hypot(c.x - c.hx, c.y - c.hy);
  var dBall = Math.hypot(c.x - b.x, c.y - b.y);
  if (!c.engaged) {
    if (dHome < c.leash * gate && dBall < c.leash * 0.95) c.engaged = true;
  } else if (dHome > c.leash) {
    c.engaged = false;
  }
}

function stepBodies(run) {
  var list = run.bodies, b = run.ball;
  for (var i = 0; i < list.length; i++) {
    var c = list[i];
    var px = c.x, py = c.y;

    if (c.prim === 'STATIC') {
      c.vx = 0; c.vy = 0;
      continue;
    }

    if (c.prim === 'PERIODIC') {
      var a = c.def.omega * run.t + c.phase;
      if (c.def.path === 'pendulum') {
        var off = c.def.amp * Math.sin(a);
        c.x = c.hx + C_AX * off; c.y = c.hy + C_AY * off;
      } else if (c.def.path === 'loop') {
        c.x = c.hx + c.def.radius * Math.cos(a);
        c.y = c.hy + c.def.radius * Math.sin(a);
      } else {                                   // swing: an arm laid along C, rotating
        var ang = Math.atan2(C_AY, C_AX) + 0.9 * Math.sin(a);
        c.x = c.hx + c.def.amp * Math.cos(ang);
        c.y = c.hy + c.def.amp * Math.sin(ang);
      }
      c.vx = (c.x - px) / DT; c.vy = (c.y - py) / DT;   // real momentum for the impulse
      c.z = heightAt(run.grid, c.x, c.y);
      c.face = Math.atan2(c.vy, c.vx);
      continue;
    }

    if (c.prim === 'TRIGGER') {
      c.on = c.def.kind === 'sprinkler'
           ? Math.sin(c.def.omega * run.t + c.phase) > 0.25
           : true;
      continue;
    }

    if (c.prim === 'SEEKER') {
      engagement(run, c, 0.55);
      var tx = c.engaged ? b.x : c.hx, ty = c.engaged ? b.y : c.hy;
      var head = seekHeading(run, c, tx, ty);
      if (head === null) { c.vx = 0; c.vy = 0; }
      else {
        c.vx += Math.cos(head) * c.def.accel * DT;
        c.vy += Math.sin(head) * c.def.accel * DT;
        var sp = Math.hypot(c.vx, c.vy);
        if (sp > c.def.maxSpeed) { c.vx *= c.def.maxSpeed / sp; c.vy *= c.def.maxSpeed / sp; }
        var nx = c.x + c.vx * DT, ny = c.y + c.vy * DT;
        if (walkable(run, nx, ny)) { c.x = nx; c.y = ny; }
        else { c.vx = 0; c.vy = 0; }
        c.face = head;
      }
      if (!c.engaged && Math.hypot(c.x - c.hx, c.y - c.hy) < 0.05) { c.vx = 0; c.vy = 0; }
      c.z = heightAt(run.grid, c.x, c.y);
      continue;
    }

    // RIVAL — the only threat in the game you beat rather than avoid. It does NOT path
    // around the void: a marble that runs off a catwalk reads as a marble, and that is
    // what makes leading it over an edge a real move.
    c.vx += c.kx; c.vy += c.ky; c.kx = 0; c.ky = 0;
    if (c.knock > 0) c.knock -= DT;

    if (c.downT > 0) {
      c.downT -= DT;
      if (c.downT <= 0) {
        c.x = c.hx; c.y = c.hy; c.vx = 0; c.vy = 0; c.engaged = false;
        c.z = heightAt(run.grid, c.x, c.y); c.active = true;
      }
      continue;
    }

    engagement(run, c, 0.6);
    var rtx = c.engaged ? b.x : c.hx, rty = c.engaged ? b.y : c.hy;
    var rdx = rtx - c.x, rdy = rty - c.y, rm = Math.hypot(rdx, rdy);
    if (rm > 0.08) {
      c.vx += (rdx / rm) * c.def.accel * DT;
      c.vy += (rdy / rm) * c.def.accel * DT;
    }
    c.vx -= RIVAL_DRAG * c.vx * DT; c.vy -= RIVAL_DRAG * c.vy * DT;
    // RIVAL_KNOCK seconds of grace let a rammed rival exceed its own top speed, which is
    // what a ram looks like.
    if (c.knock <= 0) {
      var rs = Math.hypot(c.vx, c.vy);
      if (rs > c.def.maxSpeed) { c.vx *= c.def.maxSpeed / rs; c.vy *= c.def.maxSpeed / rs; }
    }
    c.x += c.vx * DT; c.y += c.vy * DT;
    c.face = Math.atan2(c.vy, c.vx);
    if (solidAt(run.grid, c.x, c.y) !== 1 || surfAt(run.grid, c.x, c.y) === SURF.WATER) {
      c.downT = RIVAL_DOWN; c.active = false;
      emit(run, 'rivaldown');
    } else {
      c.z = heightAt(run.grid, c.x, c.y);
    }
  }
}

// TRIGGER fields act on the ball. They never block; the muncher takes your LINE before it
// takes your ball, and the sprinkler only ever spoils one.
function applyTriggers(run) {
  var b = run.ball, list = run.bodies;
  if (b.state !== ST.ROLL) return;
  for (var i = 0; i < list.length; i++) {
    var c = list[i];
    if (c.prim !== 'TRIGGER' || !c.on) continue;
    if (b.z > c.z + WALL_STEP) continue;          // a field is on the ground, like a trigger
    var dx = b.x - c.x, dy = b.y - c.y;
    var d = Math.hypot(dx, dy);
    if (d >= c.def.r) continue;

    if (c.def.kind === 'sprinkler') {
      if (d < 1e-6) continue;
      var pu = c.def.push * (1 - d / c.def.r) * DT;
      b.vx += (dx / d) * pu; b.vy += (dy / d) * pu;
      continue;
    }

    // The muncher: Marble Madness's vacuum. It never chases. There is an exact radius
    // r*(1 - K/pull) = 1.2 of its 3 tiles inside which no amount of input climbs back
    // out — and the renderer DRAWS that circle, because a point of no return you cannot
    // see is just an unfair death.
    if (d < 0.8) {
      b.x = c.x; b.y = c.y; b.vx = 0; b.vy = 0;
      enterSink(run, 'eaten');
      return;
    }
    var pl = c.def.pull * (1 - d / c.def.r) * DT;
    b.vx -= (dx / d) * pl; b.vy -= (dy / d) * pl;
  }
}

// The radius inside which no amount of input climbs back out. Derived, never typed.
function muncherHold(def) { return def.r * (1 - K / def.pull); }
