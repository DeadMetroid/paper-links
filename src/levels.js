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

// 2. THE LADDER — 3 flags
// The first real BRANCH. One way down is short, made of paper that goes away under you,
// and entered over a LEDGE you have to commit to — with a belt on the junction floor
// feeding you at that lip whether that was the plan or not. The other is longer, wider,
// gentler at its mouth, and has things living on it. They share a checkpoint at each end
// and nothing in between. Closes on a camber cut in two by its last gate.
function ladder() {
  var P = [], z = 40;
  P.push(pad(0, 0, 8, 8, z));

  // Opens on a CHUTE, not a ramp. No two courses open the same way, and the first thing
  // this one does is take the steering away for fourteen tiles.
  var c1 = chuteX(8, 0, 14, 8, z, 0.20, 1.1);           P.push(c1);   z = c1.exit;
  var g1 = gateX(22, 3, 4, 3, z);                       P.push(g1);

  // The splitting junction. The pond is in the corner nothing routes through — it is what
  // makes eleven tiles of pad unsittable as well as being the water on this course — and
  // the belt across the floor is aimed at the left-hand lip.
  P.push(pad(26, 0, 11, 10, z));
  P.push(pond(26, 6, 3, 4, z, 0.45));
  P.push(beltOver(30, 6, 7, 4, 0, 1));

  // LEFT — short. Off the lip at y=10, across THREE tiles of void and three units down,
  // then twenty tiles of paper that cracks the moment you are genuinely on it.
  // Three tiles, not two: at a two-cell gap the height dilation reaches across from both
  // sides and averages the two tiers into one corner, which invents a slope of 1.05 at
  // the landing. Every void gap in this game is at least three cells wide.
  var ls = rampY(30, 13, 6, 20, z - 3.0, 0.30);         P.push(ls);
  P.push(fragile(30, 16, 6, 14));
  P.push(pad(30, 33, 6, 6, ls.exit));
  // The rejoin height is DERIVED on both sides, never typed, so the two ways down cannot
  // grow a step between them.
  var zJoin = 27.6;
  var lx = rampX(36, 33, 12, 6, ls.exit, (ls.exit - zJoin) / 12);   P.push(lx);

  // RIGHT — longer, eight wide throughout, gentle at the mouth, and populated. It closes
  // on a TUBE: the one place in the game where speed is the safe answer, because a fast
  // ball climbs the rim and the wall hands it back still pointed down the piece.
  var r1 = rampX(37, 1, 15, 8, z, 0.17);                P.push(r1);
  P.push(pad(52, 1, 8, 8, r1.exit));
  P.push(cut(56, 1, 4, 3));
  var r2 = tubeY(52, 9, 8, 24, r1.exit, (r1.exit - zJoin) / 24, 1.2);  P.push(r2);

  // The rejoin, with a hole cut out of the middle: fourteen tiles of pad is otherwise the
  // safest ground on the course, and the hole makes it two ways round with a wrong one.
  P.push(pad(48, 33, 14, 10, zJoin));
  P.push(cut(53, 36, 5, 5));
  var g2 = gateX(62, 36, 4, 3, zJoin);                  P.push(g2);

  // A CAMBER, cut in two by its last gate — and the second half leans the other way, so
  // the edge you spent fourteen tiles fighting becomes the edge you need.
  var b1 = bankX(66, 35, 14, 5, zJoin, 0.22, 0.9);      P.push(b1);
  var g3 = gateX(80, 36, 4, 3, b1.exit);                P.push(g3);
  var b2 = bankX(84, 35, 12, 5, b1.exit, 0.22, -0.9);   P.push(b2);

  // Three tiles of void and two units down onto the green, taken at whatever the camber
  // left you with.
  P.push(pad(99, 32, 12, 12, b2.exit - 2.0, SURF.GREEN));
  P.push(greenDish(101, 34, 8, 8, b2.exit - 2.0, 0.4));

  return {
    name: 'THE LADDER',
    parTime: 16, bonus: 3,
    pieces: P,
    start: { x: 4, y: 4 },
    cup: { x: 105, y: 38, r: 0.9 },
    flags: [g1.flag, g2.flag, g3.flag],
    routes: [
      // 0 — LEFT: the ledge, the fragile leg, the flat run out.
      [{ x: 4, y: 4 }, { x: 16, y: 4 }, g1.flag, { x: 30, y: 4 }, { x: 33, y: 8 },
       { x: 33, y: 11.5 }, { x: 33, y: 14 }, { x: 33, y: 24 }, { x: 33, y: 31 },
       { x: 33, y: 36 }, { x: 40, y: 36 }, { x: 48, y: 36 }, { x: 52, y: 35 },
       { x: 60, y: 35 }, g2.flag, { x: 72, y: 37.5 }, g3.flag, { x: 90, y: 37.5 },
       { x: 96, y: 37.5 }, { x: 102, y: 38 }, { x: 105, y: 38 }],
      // 1 — RIGHT: out along the top, round the elbow, down the tube.
      [{ x: 4, y: 4 }, { x: 16, y: 4 }, g1.flag, { x: 30, y: 4 }, { x: 38, y: 5 },
       { x: 50, y: 5 }, { x: 55, y: 6 }, { x: 56, y: 12 }, { x: 56, y: 26 },
       { x: 56, y: 32 }, { x: 58, y: 35 }, { x: 60, y: 35 }, g2.flag,
       { x: 72, y: 37.5 }, g3.flag, { x: 90, y: 37.5 },
       { x: 96, y: 37.5 }, { x: 102, y: 38 }, { x: 105, y: 38 }],
    ],
    // Everything that lives here lives on the RIGHT. The left branch's threat is the
    // paper, and a threat on top of that would be two prices for one decision.
    // The tee peg is OFF the racing line: a static ON it is not an obstacle, it is a
    // wall — the ball jams against an infinite mass and no amount of input gets past.
    hazards: [haz('tee', 12, 2.2), haz('mallet', 44, 5, 0.6),
              haz('goose', 46, 7, 0, 6), haz('post', 51, 41)],
  };
}

// The factories, in play order. Each call builds a FRESH course object: compile() fills
// derived fields in place, so a course is never compiled twice.
var COURSE_DEFS = [practice, ladder];

var _courseCache = [];
function getCourse(i) {
  if (!_courseCache[i]) _courseCache[i] = compile(COURSE_DEFS[i]());
  return _courseCache[i];
}
function courseCount() { return COURSE_DEFS.length; }
