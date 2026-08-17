// THE ACCEPTANCE SUITE — 52 tests. `node tests/run.js`
//
// Every one of these drives the real simulation headlessly. A red suite blocks all
// progress. Each must be falsified by mutation before it is believed.
//
// THE MANIFEST — the specification, in order. Tests 1-48 are the shipped suite of the
// game this was derived from; 49-52 are added because the complaint log says those four
// failures recurred.
//
//   GEOMETRY AND TOPOLOGY
//    1 every course compiles with no seam between its pieces
//    2 no surface is steeper than the steepest thing an author declared
//    3 the tee can reach the cup, over paper or across a ledge
//    4 the tee, the cup and every flag stand on solid paper
//    5 a flag is somewhere the ball can stop - terminal speed <= VTERM_MAX; tees too
//    6 every authored route runs over paper from end to end
//    7 every leg runs along a world axis, never down the screen        (LAW 4.1)
//    8 every course has a fork that is really a fork                   (LAW 6.5)
//    9 every threat fits on the ground it stands on                    (LAW 9.2)
//   10 flag counts rise, and two courses share each count
//   11 the oracle clears every course on every authored route
//   12 it clears them without falling off once
//   13 gravity can beat the player somewhere - interior slope > SLOPE_CRIT (LAW 5.2)
//   14 nothing but the cup can end a course - the losing phase does not exist
//
//   PHYSICS
//   15 a ball leaving a lip flies, and its arc is ordinary ballistics
//   16 a ball that walks off the edge is lost
//   17 the simulation is deterministic - replay a run tick for tick
//   18 the speed clamp holds on every tick
//   19 a course is the same every time it is built (hash the compiled grid)
//   20 game.html builds the same six courses as src/ - hash both
//   21 the artifact reaches outside itself for nothing - no URL, no fetch, no asset
//   22 a full frame draws without a DOM or a clock
//   23 a save round-trips and unlocks nothing that was not cleared
//   24 water takes the ball, and only when the ball is actually on it
//   25 fragile paper goes, the hole stays, and a respawn brings it back (LAW 10.6)
//   26 a belt carries a ball that is asking for nothing
//   27 the rival is a two-body collision, both ways                    (LAW 5.5)
//   28 the vacuum pulls, and inside its hold nothing gets out under full opposing input
//   29 a mallet flattens the ball, and a flat ball answers no key
//   30 a respawn holds the ball for RESPAWN_HOLD seconds
//   31 a ball falling past a tier is not snapped onto the top of it    (LAW 5.4)
//   32 the tube holds its rim and the funnel closes on its throat
//   33 the tier shortcut is measurably shorter than the leg it skips
//   34 the frame paints the surfaces that carry rules
//   35 the rolling channel is noise shaped by the ground, not an engine (LAW 13.1)
//
//   GATES AND THE CLOCK
//   36 every checkpoint is a gate, not a marker on a plaza            (LAW 10.2)
//   37 there is no line across a gate that misses the flag on it
//   38 driving a route claims every flag on it, in the simulation
//   39 nothing on any course is a bigger flat square than the tee     (LAW 6.8)
//   40 the clock counts up, a checkpoint knocks seconds off it, and it pays once
//   41 the score stops in the cup and cannot go below zero
//   42 a flawless run rates between BIRDIE and PAR - this pins parTime
//   43 the HUD prints the clock, and a course card prints what was banked
//
//   RENDER AND CULL
//   44 a falling ball is still stopped by the paper, not carried through it (LAW 5.4)
//   45 the ball is never painted over paper that is in front of it
//   46 the frame does not ask the rasteriser for work it cannot see    (LAW 12.2)
//   47 a trigger is on the ground, so a ball flying over it claims nothing (LAW 10.4)
//   48 a chaser leaves a lane past it on every route it can reach      (LAW 9.3)
//
//   VARIETY AND USE - these four are meant to fail the first time they run
//   49 every feature in LAW 6.7b's table is placed at least its minimum number of times
//   50 no course runs more than two plain ramp legs in a row; no two open alike (LAW 6.9)
//   51 route length and flag count rise monotonically; no leg over 75 tiles
//   52 no piece is a flat rectangle wider than 9 across                (LAW 6.8, authored)

'use strict';

var TOTAL = 52;
var registry = new Map();
var only = process.argv.slice(2).filter(function (a) { return /^\d+$/.test(a); }).map(Number);

function test(n, name, fn) {
  if (registry.has(n)) throw new Error('duplicate test number ' + n);
  registry.set(n, { n: n, name: name, fn: fn });
}

// ---- assertions ----
function ok(cond, msg) { if (!cond) throw new Error(msg || 'expected truthy'); }
function eq(a, b, msg) {
  if (a !== b) throw new Error((msg || 'not equal') + ': ' + fmt(a) + ' !== ' + fmt(b));
}
function near(a, b, tol, msg) {
  if (!(Math.abs(a - b) <= tol))
    throw new Error((msg || 'not near') + ': ' + fmt(a) + ' vs ' + fmt(b) + ' tol ' + tol);
}
function lte(a, b, msg) {
  if (!(a <= b)) throw new Error((msg || 'expected <=') + ': ' + fmt(a) + ' > ' + fmt(b));
}
function gte(a, b, msg) {
  if (!(a >= b)) throw new Error((msg || 'expected >=') + ': ' + fmt(a) + ' < ' + fmt(b));
}
function fmt(v) {
  if (typeof v === 'number') return (Number.isInteger(v) ? String(v) : v.toFixed(4));
  if (typeof v === 'string') return JSON.stringify(v);
  return String(v);
}

module.exports = { test: test, ok: ok, eq: eq, near: near, lte: lte, gte: gte };

// ---- the tests themselves ----
require('./suite.js');

// ---- run ----
var pass = 0, fail = 0, failures = [];
var nums = Array.from(registry.keys()).sort(function (a, b) { return a - b; });
for (var i = 0; i < nums.length; i++) {
  var t = registry.get(nums[i]);
  if (only.length && only.indexOf(t.n) === -1) continue;
  var label = String(t.n).padStart(2, ' ') + '  ' + t.name;
  try {
    t.fn();
    pass++;
    console.log('  ok  ' + label);
  } catch (e) {
    fail++;
    failures.push({ n: t.n, name: t.name, err: e });
    console.log(' FAIL ' + label);
    console.log('        ' + String(e.message).split('\n').join('\n        '));
  }
}

console.log('');
var missing = [];
for (var n = 1; n <= TOTAL; n++) if (!registry.has(n)) missing.push(n);
if (missing.length) {
  console.log('  ' + (TOTAL - missing.length) + '/' + TOTAL + ' implemented. Not yet written: ' + missing.join(' '));
}
console.log('  ' + pass + ' passed, ' + fail + ' failed' + (only.length ? '  (filtered)' : ''));

if (fail) {
  console.log('\nRED. A red suite blocks all progress.');
  process.exit(1);
}
if (missing.length && !only.length) {
  console.log('GREEN so far — ' + missing.length + ' test(s) still to write.');
  process.exit(0);
}
console.log('GREEN.');
process.exit(0);
