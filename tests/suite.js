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

var CV = require('./canvas.js');
var LOAD = require('./load.js');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var ROOT = path.join(__dirname, '..');

function gridHash(c) {
  var g = c.grid;
  var h = crypto.createHash('sha256');
  h.update(Buffer.from(g.h.buffer, g.h.byteOffset, g.h.byteLength));
  h.update(Buffer.from(g.solid.buffer, g.solid.byteOffset, g.solid.byteLength));
  h.update(Buffer.from(g.surf.buffer, g.surf.byteOffset, g.surf.byteLength));
  h.update(Buffer.from(g.fx.buffer, g.fx.byteOffset, g.fx.byteLength));
  h.update(Buffer.from(g.fy.buffer, g.fy.byteOffset, g.fy.byteLength));
  h.update(JSON.stringify([g.nx, g.ny, g.ox, g.oy, c.deathZ, c.lowestZ, c.name,
                           c.parTime, c.bonus, c.start, c.cup, c.flags]));
  return h.digest('hex').slice(0, 24);
}

test(19, 'a course is the same every time it is built', function () {
  // No RNG in the level path at all: a course is byte-for-byte what the author wrote,
  // every time. Built from a FRESH factory call each time, so nothing is carried over.
  for (var i = 0; i < PL.courseCount(); i++) {
    var a = gridHash(PL.compile(PL.COURSE_DEFS[i]()));
    var b = gridHash(PL.compile(PL.COURSE_DEFS[i]()));
    eq(a, b, 'course ' + i + ' compiled differently the second time');
    eq(a, gridHash(PL.getCourse(i)), 'course ' + i + ' differs from the cached build');
  }
});

test(20, 'game.html builds the same six courses as src/', function () {
  // The deliverable is a committed file. If it ever drifts from the sources, the thing
  // the judge opens is not the thing the suite tested.
  var html = LOAD.readArtifact();
  LOAD.MODULES.forEach(function (m) {
    ok(html.indexOf('/* ===== src/' + m + ' ===== */') !== -1, 'game.html is missing src/' + m);
  });

  // Strip the wrapper and compare the concatenated engine text byte for byte.
  var i0 = html.indexOf('/* ===== src/' + LOAD.MODULES[0] + ' ===== */');
  var i1 = html.lastIndexOf('<' + '/script>');
  ok(i0 > 0 && i1 > i0, 'cannot find the script body in game.html');
  var inHtml = html.slice(i0, i1).replace(/\r\n/g, '\n').trim();
  var rebuilt = LOAD.MODULES.map(function (m) {
    return '/* ===== src/' + m + ' ===== */\n' +
      fs.readFileSync(path.join(ROOT, 'src', m), 'utf8');
  }).join('\n').replace(/\r\n/g, '\n').trim();
  eq(inHtml, rebuilt, 'game.html has drifted from src/ — run: node build.js');

  // And the courses it defines really are these courses: hash them out of the artifact's
  // own text, loaded the same way the browser loads it.
  var vm = require('vm');
  var box = vm.createContext({ Math: Math, JSON: JSON, Object: Object, Array: Array,
    Number: Number, String: String, Boolean: Boolean, Date: Date, Error: Error,
    isNaN: isNaN, isFinite: isFinite, parseInt: parseInt, parseFloat: parseFloat,
    Float64Array: Float64Array, Uint8Array: Uint8Array, Int32Array: Int32Array,
    console: console });
  box.globalThis = box;
  vm.runInContext(inHtml, box, { filename: 'game.html' });
  for (var c = 0; c < PL.courseCount(); c++)
    eq(gridHash(box.getCourse(c)), gridHash(PL.getCourse(c)),
       'course ' + c + ' in game.html is not the course in src/');
});

test(21, 'the artifact reaches outside itself for nothing', function () {
  var html = LOAD.readArtifact();
  // No URL, no fetch, no asset. Every visual is Canvas 2D and every sound is synthesized;
  // ASSETS.md says "all procedural, none third-party" and this is what keeps that true.
  // file:// blocks fetch/XHR against local files anyway — reaching for one would be
  // broken as well as undisclosed.
  var banned = [
    [/\bfetch\s*\(/, 'fetch('],
    [/XMLHttpRequest/, 'XMLHttpRequest'],
    [/\bimport\s*\(/, 'dynamic import()'],
    [/<script[^>]+src=/i, 'script src'],
    [/<link[^>]/i, 'a link tag'],
    [/<img\b/i, 'an img tag'],
    [/<audio\b/i, 'an audio tag'],
    [/<video\b/i, 'a video tag'],
    [/https?:\/\//i, 'an http(s) URL'],
    [/\bnew\s+Image\b/, 'new Image'],
    [/\bWebSocket\b/, 'WebSocket'],
    [/@font-face/i, 'font-face'],
    [/data:image/i, 'an embedded image'],
    [/data:audio/i, 'embedded audio'],
    [/decodeAudioData/, 'decodeAudioData'],
  ];
  banned.forEach(function (b) {
    var m = b[0].exec(html);
    ok(!m, 'game.html reaches outside itself: ' + b[1] + ' at offset ' + (m ? m.index : -1));
  });
  ok(!fs.existsSync(path.join(ROOT, 'assets')), 'there is an assets/ directory');
  // Fonts: generic families only, never a named webfont.
  var fonts = html.match(/[0-9]+px [a-z-]+/g) || [];
  fonts.forEach(function (f) {
    var fam = f.split(' ')[1];
    ok(fam === 'monospace' || fam === 'sans-serif' || fam === 'serif',
       'a non-generic font family is referenced: ' + f);
  });
});

// A frame drawn against the recording canvas: no DOM, no clock, no rasteriser.
function poseFrame(ci, s, extra) {
  var run = PL.newRun(PL.getCourse(ci), 0);
  var r = run.course.routes[0];
  var p = PL.pointAt(r, r.total * s);
  run.ball.x = p.x; run.ball.y = p.y;
  run.ball.z = PL.heightAt(run.grid, p.x, p.y);
  run.t = 3.25;
  if (extra) extra(run);
  var cam = PL.newCam(run.ball);
  var ctx = CV.recordingCanvas();
  PL.drawWorld(ctx, run, cam);
  return { ctx: ctx, run: run, cam: cam };
}

test(22, 'a full frame draws without a DOM or a clock', function () {
  for (var ci = 0; ci < PL.courseCount(); ci++) {
    for (var s = 0; s <= 1.0001; s += 0.1) {
      var tag = 'course ' + ci + ' at ' + s.toFixed(1) + ': ';
      var f = poseFrame(ci, Math.min(1, s));
      gte(f.ctx.counts().fill, 12, tag + 'the frame drew almost nothing');
      for (var i = 0; i < f.ctx.ops.length; i++) {
        var bb = f.ctx.bbox(f.ctx.ops[i]);
        if (!bb) continue;
        ok(isFinite(bb.x0) && isFinite(bb.y0) && isFinite(bb.x1) && isFinite(bb.y1),
           tag + 'a ' + f.ctx.ops[i].op + ' had a non-finite coordinate');
      }
    }
  }
});

test(23, 'a save round-trips and unlocks nothing that was not cleared', function () {
  // The save layer is generic in the number of courses and clamps everything to it, so it
  // is exercised at the shipped six rather than at however many are authored right now.
  var n = 6;
  lte(PL.courseCount(), n, 'more courses exist than the save test assumes');
  PL.window.localStorage.clear();

  var fresh = PL.loadSave(n);
  eq(fresh.unlocked, 1, 'a fresh save unlocks more than the first course');
  eq(PL.hasProgress(fresh), false, 'a fresh save claims progress');

  fresh.cards[0] = { net: 12.5, shots: -1 };
  fresh.unlocked = 2; fresh.pointer = 1;
  PL.writeSave(fresh);
  var back = PL.loadSave(n);
  eq(back.unlocked, 2); eq(back.pointer, 1);
  eq(back.cards[0].net, 12.5); eq(back.cards[0].shots, -1);
  eq(back.cards[1], null, 'a course that was never played came back with a card');
  eq(PL.hasProgress(back), true);

  // Defensive: a payload of the wrong version is thrown away for a fresh round rather
  // than migrated, and a hand-edited unlock is clamped to what actually exists.
  PL.window.localStorage._poison(PL.SAVE_KEY, JSON.stringify(
    { v: 999, unlocked: 6, pointer: 5, cards: [{ net: 1, shots: -4 }] }));
  eq(PL.loadSave(n).unlocked, 1, 'a save of the wrong version was honoured');
  PL.window.localStorage._poison(PL.SAVE_KEY, 'not json at all {{{');
  eq(PL.loadSave(n).unlocked, 1, 'a corrupt save was honoured');
  PL.window.localStorage._poison(PL.SAVE_KEY, JSON.stringify(
    { v: PL.SAVE_VERSION, unlocked: 9999, pointer: 9999, cards: [{ net: 'x', shots: 0 }] }));
  var clamped = PL.loadSave(n);
  eq(clamped.unlocked, n, 'unlocked was not clamped to the courses that exist');
  eq(clamped.pointer, n - 1, 'pointer was not clamped');
  eq(clamped.cards[0], null, 'a card with a non-numeric time was accepted');

  PL.eraseSave();
  eq(PL.loadSave(n).unlocked, 1, 'erasing the save left something behind');
});

// ============================================================================
// THE SURFACES THAT CARRY RULES, AND THE FIVE HAZARD PRIMITIVES
// ============================================================================

// Paint a rectangle of surface onto a fixture grid, in WORLD coordinates.
function paintFix(g, x, y, w, h, surf, fx, fy) {
  for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) {
    var k = PL.cellIndex(g, i + 0.5, j + 0.5);
    if (k < 0) continue;
    g.surf[k] = surf;
    if (fx !== undefined) { g.fx[k] = fx; g.fy[k] = fy; }
  }
}

test(24, 'water takes the ball, and only when the ball is actually on it', function () {
  // WATER is a decision, not a surface: contact means the ball goes under. The rule asks
  // for CONTACT, never for the cell alone — so a channel you can fly is a jump, and a
  // channel down one side of a lane is a lateral commitment held for the whole leg.
  function build() {
    var g = F.slab(PL, 40, 9, function () { return 30; });
    paintFix(g, 14, 0, 4, 9, PL.SURF.WATER);
    return F.shell(PL, g, { x: 2.5, y: 4.5 });
  }
  var run = PL.newRun(build());
  run.ball.vx = 9;
  var sank = false;
  for (var i = 0; i < 120 * 4; i++) {
    PL.tick(run, 0, 0);
    if (run.ball.state === PL.ST.SINK) { sank = true; break; }
  }
  ok(sank, 'a ball that rolled onto water did not go under');
  eq(run.ball.cause, 'water', 'the loss was not named as water');
  gte(run.ball.x, 14, 'it sank before it reached the water');
  lte(run.ball.x, 18.5, 'it crossed the whole channel before sinking');

  // ...and the same channel, flown. Genuinely airborne — z above the surface, `air` set,
  // so the tick takes the airborne branch and nothing but gravity acts.
  var run2 = PL.newRun(build());
  run2.ball.x = 10; run2.ball.vx = 20;
  run2.ball.z = 32.5; run2.ball.vz = 2; run2.ball.air = true;
  var over = false, sank2 = false, lift = 0;
  for (var t = 0; t < 120 * 4; t++) {
    PL.tick(run2, 0, 0);
    if (run2.ball.x > 14 && run2.ball.x < 18) {
      over = true;
      var h = PL.heightAt(run2.grid, run2.ball.x, run2.ball.y);
      lift = Math.max(lift, run2.ball.z - h);
    }
    if (run2.ball.state === PL.ST.SINK) sank2 = true;
  }
  ok(over, 'the second ball never reached the channel');
  gte(lift, PL.CONTACT * 2, 'it was never actually airborne over the water');
  ok(!sank2, 'a ball flying over the channel was taken by it — the rule read the CELL, ' +
     'not contact (max lift over the water was ' + lift.toFixed(2) + ')');
});

test(25, 'fragile paper goes, the hole stays, and a respawn brings it back', function () {
  var g = F.slab(PL, 30, 9, function () { return 30; });
  paintFix(g, 10, 0, 8, 9, PL.SURF.FRAGILE);
  var c = F.shell(PL, g, { x: 2.5, y: 4.5 });
  var run = PL.newRun(c);
  var solidBefore = c.grid.solid.slice();

  run.ball.vx = 4;
  var cracked = false, collapsed = false;
  for (var i = 0; i < 120 * 6; i++) {
    PL.tick(run, 0, 0);
    for (var e = 0; e < run.events.length; e++) {
      if (run.events[e].kind === 'crack') cracked = true;
      if (run.events[e].kind === 'collapse') collapsed = true;
    }
    run.events.length = 0;
    if (collapsed) break;
  }
  ok(cracked, 'rolling onto fragile paper never cracked it');
  ok(collapsed, 'cracked paper never became a hole');

  var holes = 0;
  for (var k = 0; k < run.grid.solid.length; k++) if (!run.grid.solid[k] && solidBefore[k]) holes++;
  gte(holes, 1, 'the collapse left no hole');

  // LAW 10.6 — the compiled course grid is cached and shared and must NEVER be written to.
  for (var q = 0; q < solidBefore.length; q++)
    if (c.grid.solid[q] !== solidBefore[q])
      throw new Error('the COURSE grid was mutated at cell ' + q + ' — a second run of this ' +
                      'course would start with the floor already eaten');

  // ...and a respawn puts it all back. A course that eats its own floor one attempt at a
  // time eventually cannot be finished.
  run.spawn = { x: 2.5, y: 4.5, z: 30 };
  PL.respawn(run);
  for (var r = 0; r < run.grid.solid.length; r++)
    eq(run.grid.solid[r], solidBefore[r], 'a respawn did not restore the fragile ground');
  eq(run.cracks.length, 0, 'a respawn left a crack still counting down');
});

test(26, 'a belt carries a ball that is asking for nothing', function () {
  // A conveyor, not a hill: it closes the gap between the ball's speed ALONG it and
  // BELT_SPEED and then stops. Drag settles that at about 8.8 units/s in about six tenths
  // of a second — that pair of numbers is what BELT_ACC was chosen for.
  var g = F.slab(PL, 60, 9, function () { return 30; });
  paintFix(g, 0, 0, 60, 9, PL.SURF.BELT, 1, 0);
  var run = PL.newRun(F.shell(PL, g, { x: 2.5, y: 4.5 }));
  var t60 = 0;
  for (var i = 0; i < 120 * 6; i++) {
    PL.tick(run, 0, 0);
    if (i === Math.round(0.6 * 120) - 1) t60 = run.ball.vx;
  }
  var settled = run.ball.vx;
  near(settled, 8.8, 0.4, 'a belt did not settle a passive ball near 8.8 units/s');
  // "in about six tenths of a second" is the TIME CONSTANT: dv/dt = BELT_ACC*(BELT_SPEED-v)
  // /BELT_SPEED - MU*v = 14 - 1.593*v, so tau = 0.628 s and one tau is 63% of the way.
  // Pushing with a constant acceleration instead gives a terminal that scales with a
  // number the belt has nothing to do with, and takes three seconds to get anywhere.
  near(t60 / settled, 0.632, 0.06, 'the belt does not close the gap on a 0.6 s time constant');
  lte(settled, PL.BELT_SPEED, 'the belt drove the ball past its own speed');
  near(run.ball.vy, 0, 1e-9, 'a belt pointed along +x moved the ball sideways');

  // A ball already faster than the belt is never SLOWED by it: the drag does that, and a
  // belt that brakes is a hill.
  var run2 = PL.newRun(F.shell(PL, g, { x: 2.5, y: 4.5 }));
  run2.ball.vx = 20;
  var a0 = run2.ball.vx;
  PL.tick(run2, 0, 0);
  var withBelt = run2.ball.vx - a0;
  var plain = F.slab(PL, 60, 9, function () { return 30; });
  var run3 = PL.newRun(F.shell(PL, plain, { x: 2.5, y: 4.5 }));
  run3.ball.vx = 20;
  PL.tick(run3, 0, 0);
  var noBelt = run3.ball.vx - 20;
  gte(withBelt, noBelt - 1e-12, 'the belt braked a ball that was faster than it');
});

test(27, 'the rival is a two-body collision, both ways', function () {
  // LAW 5.5 — a collider with a `mass` is a two-body impulse. This one branch IS the rival
  // marble: it rams you off the line and you ram it off the paper.
  function build() {
    var g = F.slab(PL, 40, 7, function () { return 30; });
    var c = F.shell(PL, g, { x: 2.5, y: 3.5 });
    c.hazards = [{ name: 'rival', x: 20, y: 3.5, phase: 0 }];
    return c;
  }
  // The BALL takes momentum off the rival...
  var run = PL.newRun(build());
  var riv = run.bodies[0];
  run.ball.x = 17; run.ball.vx = 18;
  var got = null, banked = 0, ballAfter = 0;
  for (var i = 0; i < 120 * 3 && got === null; i++) {
    PL.tick(run, 0, 0);
    for (var e = 0; e < run.events.length; e++)
      if (run.events[e].kind === 'knock') {
        got = run.events[e].a;
        // The impulse the collision BANKED on the rival, read in the same tick it was
        // banked. Reading the rival's velocity later measures what it chased with, not
        // what it was handed — which is how this test first passed against a build where
        // the collision gave it nothing at all.
        banked = Math.hypot(riv.kx, riv.ky);
        ballAfter = run.ball.vx;
      }
    run.events.length = 0;
  }
  ok(got !== null, 'the ball never met the rival');
  gte(got, 4, 'the impulse was recorded at a speed the collision cannot have had');
  lte(ballAfter, 18, 'the ball came out of the collision faster than it went in');
  gte(banked, 1.0, 'an infinite mass: the collision handed the rival nothing. ' +
      'J = -(1+E)*rel*m/(m+1) and the body takes -J/m — that branch IS the rival marble');
  // ...and physics never INTEGRATES a hazard's motion: it only ever hands it a number,
  // which the hazard spends at the top of its own update.
  gte(Math.abs(riv.vx) + Math.abs(riv.vy), 0.5, 'the rival never spent what it was handed');

  // A world body with no mass takes nothing back, which is the other half of the branch.
  var c2 = build();
  c2.hazards = [{ name: 'tree', x: 20, y: 3.5, phase: 0 }];
  var run2 = PL.newRun(c2);
  var tree = run2.bodies[0];
  run2.ball.x = 17; run2.ball.vx = 18;
  for (var t = 0; t < 120 * 3; t++) PL.tick(run2, 0, 0);
  near(tree.x, 20, 1e-9, 'a tree was pushed by the ball — it has no mass, so it is the world');

  // And the rival can be knocked clean off the paper, which is what makes leading it over
  // an edge a real move.
  var c3 = build();
  c3.hazards = [{ name: 'rival', x: 20, y: 6.6, phase: 0 }];
  var run3 = PL.newRun(c3);
  var r3 = run3.bodies[0];
  run3.ball.x = 20; run3.ball.y = 5.4; run3.ball.vy = 24;
  var down = false;
  for (var q = 0; q < 120 * 4; q++) {
    PL.tick(run3, 0, 0);
    if (r3.downT > 0 || !r3.active) { down = true; break; }
  }
  ok(down, 'the rival could not be rammed off the paper');
});

test(28, 'the vacuum pulls, and inside its hold nothing gets out', function () {
  // The muncher never chases: it pulls from r tiles, rising linearly to `pull` at the
  // mouth, so there is an exact radius r*(1 - K/pull) inside which no amount of input
  // climbs back out. The renderer DRAWS that circle, because a point of no return you
  // cannot see is just an unfair death.
  var hold = PL.muncherHold(PL.CATALOG.muncher);
  near(hold, 1.2, 1e-9, 'the hold radius is not r*(1 - K/pull)');

  function build(bx) {
    var g = F.slab(PL, 40, 20, function () { return 30; });
    var c = F.shell(PL, g, { x: bx, y: 10 });
    c.hazards = [{ name: 'muncher', x: 20, y: 10, phase: 0 }];
    return c;
  }
  // Just inside the hold, driving flat out AWAY from it: it still eats the ball.
  var inRun = PL.newRun(build(20 - hold * 0.9));
  var eaten = false;
  for (var i = 0; i < 120 * 8; i++) {
    PL.tick(inRun, -1, 0);
    if (inRun.ball.state === PL.ST.SINK) { eaten = true; break; }
  }
  ok(eaten, 'full opposing input escaped from inside the point of no return');
  eq(inRun.ball.cause, 'eaten', 'the loss was not named as eaten');

  // Just outside it, the same input gets away — so the circle means what it says.
  var outRun = PL.newRun(build(20 - PL.CATALOG.muncher.r * 0.95));
  var escaped = false;
  for (var t = 0; t < 120 * 8; t++) {
    PL.tick(outRun, -1, 0);
    if (outRun.ball.x < 20 - PL.CATALOG.muncher.r - 1) { escaped = true; break; }
  }
  ok(escaped, 'a ball outside the hold radius could not pull away either — the field is ' +
     'not a point of no return, it is a wall');

  // And it PULLS: a passive ball at the field's edge is drawn in, which is the part that
  // takes your line before it takes your ball.
  var pullRun = PL.newRun(build(20 - PL.CATALOG.muncher.r * 0.7));
  var x0 = pullRun.ball.x;
  for (var q = 0; q < 60; q++) PL.tick(pullRun, 0, 0);
  gte(pullRun.ball.x, x0 + 0.1, 'the muncher did not pull a passive ball toward it');
});

test(29, 'a mallet flattens the ball, and a flat ball answers no key', function () {
  // `flatten` is what a Marble Madness hammer actually did: it never took the marble, it
  // took the marble's SHAPE.
  var g = F.slab(PL, 30, 14, function () { return 30; });
  var c = F.shell(PL, g, { x: 15, y: 7 });
  c.hazards = [{ name: 'mallet', x: 15, y: 7, phase: 0 }];
  var run = PL.newRun(c);
  var flat = false;
  for (var i = 0; i < 120 * 6 && !flat; i++) {
    PL.tick(run, 0, 0);
    if (run.ball.flat > 0) flat = true;
  }
  ok(flat, 'a mallet sweeping over the ball never flattened it');
  near(run.ball.flat, PL.CATALOG.mallet.flatten, 0.02, 'the flatten timer is not the catalog value');

  // Nine tenths of a second flat is nine tenths of a second of gravity with no say in it.
  var vx0 = run.ball.vx;
  var pushed = 0;
  for (var t = 0; t < 60 && run.ball.flat > 0; t++) {
    var before = run.ball.vx;
    PL.tick(run, 1, 0);
    if (run.ball.vx > before) pushed++;
  }
  eq(pushed, 0, 'a flattened ball answered the key — input is meant to be ignored entirely');
  lte(run.ball.vx, Math.abs(vx0) + 1e-9, 'a flattened ball gained speed from input');
});

test(30, 'a respawn holds the ball for RESPAWN_HOLD seconds', function () {
  // Two seconds, on the flag, with the world still running and no key answered. A blink is
  // decoration you can steer through; the hold is the price.
  var g = F.slab(PL, 12, 8, function () { return 30; });
  var c = F.shell(PL, g, { x: 6.5, y: 4.5 });
  c.hazards = [{ name: 'cart', x: 6.5, y: 2, phase: 0 }];
  var run = PL.newRun(c);
  run.ball.vx = 12;
  // Every wait in this suite is bounded. An unbounded one is fine until a mutation makes
  // the thing it waits for never happen, and then tests/mutate.js hangs instead of
  // reporting — which is exactly what it did the first time it was run against all 52.
  var guard = 0;
  while (run.falls === 0 && guard++ < 120 * 30) PL.tick(run, 0, 0);
  eq(run.falls, 1, 'the ball was never lost, so there was no respawn to time');
  near(run.holdT, PL.RESPAWN_HOLD, PL.DT * 1.01, 'the hold is not RESPAWN_HOLD long');

  var held = 0, moved = 0, cartMoved = 0;
  var cart = run.bodies[0];
  var cx0 = cart.x, cy0 = cart.y;
  while (run.holdT > 0 && held < 120 * 10) {
    PL.tick(run, 1, 1);                        // full input, ignored
    held++;
    if (Math.abs(run.ball.x - 6.5) > 1e-9 || Math.abs(run.ball.y - 4.5) > 1e-9) moved++;
    if (Math.abs(cart.x - cx0) + Math.abs(cart.y - cy0) > 0.05) cartMoved++;
  }
  near(held * PL.DT, PL.RESPAWN_HOLD, 0.03, 'the hold did not last RESPAWN_HOLD seconds');
  eq(moved, 0, 'the ball moved during the hold — input was answered');
  gte(cartMoved, 1, 'the world stopped during the hold; hazards must keep cycling behind it');
  // ...and the moment it ends, the key works again.
  PL.tick(run, 1, 0);
  gte(run.ball.vx, 1e-6, 'input was still ignored after the hold ended');
});

test(31, 'a ball falling past a tier is not snapped onto the top of it', function () {
  // LAW 5.4 — paper standing more than WALL_STEP above the ball is a CLIFF beside it, not
  // ground it is about to land on. Without the rule a ball falling down a cliff drifts
  // over the footprint of ground metres above it, satisfies z <= h, and climbs the cliff
  // it just fell off.
  var HI = 40, LO = 20;
  var g = F.slab(PL, 30, 9, function (i) { return i <= 10 ? HI : LO; });
  var c = F.shell(PL, g, { x: 16, y: 4.5 });
  c.deathZ = LO - PL.DEATH_DROP;
  var run = PL.newRun(c);
  // Airborne beside the cliff, BETWEEN the two tiers, and travelling straight into it.
  // Driving off the high lip the other way never comes back, so it tests nothing — which
  // is how this first passed against a build with the tier wall deleted outright.
  var b = run.ball;
  b.x = 13; b.z = LO + 8; b.vx = -20; b.air = true; b.vz = 0;
  // The ball starts at LO+8 and nothing in this scene can lift it: gravity only pulls, and
  // the wall rule only reflects it HORIZONTALLY. So "it never rose" is the whole assertion,
  // and it catches the snap directly. Gating on "while it is below the tier" does not: the
  // moment the ball is wrongly snapped onto the tier's top it stops being below it, and
  // the check quietly stops running — which is how this test first passed against a build
  // with the tier wall deleted outright.
  var start = b.z, reached = 99, ticks = 0;
  for (var i = 0; i < 120 * 4; i++) {
    PL.tick(run, 0, 0);
    if (b.state !== PL.ST.ROLL) break;
    ticks++;
    if (b.x < reached) reached = b.x;
    lte(b.z, start + 1e-9, 'the ball ROSE, from ' + start.toFixed(2) + ' to ' +
        b.z.toFixed(2) + ' at x=' + b.x.toFixed(2) + ' — it was snapped onto the top of a ' +
        'tier it was falling past');
    // ...and it may not walk into the cliff face either.
    gte(b.x, 10 - 2 * PL.BALL_R - 0.05, 'the ball drove ' + (10 - b.x).toFixed(2) +
        ' tiles into the face of the tier at z=' + b.z.toFixed(2));
  }
  gte(ticks, 30, 'the ball never spent time beside the cliff, so nothing was tested');
  lte(reached, 11.5, 'the ball never actually reached the cliff face');
});

test(44, 'a falling ball is still stopped by the paper, not carried through it', function () {
  // The same law, in FALL state. A falling ball with no mask test drifts up to 64 units
  // INSIDE solid paper — and "sometimes the ball is glitching through the edges of the
  // map" is what that looks like from the outside.
  var HI = 40;
  var g = F.slab(PL, 30, 9, function () { return HI; });
  var c = F.shell(PL, g, { x: 25, y: 4.5 });
  c.deathZ = HI - 30;                          // a long fall, so FALL state runs for a while
  var run = PL.newRun(c);
  run.ball.vx = -24;                           // hard back INTO the slab as it drops
  run.ball.state = PL.ST.FALL;
  run.ball.z = HI - 12;                        // already below the paper, beside it
  run.ball.x = 31;                             // just off the +x lip

  var deepest = 0;
  for (var i = 0; i < 120 * 3; i++) {
    PL.tick(run, 0, 0);
    if (run.ball.state !== PL.ST.FALL) break;
    if (PL.solidAt(run.grid, run.ball.x, run.ball.y) === 1) {
      var into = 30 - run.ball.x;              // how far inside the slab's footprint
      if (into > deepest) deepest = into;
    }
  }
  lte(deepest, 2 * PL.BALL_R + 0.05,
      'a falling ball drove ' + deepest.toFixed(2) + ' tiles into solid paper');
});

test(32, 'the tube holds its rim and the funnel closes on its throat', function () {
  // A tube is a chute you can LIVE IN: the rim is flat-topped across the middle 64% and
  // folded away over the first and last 18%, so both ends seam flat against a pad.
  var tube = PL.tubeX(0, 0, 20, 8, 30, 0, 1.2);
  var rimMid = PL.pieceHeight(tube, 10, 0) - PL.pieceHeight(tube, 10, 4);
  near(rimMid, 1.2, 1e-9, 'the tube does not reach its full bank across the middle');
  for (var u = 0.20; u <= 0.80; u += 0.05) {
    var rim = PL.pieceHeight(tube, u * 20, 0) - PL.pieceHeight(tube, u * 20, 4);
    near(rim, 1.2, 1e-9, 'the tube rim is not FLAT-TOPPED at u=' + u.toFixed(2));
  }
  near(PL.pieceHeight(tube, 0, 0), 30, 1e-9, 'the tube mouth is not flat');
  near(PL.pieceHeight(tube, 20, 0), 30, 1e-9, 'the tube exit is not flat');

  // LAW 6.3 — every banking envelope opens and closes, so no joint is a launch ramp.
  ['chute', 'crown', 'bank', 'funnel'].forEach(function (kind) {
    var p = kind === 'chute' ? PL.chuteX(0, 0, 16, 8, 30, 0, 1.4)
          : kind === 'crown' ? PL.crownX(0, 0, 16, 8, 30, 0, 1.4)
          : kind === 'bank'  ? PL.bankX(0, 0, 16, 8, 30, 0, 1.4)
          :                    PL.funnelX(0, 0, 16, 8, 30, 0, 1.4, 0.4);
    for (var t = 0; t <= 8; t++) {
      near(PL.pieceHeight(p, 0, t), 30, 1e-9, kind + ' does not meet a pad flat at its mouth');
      near(PL.pieceHeight(p, 16, t), 30, 1e-9, kind + ' does not meet a pad flat at its exit');
    }
  });

  // A funnel's walls CONVERGE on a throat. The measure is where the wall SATURATES — the
  // half-width past which it is at its full local height — because that is the corridor
  // the piece leaves open, and it is lerp(1, throat, u) by construction. Measuring a
  // fixed-height contour instead measures the sin envelope closing, which does the
  // opposite near the exit and says a funnel does not converge when it plainly does.
  var fun = PL.funnelX(0, 0, 20, 8, 30, 0, 1.2, 0.4);
  function satHalfWidth(u) {
    var full = 30 + 1.2 * Math.sin(Math.PI * u);
    for (var t = 0.5; t <= 1.0; t += 0.002) {
      if (PL.pieceHeight(fun, u * 20, t * 8) >= full - 1e-9) return (t - 0.5) * 2;
    }
    return 1;
  }
  var prev = Infinity;
  [0.2, 0.4, 0.6, 0.8, 0.95].forEach(function (u) {
    var w = satHalfWidth(u);
    lte(w, prev + 1e-9, 'the funnel widens between u=' + u + ' and the sample before it');
    prev = w;
  });
  lte(satHalfWidth(0.95), satHalfWidth(0.2) * 0.6,
      'the funnel barely narrows: ' + satHalfWidth(0.2).toFixed(3) + ' -> ' +
      satHalfWidth(0.95).toFixed(3));
});

test(33, 'the tier shortcut is measurably shorter than the leg it skips', function () {
  // THE AERIAL is the only course with a declared skip, and the shortcut has to actually
  // BE a shortcut. Measured in course length along the authored routes.
  var idx = -1;
  for (var i = 0; i < PL.courseCount(); i++)
    if (PL.getCourse(i).flags.some(function (f) { return !!f.skip; })) idx = i;
  gte(idx, 0, 'no course declares a skip at all — the tier shortcut does not exist');
  var c = PL.getCourse(idx);

  var skipped = -1, skipRoute = -1;
  c.flags.forEach(function (f, fi) {
    if (f.skip) { skipped = fi; skipRoute = f.skip[0]; }
  });
  var full = -1;
  for (var r = 0; r < c.routes.length; r++) if (r !== skipRoute) { full = r; break; }

  lte(c.routes[skipRoute].total, c.routes[full].total - 3,
      'the shortcut route is ' + c.routes[skipRoute].total.toFixed(1) +
      ' against the long way at ' + c.routes[full].total.toFixed(1) + ' — not measurably shorter');
  // It must also genuinely cross a void onto ground BELOW the lip: a shortcut that is just
  // a narrower path is not a tier.
  var tiers = V.tiers(c).filter(function (t) { return t.route === skipRoute && t.drop > 1.5; });
  gte(tiers.length, 1, 'the shortcut route crosses no real tier');
  // Exactly one flag in the whole game may be declared skip.
  var skips = 0;
  for (var q = 0; q < PL.courseCount(); q++)
    PL.getCourse(q).flags.forEach(function (f) { if (f.skip) skips++; });
  eq(skips, 1, 'there is more than one declared skip in the game');
  void skipped;
});

test(47, 'a trigger is on the ground, so a ball flying over it claims nothing', function () {
  // LAW 10.4 — every trigger, the cup included, needs a height term, or a ball six units
  // ABOVE the cup holes out. It is gated on the TRIGGER'S OWN ground, never on the ball's
  // lift: lift reads zero over the void, which is exactly where a jumped gate is.
  for (var i = 0; i < PL.courseCount(); i++) {
    var c = PL.getCourse(i);
    var run = PL.newRun(c, 0);
    var tag = 'course ' + i + ' ' + c.name + ': ';

    // On the ground at the cup: it holes out.
    run.ball.x = c.cup.x; run.ball.y = c.cup.y;
    run.ball.z = PL.heightAt(run.grid, c.cup.x, c.cup.y);
    run.holdT = 0;
    PL.tick(run, 0, 0);
    eq(run.ball.state, PL.ST.HOLED, tag + 'a ball sitting in the cup did not hole out');

    // The same place, WALL_STEP + a hand's width above it: nothing.
    var high = PL.newRun(c, 0);
    high.ball.x = c.cup.x; high.ball.y = c.cup.y;
    high.ball.z = PL.heightAt(high.grid, c.cup.x, c.cup.y) + PL.WALL_STEP + 0.2;
    high.holdT = 0;
    PL.tick(high, 0, 0);
    ok(high.ball.state !== PL.ST.HOLED, tag + 'a ball above the cup holed out');

    c.flags.forEach(function (f, fi) {
      var hf = PL.newRun(c, 0);
      hf.ball.x = f.x; hf.ball.y = f.y;
      hf.ball.z = PL.heightAt(hf.grid, f.x, f.y) + PL.WALL_STEP + 0.2;
      hf.holdT = 0;
      PL.tick(hf, 0, 0);
      ok(!hf.flagsHit[fi], tag + 'flag ' + fi + ' was claimed from above it');
      var lo = PL.newRun(c, 0);
      lo.ball.x = f.x; lo.ball.y = f.y;
      lo.ball.z = PL.heightAt(lo.grid, f.x, f.y);
      lo.holdT = 0;
      PL.tick(lo, 0, 0);
      ok(lo.flagsHit[fi], tag + 'flag ' + fi + ' was NOT claimed from on top of it');
    });
  }
});

// ============================================================================
// THE LADDER, THE SLOPE, AND THE ABSENT LOSING PHASE
// ============================================================================

test(10, 'flag counts rise, and two courses share each count', function () {
  var counts = courses().map(function (c) { return c.flags.length; });
  eq(counts.join(','), '3,3,4,4,5,5', 'flag counts are ' + counts.join(','));
  for (var i = 1; i < counts.length; i++)
    gte(counts[i], counts[i - 1], 'flag counts fall between course ' + i + ' and ' + (i + 1));
  var tally = {};
  counts.forEach(function (n) { tally[n] = (tally[n] || 0) + 1; });
  Object.keys(tally).forEach(function (k) {
    eq(tally[k], 2, 'flag count ' + k + ' is used ' + tally[k] + ' times, not twice');
  });
});

test(13, 'gravity can beat the player somewhere in the game', function () {
  // LAW 5.2 — the first build had every slope below critical, which alone removed the
  // difficulty. INTERIOR means every cell within a margin of 2 is also solid: measuring
  // the whole grid instead reports the deliberately steep rim of a chute or a funnel —
  // decoration that exists to turn a drifting ball back — rather than the ground anyone
  // rolls on.
  var best = 0, where = null, ci = -1;
  eachCourse(function (c, i) {
    var m = V.maxSlope(c, true);
    if (m.slope > best) { best = m.slope; where = m.at; ci = i; }
  });
  gte(best, PL.SLOPE_CRIT, 'the steepest interior ground in the whole game is ' +
      best.toFixed(3) + ', under SLOPE_CRIT ' + PL.SLOPE_CRIT.toFixed(2) +
      ' — gravity can never beat the player');

  // ...and it has to be ground the player MEETS. Steep scenery in a corner nothing routes
  // near is exactly the decoration the law is written against.
  var c = PL.getCourse(ci), near2 = Infinity;
  c.routes.forEach(function (r) {
    near2 = Math.min(near2, Math.sqrt(PL.project(r, where[0], where[1]).d2));
  });
  lte(near2, 8, 'the steepest interior ground in the game (course ' + (ci + 1) + ' at ' +
      JSON.stringify(where) + ') is ' + near2.toFixed(1) + ' tiles from any route');
});

test(14, 'nothing but the cup can end a course', function () {
  // Any quantity that can reach zero and stop the player is the life system this design
  // already cut. The first build reinvented it twice — as a stroke limit, then as a
  // countdown clock — and carried an unreachable game-over state for six iterations.
  // Read through the loader, not straight off disk: this is the one test that reads the
  // CODE rather than running it, and reading a file the mutation harness never touched is
  // how it became the one test nothing could falsify.
  var raw = LOAD.sourceText();
  // Comments stripped: this test is about what the CODE does. "EVERY NUMBER IN THE GAME
  // LIVES HERE" is a sentence, not a life system, and a scan that cannot tell the
  // difference is a scan nobody will keep.
  var src = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

  // 1. The states are exactly the eight, and none of them is a losing phase.
  var STATES = ['LOADING', 'MENU', 'SELECT', 'VIEWCARD', 'PLAY', 'PAUSE', 'CARD', 'ROUND'];
  var quoted = src.match(/APP\.state\s*===?\s*'([A-Z]+)'/g) || [];
  quoted.concat(src.match(/APP\.state\s*=\s*'([A-Z]+)'/g) || []).forEach(function (m) {
    var name = /'([A-Z]+)'/.exec(m)[1];
    ok(STATES.indexOf(name) !== -1, 'an undeclared game state exists: ' + name);
  });
  // Named for what they ARE, not for a word they contain: `RSTAT.strokes` counts canvas
  // paths and `ctx.stroke` is how a line gets drawn. What is forbidden is a QUANTITY THAT
  // CAN REACH ZERO AND STOP THE PLAYER.
  [/STROKES?\s*[:=]?\s*\d/, /\+\s*1\s*STROKE/i, /stroke(Count|Limit|Budget|sLeft|sUsed)/i,
   /GAME_?OVER/i, /LOSE_?SCREEN/i, /\blives\b/i, /\bcountdown\b/i,
   /time(Left|Remaining)/i, /seconds(Left|Remaining)/i, /attempts(Left|Remaining)/i,
   /\bpar\s*budget\b/i].forEach(function (re) {
    var m = re.exec(src);
    ok(!m, 'the sources contain ' + re + ' at offset ' + (m ? m.index : -1) +
       ' — that is the life system arriving in a new hat');
  });

  // Structurally: there is exactly ONE place the ball's state becomes HOLED, and it is the
  // cup's own trigger. Nothing else in the game may end a course.
  var holed = src.split('state = ST.HOLED').length - 1;
  eq(holed, 1, 'the ball is put into HOLED from ' + holed + ' places');
  var cupIdx = src.indexOf('triggerHit(run, c.cup.x, c.cup.y, c.cup.r)');
  var holeIdx = src.indexOf('state = ST.HOLED');
  ok(cupIdx > 0 && holeIdx > cupIdx && holeIdx - cupIdx < 120,
     'the one HOLED assignment is not inside the cup trigger');

  // 2. And behaviourally: lose the ball fifty times and the course is still there to play.
  var g = F.slab(PL, 12, 8, function () { return 30; });
  var c = F.shell(PL, g, { x: 6.5, y: 4.5 }, { x: 6.5, y: 4.5, r: 0.9 });
  c.cup = { x: -999, y: -999, r: 0.9, z: 0 };
  var run = PL.newRun(c);
  for (var i = 0; i < 50; i++) {
    run.ball.vx = 14;
    var guard = 0;
    var was = run.falls;
    while (run.falls === was && guard++ < 120 * 20) PL.tick(run, 0, 0);
    eq(run.falls, was + 1, 'the ball could not be lost on attempt ' + i);
    var g2 = 0;
    while (run.holdT > 0 && g2++ < 120 * 10) PL.tick(run, 0, 0);
    eq(run.ball.state, PL.ST.ROLL, 'after ' + (i + 1) + ' losses the ball did not come back');
  }
  eq(run.falls, 50, 'fifty losses were not all counted');
  ok(run.clock > 0, 'the clock stopped');
  ok(isFinite(run.clock), 'the clock is not a number any more');
  // Nothing anywhere counts down toward a limit.
  ok(PL.netTime(run) >= 0, 'net time went negative');
});

// ============================================================================
// GATES AND THE CLOCK
// ============================================================================

test(36, 'every checkpoint is a gate, not a marker on a plaza', function () {
  // LAW 10.1/10.2 — the first build put every flag in the middle of a junction 11 to 50
  // tiles wide with a fixed 1.5-tile disc. The fix is not a bigger disc: a bigger disc on
  // a plaza is still a disc on a plaza. The fix is the GROUND.
  eachCourse(function (c, i) {
    var bad = V.flagIssues(c);
    ok(!bad.length, 'course ' + (i + 1) + ' ' + c.name + ':\n    ' +
       bad.map(function (b) { return 'flag ' + b.f + ': ' + b.why; }).join('\n    '));
    c.flags.forEach(function (f, fi) {
      var ga = PL.gateAt(c.grid, f.x, f.y);
      // Derived from the paper measured there, never typed.
      near(f.r, Math.max(PL.GATE_R_MIN, Math.max(f.x - ga.lo, ga.hi - f.x, f.y - ga.lo,
           ga.hi - f.y) >= 0 ? ga.r : ga.r), 1e-9,
           'course ' + (i + 1) + ' flag ' + fi + ' has a radius that is not the derived one');
      lte(ga.cross, PL.NECK_MAX, 'course ' + (i + 1) + ' flag ' + fi + ' stands on ' +
          ga.cross + ' tiles of paper across the run');
    });
  });
});

test(37, 'there is no line across a gate that misses the flag on it', function () {
  // Walk the WHOLE cross-section and check the trigger reaches every place a ball's centre
  // can physically be. A checkpoint the player can roll past is not a checkpoint.
  eachCourse(function (c, i) {
    c.flags.forEach(function (f, fi) {
      var ga = PL.gateAt(c.grid, f.x, f.y);
      var lo = ga.lo + PL.BALL_R, hi = ga.hi - PL.BALL_R;
      gte(hi, lo, 'course ' + (i + 1) + ' flag ' + fi + ': no ball fits across this gate at all');
      var worst = 0, at = 0;
      for (var p = lo; p <= hi + 1e-9; p += 0.02) {
        var dx = ga.axis === 0 ? p - f.x : 0;
        var dy = ga.axis === 0 ? 0 : p - f.y;
        var d = Math.hypot(dx, dy);
        if (d > worst) { worst = d; at = p; }
      }
      lte(worst, f.r + 1e-9, 'course ' + (i + 1) + ' ' + c.name + ' flag ' + fi +
          ': a ball centred at ' + at.toFixed(2) + ' on the cross-section is ' +
          worst.toFixed(2) + ' from the flag, outside its ' + f.r.toFixed(2) + ' trigger');
      // ...and prove it in the SIMULATION, not just in arithmetic: set the ball down at
      // each extreme of the cross-section and tick once.
      [lo, (lo + hi) / 2, hi].forEach(function (p2) {
        var run = PL.newRun(c, 0);
        run.holdT = 0;
        run.ball.x = ga.axis === 0 ? p2 : f.x;
        run.ball.y = ga.axis === 0 ? f.y : p2;
        run.ball.z = PL.heightAt(run.grid, run.ball.x, run.ball.y);
        PL.tick(run, 0, 0);
        ok(run.flagsHit[fi], 'course ' + (i + 1) + ' flag ' + fi +
           ': a ball at ' + p2.toFixed(2) + ' across the gate did not claim it');
      });
    });
  });
});

test(38, 'driving a route claims every flag on it, in the simulation', function () {
  eachCourse(function (c, i) {
    c.routes.forEach(function (r, ri) {
      var res = drive(i, ri);
      ok(res.ok, 'course ' + (i + 1) + ' route ' + ri + ' did not finish');
      var want = 0, got = 0;
      c.flags.forEach(function (f, fi) {
        if (f.skip && f.skip.indexOf(ri) !== -1) return;
        want++;
        if (res.flags[fi]) got++;
      });
      eq(got, want, 'course ' + (i + 1) + ' route ' + ri + ' claimed ' + got + ' of ' +
         want + ' checkpoints it passed');
      // A declared skip is a skip: the route must NOT have claimed it.
      c.flags.forEach(function (f, fi) {
        if (f.skip && f.skip.indexOf(ri) !== -1)
          ok(!res.flags[fi], 'course ' + (i + 1) + ' route ' + ri +
             ' claimed flag ' + fi + ', which it declares it skips');
      });
    });
  });
});

test(39, 'nothing on any course is a bigger flat square than the tee', function () {
  // LAW 6.8 — every tee is 8x8, and a 12-to-14-tile flat junction is a second starting pad
  // in the middle of the level. The floor is 9 rather than 8 because a junction carrying a
  // chaser must fit its 5.3-tile disc; that floor is set by the threat, not by the author.
  eachCourse(function (c, i) {
    var sq = V.largestFlatSquare(c);
    lte(sq.size, 9, 'course ' + (i + 1) + ' ' + c.name + ' has a ' + sq.size + 'x' +
        sq.size + ' flat square at ' + JSON.stringify(sq.at));
    // And LAW 6.7: a wide pad must CONTAIN something or it is a rest.
    var rest = V.restRatio(c);
    lte(rest.ratio, 0.07, 'course ' + (i + 1) + ' is ' + (rest.ratio * 100).toFixed(1) +
        '% flat, four tiles clear in every direction, with no hazard within five');
  });
});

test(40, 'the clock counts up, a checkpoint knocks seconds off it, and it pays once', function () {
  // LAW 11.1 — Marble Madness counts DOWN and a checkpoint adds; that clock can hit zero,
  // and a clock that can hit zero is the life system wearing a stopwatch.
  var c = PL.getCourse(0);
  var run = PL.newRun(c, 0);
  var t0 = run.clock;
  for (var i = 0; i < 120; i++) PL.tick(run, 0, 0);
  near(run.clock - t0, 1.0, 1e-9, 'the clock did not count UP one second in 120 ticks');
  eq(run.credit, 0, 'credit before any checkpoint');

  // Sit the ball on flag 0 and tick: the credit arrives, exactly once.
  var f = c.flags[0];
  run.holdT = 0;
  run.ball.x = f.x; run.ball.y = f.y;
  run.ball.z = PL.heightAt(run.grid, f.x, f.y);
  PL.tick(run, 0, 0);
  eq(run.credit, c.bonus, 'a checkpoint did not pay `bonus` seconds');
  near(run.receipt, PL.RECEIPT_TIME - PL.DT, PL.DT, 'no receipt was raised beside the clock');
  eq(run.receiptVal, c.bonus, 'the receipt does not say what was paid');
  for (var q = 0; q < 240; q++) PL.tick(run, 0, 0);
  eq(run.credit, c.bonus, 'the same checkpoint paid more than once');

  // The DRAIN is in the simulation, not the renderer, so a headless test can assert the
  // credit arrives — a number that jumps reads as a glitch.
  var run2 = PL.newRun(c, 0);
  run2.holdT = 0;
  run2.ball.x = f.x; run2.ball.y = f.y;
  run2.ball.z = PL.heightAt(run2.grid, f.x, f.y);
  PL.tick(run2, 0, 0);
  ok(run2.creditShown < run2.credit, 'the credit was shown in full immediately — it jumped');
  var steps = 0;
  while (run2.creditShown < run2.credit - 1e-9 && steps < 600) { PL.tick(run2, 0, 0); steps++; }
  near(steps * PL.DT, c.bonus / PL.CREDIT_DRAIN, 0.03,
       'the credit did not drain at CREDIT_DRAIN seconds per second');
  near(run2.creditShown, run2.credit, 1e-9, 'the drained number never caught the exact one');

  // The flag's raise animation is in the simulation too, for the same reason.
  ok(run2.flagRaise[0] > 0, 'the flag did not begin to raise');
  var r3 = PL.newRun(c, 0);
  r3.flagsHit[0] = true;
  for (var s = 0; s < Math.ceil(PL.FLAG_RAISE / PL.DT) + 4; s++) PL.tick(r3, 0, 0);
  eq(r3.flagRaise[0], 1, 'the flag never finished raising');
});

test(41, 'the score stops in the cup and cannot go below zero', function () {
  var c = PL.getCourse(0);
  var run = PL.newRun(c, 0);
  run.holdT = 0;
  run.ball.x = c.cup.x; run.ball.y = c.cup.y;
  run.ball.z = PL.heightAt(run.grid, c.cup.x, c.cup.y);
  PL.tick(run, 0, 0);
  eq(run.ball.state, PL.ST.HOLED, 'the ball did not hole out');
  var stopped = run.clock;
  for (var i = 0; i < 240; i++) PL.tick(run, 0, 0);
  near(run.clock, stopped, 1e-9, 'the clock kept running after the cup');
  gte(run.holeT, 1.9, 'the hole-out animation timer did not advance');

  // Net time is clock - credit, CLAMPED AT ZERO. Nothing here is a budget: a credit larger
  // than the clock is a zero, not a negative, and not a failure.
  run.credit = run.clock + 100;
  eq(PL.netTime(run), 0, 'net time went below zero');
  run.credit = 0;
  near(PL.netTime(run), run.clock, 1e-9, 'net time is not clock minus credit');
});

test(42, 'a flawless run rates between BIRDIE and PAR on every authored route', function () {
  // This is what pins parTime. A par that drifts out of a clean run's reach turns the
  // suite red, which is the point: the course is the wrong length, not the number.
  eachCourse(function (c, i) {
    c.routes.forEach(function (r, ri) {
      var res = drive(i, ri);
      ok(res.ok, 'course ' + (i + 1) + ' route ' + ri + ' did not finish');
      eq(res.falls, 0, 'course ' + (i + 1) + ' route ' + ri + ' was not flawless');
      var net = Math.max(0, res.clock - res.credit);
      var shots = PL.timeShots(net, c.parTime);
      ok(shots >= -1 && shots <= 0,
         'course ' + (i + 1) + ' ' + c.name + ' route ' + ri + ': a flawless run nets ' +
         net.toFixed(1) + ' against par ' + c.parTime + ' (band ' +
         PL.bandStep(c.parTime).toFixed(2) + ') which rates ' + PL.shotName(shots) +
         ' — BIRDIE or PAR is the band');
    });
  });
  // The bands themselves, at the numbers the spec names.
  eq(PL.shotName(-3), 'ALBATROSS'); eq(PL.shotName(-2), 'EAGLE');
  eq(PL.shotName(-1), 'BIRDIE');    eq(PL.shotName(0), 'PAR');
  eq(PL.shotName(1), 'BOGEY');      eq(PL.shotName(2), 'DOUBLE BOGEY');
  eq(PL.timeShots(-1000, 20), -4, 'timeShots is not clamped below');
  eq(PL.timeShots(100000, 20), 12, 'timeShots is not clamped above');
  eq(PL.bandStep(4), 3, 'the band has no 3-second floor');
  eq(PL.bandStep(40), 10, 'the band is not a quarter of par');
  // ...and the round adds up in shots, which is the only form a round adds up in.
  eq(PL.roundTitle(-4), 'CLUB CHAMPION'); eq(PL.roundTitle(-1), 'UNDER PAR');
  eq(PL.roundTitle(0), 'PAR'); eq(PL.roundTitle(5), 'BOGEY GOLFER');
  eq(PL.roundTitle(6), 'WEEKEND HACKER');
});

test(43, 'the HUD prints the clock, and a course card prints what was banked', function () {
  var ctx = CV.recordingCanvas();
  var run = PL.newRun(PL.getCourse(0), 0);
  for (var i = 0; i < 400; i++) PL.tick(run, 0, 0);
  run.banner = { cause: 'water', t: 1.2 };
  PL.APP.course = 0; PL.APP.perf = true;
  PL.drawHUD(ctx, run);
  var text = ctx.ops.filter(function (o) { return o.op === 'text'; })
                    .map(function (o) { return o.text; });
  ok(text.some(function (t) { return /^\d\d:\d\d\.\d$/.test(t); }),
     'the HUD printed no clock: ' + JSON.stringify(text));
  ok(text.indexOf('PRACTICE GREEN') !== -1, 'the HUD did not name the course');
  ok(text.some(function (t) { return /^BALL LOST — WATER$/.test(t); }),
     'the loss banner does not name the state and its cause: ' + JSON.stringify(text));
  ok(text.some(function (t) { return /fills \d+/.test(t); }), 'F3 printed no path counts');

  // The card banks the EXACT credit, not the drained one: hole out half a second after the
  // last flag and the two disagree, and the card is the one that has to be right.
  PL.APP.save = PL.blankSave(PL.courseCount());
  PL.APP.run = run;
  run.credit = 9; run.creditShown = 2; run.clock = 24;
  run.ball.state = PL.ST.HOLED;
  PL.bankCourse();
  eq(PL.APP.state, 'CARD', 'holing out did not produce a course card');
  near(PL.APP.lastCard.net, 15, 1e-9, 'the card banked the DRAINED credit, not the exact one');
  eq(PL.APP.lastCard.name, 'PRACTICE GREEN');
  eq(PL.APP.save.cards[0].net, 15, 'the save did not record the net time');

  var card = CV.recordingCanvas();
  PL.drawCard(card);
  var ct = card.ops.filter(function (o) { return o.op === 'text'; }).map(function (o) { return o.text; });
  ok(ct.indexOf('PRACTICE GREEN') !== -1, 'the card does not name the course');
  ok(ct.indexOf('NET') !== -1 && ct.indexOf('PAR') !== -1, 'the card prints no net or par');
  ok(ct.some(function (t) { return t === PL.shotName(PL.APP.lastCard.shots); }),
     'the card does not print what it rated: ' + JSON.stringify(ct));
  PL.APP.state = 'MENU'; PL.APP.run = null; PL.APP.perf = false;
});

// ============================================================================
// RENDER, AUDIO AND CULL
// ============================================================================

test(34, 'the frame paints the surfaces that carry rules', function () {
  // A surface with a rule has to be visible as itself. The complaint this exists for is
  // "the sand traps and the water are just blocks that are colored differently" — the
  // shape is geometry, but if the colour never reaches the canvas there is nothing to
  // read at all.
  var want = [PL.SURF.WATER, PL.SURF.SAND, PL.SURF.BELT, PL.SURF.FRAGILE];
  var seen = {};
  for (var ci = 0; ci < PL.courseCount(); ci++) {
    for (var s = 0; s <= 1.0001; s += 0.05) {
      var f = poseFrame(ci, Math.min(1, s));
      var styles = {};
      f.ctx.ops.forEach(function (o) { if (o.op === 'fill') styles[String(o.style)] = 1; });
      want.forEach(function (sf) {
        for (var k = 0; k < PL.SHADES; k++)
          if (styles[PL.SHADE_TABLE[sf][k]]) seen[sf] = (seen[sf] || 0) + 1;
      });
    }
  }
  want.forEach(function (sf) {
    gte(seen[sf] || 0, 1, 'no frame anywhere in the game painted ' + PL.SURF_NAME[sf] +
        ' — the rule is there and the surface is not');
  });
  // CRACKED is what the renderer reads once fragile paper has been touched, so it has to
  // be a different colour from FRAGILE or the tell does not exist.
  ok(PL.SHADE_TABLE[PL.SURF.CRACKED][7] !== PL.SHADE_TABLE[PL.SURF.FRAGILE][7],
     'cracked paper is the same colour as whole paper');
  // ...and the warn mark is ONE mark, painted on the ground, not a colour scheme.
  var props = poseFrame(5, 0.55).ctx.ops.filter(function (o) {
    return o.op === 'fill' && String(o.style).indexOf('255,166,58') !== -1;
  });
  gte(props.length, 0);
});

test(35, 'the rolling channel is noise shaped by the ground, not an engine', function () {
  var WA = require('./webaudio.js');
  var ctx = WA.fakeAudio();
  PL.AUD = null;
  PL.setAudioFactory(function () { return ctx; });
  var a = PL.ensureAudio();
  ok(a, 'the audio graph would not build');

  // 1. THE BED IS NOISE. Everything feeding the rolling gain must trace back to a buffer
  //    source, and not one oscillator may appear anywhere in that chain.
  var feed = ctx.feeding(a.rollGain);
  var kinds = feed.map(function (n) { return n._kind; });
  ok(kinds.indexOf('bufferSource') !== -1, 'the rolling bed has no noise source at all');
  eq(kinds.filter(function (k) { return k === 'oscillator'; }).length, 0,
     'there is an OSCILLATOR in the rolling bed: ' + kinds.join(','));
  ok(kinds.indexOf('biquad') !== -1, 'the noise is not filtered');
  // The loop really is a seeded buffer, not silence, and not a sample.
  var data = a.buf.getChannelData(0);
  var nz = 0, sum = 0;
  for (var i = 0; i < data.length; i++) { if (data[i] !== 0) nz++; sum += data[i] * data[i]; }
  gte(nz / data.length, 0.99, 'the noise buffer is mostly silence');
  gte(Math.sqrt(sum / data.length), 0.3, 'the noise buffer is too quiet to be noise');
  near(a.buf.length / ctx.sampleRate, PL.NOISE_SECONDS, 0.01, 'the loop is not NOISE_SECONDS long');
  // Deterministic: the same seed, the same buffer.
  var b2 = ctx.createBuffer(1, 4096, 44100);
  PL.fillNoise(b2.getChannelData(0), 4096);
  var b3 = ctx.createBuffer(1, 4096, 44100);
  PL.fillNoise(b3.getChannelData(0), 4096);
  for (var q = 0; q < 4096; q++)
    if (b2.getChannelData(0)[q] !== b3.getChannelData(0)[q])
      throw new Error('the noise loop is not deterministic at sample ' + q);

  // 2. SPEED OPENS AND BRIGHTENS IT.
  function sample(sp, bank) {
    var g = F.slab(PL, 40, 9, function () { return 30; });
    var run = PL.newRun(F.shell(PL, g, { x: 10, y: 4.5 }));
    run.holdT = 0;
    run.ball.vx = sp; run.ball.bank = bank; run.ball.lift = 0;
    PL.audioRoll(a, run);
    return { f: a.bp.frequency.value, q: a.bp.Q.value, g: a.rollGain.gain.value };
  }
  var slow = sample(2, 0), fast = sample(22, 0);
  gte(fast.f, slow.f * 1.5, 'speed does not brighten the band: ' +
      slow.f.toFixed(0) + ' -> ' + fast.f.toFixed(0) + ' Hz');
  gte(fast.g, slow.g * 3, 'speed does not open it: gain ' +
      slow.g.toFixed(4) + ' -> ' + fast.g.toFixed(4));
  gte(slow.f, PL.ROLL_LO * 0.8, 'the band starts below ROLL_LO');
  lte(fast.f, PL.ROLL_HI * 2.2, 'the band runs far past ROLL_HI');

  // 3. A BANK TIGHTENS IT — riding a tube's rim is audible before it is visible.
  var flat = sample(12, 0), leaning = sample(12, 0.5);
  gte(leaning.q, flat.q * 1.5, 'a bank does not tighten the band: Q ' +
      flat.q.toFixed(2) + ' -> ' + leaning.q.toFixed(2));
  gte(leaning.f, flat.f * 1.05, 'a bank does not lift the band');

  // 4. THE SURFACE IS THE VOICE — the same speed on different ground is a different sound.
  function onSurf(surf) {
    var g = F.slab(PL, 40, 9, function () { return 30; }, surf);
    var run = PL.newRun(F.shell(PL, g, { x: 10, y: 4.5 }));
    run.holdT = 0;
    run.ball.vx = 12; run.ball.lift = 0;
    PL.audioRoll(a, run);
    return a.hp.frequency.value + ':' + a.bp.frequency.value.toFixed(1) + ':' + a.bp.Q.value.toFixed(2);
  }
  var voices = {};
  [PL.SURF.FAIRWAY, PL.SURF.GREEN, PL.SURF.SAND, PL.SURF.BELT, PL.SURF.FRAGILE]
    .forEach(function (sf) { voices[onSurf(sf)] = (voices[onSurf(sf)] || 0) + 1; });
  gte(Object.keys(voices).length, 5, 'the surfaces do not sound different from each other');

  // 5. The channel switches on LIFT, not on ball.air: the launch test makes `air` flicker
  //    on undulating ground and the rolling sound would stutter with it.
  var g2 = F.slab(PL, 40, 9, function () { return 30; });
  var run2 = PL.newRun(F.shell(PL, g2, { x: 10, y: 4.5 }));
  run2.holdT = 0; run2.ball.vx = 14; run2.ball.lift = 0; run2.ball.air = true;
  PL.audioRoll(a, run2);
  gte(a.rollGain.gain.value, 0.01, 'the rolling channel cut out on `air` alone');
  run2.ball.lift = PL.BALL_R;
  PL.audioRoll(a, run2);
  eq(a.rollGain.gain.value, 0, 'the rolling channel kept playing while the ball was lifted');
  gte(a.airGain.gain.value, 0.01, 'nothing plays while the ball is in the air');

  // 6. Mute really mutes, from any screen.
  PL.setMuted(true);
  eq(a.master.gain.value, 0, 'M did not mute');
  PL.setMuted(false);
  gte(a.master.gain.value, 0.1, 'unmuting did not restore the master gain');

  // 7. The layer reads the EVENT LIST and never inspects the world.
  var before = ctx._nodes.length;
  var run3 = PL.newRun(PL.getCourse(0), 0);
  run3.events.push({ kind: 'flag', a: 0 }, { kind: 'cup' }, { kind: 'crack' },
                   { kind: 'collapse' }, { kind: 'splash' }, { kind: 'eaten' },
                   { kind: 'land', a: 8 }, { kind: 'knock', a: 6 }, { kind: 'flatten' });
  PL.playEvents(run3);
  gte(ctx._nodes.length - before, 9, 'the one-shots did not reach the graph');
  eq(run3.events.length, 0, 'the audio layer did not drain the event list');
  PL.AUD = null;
  PL.setAudioFactory(null);
});

test(45, 'the ball is never painted over paper that is in front of it', function () {
  // LAW 4.5 — the ball is the exception to sorting on wx+wy. The moment it is off the paper
  // and below the paper beside it, height is the whole of the difference.
  //
  // The occluder is found here from the PROJECTION, independently of the renderer's own
  // march: two points share a pixel iff wx-wy is equal and (wx+wy)*(TILE/4) - wz*Z_SCALE is
  // equal, which parameterises the ray from the ball as (bx+t, by+t, bz + Z_BAND*t). Walked
  // at a fiftieth of a tile, against the renderer's tenth.
  function occluderBand(run, b) {
    var g = run.grid;
    for (var t = 0.02; t <= PL.BALL_REACH * 2; t += 0.02) {
      var x = b.x + t, y = b.y + t;
      if (PL.solidAt(g, x, y) !== 1) continue;
      if (b.z + PL.Z_BAND * t > PL.heightAt(g, x, y)) continue;
      return Math.floor(x) + Math.floor(y);
    }
    return null;
  }

  var testedOcclusion = 0, testedOver = 0;
  for (var ci = 0; ci < PL.courseCount(); ci++) {
    var c = PL.getCourse(ci);
    var r = c.routes[0];
    for (var s = 0; s <= 1.0001; s += 0.02) {
      var p = PL.pointAt(r, Math.min(1, s) * r.total);

      // (a) ON the paper: with nothing in front, the ball must be drawn AFTER the ground it
      //     is standing on. This is the half that "sort it first" fails.
      var on = PL.newRun(c, 0);
      on.ball.x = p.x; on.ball.y = p.y;
      on.ball.z = PL.heightAt(on.grid, p.x, p.y);
      if (PL.solidAt(on.grid, p.x, p.y) === 1 && occluderBand(on, on.ball) === null) {
        testedOver++;
        gte(PL.ballDepth(on), Math.floor(p.x) + Math.floor(p.y),
            'course ' + (ci + 1) + ': the ball at (' + p.x.toFixed(1) + ',' + p.y.toFixed(1) +
            ') sorts at ' + PL.ballDepth(on).toFixed(2) + ', behind the ground it stands on');
      }

      // (b) OFF the lip and below it — the case the law is written for: a marble that has
      //     dropped behind a ledge. Posed over the VOID, because a ball below the surface
      //     of its own solid cell is inside the paper, which is not a state the game has.
      for (var d = 1; d <= 7; d++) {
        var vx = p.x + d, vy = p.y + d;
        if (PL.solidAt(c.grid, vx, vy) === 1) continue;
        [-1.5, -4, -9].forEach(function (dz) {
          var run = PL.newRun(c, 0);
          run.ball.x = vx; run.ball.y = vy;
          run.ball.z = PL.heightAt(run.grid, p.x, p.y) + dz;
          var key = PL.ballDepth(run);
          var occ = occluderBand(run, run.ball);
          if (occ === null) return;
          testedOcclusion++;
          lte(key, occ - 1e-9, 'course ' + (ci + 1) + ': the ball at (' + vx.toFixed(2) + ',' +
              vy.toFixed(2) + ',' + run.ball.z.toFixed(2) + ') sorts at ' + key.toFixed(2) +
              ' but paper in front of it is in band ' + occ + ' — it would be painted over it');
        });
        break;
      }
    }
  }
  gte(testedOcclusion, 20, 'no pose in the whole game had paper in front of the ball — ' +
      'the occlusion half of this test never ran');
  gte(testedOver, 200, 'the "drawn over its own ground" half barely ran');

  // And the SINK case is composed at the water's own depth, not dragged behind a ledge.
  var c0 = PL.getCourse(0);
  var sunk = PL.newRun(c0, 0);
  sunk.ball.state = PL.ST.SINK;
  sunk.ball.z -= 3;
  near(PL.ballDepth(sunk), sunk.ball.x + sunk.ball.y + PL.PROP_BIAS, 1e-9,
       'a sinking ball does not keep the flat sort key');
});

test(46, 'the frame does not ask the rasteriser for work it cannot see', function () {
  // LAW 12.2 — a frame costs what it hands the canvas. Every path is tessellated again
  // from scratch every frame, so the number that matters is PATHS PER FRAME. Asserting
  // milliseconds is worthless: two headless configurations of one machine disagreed 2.5x
  // on the same build.
  //
  // The scale to beat, from the worst course of the first build: 681 fills and 571
  // strokes, of which 275 and 192 PAINTED NOTHING AT ALL — "the whole prop roster drawn at
  // any distance, and walls hanging in from above still stroking creases hundreds of
  // pixels off screen".
  //
  // Two different numbers are asserted, because there are two different things going on:
  //   * the COUNTS, capped just above the measured worst, so a future course cannot double
  //     them without anyone noticing;
  //   * paths that land FAR outside the canvas — more than 200 px past an edge — which is
  //     the defect the complaint describes. Paths that land just outside are the
  //     CELL_UP/CELL_DOWN margins' deliberate slack: those margins were settled by hashing
  //     posed frames and "exist to make the cull provably invisible, not to be tight", and
  //     every attempt here to tighten them moved pixels.
  var FAR = 200;
  var worstF = 0, worstS = 0, where = '', far = 0, total = 0;
  for (var ci = 0; ci < PL.courseCount(); ci++) {
    for (var s = 0; s <= 1.0001; s += 0.02) {
      var f = poseFrame(ci, Math.min(1, s));
      var n = f.ctx.counts();
      if (n.fill > worstF) { worstF = n.fill; where = 'course ' + (ci + 1) + ' at ' + s.toFixed(2); }
      if (n.stroke > worstS) worstS = n.stroke;
      f.ctx.ops.forEach(function (o) {
        if (o.op !== 'fill' && o.op !== 'stroke') return;
        total++;
        var bb = f.ctx.bbox(o);
        if (!bb) { far++; return; }
        if (bb.x1 < -FAR || bb.x0 > PL.W + FAR || bb.y1 < -FAR || bb.y0 > PL.H + FAR) far++;
      });
    }
  }
  lte(worstF, 520, 'worst frame hands over ' + worstF + ' fills (' + where +
      '); the first build managed 681 with 275 of them painting nothing');
  lte(worstS, 175, 'worst frame hands over ' + worstS + ' strokes');
  lte(far / total, 0.03, (far / total * 100).toFixed(2) + '% of the paths in a frame land ' +
      'more than ' + FAR + 'px outside the canvas (' + far + ' of ' + total + ') — that is ' +
      'the roster being drawn at any distance');
  gte(total, 20000, 'not enough frames were measured for the ratio to mean anything');
});

test(48, 'a chaser leaves a lane past it on every route it can reach', function () {
  // LAW 9.3 — where a chaser SHOVES you is its placement, and the anchor cannot tell you
  // that. A chaser on the exact corner a route turns can pass an anchor check on six tiles
  // of clearance and still aim every ram it throws off the level. Being shoved off is a
  // legitimate way to lose the ball; having nowhere else to be is not.
  var chasers = 0;
  eachCourse(function (c, i) {
    var run = { grid: c.grid, course: c, bodies: [], ball: { x: 0, y: 0 } };
    PL.buildBodies(run);
    run.bodies.forEach(function (b) {
      if (b.prim !== 'SEEKER' && b.prim !== 'RIVAL') return;
      chasers++;
      var sweep = V.hazSweep(b);
      c.routes.forEach(function (r, ri) {
        for (var s = 0; s <= r.total; s += 0.25) {
          var p = PL.pointAt(r, s);
          if (Math.hypot(p.x - b.hx, p.y - b.hy) > sweep) continue;
          var t0 = PL.pointAt(r, Math.max(0, s - 1)), t1 = PL.pointAt(r, Math.min(r.total, s + 1));
          var axis = Math.abs(t1.x - t0.x) >= Math.abs(t1.y - t0.y) ? 1 : 0;
          var sp = PL.paperSpan(c.grid, p.x, p.y, axis);
          if (!sp.span) continue;
          var lo = sp.lo + PL.BALL_R, hi = sp.hi - PL.BALL_R;
          var hc = axis === 0 ? b.hx : b.hy;
          var blo = hc - (b.r + PL.BALL_R), bhi = hc + (b.r + PL.BALL_R);
          var room = Math.max(Math.min(hi, blo) - lo, hi - Math.max(lo, bhi));
          gte(room, 2 * PL.BALL_R, 'course ' + (i + 1) + ' ' + c.name + ': the ' + b.name +
              ' at (' + b.hx + ',' + b.hy + ') leaves ' + room.toFixed(2) +
              ' of paper for the ball on route ' + ri + ' at (' + p.x.toFixed(1) + ',' +
              p.y.toFixed(1) + ') — a ball needs ' + (2 * PL.BALL_R).toFixed(2));
        }
      });
    });
  });
  gte(chasers, 3, 'there are only ' + chasers + ' chasers in the whole game');
});

// ============================================================================
// VARIETY AND USE — these four are meant to fail the first time they run
// ============================================================================

test(49, 'every feature in the table is placed at least its minimum number of times', function () {
  // LAW 6.7b — `bank` and `crown` were both implemented, TESTED, and never once placed
  // until a player complained that cambered paths were missing. The engine having a feature
  // is invisible; only a course using it is the game. Counted off the COMPILED courses,
  // never off the source.
  var counts = V.featureCounts(courses());
  var MIN = { water: 6, fragile: 3, bank: 3, crown: 2, tube: 2, branch: 3, belt: 2, tier: 4 };
  Object.keys(MIN).forEach(function (k) {
    gte(counts[k] || 0, MIN[k], k + ' is placed on ' + (counts[k] || 0) +
        ' course(s), and the table says at least ' + MIN[k]);
  });
  // ...and exactly one of the tiers is a ROUTE.
  var routed = 0;
  courses().forEach(function (c) {
    if (c.flags.some(function (f) { return !!f.skip; })) routed++;
  });
  eq(routed, 1, 'the number of courses whose tier is a declared route is ' + routed + ', not 1');
});

test(50, 'no course runs more than two plain ramp legs in a row, and no two open alike', function () {
  // LAW 6.9 — `pad -> ramp -> pad -> ramp` is the shape the level model makes easiest, and
  // six courses of it is what "everything is very generic" means. Read the piece list of
  // each course out loud as a sequence of kinds: if courses 2 and 3 sound the same, they
  // are the same.
  var all = {}, allKinds = {};
  eachCourse(function (c, i) {
    var kinds = V.legKinds(c);
    gte(kinds.length, 4, 'course ' + (i + 1) + ' has only ' + kinds.length + ' legs');
    var run = 0, worst = 0;
    kinds.forEach(function (k) {
      if (k === 'ramp') { run++; if (run > worst) worst = run; } else run = 0;
    });
    lte(worst, 2, 'course ' + (i + 1) + ' ' + c.name + ' runs ' + worst +
        ' plain ramps in a row: ' + kinds.join(' '));
    // A course must not be ALL one thing either. Two is the floor rather than three
    // because course 1 is authored verbatim from the brief and is ramps and one camber:
    // the practice green teaches the alternation before the game starts breaking it.
    var distinct = {};
    kinds.forEach(function (k) { distinct[k.split('+')[0]] = 1; });
    gte(Object.keys(distinct).length, 2, 'course ' + (i + 1) + ' is made of one kind of ' +
        'leg: ' + kinds.join(' '));
    all[Object.keys(distinct).join('|')] = 1;
    Object.keys(distinct).forEach(function (k) { allKinds[k] = 1; });
  });
  // ...and across the six, the piece vocabulary really is used.
  gte(Object.keys(allKinds).length, 7, 'the whole game is built from only ' +
      Object.keys(allKinds).length + ' kinds of leg: ' + Object.keys(allKinds).join(' '));
  var opens = {};
  eachCourse(function (c, i) {
    var sig = V.openingSignature(c);
    ok(!opens[sig], 'course ' + (i + 1) + ' opens exactly like course ' + opens[sig] +
       ': ' + sig);
    opens[sig] = i + 1;
    // The FIRST MOVE off the tee is a different piece kind on every one of the six.
    var first = V.legKinds(c)[0];
    ok(!opens['first:' + first], 'course ' + (i + 1) + ' opens on a ' + first +
       ', the same first move as course ' + opens['first:' + first]);
    opens['first:' + first] = i + 1;
  });
});

test(51, 'route length and flag count rise, and no leg is longer than 75 tiles', function () {
  var lens = courses().map(function (c) { return c.routes[0].total; });
  for (var i = 1; i < lens.length; i++)
    gte(lens[i], lens[i - 1] + 1, 'course ' + (i + 1) + ' (' + lens[i].toFixed(1) +
        ' tiles) is not longer than course ' + i + ' (' + lens[i - 1].toFixed(1) + ')');
  var counts = courses().map(function (c) { return c.flags.length; });
  for (var j = 1; j < counts.length; j++)
    gte(counts[j], counts[j - 1], 'flag counts fall at course ' + (j + 1));

  // The unit that gets designed is the stretch between two flags, not the course. A leg you
  // cannot re-drive in a few seconds turns a fall from a setback into a punishment, and the
  // retry loop stops being compulsive.
  eachCourse(function (c, ci) {
    c.routes.forEach(function (r, ri) {
      var marks = [0];
      c.flags.forEach(function (f, fi) {
        if (f.skip && f.skip.indexOf(ri) !== -1) return;
        marks.push(PL.project(r, f.x, f.y).s);
      });
      marks.push(r.total);
      marks.sort(function (a, b) { return a - b; });
      // A route that declares a SKIP deliberately merges two legs into one, and driving
      // twice as far with no respawn point in between is exactly what skipping a
      // checkpoint costs. It is allowed the two legs it gave up and not a tile more.
      var skipping = c.flags.some(function (f) { return f.skip && f.skip.indexOf(ri) !== -1; });
      var cap = skipping ? 150 : 75;
      for (var k = 1; k < marks.length; k++) {
        var leg = marks[k] - marks[k - 1];
        lte(leg, cap, 'course ' + (ci + 1) + ' ' + c.name + ' route ' + ri +
            ' has a ' + leg.toFixed(1) + '-tile stretch between checkpoints' +
            (skipping ? ' (this route skips one, so its cap is ' + cap + ')' : ''));
      }
    });
  });
});

test(52, 'no piece is a flat rectangle wider than 9 across', function () {
  // LAW 6.8 asked of the AUTHOR'S pieces rather than of the compiled grid, so it fails at
  // the line that wrote it. Nothing is a plain flat rectangle above 9 across: if a piece is
  // wider than that it is a bowl, or it has a cut in it, or a crown or a camber runs over it.
  eachCourse(function (c, i) {
    var bad = V.wideFlatPieces(c);
    ok(!bad.length, 'course ' + (i + 1) + ' ' + c.name + ' has plain flat pad(s) wider than ' +
       '9 with nothing carved into them: ' + JSON.stringify(bad));
    // Every tee is 8x8, and it is the only ground of that shape on its course.
    var tee = c.pieces[0];
    eq(tee.kind, 'pad', 'course ' + (i + 1) + ' does not begin with a pad');
    eq(tee.w, 8, 'course ' + (i + 1) + ' tee is not 8 wide');
    eq(tee.h, 8, 'course ' + (i + 1) + ' tee is not 8 tall');
  });
});
