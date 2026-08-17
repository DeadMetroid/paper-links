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
