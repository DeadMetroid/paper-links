// THE FAIRNESS ORACLE — section 15, harness 1, shipped exactly as specified.
//
// It drives each authored route using exactly the input a human gets, quantised to the
// eight directions a keyboard can produce. It gates tests 11, 12 and 42, and those gate
// all six courses: until it exists you cannot tell whether a course you wrote is
// passable, and every constant in it was tuned against courses that already worked.
//
// DO NOT retune a constant in this file to make a course pass. Fix the course.

'use strict';

function makeOracle(PL) {
  var MAX_SPEED = PL.MAX_SPEED, G = PL.G;
  var solidAt = PL.solidAt, heightAt = PL.heightAt;
  var pointAt = PL.pointAt, project = PL.project;

  var STICK = 7;              // tiles off the route before it gives that route up

  function quantise8(dx, dy) {
    var m = Math.hypot(dx, dy);
    if (m < 1e-9) return [0, 0];
    var k = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
    return [Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)];
  }

  // Solid paper around a point, in tiles, capped at 9. A four-tile catwalk and a
  // twenty-tile junction are not the same road and nothing but looking says which.
  function clearanceAt(grid, x, y) {
    var best = 9;
    for (var d = 0; d < 4; d++) {
      var dx = d === 0 ? 1 : d === 1 ? -1 : 0;
      var dy = d === 2 ? 1 : d === 3 ? -1 : 0;
      for (var k = 1; k <= 9; k++) {
        if (solidAt(grid, x + dx*k, y + dy*k) !== 1) { if (k-1 < best) best = k-1; break; }
      }
    }
    return best;
  }

  // NEVER BRAKE INTO A GAP. The clearance governor below slows for exactly the thing
  // that must be taken fast — a ledge has almost no clearance — so a gap overrides it
  // with the ballistic requirement. A gap onto ground no LOWER than the lip cannot be
  // jumped at all, and is reported as needing the speed clamp so it surfaces as a bug.
  function gapAhead(grid, route, s0, range) {
    var step = 0.5, lastSolid = null;
    for (var d = 0; d <= range; d += step) {
      var p = pointAt(route, Math.min(route.total, s0 + d));
      if (solidAt(grid, p.x, p.y) === 1) { lastSolid = p; continue; }
      if (!lastSolid) return null;                        // already off the paper
      for (var e = d + step; e <= d + 14; e += step) {    // walk to the far side
        var q = pointAt(route, Math.min(route.total, s0 + e));
        if (solidAt(grid, q.x, q.y) !== 1) continue;
        var span = Math.hypot(q.x - lastSolid.x, q.y - lastSolid.y);
        var drop = heightAt(grid, lastSolid.x, lastSolid.y) - heightAt(grid, q.x, q.y);
        if (drop <= 0.1) return { span: span, vreq: MAX_SPEED };
        var flight = Math.sqrt((2 * drop) / G);
        return { span: span, vreq: ((span + 1.2) / flight) * 1.15 };
      }
      return { span: 14, vreq: MAX_SPEED };
    }
    return null;
  }

  function tangentAt(route, s) {
    var a = pointAt(route, s), c = pointAt(route, Math.min(route.total, s + 2.5));
    var tx = c.x - a.x, ty = c.y - a.y, m = Math.hypot(tx, ty);
    return m < 1e-6 ? [0, 0] : [tx/m, ty/m];
  }

  // Commit to the route it was ASKED for; give it up only when pushed STICK tiles off.
  // Choosing purely by proximity looks tidier and is wrong: on a fork the ball drifts a
  // metre toward the narrow lane, the oracle adopts it, and the course is now judged on
  // the hardest line through it rather than the one the author drew.
  function nearestRoute(course, x, y, prefer) {
    var best = null, bestD = 1e18;
    for (var i = 0; i < course.routes.length; i++) {
      var pr = project(course.routes[i], x, y);
      if (i === prefer && pr.d2 <= STICK*STICK)
        return { route: course.routes[i], s: pr.s, idx: i, d2: pr.d2 };
      if (pr.d2 < bestD) { bestD = pr.d2; best = { route: course.routes[i], s: pr.s, idx: i, d2: pr.d2 }; }
    }
    return best;
  }

  function autopilotInput(run, prefer) {
    var course = run.course, b = run.ball;
    var nr = nearestRoute(course, b.x, b.y, prefer === undefined ? 0 : prefer);
    if (!nr) return [0, 0];
    var t = tangentAt(nr.route, nr.s);
    var sp = Math.hypot(b.vx, b.vy);

    // Look further ahead the faster it goes, and take the TIGHTER of the clearance here
    // and where it will be — braking has to start before the narrow bit, not on it.
    var reach = Math.max(4, sp * 0.8);
    var probe = pointAt(nr.route, Math.min(nr.route.total, nr.s + reach));
    var clear = Math.min(clearanceAt(run.grid, b.x, b.y),
                         clearanceAt(run.grid, probe.x, probe.y));
    var want = 3.0 + clear * 1.7;

    // Brake for the corner, not on it. `turn` is 0 dead straight, 1 a right angle, 2
    // straight back. A ball arriving at a junction at the ramp's terminal speed needs
    // v^2/2K tiles to stop and the junction that could absorb that would be the size of
    // the level, so the speed comes off before the corner arrives.
    var t2 = tangentAt(nr.route, Math.min(nr.route.total, nr.s + reach));
    var turn = 1 - (t[0]*t2[0] + t[1]*t2[1]);
    if (turn > 0.05) want /= (1 + 1.9 * turn);

    var gap = gapAhead(run.grid, nr.route, nr.s, reach + 12);
    if (gap) want = Math.max(want, gap.vreq);

    // Being ON the line outranks making progress along it. Off by two tiles on a
    // three-tile catwalk is not a tracking error to trim on the way past, it is the last
    // moment before a fall — so the tangent term is scaled down by how far off the ball
    // already is, and the pull back onto the line is not.
    var off = Math.sqrt(nr.d2);
    var align = 1 / (1 + 0.6 * off);
    var here = pointAt(nr.route, nr.s);
    return quantise8(t[0]*want*align + (here.x - b.x)*3.0 - b.vx,
                     t[1]*want*align + (here.y - b.y)*3.0 - b.vy);
  }

  // The driver loop. Runs to 120*240 ticks, feeds [0,0] while the run is FALLING, and
  // measures progress as the fraction of the ROUTE covered, never distance down the
  // screen — on a staircase those are not the same thing, and a branch that runs back
  // up-left is progress even though S barely moves. Gives up after 120*25 ticks with no
  // new best and reports the percentage it stalled at.
  function driveRoute(course, routeIdx, opts) {
    opts = opts || {};
    var run = PL.newRun(course, routeIdx);
    var route = course.routes[routeIdx];
    var MAXT = 120 * 240, STALL = 120 * 25;
    var best = 0, sinceBest = 0, falls = 0, ticks = 0;

    while (ticks < MAXT) {
      var inp = (run.ball.state === PL.ST.FALL || run.ball.state === PL.ST.SINK ||
                 run.holdT > 0) ? [0, 0] : autopilotInput(run, routeIdx);
      var fallsBefore = run.falls;
      PL.tick(run, inp[0], inp[1]);
      if (run.falls > fallsBefore) falls = run.falls;
      ticks++;

      if (run.ball.state === PL.ST.HOLED) {
        return { ok: true, falls: falls, ticks: ticks, progress: 1,
                 clock: run.clock, credit: run.credit, run: run,
                 flags: run.flagsHit.slice() };
      }

      var pr = project(route, run.ball.x, run.ball.y);
      var frac = pr.s / route.total;
      if (frac > best + 1e-4) { best = frac; sinceBest = 0; } else { sinceBest++; }
      if (sinceBest > STALL) break;
    }
    return { ok: false, falls: falls, ticks: ticks, progress: best,
             clock: run.clock, credit: run.credit, run: run,
             flags: run.flagsHit.slice() };
  }

  return {
    STICK: STICK, quantise8: quantise8, clearanceAt: clearanceAt, gapAhead: gapAhead,
    tangentAt: tangentAt, nearestRoute: nearestRoute, autopilotInput: autopilotInput,
    driveRoute: driveRoute,
  };
}

module.exports = { makeOracle: makeOracle };
