// THE LEVEL MODEL — pieces painted on the lattice.
//
// LAW 6.1 — a level is an ORDERED LIST OF PIECES painted onto the world lattice, not a
// ribbon with a width. Later pieces win, for both height and mask, so authoring is: lay
// the big shapes down, then carve. Every run is along +wx or +wy, which satisfies LAW 4.1
// by construction and makes 4.2 free.
//
// There is no corridor generator here and there must never be one. A 1-D chain of
// segments down one centreline cannot express a junction, cannot express a branch, and
// every fix to it buys one course while selling another.

function smoothstep(x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x * x * (3 - 2 * x);
}

// ---- the pieces -------------------------------------------------------------
// `u` runs along the piece's own axis, `t` across it, both in [0,1].

function pieceLen(p) { return p.axis === 'x' ? p.w : p.h; }

function pieceHeight(p, cx, cy) {
  var u, t;
  if (p.axis === 'y') { u = (cy - p.y) / p.h; t = (cx - p.x) / p.w; }
  else                { u = (cx - p.x) / p.w; t = (cy - p.y) / p.h; }
  if (u < 0) u = 0; else if (u > 1) u = 1;
  if (t < 0) t = 0; else if (t > 1) t = 1;

  if (p.kind === 'bowl') {
    // Chebyshev radius, so r is exactly 1 on the WHOLE boundary and the rim seams flat
    // against the pad it is sunk into. A dish that collects: the restoring slope grows
    // linearly with offset (LAW 5.6 — a surface with a rule must carry a SHAPE).
    var rx = Math.abs(2 * (cx - (p.x + p.w / 2)) / p.w);
    var ry = Math.abs(2 * (cy - (p.y + p.h / 2)) / p.h);
    var r = Math.max(rx, ry); if (r > 1) r = 1;
    return p.z - p.depth * (1 - r * r);
  }

  var base = p.z - (p.slope || 0) * u * pieceLen(p);
  var d = 2 * t - 1;

  switch (p.kind) {
    case 'pad':
    case 'ramp':
      return base;
    case 'chute':
      // Banking OPENS AND CLOSES along its length so both ends seam flat against a pad.
      // LAW 6.3: full banking at the mouth made the pad in front absorb the whole rim in
      // one cell — a 1.4-unit step, more than three times critical. A launch ramp
      // disguised as a joint.
      return base + p.bank * Math.sin(Math.PI * u) * d * d;
    case 'tube':
      // A chute you can LIVE IN: the rim is held flat-topped across the middle 64% and
      // folded away over the first and last 18%.
      return base + p.bank * smoothstep(Math.min(u, 1 - u) / 0.18) * d * d;
    case 'funnel':
      var thr = 1 + (p.throat - 1) * u;
      var q = Math.min(1, Math.abs(d) / thr);
      return base + p.rise * Math.sin(Math.PI * u) * q * q;
    case 'wave':
      return base + p.amp * (1 - Math.cos(2 * Math.PI * u * p.waves)) / 2;
    case 'crown':
      // A RIDGE — the inverse of a chute. The crest is high ground and both edges fall
      // into the void, so the drift finishes itself. Nothing has to touch you.
      return base + p.rise * Math.sin(Math.PI * u) * (1 - d * d);
    case 'bank':
      // A CAMBER. `tilt` is SIGNED and is the total height difference across the piece.
      // LAW 6.6: it points gravity at one edge for the whole length of a leg, so holding
      // a line costs input CONTINUOUSLY rather than at a moment.
      return base + p.tilt * smoothstep(Math.min(u, 1 - u) / 0.15) * (t - 0.5);
    default:
      throw new Error('piece with no height function: ' + p.kind);
  }
}

function piece(o) {
  if (o.kind !== 'cut' && o.kind !== 'paint' && o.kind !== 'bowl') {
    o.exit = o.z - (o.slope || 0) * pieceLen(o);
  } else {
    o.exit = o.z;
  }
  if (o.surf === undefined) o.surf = SURF.FAIRWAY;
  return o;
}

// ---- authoring helpers ------------------------------------------------------
// Each returns its own exit height and the next leg is handed that number, so two pieces
// that meet always agree BY CONSTRUCTION. Heights are never typed twice.

function pad(x, y, w, h, z, surf)  { return piece({ kind:'pad', axis:'x', x:x,y:y,w:w,h:h,z:z, surf:surf }); }
function cut(x, y, w, h)           { return piece({ kind:'cut', axis:'x', x:x,y:y,w:w,h:h,z:0 }); }

function rampX(x,y,w,h,z,slope,surf){ return piece({ kind:'ramp', axis:'x', x:x,y:y,w:w,h:h,z:z,slope:slope,surf:surf }); }
function rampY(x,y,w,h,z,slope,surf){ return piece({ kind:'ramp', axis:'y', x:x,y:y,w:w,h:h,z:z,slope:slope,surf:surf }); }

function chuteX(x,y,w,h,z,slope,bank,surf){ return piece({ kind:'chute', axis:'x', x:x,y:y,w:w,h:h,z:z,slope:slope,bank:bank,surf:surf }); }
function chuteY(x,y,w,h,z,slope,bank,surf){ return piece({ kind:'chute', axis:'y', x:x,y:y,w:w,h:h,z:z,slope:slope,bank:bank,surf:surf }); }

function tubeX(x,y,w,h,z,slope,bank,surf){ return piece({ kind:'tube', axis:'x', x:x,y:y,w:w,h:h,z:z,slope:slope,bank:bank,surf:surf }); }
function tubeY(x,y,w,h,z,slope,bank,surf){ return piece({ kind:'tube', axis:'y', x:x,y:y,w:w,h:h,z:z,slope:slope,bank:bank,surf:surf }); }

function funnelX(x,y,w,h,z,slope,rise,throat,surf){ return piece({ kind:'funnel', axis:'x', x:x,y:y,w:w,h:h,z:z,slope:slope,rise:rise,throat:throat,surf:surf }); }
function funnelY(x,y,w,h,z,slope,rise,throat,surf){ return piece({ kind:'funnel', axis:'y', x:x,y:y,w:w,h:h,z:z,slope:slope,rise:rise,throat:throat,surf:surf }); }

function bankX(x,y,w,h,z,slope,tilt,surf){ return piece({ kind:'bank', axis:'x', x:x,y:y,w:w,h:h,z:z,slope:slope,tilt:tilt,surf:surf }); }
function bankY(x,y,w,h,z,slope,tilt,surf){ return piece({ kind:'bank', axis:'y', x:x,y:y,w:w,h:h,z:z,slope:slope,tilt:tilt,surf:surf }); }

function crownX(x,y,w,h,z,slope,rise,surf){ return piece({ kind:'crown', axis:'x', x:x,y:y,w:w,h:h,z:z,slope:slope,rise:rise,surf:surf }); }
function crownY(x,y,w,h,z,slope,rise,surf){ return piece({ kind:'crown', axis:'y', x:x,y:y,w:w,h:h,z:z,slope:slope,rise:rise,surf:surf }); }

function waveX(x,y,w,h,z,slope,amp,waves,surf){ return piece({ kind:'wave', axis:'x', x:x,y:y,w:w,h:h,z:z,slope:slope,amp:amp,waves:waves,surf:surf }); }
function waveY(x,y,w,h,z,slope,amp,waves,surf){ return piece({ kind:'wave', axis:'y', x:x,y:y,w:w,h:h,z:z,slope:slope,amp:amp,waves:waves,surf:surf }); }

// `z` is the RIM. The dish sinks `depth` below it, so a bowl always seams flat against
// the pad it is cut into and the author never re-derives a parent's height function.
function bowl(x,y,w,h,z,depth,surf){ return piece({ kind:'bowl', axis:'x', x:x,y:y,w:w,h:h,z:z,depth:depth,surf:surf }); }
function pond(x,y,w,h,z,depth)     { return bowl(x,y,w,h,z,depth,SURF.WATER); }
function greenDish(x,y,w,h,z,depth){ return bowl(x,y,w,h,z,depth,SURF.GREEN); }

function belt(x,y,w,h,z,dx,dy) {
  var m = Math.hypot(dx, dy);
  return piece({ kind:'pad', axis:'x', x:x,y:y,w:w,h:h,z:z, surf:SURF.BELT, fx:dx/m, fy:dy/m });
}

// LAW 6.2 — `paint` writes surface and flow onto ground that ALREADY EXISTS and touches
// NO height. It is why water and fragile paper are authoring moves rather than arithmetic
// problems: a channel can run down one side of a banked leg without the author
// re-deriving the parent's height function at an offset and getting it a hundredth wrong
// — which is a seam, and a seam is a cliff. It paints solid cells only, so a strip that
// overhangs its parent quietly does nothing instead of quietly adding floor.
function paint(x,y,w,h,surf,fx,fy){ return piece({ kind:'paint', axis:'x', x:x,y:y,w:w,h:h,z:0, surf:surf, fx:fx, fy:fy }); }
function water(x,y,w,h)   { return paint(x,y,w,h,SURF.WATER); }
function fragile(x,y,w,h) { return paint(x,y,w,h,SURF.FRAGILE); }
function sand(x,y,w,h)    { return paint(x,y,w,h,SURF.SAND); }
function rough(x,y,w,h)   { return paint(x,y,w,h,SURF.ROUGH); }
function dry(x,y,w,h)     { return paint(x,y,w,h,SURF.FAIRWAY); }
function drySlot(x,y,w,h) { return paint(x,y,w,h,SURF.FAIRWAY); }   // a gate through water
function beltOver(x,y,w,h,dx,dy) {
  var m = Math.hypot(dx, dy);
  return paint(x,y,w,h,SURF.BELT,dx/m,dy/m);
}

// A gate is a short FLAT span with the void — or water, which is not ground either —
// hard against both sides. It carries its own flag coordinate, so a gate cannot be moved
// and leave its checkpoint standing in the void where it used to be (LAW 10.1).
// It is FLAT because a checkpoint is also a respawn: a gate on a slope is a gate you roll
// off during the two-second hold.
function gateX(x, y, len, w, z) {
  var p = pad(x, y, len, w, z);
  p.gate = 'x';
  p.flag = { x: x + len / 2, y: y + w / 2, r: 0 };
  return p;
}
function gateY(x, y, w, len, z) {
  var p = pad(x, y, w, len, z);
  p.gate = 'y';
  p.flag = { x: x + w / 2, y: y + len / 2, r: 0 };
  return p;
}
// Exactly one flag in the whole game may declare this — the one the tier shortcut gives
// up (LAW 10.3).
function skips(flag, routes) { flag.skip = routes; return flag; }

// ---- routes -----------------------------------------------------------------
// An authored polyline from the tee to the cup, per branch. This is the only thing that
// knows "the way through" — the geometry does not have to encode it.

function makeRoute(pts) {
  var cum = [0], total = 0;
  for (var i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    cum.push(total);
  }
  return { pts: pts, cum: cum, total: total };
}

function pointAt(route, s) {
  var pts = route.pts, cum = route.cum;
  if (s <= 0) return { x: pts[0].x, y: pts[0].y };
  if (s >= route.total) return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
  var lo = 0, hi = cum.length - 1;
  while (lo + 1 < hi) { var mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
  var seg = cum[lo + 1] - cum[lo];
  var f = seg < 1e-12 ? 0 : (s - cum[lo]) / seg;
  return { x: pts[lo].x + (pts[lo + 1].x - pts[lo].x) * f,
           y: pts[lo].y + (pts[lo + 1].y - pts[lo].y) * f };
}

function project(route, x, y) {
  var pts = route.pts, cum = route.cum, bd = Infinity, bs = 0;
  for (var i = 0; i + 1 < pts.length; i++) {
    var ax = pts[i].x, ay = pts[i].y;
    var bx = pts[i + 1].x - ax, by = pts[i + 1].y - ay;
    var L2 = bx * bx + by * by;
    var f = L2 < 1e-12 ? 0 : ((x - ax) * bx + (y - ay) * by) / L2;
    if (f < 0) f = 0; else if (f > 1) f = 1;
    var dx = x - (ax + bx * f), dy = y - (ay + by * f);
    var d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; bs = cum[i] + f * Math.sqrt(L2); }
  }
  return { s: bs, d2: bd };
}

// ---- checkpoint measurement (section 10) ------------------------------------
// Walks out cell by cell and stops at the first that is not GROUND. Water is not ground:
// contact with it is a loss, so a ball can no more stand on it than on the void. That is
// what lets a dry SLOT through a band of water be a neck.
function paperSpan(g, x, y, axis) {
  var dx = axis === 0 ? 1 : 0, dy = axis === 0 ? 0 : 1;
  if (!groundAt(g, x, y)) return { span: 0, lo: x, hi: x };
  var i0 = Math.floor(axis === 0 ? x - g.ox : y - g.oy);
  var hiC = i0, loC = i0, k;
  for (k = 1; k <= 60; k++) { if (groundAt(g, x + dx * k, y + dy * k)) hiC = i0 + k; else break; }
  for (k = 1; k <= 60; k++) { if (groundAt(g, x - dx * k, y - dy * k)) loC = i0 - k; else break; }
  var org = axis === 0 ? g.ox : g.oy;
  return { span: (hiC + 1) - loC, lo: org + loC, hi: org + hiC + 1 };
}

// The NARROWER axis is the cross-section; the ball travels the wider one. `need` is the
// furthest place on that cross-section a ball's CENTRE can be — the paper's edge minus
// BALL_R. The radius is DERIVED from the paper measured there, never typed.
function gateAt(g, x, y) {
  var sx = paperSpan(g, x, y, 0), sy = paperSpan(g, x, y, 1);
  var cross = sx.span <= sy.span ? sx : sy;
  var axis = sx.span <= sy.span ? 0 : 1;
  var p = axis === 0 ? x : y;
  var need = Math.max(p - cross.lo, cross.hi - p) - BALL_R;
  return {
    r: Math.max(GATE_R_MIN, need + GATE_MARGIN),
    cross: cross.span, along: (axis === 0 ? sy : sx).span, axis: axis,
    lo: cross.lo, hi: cross.hi,
  };
}

// ---- the compile pass -------------------------------------------------------
// Everything a level needs comes out of this one sweep.

function compile(course) {
  var P = course.pieces, i, j, k, p;

  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (i = 0; i < P.length; i++) {
    p = P[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x + p.w > maxX) maxX = p.x + p.w;
    if (p.y + p.h > maxY) maxY = p.y + p.h;
  }
  var ox = Math.floor(minX) - 2, oy = Math.floor(minY) - 2;
  var nx = Math.ceil(maxX) + 2 - ox, ny = Math.ceil(maxY) + 2 - oy;
  var g = makeGrid(nx, ny, ox, oy);
  var W1 = nx + 1;
  var seams = [];

  for (i = 0; i < P.length; i++) {
    p = P[i];
    var cx0 = Math.round(p.x - ox), cy0 = Math.round(p.y - oy);
    var cw = Math.round(p.w), ch = Math.round(p.h);

    if (p.kind === 'cut') {
      for (j = cy0; j < cy0 + ch; j++) {
        if (j < 0 || j >= ny) continue;                       // per AXIS (LAW 6.4)
        for (k = cx0; k < cx0 + cw; k++) {
          if (k < 0 || k >= nx) continue;
          g.solid[j * nx + k] = 0;
        }
      }
      continue;
    }

    if (p.kind === 'paint') {
      for (j = cy0; j < cy0 + ch; j++) {
        if (j < 0 || j >= ny) continue;
        for (k = cx0; k < cx0 + cw; k++) {
          if (k < 0 || k >= nx) continue;
          var pk = j * nx + k;
          if (!g.solid[pk]) continue;                          // solid cells ONLY
          g.surf[pk] = p.surf;
          g.fx[pk] = p.fx || 0; g.fy[pk] = p.fy || 0;
        }
      }
      continue;
    }

    // Corner heights over [x..x+w] x [y..y+h] INCLUSIVE, so neighbours share a line.
    for (j = cy0; j <= cy0 + ch; j++) {
      if (j < 0 || j > ny) continue;
      for (k = cx0; k <= cx0 + cw; k++) {
        if (k < 0 || k > nx) continue;
        var ck = j * W1 + k;
        var hz = pieceHeight(p, ox + k, oy + j);
        // The seam check is on the PERIMETER only. A bowl sunk into a pad disagrees with
        // it everywhere inside on purpose — that is the authoring model, lay the big
        // shapes down then carve. The perimeter is where it MEETS its neighbour.
        var onEdge = (k === cx0 || k === cx0 + cw || j === cy0 || j === cy0 + ch);
        if (onEdge && g.hp[ck] && !p.embed && Math.abs(g.h[ck] - hz) > SEAM_TOL)
          seams.push({ x: ox + k, y: oy + j, was: g.h[ck], now: hz, kind: p.kind, i: i });
        g.h[ck] = hz;
        g.hp[ck] = 1;
      }
    }
    for (j = cy0; j < cy0 + ch; j++) {
      if (j < 0 || j >= ny) continue;
      for (k = cx0; k < cx0 + cw; k++) {
        if (k < 0 || k >= nx) continue;
        var sk = j * nx + k;
        g.solid[sk] = 1;
        g.surf[sk] = p.surf;
        g.fx[sk] = p.fx || 0; g.fy[sk] = p.fy || 0;
      }
    }
  }

  var lowest = Infinity;
  for (k = 0; k < g.h.length; k++) if (g.hp[k] && g.h[k] < lowest) lowest = g.h[k];
  var voidZ = lowest - VOID_DEPTH;
  for (k = 0; k < g.h.length; k++) if (!g.hp[k]) g.h[k] = voidZ;

  // LAW 5.3 — dilate the height field TWO RINGS past the paper, so the gradient at an
  // edge is the real slope of the ground the ball is on. Without it gradAt on the last
  // solid cell of a lip samples void filler 40 units down, reports a slope of -18, and
  // the launch test converts that into 300 units/s straight down: the ball VANISHES at
  // the edge instead of flying off it.
  for (var pass = 0; pass < 2; pass++) {
    var idx = [], val = [];
    for (j = 0; j <= ny; j++) for (k = 0; k <= nx; k++) {
      var dk = j * W1 + k;
      if (g.hp[dk]) continue;
      var sum = 0, n = 0;
      if (k > 0  && g.hp[dk - 1])  { sum += g.h[dk - 1];  n++; }
      if (k < nx && g.hp[dk + 1])  { sum += g.h[dk + 1];  n++; }
      if (j > 0  && g.hp[dk - W1]) { sum += g.h[dk - W1]; n++; }
      if (j < ny && g.hp[dk + W1]) { sum += g.h[dk + W1]; n++; }
      if (n) { idx.push(dk); val.push(sum / n); }
    }
    for (i = 0; i < idx.length; i++) { g.h[idx[i]] = val[i]; g.hp[idx[i]] = 1; }
  }

  course.grid = g;
  course.seams = seams;
  course.lowestZ = lowest;
  course.deathZ = lowest - DEATH_DROP;

  // The trigger radius is derived from the paper measured at the flag, never typed.
  for (i = 0; i < course.flags.length; i++) {
    var f = course.flags[i];
    var ga = gateAt(g, f.x, f.y);
    f.r = ga.r; f.cross = ga.cross; f.along = ga.along;
  }
  course.cup.z = heightAt(g, course.cup.x, course.cup.y);

  var rs = [];
  for (i = 0; i < course.routes.length; i++) rs.push(makeRoute(course.routes[i]));
  course.routes = rs;

  return course;
}
