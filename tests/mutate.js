// MUTATION HARNESS — `node tests/mutate.js`
//
// Rule 5: a test a mutation cannot turn red is not a test. Each entry below breaks the
// code a test covers ON PURPOSE and names exactly which tests must go red. If a mutation
// leaves everything green, the test is decoration. If it reddens a test not on its list,
// either the mutation is broader than it claims or the tests are entangled — both are
// worth knowing, so both are reported.
//
// `expect` is the set of tests that MUST fail. `also` is a set allowed to fail too, for
// mutations that genuinely break more than one thing. Entries whose expected tests are
// not written yet are skipped, so this file grows alongside the suite.

'use strict';
var cp = require('child_process');
var path = require('path');

var MUTATIONS = [
  // ---- physics -------------------------------------------------------------
  { name: 'gravity does not act in flight',
    edits: [{ file: 'physics.js', from: 'ax = K * AIR_INPUT * ix; ay = K * AIR_INPUT * iy;\n    b.vz -= G * DT;', to: 'ax = K * AIR_INPUT * ix; ay = K * AIR_INPUT * iy;' }],
    expect: [15], also: [16, 24, 31, 44, 11, 12, 42, 33, 47] },

  { name: 'the ball is dragged in flight',
    edits: [{ file: 'physics.js', from: 'ax = K * AIR_INPUT * ix; ay = K * AIR_INPUT * iy;', to: 'ax = K * AIR_INPUT * ix - 2 * b.vx; ay = K * AIR_INPUT * iy;' }],
    expect: [15], also: [11, 12, 42, 33] },

  { name: 'the death plane never fires',
    edits: [{ file: 'physics.js', from: "if (b.z < c.deathZ) enterFall(run, 'void');", to: '' }],
    expect: [16], also: [31, 44, 11, 12, 42, 25, 33] },

  { name: 'a respawn does not return the ball to its spawn',
    edits: [{ file: 'physics.js', from: 'b.x = run.spawn.x; b.y = run.spawn.y; b.z = run.spawn.z;\n  b.vx = b.vy = b.vz = 0;', to: 'b.vx = b.vy = b.vz = 0;' }],
    expect: [16], also: [30, 11, 12, 42, 25] },

  { name: 'RNG in the simulation path',
    edits: [{ file: 'physics.js', from: 'b.vx += ax * DT; b.vy += ay * DT;', to: 'b.vx += ax * DT + (Math.random() - 0.5) * 1e-9; b.vy += ay * DT;' }],
    expect: [17], also: [15, 19] },

  { name: 'module-level state leaks between runs',
    edits: [{ file: 'physics.js', from: 'var _g0 = [0, 0], _g1 = [0, 0];', to: 'var _g0 = [0, 0], _g1 = [0, 0], _leak = 0;' },
            { file: 'physics.js', from: '  run.t += DT;', to: '  run.t += DT; _leak++; b.vx += _leak * 1e-12;' }],
    expect: [17], also: [15, 18] },

  { name: 'a hazard phase is seeded from entropy',
    edits: [{ file: 'hazards.js', from: 'phase: p.phase || 0,', to: 'phase: (p.phase || 0) + Math.random() * 1e-6,' }],
    expect: [17], also: [19, 11, 12, 42] },

  { name: 'the speed clamp is applied once per frame instead of every tick',
    edits: [{ file: 'physics.js', from: '  applyTriggers(run);\n  collideBodies(run);\n  clampSpeed(b);', to: '  applyTriggers(run);\n  collideBodies(run);' },
            { file: 'physics.js', from: '  b.vx += ax * DT; b.vy += ay * DT;\n  clampSpeed(b);', to: '  b.vx += ax * DT; b.vy += ay * DT;' }],
    expect: [18], also: [11, 12, 42, 26] },

  { name: 'the clamp is off by a hair',
    edits: [{ file: 'physics.js', from: 'if (s2 > MAX_SPEED * MAX_SPEED) {', to: 'if (s2 > MAX_SPEED * MAX_SPEED * 1.02) {' }],
    expect: [18], also: [] },

  // ---- the level compiler ---------------------------------------------------
  { name: 'a branch arrives half a unit above the junction it rejoins',
    edits: [{ file: 'levels.js', from: 'P.push(bankY(34, 10, 4, 16, z, 0.14, 0.7));', to: 'P.push(bankY(34, 10, 4, 16, z + 0.5, 0.14, 0.7));' }],
    expect: [1], also: [2, 8, 11, 12, 42, 49, 50] },

  { name: 'the two-ring dilation is dropped (LAW 5.3)',
    edits: [{ file: 'level.js', from: 'for (var pass = 0; pass < 2; pass++) {', to: 'for (var pass = 0; pass < 0; pass++) {' }],
    expect: [2], also: [5, 11, 12, 42, 39, 50, 51, 13, 46, 22, 34, 45, 3, 6, 9, 36, 37, 47, 48, 52, 33] },

  { name: 'a route is allowed to leave the paper',
    edits: [{ file: 'levels.js', from: '{ x: 48, y: 29 }, { x: 57, y: 29 }', to: '{ x: 48, y: 20 }, { x: 57, y: 29 }' }],
    expect: [6], also: [7, 8, 11, 12, 42, 9, 36, 37, 51] },

  { name: 'a leg is aimed down the descent axis (LAW 4.1)',
    edits: [{ file: 'levels.js', from: '{ x: 30, y: 14 }, { x: 30, y: 24 }', to: '{ x: 36, y: 14 }, { x: 30, y: 24 }' }],
    expect: [7], also: [6, 8, 11, 12, 42, 36, 37, 51, 9] },

  { name: 'the branch is two identical lanes (LAW 6.5)',
    edits: [{ file: 'levels.js', from: 'P.push(bankY(34, 10, 4, 16, z, 0.14, 0.7));', to: 'P.push(rampY(34, 10, 4, 16, z, 0.14));' }],
    expect: [8], also: [49] },

  { name: 'a chaser is dropped where the route has no room past it (LAW 9.3)',
    edits: [{ file: 'levels.js', from: "haz('tree', 31, 8)", to: "haz('golfer', 25, 4)" }],
    expect: [9], also: [11, 12, 42, 48] },

  { name: 'a gate is walled off, so the course cannot be cleared',
    edits: [{ file: 'levels.js', from: 'var g2 = gateX(39, 28, 4, 3, z);                      P.push(g2);', to: 'var g2 = gateX(39, 28, 4, 3, z);                      P.push(g2); P.push(cut(39,28,4,3));' }],
    expect: [11], also: [4, 12, 3, 5, 36, 37, 42, 6, 47, 51, 38, 40, 43] },


  // ---- geometry and topology ------------------------------------------------
  { name: 'the tier gap is widened past anything a ball can cross',
    edits: [{ file: 'levels.js', from: 'var l3 = rampY(60, 38, 5, 12, z, 0.20);               P.push(l3);   z = l3.exit;', to: 'var l3 = rampY(60, 38, 5, 4, z, 0.20);                P.push(l3);   z = l3.exit;' }],
    expect: [3], also: [1, 2, 5, 6, 11, 12, 20, 38, 42, 51, 36, 37, 47, 33, 45, 46, 49, 22, 34, 39, 50, 52, 13, 43, 40] },

  { name: 'the cup is moved off the green',
    edits: [{ file: 'levels.js', from: 'cup: { x: 62, y: 59, r: 0.9 },', to: 'cup: { x: 62, y: 74, r: 0.9 },' }],
    expect: [4], also: [3, 6, 11, 12, 20, 38, 42, 51, 36, 37, 47, 41, 43, 40] },

  { name: 'a gate is laid on a slope, so its respawn rolls off during the hold',
    edits: [{ file: 'level.js', from: 'function gateX(x, y, len, w, z) {\n  var p = pad(x, y, len, w, z);', to: 'function gateX(x, y, len, w, z) {\n  var p = rampX(x, y, len, w, z, 0.3);' }],
    expect: [5], also: [1, 2, 11, 12, 20, 38, 42, 36, 37, 47, 51, 45, 46, 22, 34, 39, 49, 50, 43, 40, 13, 33] },

  { name: 'a course loses a checkpoint, so the counts no longer pair up',
    edits: [{ file: 'levels.js', from: 'flags: [g1.flag, g2.flag, g3.flag],\n    routes: [\n      [{ x: 4, y: 4 }, { x: 16, y: 4 }, g1.flag, { x: 30, y: 6 },', to: 'flags: [g1.flag, g2.flag],\n    routes: [\n      [{ x: 4, y: 4 }, { x: 16, y: 4 }, g1.flag, { x: 30, y: 6 },' }],
    expect: [10], also: [20, 42, 51, 40, 43] },

  { name: 'input authority is raised until gravity can never beat the player',
    edits: [{ file: 'tuning.js', from: 'var K          = 9.0;', to: 'var K          = 40.0;' }],
    expect: [13], also: [11, 12, 42, 28, 26, 18, 40, 43, 17, 30, 25, 38] },

  { name: 'the compiler is not deterministic',
    edits: [{ file: 'level.js', from: '  course.deathZ = lowest - DEATH_DROP;', to: '  course.deathZ = lowest - DEATH_DROP + Math.random() * 1e-9;' }],
    expect: [19], also: [20] },

  { name: 'game.html drifts from src/',
    edits: [{ file: 'game.html', from: '/* ===== src/tuning.js ===== */', to: '/* ===== src/tuning_OLD.js ===== */' }],
    expect: [20], also: [] },

  { name: 'the artifact reaches for an image',
    edits: [{ file: 'game.html', from: '<canvas id="c"', to: '<img src="paper.png"><canvas id="c"' }],
    expect: [21], also: [20] },

  { name: 'the renderer needs a DOM',
    edits: [{ file: 'render.js', from: 'function drawWorld(ctx, run, cam) {', to: 'function drawWorld(ctx, run, cam) {\n  void document.body;' }],
    expect: [22], also: [34, 45, 46, 20] },

  { name: 'a hand-edited save is trusted',
    edits: [{ file: 'save.js', from: '  s.unlocked = Math.max(1, Math.min(n, p.unlocked | 0));', to: '  s.unlocked = p.unlocked | 0;' }],
    expect: [23], also: [20] },

  // ---- the surfaces that carry rules ----------------------------------------
  { name: 'a respawn does not restore the fragile ground (LAW 10.6)',
    edits: [{ file: 'physics.js', from: '  run.grid.solid.set(c.grid.solid);\n  run.grid.surf.set(c.grid.surf);', to: '' }],
    expect: [25], also: [20] },

  { name: 'the belt pushes with a constant acceleration instead of closing a gap',
    edits: [{ file: 'tuning.js', from: 'var BELT_ACC   = 14;', to: 'var BELT_ACC   = 3;' }],
    expect: [26], also: [11, 12, 42, 20, 18] },

  { name: 'the rival takes nothing back from a collision',
    edits: [{ file: 'physics.js', from: '        c.kx -= J * nx / c.mass; c.ky -= J * ny / c.mass;', to: '' }],
    expect: [27], also: [20, 17] },

  { name: 'the vacuum barely pulls, so its point of no return is not one',
    edits: [{ file: 'hazards.js', from: '    var pl = c.def.pull * (1 - d / c.def.r) * DT;', to: '    var pl = c.def.pull * 0.2 * (1 - d / c.def.r) * DT;' }],
    expect: [28], also: [20, 11, 12, 42] },

  { name: 'a tier wall is not a wall while the ball is still rolling (LAW 5.4)',
    edits: [{ file: 'physics.js', from: '  if (!contact) {\n    if (wallAt(g, nx2, ny2, b.z)) {', to: '  if (!contact) {\n    if (false) {' }],
    expect: [31], also: [20, 11, 12, 42, 17] },

  { name: 'a banking envelope is removed, so a joint becomes a launch ramp (LAW 6.3)',
    edits: [{ file: 'level.js', from: "      return base + p.bank * smoothstep(Math.min(u, 1 - u) / 0.18) * d * d;", to: '      return base + p.bank * d * d;' }],
    expect: [32], also: [1, 2, 20, 11, 12, 42, 45, 46, 5, 36, 37, 22, 34, 39, 49, 50, 13, 43, 40, 47, 33, 51, 38, 3, 6] },

  { name: 'the tier shortcut is not declared a skip',
    edits: [{ file: 'levels.js', from: 'flags: [g1.flag, g2.flag, skips(g3.flag, [1]), g4.flag],', to: 'flags: [g1.flag, g2.flag, g3.flag, g4.flag],' }],
    expect: [33], also: [20, 36, 12, 38, 51, 49] },

  { name: 'water is painted as fairway, so the rule is there and the surface is not',
    edits: [{ file: 'render.js', from: '      var surf = g.surf[ck];\n      var gx =', to: '      var surf = g.surf[ck] === SURF.WATER ? SURF.FAIRWAY : g.surf[ck];\n      var gx =' }],
    expect: [34], also: [20, 45, 46] },

  { name: 'the rolling bed is an oscillator (LAW 13.1)',
    edits: [{ file: 'audio.js', from: '  var src = ctx.createBufferSource();\n  src.buffer = buf; src.loop = true;', to: '  var src = ctx.createOscillator();\n  src.buffer = buf; src.loop = true;' }],
    expect: [35], also: [20] },

  // ---- gates, the clock, and the frame ---------------------------------------
  { name: 'a checkpoint is widened onto a plaza (LAW 10.2)',
    edits: [{ file: 'levels.js', from: 'var g2 = gateX(39, 28, 4, 3, z);                      P.push(g2);', to: 'var g2 = gateX(39, 26, 4, 6, z);                      P.push(g2);' }],
    expect: [36], also: [20, 37, 5, 39, 52, 11, 12, 42, 38, 51, 47] },

  { name: 'a chaser is parked in the middle of a three-tile gate (LAW 9.3)',
    edits: [{ file: 'levels.js', from: "haz('tree', 31, 8)", to: "haz('dog', 25, 4.5, 0, 2)" }],
    expect: [48], also: [9, 20, 11, 12, 42, 38] },

  { name: 'a junction is left flat and uncarved (LAW 6.8)',
    edits: [{ file: 'levels.js', from: '  P.push(pad(27, 0, 11, 10, z));\n  P.push(cut(34, 0, 4, 4));', to: '  P.push(pad(27, 0, 11, 10, z));' }],
    expect: [39, 52], also: [20, 8, 49, 46] },

  { name: 'the clock counts DOWN (LAW 11.1)',
    edits: [{ file: 'physics.js', from: "  if (b.state !== ST.HOLED) run.clock += DT;", to: '  if (b.state !== ST.HOLED) run.clock -= DT;' }],
    expect: [40], also: [20, 42, 43, 11, 12, 41] },

  { name: 'net time is allowed to go negative',
    edits: [{ file: 'physics.js', from: 'function netTime(run) { return Math.max(0, run.clock - run.credit); }', to: 'function netTime(run) { return run.clock - run.credit; }' }],
    expect: [41], also: [20, 14] },

  { name: 'a par time drifts out of a clean run\'s reach',
    edits: [{ file: 'levels.js', from: "    name: 'PRACTICE GREEN',\n    parTime: 16, bonus: 3,", to: "    name: 'PRACTICE GREEN',\n    parTime: 40, bonus: 3," }],
    expect: [42], also: [20] },

  { name: 'the HUD stops printing the clock',
    edits: [{ file: 'ui.js', from: "  txt(ctx, clockStr(shown), W - 26, 62, 46, '#f6f1e2', 'right', 'bold');", to: "  txt(ctx, '', W - 26, 62, 46, '#f6f1e2', 'right', 'bold');" }],
    expect: [43], also: [20] },

  { name: 'the ball sorts on its flat key alone, ignoring its height (LAW 4.5)',
    edits: [{ file: 'render.js', from: '  var best = flat, t = 0, guard = 0;', to: '  return flat;\n  var best = flat, t = 0, guard = 0;' }],
    expect: [45], also: [20] },

  { name: 'the terrain cull margins are thrown away (LAW 12.2)',
    edits: [{ file: 'tuning.js', from: 'var CELL_UP     = CELL_SPREAD * Z_SCALE + TILE;', to: 'var CELL_UP     = 4000;' },
            { file: 'tuning.js', from: 'var CELL_DOWN   = TILE / 2 + CELL_SPREAD * Z_SCALE + TILE;', to: 'var CELL_DOWN   = 4000;' }],
    expect: [46], also: [20] },

  { name: 'a course drops the water it owes (LAW 6.7b)',
    edits: [{ file: 'levels.js', from: '  P.push(pond(28, 36, 4, 4, z, 0.45));', to: '' }],
    expect: [49], also: [20, 39, 46, 52] },

  { name: 'the flag ladder stops rising (3/3/4/4/5/5)',
    edits: [{ file: 'levels.js',
              from: 'flags: [g1.flag, g2.flag, g3.flag, g4.flag, g5.flag],\n    routes: [\n      // 0 — the narrow four-tile side of the middle channel.',
              to: 'flags: [g1.flag, g2.flag, g3.flag],\n    routes: [\n      // 0 — the narrow four-tile side of the middle channel.' }],
    expect: [51], also: [10, 20, 42, 40, 43, 36, 37, 38] },

  { name: 'a flag trigger never fires',
    edits: [{ file: 'physics.js', from: 'if (triggerHit(run, fl.x, fl.y, fl.r)) {', to: 'if (false && triggerHit(run, fl.x, fl.y, fl.r)) {' }],
    expect: [12], also: [38, 40, 42, 43, 30, 25] },

  // ---- one mutation aimed squarely at each remaining test --------------------
  { name: 'a losing phase is added to the state machine',
    edits: [{ file: 'game.js', from: "if (code === 'Escape') { APP.state = 'PAUSE'; APP.menuIdx = 0; APP.keys = {}; return true; }", to: "if (code === 'Escape') { APP.state = 'GAMEOVER'; APP.menuIdx = 0; APP.keys = {}; return true; }" }],
    expect: [14], also: [20] },

  { name: 'water reads the CELL instead of contact, so a ball flying it is taken',
    edits: [{ file: 'physics.js', from: "if (!b.air && surfAt(g, b.x, b.y) === SURF.WATER) enterSink(run, 'water');", to: "if (surfAt(g, b.x, b.y) === SURF.WATER) enterSink(run, 'water');" }],
    expect: [24], also: [20, 11, 12, 42, 38] },

  { name: 'a mallet no longer takes the marble\'s shape',
    edits: [{ file: 'physics.js', from: '    if (c.flatten && b.flat <= 0) {', to: '    if (false) {' }],
    expect: [29], also: [20] },

  { name: 'the respawn hold is a blink you can steer through (LAW 10.5)',
    edits: [{ file: 'physics.js', from: '  run.holdT = RESPAWN_HOLD;', to: '  run.holdT = 0.2;' }],
    expect: [30], also: [20, 11, 12, 42] },

  { name: 'the trigger radius goes back to a fixed number (LAW 10.1)',
    edits: [{ file: 'level.js', from: '    r: Math.max(GATE_R_MIN, need + GATE_MARGIN),', to: '    r: GATE_R_MIN,' }],
    expect: [37], also: [20, 36, 47] },

  { name: 'one checkpoint quietly stops recording',
    edits: [{ file: 'physics.js', from: '      run.flagsHit[f] = true;', to: '      if (f !== 0) run.flagsHit[f] = true;' }],
    expect: [38], also: [20, 40, 42, 43, 12, 30, 25] },

  { name: 'a FALLING ball ignores the mask entirely (LAW 5.4)',
    edits: [{ file: 'physics.js', from: '    if (wallAt(g, b.x + fdx, b.y, b.z)) b.vx = -E * b.vx; else b.x += fdx;', to: '    b.x += fdx;' }],
    expect: [44], also: [20] },

  { name: 'a trigger has no height term, so a ball six units above the cup holes out',
    edits: [{ file: 'physics.js', from: '  return b.z <= heightAt(run.grid, tx, ty) + WALL_STEP;', to: '  return true;' }],
    expect: [47], also: [20, 11, 12, 42, 38, 41, 43, 40, 37, 36] },

  { name: 'a camber is flattened back into a plain ramp (LAW 6.9)',
    edits: [{ file: 'levels.js', from: '  var l2 = bankY(29, 28, 6, 10, l1.exit, 0.28, 0.8);    P.push(l2);', to: '  var l2 = rampY(29, 28, 6, 10, l1.exit, 0.28);         P.push(l2);' }],
    expect: [50], also: [20, 8, 49, 11, 12, 42] },
];

var only = process.argv.slice(2);

function runSuite(edits, nums) {
  var env = Object.assign({}, process.env, { PL_MUTATE: JSON.stringify(edits) });
  var r = cp.spawnSync(process.execPath,
    [path.join(__dirname, 'run.js')].concat(nums.map(String)),
    { env: env, encoding: 'utf8' });
  var out = (r.stdout || '') + (r.stderr || '');
  var failed = [];
  out.split('\n').forEach(function (line) {
    var m = /^ FAIL\s+(\d+)/.exec(line);
    if (m) failed.push(Number(m[1]));
  });
  return { failed: failed, out: out, crashed: r.status !== 0 && r.status !== 1 };
}

// Which tests actually exist right now — no point demanding a mutation redden a test that
// has not been written yet.
function implemented() {
  var r = cp.spawnSync(process.execPath, [path.join(__dirname, 'run.js')], { encoding: 'utf8' });
  var m = /Not yet written: ([\d ]+)/.exec(r.stdout || '');
  var missing = m ? m[1].trim().split(/\s+/).map(Number) : [];
  var all = [];
  for (var i = 1; i <= 52; i++) if (missing.indexOf(i) === -1) all.push(i);
  return all;
}

var live = implemented();
var bad = 0, ran = 0, skipped = 0;
console.log('mutation harness — ' + live.length + ' test(s) implemented\n');

MUTATIONS.forEach(function (mu) {
  if (only.length && only.indexOf(mu.name) === -1) return;
  var want = mu.expect.filter(function (n) { return live.indexOf(n) !== -1; });
  if (!want.length) { skipped++; return; }
  var allowed = want.concat((mu.also || []).filter(function (n) { return live.indexOf(n) !== -1; }));
  var res = runSuite(mu.edits, live);
  ran++;
  var missed = want.filter(function (n) { return res.failed.indexOf(n) === -1; });
  var extra = res.failed.filter(function (n) { return allowed.indexOf(n) === -1; });
  if (res.crashed) {
    console.log('  BAD   ' + mu.name + '  — the mutated suite crashed:\n' +
                res.out.split('\n').slice(-8).join('\n'));
    bad++;
  } else if (missed.length) {
    console.log('  BAD   ' + mu.name + '  — test(s) ' + missed.join(',') + ' stayed GREEN. Not a test.');
    bad++;
  } else if (extra.length) {
    console.log('  note  ' + mu.name + '  — also reddened ' + extra.join(',') + ' (not declared)');
  } else {
    console.log('  ok    ' + mu.name + '  — reddened ' + res.failed.join(','));
  }
});

console.log('\n  ' + ran + ' mutation(s) run, ' + bad + ' inadequate' +
            (skipped ? ', ' + skipped + ' waiting on tests not yet written' : '') + '.');

// The FLOOR asks: has every test been falsified at least once? A test nothing in this file
// can turn red is decoration, and the only way to know is to keep the tally.
if (!only.length) {
  var covered = {}, incidental = {};
  MUTATIONS.forEach(function (mu) {
    mu.expect.forEach(function (n) { covered[n] = (covered[n] || 0) + 1; });
    (mu.also || []).forEach(function (n) { incidental[n] = (incidental[n] || 0) + 1; });
  });
  var none = [], onlyIncidental = [];
  for (var t = 1; t <= 52; t++) {
    if (covered[t]) continue;
    if (incidental[t]) onlyIncidental.push(t); else none.push(t);
  }
  console.log('  falsified on purpose: ' + Object.keys(covered).length + '/52' +
              (onlyIncidental.length ? '   falsified only as a side effect: ' + onlyIncidental.join(',') : '') +
              (none.length ? '\n  NEVER FALSIFIED BY ANYTHING: ' + none.join(',') : ''));
  if (none.length) bad++;
}
process.exit(bad ? 1 : 0);
