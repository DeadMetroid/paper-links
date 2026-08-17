// The 52 tests. Registered against the runner in run.js; the manifest lives there.
'use strict';
var T = require('./run.js');
var test = T.test, ok = T.ok, eq = T.eq, near = T.near, lte = T.lte, gte = T.gte;

var F = require('./fixtures.js');
var PL = require('./load.js').loadEngine();

// ============================================================================
// PHYSICS
// ============================================================================

test(15, 'a ball leaving a lip flies, and its arc is ordinary ballistics', function () {
  // Flat paper, then void. The ball rolls off the lip at a known speed. Once it is off
  // the mask nothing but gravity acts on it, so z(t) must be the textbook parabola and
  // x(t) must be a straight line at the launch speed.
  var g = F.slab(PL, 20, 8, function () { return 30; });
  var run = PL.newRun(F.shell(PL, g, { x: 2.5, y: 4.5 }));
  var b = run.ball;
  b.vx = 12;                                   // rolling toward the +wx lip at x = 20

  var launchX = null, launchZ = null, launchVX = null;
  for (var i = 0; i < 900; i++) {
    PL.tick(run, 0, 0);
    if (PL.solidAt(g, b.x, b.y) !== 1) { launchX = b.x; launchZ = b.z; launchVX = b.vx; break; }
  }
  ok(launchX !== null, 'the ball never left the paper');
  near(launchZ, 30, 1e-9, 'it did not leave a flat lip at the lip height');

  // 50 airborne ticks: 2.6 units of drop, comfortably short of deathZ, so the whole
  // measurement happens inside one uninterrupted flight.
  var N = 50;
  for (var k = 0; k < N; k++) PL.tick(run, 0, 0);
  eq(b.state, PL.ST.ROLL, 'the flight was interrupted before it could be measured');

  // Horizontal: no force at all off the paper with no input.
  near(b.vx, launchVX, 1e-12, 'horizontal speed changed in flight');
  near(b.x, launchX + launchVX * N * PL.DT, 1e-9, 'x is not a straight line in flight');
  // Vertical: semi-implicit Euler on a constant -G. Its exact closed form after n steps
  // is z0 - G*dt^2*n(n+1)/2, which is the continuous parabola to within one step of dt.
  var want = launchZ - PL.G * PL.DT * PL.DT * N * (N + 1) / 2;
  near(b.z, want, 1e-9, 'the arc is not ordinary ballistics');
  near(b.z, launchZ - 0.5 * PL.G * Math.pow(N * PL.DT, 2), 0.06, 'not a parabola');
});

test(16, 'a ball that walks off the edge is lost', function () {
  var g = F.slab(PL, 12, 8, function () { return 30; });
  var run = PL.newRun(F.shell(PL, g, { x: 6.5, y: 4.5 }));
  run.ball.vx = 10;
  var lost = false, cause = null;
  for (var i = 0; i < 120 * 12; i++) {
    PL.tick(run, 0, 0);
    if (run.falls > 0) { lost = true; cause = 'respawned'; break; }
    if (run.ball.state === PL.ST.FALL) cause = run.ball.cause;
  }
  ok(lost, 'the ball rolled off the paper and was never lost');
  eq(cause, 'respawned', 'it did not resolve into a respawn');
  eq(run.ball.state, PL.ST.ROLL, 'it did not come back rolling');
  near(run.ball.x, 6.5, 1e-9, 'it did not come back at the tee');
  eq(run.falls, 1, 'the fall was not counted exactly once');
});

test(17, 'the simulation is deterministic — replay a run tick for tick', function () {
  // Undulating ground with a lip, a belt strip and a wall of statics: every branch in the
  // tick gets exercised, and any wall-clock or RNG leak shows up as a divergence.
  function build() {
    var g = F.slab(PL, 26, 14, function (i, j) {
      return 40 - i * 0.22 + Math.sin(i * 0.7) * 0.35 + Math.cos(j * 0.5) * 0.2;
    });
    for (var j = 4; j < 8; j++) for (var i = 10; i < 16; i++) {
      var k = (j + 6) * g.nx + (i + 6);
      g.surf[k] = PL.SURF.BELT; g.fx[k] = 0; g.fy[k] = 1;
    }
    var c = F.shell(PL, g, { x: 2.5, y: 7.5 });
    c.hazards = [
      { name: 'tree', x: 8, y: 7, phase: 0 },
      { name: 'mallet', x: 14, y: 7, phase: 0.4 },
      { name: 'rival', x: 18, y: 7, phase: 0 },
      { name: 'goose', x: 22, y: 6, phase: 0 },
    ];
    return c;
  }
  // Trace EVERY body, not just the ball. A phase seeded from entropy moves a hammer the
  // ball never happens to meet, and a trace that only watches the ball calls that
  // deterministic. It is not — it is unobserved.
  function drive(course) {
    var run = PL.newRun(course);
    var trace = [], travel = 0, lx = run.ball.x, ly = run.ball.y;
    for (var i = 0; i < 120 * 20; i++) {
      var a = Math.sin(i * 0.017), s = Math.hypot(a, 0.4);
      PL.tick(run, a / s, 0.4 / s);
      travel += Math.hypot(run.ball.x - lx, run.ball.y - ly);
      lx = run.ball.x; ly = run.ball.y;
      if (i % 7) continue;
      trace.push(run.ball.x, run.ball.y, run.ball.z, run.ball.vx, run.ball.vy,
                 run.ball.vz, run.ball.spin, run.clock, run.falls);
      for (var q = 0; q < run.bodies.length; q++)
        trace.push(run.bodies[q].x, run.bodies[q].y, run.bodies[q].vx, run.bodies[q].vy);
    }
    return { trace: trace, travel: travel };
  }
  var a = drive(build()), b = drive(build());
  gte(a.travel, 20, 'the ball barely moved, so the trace proves nothing');
  eq(a.trace.length, b.trace.length, 'traces are different lengths');
  gte(a.trace.length, 5000, 'trace is too short to mean anything');
  for (var i = 0; i < a.trace.length; i++)
    if (a.trace[i] !== b.trace[i])
      throw new Error('diverged at sample ' + i + ': ' + a.trace[i] + ' vs ' + b.trace[i]);
});

test(18, 'the speed clamp holds on every tick', function () {
  // Past critical: SLOPE_CRIT is 0.42 and this is 0.9, so gravity wins outright and the
  // ball accelerates until only the clamp stops it. Then a belt pointed the same way,
  // full input the same way, and 100,000 ticks — nothing may exceed MAX_SPEED, ever, and
  // nothing may go NaN.
  var g = F.slab(PL, 400, 10, function (i) { return 400 - i * 0.9; });
  for (var j = 0; j < 10; j++) for (var i = 60; i < 90; i++) {
    var k = (j + 6) * g.nx + (i + 6);
    g.surf[k] = PL.SURF.BELT; g.fx[k] = 1; g.fy[k] = 0;
  }
  var c = F.shell(PL, g, { x: 1.5, y: 5.5 });
  var run = PL.newRun(c);
  var worst = 0, sawFast = false;
  for (var t = 0; t < 100000; t++) {
    PL.tick(run, 1, 0);
    var b = run.ball;
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.z) ||
        !Number.isFinite(b.vx) || !Number.isFinite(b.vy) || !Number.isFinite(b.vz))
      throw new Error('NaN or Infinity at tick ' + t + ': ' + JSON.stringify(
        { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz }));
    var sp = Math.hypot(b.vx, b.vy);
    if (sp > worst) worst = sp;
    if (sp > PL.MAX_SPEED * 0.98) sawFast = true;
  }
  ok(sawFast, 'never got near the clamp, so the clamp was never tested');
  lte(worst, PL.MAX_SPEED + 1e-9, 'the clamp was exceeded');
  gte(run.t, 100000 * PL.DT - 1e-6, 'the sim did not actually advance 100,000 ticks');
});

var V = require('./validate.js').mk(PL);

// Every course that exists right now, compiled. The suite grows with the game: a test
// that measures "all six" is written when the sixth is authored, not before.
function courses() {
  var out = [];
  for (var i = 0; i < PL.courseCount(); i++) out.push(PL.getCourse(i));
  return out;
}
function eachCourse(fn) { courses().forEach(function (c, i) { fn(c, i); }); }

// ============================================================================
// GEOMETRY AND TOPOLOGY
// ============================================================================

test(1, 'every course compiles with no seam between its pieces', function () {
  // Heights live on lattice CORNERS and are shared between neighbouring cells, so two
  // pieces that meet must agree on the boundary or the seam is a one-cell cliff.
  eachCourse(function (c, i) {
    if (!c.seams.length) return;
    var lines = c.seams.slice(0, 8).map(function (s) {
      return '    (' + s.x + ',' + s.y + ') ' + s.was.toFixed(3) + ' -> ' + s.now.toFixed(3) +
             '  by piece #' + s.i + ' (' + s.kind + ')';
    });
    throw new Error('course ' + i + ' ' + c.name + ' has ' + c.seams.length +
                    ' seam(s):\n' + lines.join('\n'));
  });
});

test(2, 'no surface is steeper than the steepest thing an author declared', function () {
  eachCourse(function (c, i) {
    var d = V.declaredSlope(c), m = V.maxSlope(c, false);
    // The compiled grid is a bilinear read of the same corners the pieces wrote, so it
    // can never legitimately exceed the steepest corner step any piece asked for.
    // Anything over that came from two pieces interacting, which is a bug, not a design.
    lte(m.slope, d.slope + 1e-9,
        'course ' + i + ' ' + c.name + ': grid reads ' + m.slope.toFixed(4) + ' at ' +
        JSON.stringify(m.at) + ' but the steepest declared is ' + d.slope.toFixed(4) +
        ' (' + JSON.stringify(d.who) + ')');
  });
});

test(3, 'the tee can reach the cup, over paper or across a ledge', function () {
  eachCourse(function (c, i) {
    ok(V.reachable(c, c.start, c.cup), 'course ' + i + ' ' + c.name + ': tee cannot reach the cup');
  });
});

test(4, 'the tee, the cup and every flag stand on solid paper', function () {
  eachCourse(function (c, i) {
    var g = c.grid, tag = 'course ' + i + ' ' + c.name + ': ';
    eq(PL.solidAt(g, c.start.x, c.start.y), 1, tag + 'the tee is over the void');
    eq(PL.solidAt(g, c.cup.x, c.cup.y), 1, tag + 'the cup is over the void');
    c.flags.forEach(function (f, fi) {
      eq(PL.solidAt(g, f.x, f.y), 1, tag + 'flag ' + fi + ' at ' + f.x + ',' + f.y + ' is over the void');
      ok(PL.surfAt(g, f.x, f.y) !== PL.SURF.WATER, tag + 'flag ' + fi + ' stands in water');
    });
  });
});

test(5, 'a flag is somewhere the ball can actually stop, and so is every tee', function () {
  // A checkpoint is also a respawn: the ball is set down with the world running and no
  // key answered for two seconds. A gate on a slope is a gate you roll off during the
  // hold, so the terminal speed of the ground it stands on is capped.
  eachCourse(function (c, i) {
    var tag = 'course ' + i + ' ' + c.name + ': ';
    lte(V.terminalAt(c, c.start.x, c.start.y), PL.VTERM_MAX, tag + 'the tee is on a slope');
    c.flags.forEach(function (f, fi) {
      lte(V.terminalAt(c, f.x, f.y), PL.VTERM_MAX,
          tag + 'flag ' + fi + ' sits where terminal speed is ' +
          V.terminalAt(c, f.x, f.y).toFixed(2) + ', over VTERM_MAX ' + PL.VTERM_MAX);
    });
  });
});

test(6, 'every authored route runs over paper from end to end', function () {
  eachCourse(function (c, i) {
    var bad = V.routeOffPaper(c);
    ok(!bad.length, 'course ' + i + ' ' + c.name + ': ' + JSON.stringify(bad) +
       ' — a route may cross a LEDGE, but it may not wander off the level');
  });
});

test(7, 'every leg runs along a world axis, never down the screen', function () {
  // LAW 4.1 — in this projection a side wall on an edge parallel to (1,1) projects to a
  // LINE: 0 px^2 of screen area. A corridor aimed at the bottom of the screen cannot show
  // its sides at any thickness. "It looks flat" and "there are no paths at different
  // angles" are one defect, and it is geometric, not artistic.
  eachCourse(function (c, i) {
    var bad = V.offAxisLegs(c);
    ok(!bad.length, 'course ' + i + ' ' + c.name + ' has diagonal leg(s): ' + JSON.stringify(bad));
    // And the pieces themselves are axis-aligned rectangles on the lattice, by construction.
    c.pieces.forEach(function (p, pi) {
      ok(p.w >= 1 && p.h >= 1 && p.w === Math.round(p.w) && p.h === Math.round(p.h),
         'course ' + i + ' piece #' + pi + ' (' + p.kind + ') is not a lattice rectangle: ' +
         p.w + 'x' + p.h);
      ok(p.axis === 'x' || p.axis === 'y',
         'course ' + i + ' piece #' + pi + ' (' + p.kind + ') declares no world axis');
    });
  });
});

test(8, 'every course has a fork that is really a fork', function () {
  // LAW 6.5 — a fork is two lanes; a BRANCH is two paths. The first build called it a
  // fork when two identical ramps ran side by side two tiles apart and rejoined on the
  // next pad: same slope, same width, same threats, NO REASON TO PREFER EITHER.
  eachCourse(function (c, i) {
    var bs = V.branches(c);
    ok(bs.length, 'course ' + i + ' ' + c.name + ' has no divergent route pair at all');
    var real = bs.filter(function (b) { return b.diff.length > 0; });
    ok(real.length, 'course ' + i + ' ' + c.name + ': its branches are the same lane twice — ' +
       JSON.stringify(bs.map(function (b) { return b.sa; })));
  });
});

test(9, 'every threat fits on the ground it stands on', function () {
  // LAW 9.2 and 9.3. On its first run against a hand-placed roster this caught ELEVEN,
  // including a golfer with a twelve-tile leash on four tiles of catwalk.
  eachCourse(function (c, i) {
    var bad = V.hazardIssues(c);
    ok(!bad.length, 'course ' + i + ' ' + c.name + ':\n    ' +
       bad.map(function (b) { return b.name + ' #' + b.i + ': ' + b.why; }).join('\n    '));
  });
});

// The fairness oracle drives each authored route using exactly the input a human gets,
// quantised to the eight directions a keyboard can produce. Until it exists you cannot
// tell whether a course you wrote is passable.
var ORACLE = require('./oracle.js').makeOracle(PL);
var _driven = {};
function drive(ci, ri) {
  var key = ci + ':' + ri;
  if (!_driven[key]) _driven[key] = ORACLE.driveRoute(PL.getCourse(ci), ri);
  return _driven[key];
}

test(11, 'the oracle clears every course on every authored route', function () {
  eachCourse(function (c, i) {
    c.routes.forEach(function (r, ri) {
      var res = drive(i, ri);
      var b = res.run.ball;
      ok(res.ok, 'course ' + i + ' ' + c.name + ' route ' + ri + ': stalled at ' +
         (res.progress * 100).toFixed(1) + '% of the route, at (' + b.x.toFixed(1) + ',' +
         b.y.toFixed(1) + ',' + b.z.toFixed(1) + ') after ' + res.ticks + ' ticks');
    });
  });
});

test(12, 'it clears them without falling off once', function () {
  eachCourse(function (c, i) {
    c.routes.forEach(function (r, ri) {
      var res = drive(i, ri);
      eq(res.falls, 0, 'course ' + i + ' ' + c.name + ' route ' + ri +
         ': a flawless line still fell ' + res.falls + ' time(s)');
      res.flags.forEach(function (hit, fi) {
        var f = c.flags[fi];
        if (f.skip && f.skip.indexOf(ri) !== -1) return;
        ok(hit, 'course ' + i + ' route ' + ri + ' drove past flag ' + fi + ' without claiming it');
      });
    });
  });
});
