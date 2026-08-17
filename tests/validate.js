// THE VALIDATORS. These are the specification (section 8): a course is finished when
// every one of them is clean and the oracle clears every authored route with zero falls.
//
// They live here rather than in src/ because the game never calls them — shipping a
// validator in game.html would be dead code in the artifact. They read the compiled
// course exactly as the engine does.

'use strict';

function mk(PL) {
  var V = {};
  var BALL_R = PL.BALL_R, SURF = PL.SURF;

  // ---- LAW 5.2 / test 2 and 13 ---------------------------------------------
  // The steepest thing an author DECLARED: the piece's own height function sampled at
  // the corners the grid can actually represent. Anything the compiled grid does that is
  // steeper than this came from pieces interacting, which is a bug, not a design.
  // Compile each piece ALONE, through the same compiler and the same dilation, and read
  // it with the same sweep. Comparing a 1-D corner step against a 2-D gradient magnitude
  // is not a comparison: a bowl whose corners step 0.375 in y and 0 in x still has a
  // gradient of 0.381 half a cell away, because bilinear interpolation combines the two.
  // Like-for-like is the only form of this test that means anything.
  var _solo = new WeakMap();
  V.declaredSlope = function (course) {
    var worst = 0, who = null;
    course.pieces.forEach(function (p, i) {
      if (p.kind === 'cut' || p.kind === 'paint') return;
      var solo = _solo.get(p);
      if (!solo) {
        solo = PL.compile({ pieces: [p], flags: [], routes: [],
                            cup: { x: p.x + p.w / 2, y: p.y + p.h / 2, r: 1 } });
        _solo.set(p, solo);
      }
      var m = V.maxSlope(solo, false);
      if (m.slope > worst) { worst = m.slope; who = { i: i, kind: p.kind, at: m.at }; }
    });
    return { slope: worst, who: who };
  };

  // Max |grad| over solid cell centres. `interior` demands every cell within a margin of
  // 2 also be solid: measuring the whole grid instead reports the deliberately steep rim
  // of a chute or a funnel — decoration that exists to turn a drifting ball back — rather
  // than the ground anyone rolls on.
  // Sampled at NINE points inside each cell, not just its centre. gradAt at a cell centre
  // reads x +/- 0.5, which is exactly that cell's own two corner lines — so a centre-only
  // sweep can never see past the cell and would call a course with no dilation at all
  // (LAW 5.3) perfectly smooth. The ball is not confined to cell centres, and the -18
  // slope that made it vanish at a lip lives at 0.85 of the way across.
  var SUB = [0.15, 0.5, 0.85];
  V.maxSlope = function (course, interior) {
    var g = course.grid, worst = 0, at = null;
    for (var j = 0; j < g.ny; j++) for (var i = 0; i < g.nx; i++) {
      if (!g.solid[j * g.nx + i]) continue;
      if (interior && !V.isInterior(g, i, j, 2)) continue;
      for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) {
        var x = g.ox + i + SUB[a], y = g.oy + j + SUB[b];
        var s = PL.gradMag(g, x, y);
        if (s > worst) { worst = s; at = [x, y]; }
      }
    }
    return { slope: worst, at: at };
  };

  V.isInterior = function (g, i, j, m) {
    for (var b = -m; b <= m; b++) for (var a = -m; a <= m; a++) {
      var ii = i + a, jj = j + b;
      if (ii < 0 || ii >= g.nx || jj < 0 || jj >= g.ny) return false;
      if (!g.solid[jj * g.nx + ii]) return false;
    }
    return true;
  };

  // ---- reachability (section 6) ---------------------------------------------
  // A flood fill on the mask that also steps across a run of non-ground up to 6 cells
  // long, in a straight lattice direction, onto ground no higher than where it left. A
  // pure walk says "no" on any course with a ledge, and a ledge is a move, not a hole in
  // the level.
  V.reachable = function (course, from, to) {
    var g = course.grid;
    var seen = new Uint8Array(g.nx * g.ny);
    var si = Math.floor(from.x - g.ox), sj = Math.floor(from.y - g.oy);
    var ti = Math.floor(to.x - g.ox), tj = Math.floor(to.y - g.oy);
    var stack = [[si, sj]];
    seen[sj * g.nx + si] = 1;
    var D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (stack.length) {
      var c = stack.pop(), i = c[0], j = c[1];
      if (i === ti && j === tj) return true;
      var hz = g.h[j * (g.nx + 1) + i];
      for (var d = 0; d < 4; d++) {
        for (var gapLen = 1; gapLen <= 7; gapLen++) {
          var ni = i + D[d][0] * gapLen, nj = j + D[d][1] * gapLen;
          if (ni < 0 || ni >= g.nx || nj < 0 || nj >= g.ny) break;
          var ok = g.solid[nj * g.nx + ni] && g.surf[nj * g.nx + ni] !== SURF.WATER;
          if (!ok) { if (gapLen > 6) break; continue; }   // a gap of up to 6 is a move
          if (gapLen > 1 && g.h[nj * (g.nx + 1) + ni] > hz + 0.1) break;  // never jump UP
          if (!seen[nj * g.nx + ni]) { seen[nj * g.nx + ni] = 1; stack.push([ni, nj]); }
          break;                                          // first ground in this direction
        }
      }
    }
    return false;
  };

  // ---- LAW 4.1 / test 7 ------------------------------------------------------
  // Every LEG runs along a world axis. A leg is a route segment long enough to be one:
  // the short hops that cross a junction are the turn itself, not a leg.
  V.offAxisLegs = function (course) {
    var bad = [];
    course.routes.forEach(function (r, ri) {
      for (var i = 0; i + 1 < r.pts.length; i++) {
        var dx = Math.abs(r.pts[i + 1].x - r.pts[i].x);
        var dy = Math.abs(r.pts[i + 1].y - r.pts[i].y);
        var len = Math.hypot(dx, dy);
        if (len <= 6) continue;
        if (Math.min(dx, dy) > 1.5)
          bad.push({ route: ri, seg: i, dx: dx, dy: dy, len: len });
      }
    });
    return bad;
  };

  // ---- LAW 6.5 / test 8 ------------------------------------------------------
  // A fork is two LANES; a BRANCH is two PATHS. The first build called it a fork when two
  // identical ramps ran side by side two tiles apart: same slope, same width, same
  // threats, NO REASON TO PREFER EITHER. A branch shares nothing in between.
  V.branches = function (course) {
    var out = [];
    for (var a = 0; a < course.routes.length; a++)
      for (var b = a + 1; b < course.routes.length; b++) {
        var d = V.divergence(course, a, b);
        if (d) out.push(d);
      }
    return out;
  };

  V.divergence = function (course, ai, bi) {
    var A = course.routes[ai], B = course.routes[bi];
    var step = 0.5, runs = [], cur = null;
    for (var s = 0; s <= A.total; s += step) {
      var p = PL.pointAt(A, s);
      var far = Math.sqrt(PL.project(B, p.x, p.y).d2) > 2.5;
      if (far) { if (!cur) cur = { s0: s, s1: s }; else cur.s1 = s; }
      else if (cur) { runs.push(cur); cur = null; }
    }
    if (cur) runs.push(cur);
    var best = null;
    runs.forEach(function (r) { if (!best || r.s1 - r.s0 > best.s1 - best.s0) best = r; });
    if (!best || best.s1 - best.s0 < 8) return null;

    // The matching stretch of B: everything of B that is far from A.
    var bRuns = [], bCur = null;
    for (var t = 0; t <= B.total; t += step) {
      var q = PL.pointAt(B, t);
      var bfar = Math.sqrt(PL.project(A, q.x, q.y).d2) > 2.5;
      if (bfar) { if (!bCur) bCur = { s0: t, s1: t }; else bCur.s1 = t; }
      else if (bCur) { bRuns.push(bCur); bCur = null; }
    }
    var bBest = null;
    bRuns.forEach(function (r) { if (!bBest || r.s1 - r.s0 > bBest.s1 - bBest.s0) bBest = r; });
    if (!bBest || bBest.s1 - bBest.s0 < 8) return null;

    var sa = V.legSignature(course, A, best.s0, best.s1);
    var sb = V.legSignature(course, B, bBest.s0, bBest.s1);
    var diff = [];
    if (Math.abs(sa.len - sb.len) / Math.max(sa.len, sb.len) > 0.10) diff.push('length');
    if (sa.kinds !== sb.kinds) diff.push('pieces');
    if (Math.abs(sa.slope - sb.slope) > 0.03) diff.push('slope');
    if (Math.abs(sa.cross - sb.cross) > 0.03) diff.push('camber');
    if (sa.surfs !== sb.surfs) diff.push('surface');
    if (Math.abs(sa.width - sb.width) >= 1) diff.push('width');
    if (sa.hazards !== sb.hazards) diff.push('hazards');
    return { a: ai, b: bi, lenA: sa.len, lenB: sb.len, diff: diff, sa: sa, sb: sb };
  };

  // What a stretch of route is MADE of. Two stretches that agree on every one of these
  // are the same lane twice, whichever two piece objects they happen to sit on.
  V.legSignature = function (course, route, s0, s1) {
    var g = course.grid, kinds = {}, surfs = {}, hz = {};
    var maxSlope = 0, maxCross = 0, narrowest = 99;
    for (var s = s0; s <= s1; s += 0.5) {
      var p = PL.pointAt(route, s);
      var pc = V.pieceAt(course, p.x, p.y);
      if (pc) kinds[pc.kind] = 1;
      surfs[PL.surfAt(g, p.x, p.y)] = 1;
      // The NARROWEST thing on the stretch, not the set of everything it touches: two
      // branches that separate on a shared junction both taste that junction's width, and
      // a signature that records it calls two identical lanes different.
      var sx = PL.paperSpan(g, p.x, p.y, 0).span, sy = PL.paperSpan(g, p.x, p.y, 1).span;
      if (Math.min(sx, sy) < narrowest) narrowest = Math.min(sx, sy);
      var gr = [0, 0]; PL.gradAt(g, p.x, p.y, gr);
      var m = Math.hypot(gr[0], gr[1]);
      if (m > maxSlope) maxSlope = m;
      // Cross-slope: the component of the gradient across the route's own direction.
      var t0 = PL.pointAt(route, Math.max(s0, s - 1)), t1 = PL.pointAt(route, Math.min(s1, s + 1));
      var tx = t1.x - t0.x, ty = t1.y - t0.y, tm = Math.hypot(tx, ty);
      if (tm > 1e-6) {
        var c = Math.abs(gr[0] * (-ty / tm) + gr[1] * (tx / tm));
        if (c > maxCross) maxCross = c;
      }
      (course.hazards || []).forEach(function (h) {
        if (Math.hypot(h.x - p.x, h.y - p.y) < 3.5) hz[h.name] = 1;
      });
    }
    return {
      len: s1 - s0,
      kinds: Object.keys(kinds).sort().join(','),
      surfs: Object.keys(surfs).sort().join(','),
      width: narrowest,
      hazards: Object.keys(hz).sort().join(','),
      slope: maxSlope, cross: maxCross,
    };
  };

  // The last piece in the list whose rect contains this point and which paints ground.
  V.pieceAt = function (course, x, y) {
    var found = null;
    course.pieces.forEach(function (p) {
      if (p.kind === 'cut' || p.kind === 'paint') return;
      if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) found = p;
    });
    return found;
  };

  // ---- LAW 9.2 / 9.3, tests 9 and 48 ----------------------------------------
  V.hazardIssues = function (course) {
    var g = course.grid, out = [];
    var run = { grid: g, course: course, bodies: [], ball: { x: 0, y: 0 } };
    PL.buildBodies(run);
    run.bodies.forEach(function (b, i) {
      var sweep = PL.hazSweep(b);
      var sx = PL.paperSpan(g, b.hx, b.hy, 0).span, sy = PL.paperSpan(g, b.hx, b.hy, 1).span;
      if (PL.solidAt(g, b.hx, b.hy) !== 1) {
        out.push({ i: i, name: b.name, why: 'anchored off the paper at ' + b.hx + ',' + b.hy });
        return;
      }
      // LAW 9.2 — the disc has to fit. Wider than the paper under it and it is not a
      // threat, it is a wall with no line past it.
      var span = Math.min(sx, sy);
      if (sweep >= span)
        out.push({ i: i, name: b.name, why: 'sweep ' + sweep.toFixed(2) +
                   ' >= paper ' + span + ' at ' + b.hx + ',' + b.hy });

      // LAW 9.3 — where a chaser SHOVES you is its placement, and the anchor cannot tell
      // you that. Walk every route through the disc and ask how much paper is left for
      // the ball's CENTRE either side.
      if (b.prim !== 'SEEKER' && b.prim !== 'RIVAL') return;
      course.routes.forEach(function (r, ri) {
        for (var s = 0; s <= r.total; s += 0.5) {
          var p = PL.pointAt(r, s);
          if (Math.hypot(p.x - b.hx, p.y - b.hy) > sweep) continue;
          var t0 = PL.pointAt(r, Math.max(0, s - 1)), t1 = PL.pointAt(r, Math.min(r.total, s + 1));
          var axis = Math.abs(t1.x - t0.x) >= Math.abs(t1.y - t0.y) ? 1 : 0;  // ACROSS the run
          var sp = PL.paperSpan(g, p.x, p.y, axis);
          if (!sp.span) continue;
          var lo = sp.lo + BALL_R, hi = sp.hi - BALL_R;              // where a centre can be
          var hc = axis === 0 ? b.hx : b.hy;
          var blo = hc - (b.r + BALL_R), bhi = hc + (b.r + BALL_R);  // what the chaser occupies
          var left = Math.min(hi, blo) - lo, right = hi - Math.max(lo, bhi);
          var room = Math.max(left, right);
          if (room < 2 * BALL_R) {
            out.push({ i: i, name: b.name, why: 'route ' + ri + ' at ' + p.x.toFixed(1) + ',' +
                       p.y.toFixed(1) + ' leaves ' + room.toFixed(2) + ' for the ball (need ' +
                       (2 * BALL_R).toFixed(2) + ')' });
            return;
          }
        }
      });
    });
    return out;
  };

  // ---- LAW 10.2 / tests 36, 37 -----------------------------------------------
  V.flagIssues = function (course) {
    var g = course.grid, out = [];
    course.flags.forEach(function (f, fi) {
      var ga = PL.gateAt(g, f.x, f.y);
      if (PL.solidAt(g, f.x, f.y) !== 1)
        out.push({ f: fi, why: 'stands off the paper' });
      if (ga.cross > PL.NECK_MAX)
        out.push({ f: fi, why: 'neck is ' + ga.cross + ' across, over NECK_MAX ' + PL.NECK_MAX });
      if (ga.along < 2)
        out.push({ f: fi, why: 'spans ' + ga.along + ' along the run — a stub, not a path' });
      course.routes.forEach(function (r, ri) {
        if (f.skip && f.skip.indexOf(ri) !== -1) return;
        var d = Math.sqrt(PL.project(r, f.x, f.y).d2);
        if (d > 0.7 * f.r)
          out.push({ f: fi, why: 'route ' + ri + ' passes ' + d.toFixed(2) +
                     ' away, over 0.7r = ' + (0.7 * f.r).toFixed(2) });
        var s = PL.project(r, f.x, f.y).s;
        if (r.total - s < PL.CUP_CLEAR)
          out.push({ f: fi, why: 'route ' + ri + ' leaves only ' + (r.total - s).toFixed(1) +
                     ' tiles to the cup, under CUP_CLEAR ' + PL.CUP_CLEAR });
      });
    });
    return out;
  };

  // ---- LAW 6.8 / tests 39 and 52 ---------------------------------------------
  // A cell is FLAT when it is solid, is not WATER, and |gradAt(centre)| <= 0.06.
  V.largestFlatSquare = function (course) {
    var g = course.grid, nx = g.nx, ny = g.ny;
    var dp = new Int32Array(nx * ny), best = 0, at = null;
    for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
      var k = j * nx + i;
      var flat = g.solid[k] && g.surf[k] !== SURF.WATER &&
                 PL.gradMag(g, g.ox + i + 0.5, g.oy + j + 0.5) <= 0.06;
      if (!flat) { dp[k] = 0; continue; }
      dp[k] = (i === 0 || j === 0) ? 1
            : 1 + Math.min(dp[k - 1], dp[k - nx], dp[k - nx - 1]);
      if (dp[k] > best) { best = dp[k]; at = [g.ox + i - best + 1, g.oy + j - best + 1]; }
    }
    return { size: best, at: at };
  };

  // ---- LAW 6.7 ---------------------------------------------------------------
  // Flat, four tiles clear in every direction, no hazard within five. 12% of the first
  // build was that, and every course finished on the largest, flattest ground in it.
  V.restRatio = function (course) {
    var g = course.grid, rest = 0, solid = 0;
    for (var j = 0; j < g.ny; j++) for (var i = 0; i < g.nx; i++) {
      var k = j * g.nx + i;
      if (!g.solid[k]) continue;
      solid++;
      if (g.surf[k] === SURF.WATER) continue;
      var x = g.ox + i + 0.5, y = g.oy + j + 0.5;
      if (PL.gradMag(g, x, y) > 0.06) continue;
      if (!V.isInterior(g, i, j, 4)) continue;
      var near = (course.hazards || []).some(function (h) {
        return Math.hypot(h.x - x, h.y - y) < 5;
      });
      if (near) continue;
      rest++;
    }
    return { ratio: solid ? rest / solid : 0, rest: rest, solid: solid };
  };

  // ---- LAW 6.7b / test 49 -----------------------------------------------------
  // Counted off the COMPILED courses, not off the source. The engine having a feature is
  // invisible; only a course using it is the game.
  V.featureCounts = function (courses) {
    var c = { water: 0, fragile: 0, bank: 0, crown: 0, tube: 0, branch: 0, belt: 0, tier: 0 };
    courses.forEach(function (co) {
      var g = co.grid, has = {};
      for (var k = 0; k < g.solid.length; k++) {
        if (!g.solid[k]) continue;
        if (g.surf[k] === SURF.WATER) has.water = 1;
        if (g.surf[k] === SURF.FRAGILE) has.fragile = 1;
        if (g.surf[k] === SURF.BELT) has.belt = 1;
      }
      co.pieces.forEach(function (p) {
        if (p.kind === 'bank') has.bank = 1;
        if (p.kind === 'crown') has.crown = 1;
        if (p.kind === 'tube') has.tube = 1;
      });
      if (V.branches(co).some(function (b) { return b.diff.length > 0; })) has.branch = 1;
      if (V.tiers(co).length) has.tier = 1;
      Object.keys(has).forEach(function (k2) { c[k2]++; });
    });
    return c;
  };

  // A TIER is a void gap a route crosses onto ground BELOW the lip: the drop is a route.
  V.tiers = function (course) {
    var g = course.grid, out = [];
    course.routes.forEach(function (r, ri) {
      var last = null;
      for (var s = 0; s <= r.total; s += 0.25) {
        var p = PL.pointAt(r, s);
        if (PL.solidAt(g, p.x, p.y) === 1) {
          if (last !== null && s - last.s > 1.0) {
            var drop = PL.heightAt(g, last.p.x, last.p.y) - PL.heightAt(g, p.x, p.y);
            if (drop > 0.8) out.push({ route: ri, at: s, span: s - last.s, drop: drop });
          }
          last = { s: s, p: p };
        }
      }
    });
    return out;
  };

  // ---- LAW 6.9 / test 50 ------------------------------------------------------
  // Read the piece list of each course out loud as a sequence of kinds. If courses 2 and
  // 3 sound the same, they are the same.
  V.legKinds = function (course) {
    // A LEG is a piece with a length: everything that is not a junction pad, a cut or a
    // paint. A ramp carrying a paint over it is not a plain ramp.
    var painted = {};
    course.pieces.forEach(function (p) {
      if (p.kind !== 'paint') return;
      course.pieces.forEach(function (q, qi) {
        if (q.kind === 'cut' || q.kind === 'paint') return;
        if (p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y)
          painted[qi] = 1;
      });
    });
    var out = [];
    course.pieces.forEach(function (p, i) {
      if (p.kind === 'cut' || p.kind === 'paint' || p.kind === 'bowl') return;
      if (p.kind === 'pad') return;                       // a junction is not a leg
      out.push(painted[i] ? p.kind + '+paint' : p.kind);
    });
    return out;
  };

  V.openingSignature = function (course) {
    return course.pieces.filter(function (p) { return p.kind !== 'paint'; })
                        .slice(0, 4).map(function (p) { return p.kind; }).join('>');
  };

  // ---- test 52 ----------------------------------------------------------------
  // LAW 6.8 asked of the AUTHOR'S pieces rather than of the compiled grid, so it fails at
  // the line that wrote it. Nothing is a plain flat rectangle above 9 across.
  V.wideFlatPieces = function (course) {
    var out = [];
    course.pieces.forEach(function (p, i) {
      if (p.kind !== 'pad') return;
      if (p.surf === SURF.WATER) return;
      var across = Math.min(p.w, p.h);
      if (across <= 9) return;
      // ...unless something carves it: a bowl, a cut, a crown or a bank over it.
      var saved = course.pieces.some(function (q, qi) {
        if (qi <= i) return false;
        if (['bowl', 'cut', 'crown', 'bank'].indexOf(q.kind) === -1) return false;
        return q.x < p.x + p.w && q.x + q.w > p.x && q.y < p.y + p.h && q.y + q.h > p.y;
      });
      if (!saved) out.push({ i: i, at: [p.x, p.y], w: p.w, h: p.h });
    });
    return out;
  };

  // ---- test 6 -----------------------------------------------------------------
  V.routeOffPaper = function (course) {
    var g = course.grid, out = [];
    course.routes.forEach(function (r, ri) {
      var gap = 0, worst = 0;
      for (var s = 0; s <= r.total; s += 0.25) {
        var p = PL.pointAt(r, s);
        if (PL.solidAt(g, p.x, p.y) === 1) { gap = 0; continue; }
        gap += 0.25;
        if (gap > worst) worst = gap;
      }
      // A route may cross a LEDGE — that is a move, not a hole. It may not wander.
      if (worst > 6.5) out.push({ route: ri, gap: worst });
    });
    return out;
  };

  // ---- test 5 ------------------------------------------------------------------
  // A flag is somewhere the ball can actually stop. Terminal speed on a slope s against
  // the surface's own drag: ROLL*G*s = MU*drag*v.
  V.terminalAt = function (course, x, y) {
    var g = course.grid;
    var s = PL.gradMag(g, x, y);
    return PL.ROLL * PL.G * s / (PL.MU * PL.SURF_DRAG[PL.surfAt(g, x, y)]);
  };

  return V;
}

module.exports = { mk: mk };
