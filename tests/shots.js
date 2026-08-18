// POSED FRAMES OFF THE REAL ARTIFACT — section 15, harness 2.
//
// Drives headless Chrome over a real file:// URL, poses the ball at fixed positions on
// every course, captures frames and HASHES them. This is how anything visual is verified:
// argument is not proof. The first build's draw-call cull was reasoned correct twice and
// was wrong twice, and the frame hashes are what caught it both times.
//
// `puppeteer-core` downloads no browser of its own — it is pointed at one already
// installed. That is deliberate: a driver package that fetches its own Chromium has
// failed on this machine repeatedly, in a way re-running the installer never fixes.
//
//   node tests/shots.js            capture, write PNGs and hashes to tests/_out/
//   node tests/shots.js --check    capture and compare against tests/frames.json

'use strict';
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var ROOT = path.join(__dirname, '..');
var OUT = path.join(__dirname, '_out');
var HASHES = path.join(__dirname, 'frames.json');

// Set PL_BROWSER to point these harnesses at any Chromium build. The list below is only
// the default install locations to try when it is not set: they are the same on every
// machine and identify nothing about this one, and they are the only absolute paths
// written down anywhere in this repository.
var BROWSERS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

function findBrowser() {
  if (process.env.PL_BROWSER && fs.existsSync(process.env.PL_BROWSER)) return process.env.PL_BROWSER;
  for (var i = 0; i < BROWSERS.length; i++) if (fs.existsSync(BROWSERS[i])) return BROWSERS[i];
  return null;
}

// The poses. Each is a course, a place on its route, and a name. Fixed, so a frame hash
// means the same thing tomorrow.
var POSES = [
  { c: 0, s: 0.02, name: 'c1-tee' },
  { c: 0, s: 0.22, name: 'c1-gate1' },
  { c: 0, s: 0.45, name: 'c1-branch' },
  { c: 0, s: 0.72, name: 'c1-rejoin' },
  { c: 0, s: 0.95, name: 'c1-tier' },
  { c: 1, s: 0.18, name: 'c2-split' },
  { c: 1, s: 0.34, name: 'c2-fragile' },
  { c: 1, s: 0.72, name: 'c2-camber' },
  { c: 2, s: 0.16, name: 'c3-bunkerA' },
  { c: 2, s: 0.30, name: 'c3-dryline' },
  { c: 2, s: 0.62, name: 'c3-ridge' },
  { c: 2, s: 0.80, name: 'c3-funnel' },
  { c: 3, s: 0.28, name: 'c4-catwalk' },
  { c: 3, s: 0.56, name: 'c4-shortcut', route: 1 },
  { c: 3, s: 0.90, name: 'c4-tube' },
  { c: 4, s: 0.20, name: 'c5-channel' },
  { c: 4, s: 0.62, name: 'c5-midwater' },
  { c: 4, s: 0.95, name: 'c5-runin' },
  { c: 5, s: 0.12, name: 'c6-ridge' },
  { c: 5, s: 0.55, name: 'c6-camber' },
  { c: 5, s: 0.72, name: 'c6-watergate' },
  { c: 5, s: 0.82, name: 'c6-rival' },
];

async function capture(opts) {
  opts = opts || {};
  var exe = findBrowser();
  if (!exe) throw new Error('no installed browser found at any of:\n  ' + BROWSERS.join('\n  '));
  var puppeteer = require('puppeteer-core');
  var browser = await puppeteer.launch({
    executablePath: exe,
    headless: 'new',
    args: ['--allow-file-access-from-files', '--hide-scrollbars', '--force-device-scale-factor=1'],
  });
  try {
    var page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    var errors = [];
    page.on('pageerror', function (e) { errors.push('pageerror: ' + e.message); });
    page.on('console', function (m) { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    await page.goto('file://' + path.join(ROOT, 'game.html').replace(/\\/g, '/'),
                    { waitUntil: 'load' });
    // LOADING compiles one course per frame; wait until the menu is up.
    await page.waitForFunction('typeof APP !== "undefined" && APP.state === "MENU"',
                               { timeout: 15000 });
    // FREEZE the simulation. The frame loop keeps running — it has to, it is the real
    // artifact — but with stepApp neutered it redraws the same posed state forever, so a
    // frame hash means the pose rather than however many milliseconds elapsed between
    // posing and screenshotting.
    await page.evaluate('window.stepApp = function () {};');

    var shots = [];
    for (var i = 0; i < POSES.length; i++) {
      var p = POSES[i];
      // Pose the run directly: no RNG anywhere, so the same pose is the same frame.
      await page.evaluate(function (pose) {
        startCourse(pose.c);
        APP.iris = null;
        var run = APP.run, r = run.course.routes[pose.route || 0];
        var pt = pointAt(r, r.total * pose.s);
        run.ball.x = pt.x; run.ball.y = pt.y;
        run.ball.z = heightAt(run.grid, pt.x, pt.y);
        run.ball.vx = 0; run.ball.vy = 0; run.ball.vz = 0;
        run.holdT = 0; run.t = 3.25; run.clock = 4.5;
        APP.cam = newCam(run.ball);
        drawApp(document.getElementById('c').getContext('2d'));
      }, p);
      var buf = await page.screenshot({ type: 'png' });
      var hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
      shots.push({ name: p.name, hash: hash });
      if (!opts.check) {
        fs.mkdirSync(OUT, { recursive: true });
        fs.writeFileSync(path.join(OUT, p.name + '.png'), buf);
      }
    }

    var stats = await page.evaluate(function () {
      return { fills: RSTAT.fills, strokes: RSTAT.strokes, cells: RSTAT.cells, props: RSTAT.props };
    });
    return { shots: shots, errors: errors, stats: stats };
  } finally {
    await browser.close();
  }
}

async function main() {
  var check = process.argv.indexOf('--check') !== -1;
  var res = await capture({ check: check });
  res.shots.forEach(function (s) { console.log('  ' + s.hash + '  ' + s.name); });
  console.log('  last frame: ' + JSON.stringify(res.stats));
  if (res.errors.length) {
    console.log('\nCONSOLE / PAGE ERRORS:');
    res.errors.forEach(function (e) { console.log('  ' + e); });
    process.exit(1);
  }
  if (check) {
    if (!fs.existsSync(HASHES)) { console.log('\nno tests/frames.json to check against'); process.exit(1); }
    var want = JSON.parse(fs.readFileSync(HASHES, 'utf8'));
    var bad = 0;
    res.shots.forEach(function (s) {
      if (want[s.name] && want[s.name] !== s.hash) {
        console.log('  CHANGED ' + s.name + ': ' + want[s.name] + ' -> ' + s.hash);
        bad++;
      }
    });
    console.log(bad ? '\n' + bad + ' frame(s) moved.' : '\nevery frame byte-identical.');
    process.exit(bad ? 1 : 0);
  }
  var map = {};
  res.shots.forEach(function (s) { map[s.name] = s.hash; });
  fs.writeFileSync(HASHES, JSON.stringify(map, null, 2) + '\n');
  console.log('\nwrote tests/frames.json and tests/_out/*.png');
}

if (require.main === module) {
  main().catch(function (e) { console.error(String(e.stack || e)); process.exit(2); });
}
module.exports = { capture: capture, findBrowser: findBrowser, POSES: POSES };
