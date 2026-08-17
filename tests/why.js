// WHY DID IT FALL — `node tests/why.js <course> [route]`
//
// The oracle reports the percentage it stalled at, which is the single most useful line
// while authoring. This is the second most useful one: WHERE it lost the ball, and to
// what. A course that fights the oracle is usually losing it in one place, over and over.

'use strict';
var PL = require('./load.js').loadEngine();
var O = require('./oracle.js').makeOracle(PL);

var ci = Number(process.argv[2] || 0);
var only = process.argv[3] === undefined ? null : Number(process.argv[3]);
var c = PL.getCourse(ci);

for (var ri = 0; ri < c.routes.length; ri++) {
  if (only !== null && ri !== only) continue;
  var run = PL.newRun(c, ri);
  var route = c.routes[ri];
  var best = 0, sinceBest = 0, ticks = 0, losses = [], maxSp = 0;
  var MAXT = 120 * 240, STALL = 120 * 25;

  while (ticks < MAXT) {
    var inp = (run.ball.state === PL.ST.FALL || run.ball.state === PL.ST.SINK || run.holdT > 0)
      ? [0, 0] : O.autopilotInput(run, ri);
    var bx = run.ball.x, by = run.ball.y, bz = run.ball.z;
    var sp = Math.hypot(run.ball.vx, run.ball.vy);
    PL.tick(run, inp[0], inp[1]);
    if (sp > maxSp) maxSp = sp;
    for (var e = 0; e < run.events.length; e++) {
      var ev = run.events[e];
      if (ev.kind === 'lost' || ev.kind === 'splash' || ev.kind === 'eaten') {
        losses.push({ cause: ev.a || ev.kind, x: +bx.toFixed(1), y: +by.toFixed(1),
                      z: +bz.toFixed(1), sp: +sp.toFixed(1),
                      pct: +(PL.project(route, bx, by).s / route.total * 100).toFixed(1) });
      }
    }
    run.events.length = 0;
    ticks++;
    if (run.ball.state === PL.ST.HOLED) break;
    var frac = PL.project(route, run.ball.x, run.ball.y).s / route.total;
    if (frac > best + 1e-4) { best = frac; sinceBest = 0; } else sinceBest++;
    if (sinceBest > STALL) break;
  }

  var done = run.ball.state === PL.ST.HOLED;
  console.log('\n  course ' + (ci + 1) + ' ' + c.name + '  route ' + ri + ': ' +
    (done ? 'CLEARED' : 'STALLED at ' + (best * 100).toFixed(1) + '%') +
    '  ' + losses.length + ' loss(es)  peak speed ' + maxSp.toFixed(1) +
    '  clock ' + run.clock.toFixed(1));
  if (!done) console.log('    ended at (' + run.ball.x.toFixed(1) + ',' + run.ball.y.toFixed(1) +
                         ',' + run.ball.z.toFixed(1) + ')');
  var seen = {};
  losses.forEach(function (l) {
    var key = l.cause + '@' + Math.round(l.pct / 2);
    seen[key] = (seen[key] || 0) + 1;
    if (seen[key] <= 2) console.log('    lost to ' + l.cause + ' at ' + l.pct + '% — (' +
      l.x + ',' + l.y + ',' + l.z + ') doing ' + l.sp);
  });
  Object.keys(seen).forEach(function (k) {
    if (seen[k] > 2) console.log('    ...and ' + (seen[k] - 2) + ' more like ' + k);
  });
}
