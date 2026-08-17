// AN ASCII MAP OF A COMPILED COURSE — `node tests/map.js [course] [--h]`
//
// Authoring six staircases of +wx/+wy runs by reading coordinates off a screen is how
// legs end up two tiles from where the author thought. This prints what the COMPILER
// produced: the mask, the surfaces, the routes, the flags, the tee and the cup — and with
// --h, the heights, so a seam is visible as a column that jumps.
//
// +x runs down-RIGHT on screen, +y runs down-LEFT. On this map +x is across and +y is
// down, so a level reads as a staircase from the top-left to the bottom-right.

'use strict';
var PL = require('./load.js').loadEngine();
var V = require('./validate.js').mk(PL);

var SURF_CH = ['.', ',', '"', 's', '~', '=', 'f', 'c'];   // fairway green rough sand water belt fragile cracked

function mapCourse(ci, showH) {
  var c = PL.getCourse(ci), g = c.grid;
  var rows = [];
  for (var j = 0; j < g.ny; j++) {
    var line = '';
    for (var i = 0; i < g.nx; i++) {
      var k = j * g.nx + i;
      line += g.solid[k] ? SURF_CH[g.surf[k]] : ' ';
    }
    rows.push(line.split(''));
  }
  function put(wx, wy, ch) {
    var i = Math.floor(wx - g.ox), j = Math.floor(wy - g.oy);
    if (i < 0 || i >= g.nx || j < 0 || j >= g.ny) return;
    rows[j][i] = ch;
  }
  // Routes first, then the things that must not be hidden by them.
  c.routes.forEach(function (r, ri) {
    for (var s = 0; s <= r.total; s += 0.35) {
      var p = PL.pointAt(r, s);
      put(p.x, p.y, ri === 0 ? '-' : (ri === 1 ? '+' : '*'));
    }
  });
  (c.hazards || []).forEach(function (h) { put(h.x, h.y, 'H'); });
  c.flags.forEach(function (f, fi) { put(f.x, f.y, String(fi + 1)); });
  put(c.start.x, c.start.y, 'T');
  put(c.cup.x, c.cup.y, 'O');

  console.log('\n  COURSE ' + (ci + 1) + '  ' + c.name +
              '   grid ' + g.nx + 'x' + g.ny + ' at (' + g.ox + ',' + g.oy + ')' +
              '   par ' + c.parTime + 's   ' + c.flags.length + ' flags');
  var head = '     ';
  for (var i2 = 0; i2 < g.nx; i2++) head += (((g.ox + i2) % 10 === 0) ? String(Math.abs((g.ox + i2) / 10) % 10) : ' ');
  console.log(head);
  rows.forEach(function (r, j) {
    console.log(String(g.oy + j).padStart(4) + ' ' + r.join(''));
  });
  console.log('     key:  . fairway  , green  " rough  s sand  ~ water  = belt  f fragile');
  console.log('           T tee  O cup  1..n flags  H hazard  - route0  + route1  * route2');

  if (showH) {
    console.log('\n  HEIGHTS (integer part, solid cells only):');
    for (var j3 = 0; j3 < g.ny; j3++) {
      var line = '';
      for (var i3 = 0; i3 < g.nx; i3++) {
        if (!g.solid[j3 * g.nx + i3]) { line += ' '; continue; }
        var h = PL.heightAt(g, g.ox + i3 + 0.5, g.oy + j3 + 0.5);
        line += String(Math.round(h) % 36).replace(/^(\d)$/, '$1');
        line = line.slice(0, i3 + 1);
        var v = Math.round(h);
        line = line.slice(0, i3) + '0123456789abcdefghijklmnopqrstuvwxyz'[((v % 36) + 36) % 36];
      }
      console.log(String(g.oy + j3).padStart(4) + ' ' + line);
    }
  }
}

function report(ci) {
  var c = PL.getCourse(ci);
  var d = V.declaredSlope(c), m = V.maxSlope(c, false), inn = V.maxSlope(c, true);
  var fs = V.flagIssues(c), hs = V.hazardIssues(c), sq = V.largestFlatSquare(c);
  var br = V.branches(c), tiers = V.tiers(c), rest = V.restRatio(c);
  console.log('\n  seams        ' + c.seams.length +
              (c.seams.length ? '  ' + JSON.stringify(c.seams.slice(0, 4)) : ''));
  console.log('  slope        declared ' + d.slope.toFixed(3) + '   grid ' + m.slope.toFixed(3) +
              '   interior ' + inn.slope.toFixed(3) + '   (SLOPE_CRIT ' + PL.SLOPE_CRIT.toFixed(2) + ')');
  console.log('  reach        ' + V.reachable(c, c.start, c.cup));
  console.log('  routes       ' + c.routes.map(function (r) { return r.total.toFixed(1); }).join(' / ') +
              '   off-paper ' + JSON.stringify(V.routeOffPaper(c)) +
              '   off-axis ' + V.offAxisLegs(c).length);
  console.log('  flat square  ' + sq.size + ' at ' + JSON.stringify(sq.at) +
              '   rest ' + (rest.ratio * 100).toFixed(1) + '%');
  console.log('  branches     ' + JSON.stringify(br.map(function (b) {
    return { a: b.a, b: b.b, lenA: +b.lenA.toFixed(0), lenB: +b.lenB.toFixed(0), diff: b.diff };
  })));
  console.log('  tiers        ' + JSON.stringify(tiers.map(function (t) {
    return { r: t.route, at: +t.at.toFixed(0), span: +t.span.toFixed(1), drop: +t.drop.toFixed(1) };
  })));
  console.log('  leg kinds    ' + V.legKinds(c).join(' '));
  console.log('  wide flat    ' + JSON.stringify(V.wideFlatPieces(c)));
  if (fs.length) console.log('  FLAG ISSUES  ' + JSON.stringify(fs, null, 1));
  if (hs.length) console.log('  HAZ ISSUES   ' + JSON.stringify(hs, null, 1));
  if (!fs.length && !hs.length) console.log('  flags/hazards clean');
}

function oracle(ci) {
  var O = require('./oracle.js').makeOracle(PL);
  var c = PL.getCourse(ci);
  for (var r = 0; r < c.routes.length; r++) {
    var res = O.driveRoute(c, r);
    var b = res.run.ball;
    var net = Math.max(0, res.clock - res.credit);
    var shots = Math.round((net - c.parTime) / Math.max(3, c.parTime / 4));
    console.log('  route ' + r + '  ' + (res.ok ? 'CLEARED' : 'STALLED at ' + (res.progress * 100).toFixed(1) + '%') +
      '  falls ' + res.falls + '  clock ' + res.clock.toFixed(1) + '  credit ' + res.credit +
      '  net ' + net.toFixed(1) + '  vs par ' + c.parTime + ' -> ' + (shots > 0 ? '+' : '') + shots +
      '  flags ' + JSON.stringify(res.flags) +
      (res.ok ? '' : '  at (' + b.x.toFixed(1) + ',' + b.y.toFixed(1) + ',' + b.z.toFixed(1) + ') state ' + b.state));
  }
}

var which = process.argv[2];
var showH = process.argv.indexOf('--h') !== -1;
var list = which === undefined || which === '--h'
  ? Array.from({ length: PL.courseCount() }, function (_, i) { return i; })
  : [Number(which)];
list.forEach(function (i) {
  mapCourse(i, showH);
  report(i);
  oracle(i);
});
