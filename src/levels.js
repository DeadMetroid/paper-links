// THE SIX COURSES. Authored by hand, in order, with no RNG anywhere in the level path —
// a course is byte-for-byte what the author wrote, every time.
//
// Read the comments: they are why, not what.

// 1. PRACTICE GREEN — 3 flags
// Teaches the five things the game is: the ball keeps going, the world runs
// down-right and down-left rather than straight down, the gap between two paths
// is not floor, going over an edge on purpose is a move — and that the two ways
// down are not the same way down twice.
function practice() {
  var P = [], z = 40;

  // Eight tiles square, and it is the ONLY ground of that shape on the course.
  P.push(pad(0, 0, 8, 8, z));
  var l1 = rampX(8, 1, 15, 6, z, 0.14);                 P.push(l1);   z = l1.exit;

  // GATE 1: the lane is six wide and the way out of it is three, with the void
  // hard against both sides. No line down this leg misses the checkpoint.
  var g1 = gateX(23, 3, 4, 3, z);                       P.push(g1);

  // The junction, cut back to the elbow the turn actually uses.
  P.push(pad(27, 0, 11, 10, z));
  P.push(cut(34, 0, 4, 4));

  // The first fork, and the two sides are not the same lane twice. The left is
  // flat. The right is tilted 0.7 across four tiles — cross-slope 0.175, so
  // gravity spends about four of the nine units of input the player has, for all
  // sixteen tiles of it, and the low side of it is the void.
  var safe = rampY(28, 10, 4, 16, z, 0.14);             P.push(safe);
  P.push(bankY(34, 10, 4, 16, z, 0.14, 0.7));
  z = safe.exit;

  P.push(pad(26, 26, 13, 9, z));
  // Water, on the course that cannot punish it, in the corner nothing routes
  // through: this is where a player learns that the blue is not scenery.
  P.push(pond(26, 31, 4, 4, z, 0.5));
  // ...and the rest of the lower half is a DISH. A dish is the cheapest way to
  // stop a junction being a room: it takes no paper away and there is no square
  // foot of it a ball sits still on.
  P.push(bowl(31, 30, 8, 5, z, 0.35));

  // GATE 2 is on the way OUT of the rejoin rather than on it. A checkpoint on a
  // junction two lanes arrive at cannot gate both; one on the single neck they
  // both leave by gates the pair for free.
  var g2 = gateX(39, 28, 4, 3, z);                      P.push(g2);
  var l2 = rampX(43, 26, 15, 6, z, 0.16);               P.push(l2);   z = l2.exit;

  P.push(pad(58, 24, 8, 10, z));
  // GATE 3 is a leg and a tier short of the cup, not on the green beside it.
  var g3 = gateY(61, 34, 3, 4, z);                      P.push(g3);
  var l3 = rampY(60, 38, 5, 12, z, 0.20);               P.push(l3);   z = l3.exit;

  // The teaching tier. Three tiles of void and 2.6 units down onto a green wide
  // enough to be wrong on: at the leg's terminal 13 u/s the ball flies 5.4 tiles
  // and at a crawl it flies nothing, so the way past it is not braking — which
  // is the whole game said once, gently, on a course that cannot punish it hard.
  P.push(pad(56, 53, 12, 12, z - 2.6, SURF.GREEN));
  P.push(greenDish(58, 55, 8, 8, z - 2.6, 0.4));

  return {
    name: 'PRACTICE GREEN',
    parTime: 16, bonus: 3,
    pieces: P,
    start: { x: 4, y: 4 },
    cup: { x: 62, y: 59, r: 0.9 },
    // Never typed. Each is the centre of the gate it stands on, so a gate that
    // moves takes its checkpoint with it.
    flags: [g1.flag, g2.flag, g3.flag],
    routes: [
      [{ x: 4, y: 4 }, { x: 16, y: 4 }, g1.flag, { x: 30, y: 6 },
       { x: 30, y: 14 }, { x: 30, y: 24 }, { x: 31, y: 29 }, g2.flag,
       { x: 48, y: 29 }, { x: 57, y: 29 }, { x: 62, y: 30 }, g3.flag,
       { x: 62.5, y: 44 }, { x: 62.5, y: 49 }, { x: 62, y: 56 }, { x: 62, y: 59 }],
      [{ x: 4, y: 4 }, { x: 16, y: 4 }, g1.flag, { x: 32, y: 6 },
       { x: 36, y: 8 }, { x: 36, y: 14 }, { x: 36, y: 24 }, { x: 37, y: 29 }, g2.flag,
       { x: 48, y: 29 }, { x: 57, y: 29 }, { x: 62, y: 30 }, g3.flag,
       { x: 62.5, y: 44 }, { x: 62.5, y: 49 }, { x: 62, y: 56 }, { x: 62, y: 59 }],
    ],
    // A static two tiles from the racing line is an obstacle; one ON it is a
    // wall, and the first leg of the first course is not where a wall belongs.
    hazards: [haz('tee', 16, 4), haz('tee', 19, 4), haz('tree', 31, 8)],
  };
}

// The factories, in play order. Each call builds a FRESH course object: compile() fills
// derived fields in place, so a course is never compiled twice.
var COURSE_DEFS = [practice];

var _courseCache = [];
function getCourse(i) {
  if (!_courseCache[i]) _courseCache[i] = compile(COURSE_DEFS[i]());
  return _courseCache[i];
}
function courseCount() { return COURSE_DEFS.length; }
