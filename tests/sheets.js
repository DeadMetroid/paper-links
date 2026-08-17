// TWO SHEETS THAT EXIST BECAUSE A SUITE CANNOT SEE A CATEGORY ERROR — section 15,
// harness 3.
//
//   node tests/sheets.js gates     what every checkpoint in the game stands on
//   node tests/sheets.js props     every art in the catalog, alone, at the real tile
//
// Two arts being the same blue rectangle, and three being authored for a tile size that
// no longer existed, both shipped — and every one of them was obvious the first second
// anyone put them side by side. Run each sheet before believing the pass it belongs to
// is done.

'use strict';
var fs = require('fs');
var path = require('path');
var shots = require('./shots.js');

// ---- the gate sheet ---------------------------------------------------------------
function gateSheet() {
  var PL = require('./load.js').loadEngine();
  var V = require('./validate.js').mk(PL);
  var rows = [];
  console.log('  course              flag  at            neck  along   r     route d   to cup   terminal');
  console.log('  ' + '-'.repeat(94));
  for (var i = 0; i < PL.courseCount(); i++) {
    var c = PL.getCourse(i);
    c.flags.forEach(function (f, fi) {
      var ga = PL.gateAt(c.grid, f.x, f.y);
      var d = 1e9, toCup = 1e9;
      c.routes.forEach(function (r, ri) {
        if (f.skip && f.skip.indexOf(ri) !== -1) return;
        var pr = PL.project(r, f.x, f.y);
        d = Math.min(d, Math.sqrt(pr.d2));
        toCup = Math.min(toCup, r.total - pr.s);
      });
      var term = V.terminalAt(c, f.x, f.y);
      var bad = [];
      if (ga.cross > PL.NECK_MAX) bad.push('NECK');
      if (ga.along < 2) bad.push('STUB');
      if (d > 0.7 * f.r) bad.push('MISSABLE');
      if (toCup < PL.CUP_CLEAR) bad.push('TOO LATE');
      if (term > PL.VTERM_MAX) bad.push('SLOPED');
      console.log('  ' + (i + 1 + ' ' + c.name).padEnd(20) +
        String(fi).padEnd(6) +
        (f.x + ',' + f.y).padEnd(14) +
        String(ga.cross).padEnd(6) +
        String(ga.along).padEnd(8) +
        f.r.toFixed(2).padEnd(6) +
        d.toFixed(2).padEnd(10) +
        toCup.toFixed(1).padEnd(9) +
        term.toFixed(2).padEnd(6) +
        (bad.length ? '  <-- ' + bad.join(' ') : ''));
      rows.push({ course: i, flag: fi, bad: bad });
    });
  }
  var bad = rows.filter(function (r) { return r.bad.length; });
  console.log('\n  ' + rows.length + ' checkpoint(s), ' + bad.length + ' with problems.');
  console.log('  NECK_MAX ' + PL.NECK_MAX + '   CUP_CLEAR ' + PL.CUP_CLEAR +
              '   GATE_R_MIN ' + PL.GATE_R_MIN + '   VTERM_MAX ' + PL.VTERM_MAX);
  return bad.length;
}

// ---- the prop sheet ---------------------------------------------------------------
// Rendered in the real artifact, at the real TILE, on real ground — because the defect it
// exists to catch is a prop authored against a tile size that no longer exists.
async function propSheet() {
  var exe = shots.findBrowser();
  if (!exe) throw new Error('no installed browser found');
  var puppeteer = require('puppeteer-core');
  var browser = await puppeteer.launch({
    executablePath: exe, headless: 'new',
    args: ['--allow-file-access-from-files', '--hide-scrollbars', '--force-device-scale-factor=1'],
  });
  try {
    var page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    var errors = [];
    page.on('pageerror', function (e) { errors.push(e.message); });
    await page.goto('file://' + path.join(__dirname, '..', 'game.html').replace(/\\/g, '/'),
                    { waitUntil: 'load' });
    await page.waitForFunction('typeof APP !== "undefined" && APP.state === "MENU"', { timeout: 15000 });
    // The frame loop would repaint the menu over the sheet before the screenshot.
    await page.evaluate('window.stepApp = function () {}; window.drawApp = function () {};');

    var report = await page.evaluate(function () {
      var ctx = document.getElementById('c').getContext('2d');
      var names = Object.keys(CATALOG);
      var cols = 5, cw = W / cols, ch = H / Math.ceil(names.length / cols);

      ctx.fillStyle = 'rgb(58,52,74)';
      ctx.fillRect(0, 0, W, H);

      var run = { t: 2.4, grid: null, course: null, ball: { x: 0, y: 0 }, bodies: [], events: [] };
      var out = [];
      names.forEach(function (n, i) {
        var cx = (i % cols) * cw + cw / 2, cy = ((i / cols) | 0) * ch + ch * 0.66;
        // A patch of real ground under it, at the real tile, so scale is judged against
        // something the game actually draws.
        for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) {
          ctx.beginPath();
          ctx.moveTo(cx + (a - b) * TILE / 2, cy + (a + b) * TILE / 4);
          ctx.lineTo(cx + (a + 1 - b) * TILE / 2, cy + (a + 1 + b) * TILE / 4);
          ctx.lineTo(cx + (a + 1 - b - 1) * TILE / 2, cy + (a + 1 + b + 1) * TILE / 4);
          ctx.lineTo(cx + (a - b - 1) * TILE / 2, cy + (a + b + 1) * TILE / 4);
          ctx.closePath();
          ctx.fillStyle = SHADE_TABLE[0][(a + b + 2) % 2 ? 7 : 6];
          ctx.fill();
        }
        var def = CATALOG[n];
        var body = { name: n, def: def, prim: def.prim, art: def.art || n,
                     hx: 0, hy: 0, x: 0, y: 0, z: 0, r: def.r, h: def.h || 1.4,
                     vx: 1, vy: 0, phase: 0.7, face: 0.4, on: true, active: true };
        var before = RSTAT.fills + RSTAT.strokes;
        var art = ART[body.art];
        if (art) art(ctx, cx, cy, run.t, body);
        var paths = RSTAT.fills + RSTAT.strokes - before;
        out.push({ name: n, art: body.art, has: !!art, paths: paths,
                   r: def.r, h: def.h || null });
        ctx.font = '15px monospace'; ctx.fillStyle = '#f6f1e2'; ctx.textAlign = 'center';
        ctx.fillText(n + '  r=' + def.r + (def.h ? ' h=' + def.h : ''), cx, cy + 34);
        ctx.fillStyle = 'rgba(246,241,226,0.45)'; ctx.font = '13px monospace';
        ctx.fillText(def.prim + '  ' + paths + ' paths', cx, cy + 52);
      });
      // A one-tile ruler, so "half-size" is measurable rather than a feeling.
      ctx.strokeStyle = '#ffa63a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(30, H - 30); ctx.lineTo(30 + TILE, H - 30); ctx.stroke();
      ctx.fillStyle = '#ffa63a'; ctx.font = '15px monospace'; ctx.textAlign = 'left';
      ctx.fillText('1 tile = ' + TILE + 'px', 30, H - 40);
      return out;
    });

    fs.mkdirSync(path.join(__dirname, '_out'), { recursive: true });
    var buf = await page.screenshot({ type: 'png' });
    fs.writeFileSync(path.join(__dirname, '_out', 'props.png'), buf);

    var bad = 0;
    console.log('  art          prim       paths   r      h');
    console.log('  ' + '-'.repeat(50));
    report.forEach(function (r) {
      var flag = '';
      if (!r.has) { flag = '  <-- NO ART AT ALL'; bad++; }
      else if (r.paths < 2) { flag = '  <-- one path: not a volume'; bad++; }
      console.log('  ' + r.name.padEnd(13) + String(r.paths).padEnd(8) +
                  String(r.r).padEnd(7) + String(r.h === null ? '-' : r.h).padEnd(6) + flag);
    });
    if (errors.length) { console.log('\n  PAGE ERRORS: ' + errors.join('; ')); bad++; }
    console.log('\n  wrote tests/_out/props.png  (' + report.length + ' arts, ' + bad + ' problems)');
    return bad;
  } finally {
    await browser.close();
  }
}

async function main() {
  var which = process.argv[2] || 'gates';
  var bad = which === 'props' ? await propSheet() : gateSheet();
  process.exit(bad ? 1 : 0);
}
if (require.main === module) main().catch(function (e) { console.error(String(e.stack || e)); process.exit(2); });
module.exports = { gateSheet: gateSheet, propSheet: propSheet };
