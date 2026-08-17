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

  { name: 'a flag trigger never fires',
    edits: [{ file: 'physics.js', from: 'if (triggerHit(run, fl.x, fl.y, fl.r)) {', to: 'if (false && triggerHit(run, fl.x, fl.y, fl.r)) {' }],
    expect: [12], also: [38, 40, 42, 43, 30, 25] },
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
process.exit(bad ? 1 : 0);
