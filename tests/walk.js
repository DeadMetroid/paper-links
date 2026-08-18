// THE WALKTHROUGH — `node tests/walk.js`
//
// Drives the shipped artifact from `file://` through the whole of the single unbroken take
// in docs/VIDEO_GUIDE.md, capturing a frame at every beat and reporting what the game
// actually did. This exists because a box in docs/FLOOR.md is a claim about a game
// somebody WATCHED, and reading the code that ought to do a thing is not watching it.
//
// Frames land in tests/_out/walk-*.png.

'use strict';
var fs = require('fs');
var path = require('path');
var shots = require('./shots.js');

var OUT = path.join(__dirname, '_out');
var URL = 'file://' + path.join(__dirname, '..', 'game.html').replace(/\\/g, '/');

function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function main() {
  var exe = shots.findBrowser();
  if (!exe) throw new Error('no installed browser found');
  var puppeteer = require('puppeteer-core');
  var browser = await puppeteer.launch({
    executablePath: exe, headless: 'new',
    args: ['--allow-file-access-from-files', '--hide-scrollbars', '--force-device-scale-factor=1'],
  });
  var errors = [];
  var log = [];
  fs.mkdirSync(OUT, { recursive: true });

  try {
    var page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on('pageerror', function (e) { errors.push('pageerror: ' + e.message); });
    page.on('console', function (m) { if (m.type() === 'error') errors.push('console: ' + m.text()); });

    async function shot(name, note) {
      var buf = await page.screenshot({ type: 'png' });
      fs.writeFileSync(path.join(OUT, 'walk-' + name + '.png'), buf);
      log.push('  ' + name.padEnd(16) + note);
    }
    async function tap(k) { await page.keyboard.press(k); await wait(140); }
    async function hold(k, ms) {
      await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k);
    }
    async function choose(items, want) {
      for (var i = 0; i < 8; i++) {
        var idx = await page.evaluate('APP.menuIdx');
        if (items[idx] === want) { await tap('Enter'); return; }
        await tap('ArrowDown');
      }
      throw new Error('never reached ' + want);
    }
    var MENU = ['CONTINUE', 'NEW ROUND', 'COURSE SELECT', 'SCORECARD', 'ERASE SAVE'];
    var PAUSE = ['RESUME', 'RESTART COURSE', 'QUIT TO MENU'];

    // ---- 1. boot from file:// -------------------------------------------------
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction('typeof APP !== "undefined" && APP.state === "MENU"', { timeout: 15000 });
    await shot('1-menu', 'the title screen, CONTINUE greyed out with no save');

    await choose(MENU, 'NEW ROUND');
    await page.waitForFunction('APP.state === "PLAY"', { timeout: 5000 });
    await hold('KeyD', 900);
    await wait(300);
    await shot('2-play', 'course 1, thirty seconds in: the ball, the descent, the WASD hint');

    // ---- 2. a LOSS and its aftermath ------------------------------------------
    // Drive off the side of the first leg the way a player does: hold one key.
    await page.evaluate(function () {
      APP.run.ball.x = 16; APP.run.ball.y = 4; APP.run.ball.vx = 0; APP.run.ball.vy = 0;
      APP.run.ball.z = heightAt(APP.run.grid, 16, 4);
    });
    await hold('KeyA', 1400);
    await page.waitForFunction('APP.run && APP.run.banner', { timeout: 8000 });
    var banner = await page.evaluate('APP.run.banner.cause');
    await shot('3-lost', 'BALL LOST — ' + String(banner).toUpperCase() + ', the banner naming the cause');
    await page.waitForFunction('APP.run.holdT > 0', { timeout: 8000 });
    await wait(500);
    var holdInfo = await page.evaluate(
      'JSON.stringify({hold: APP.run.holdT, falls: APP.run.falls, clock: APP.run.clock})');
    await shot('4-hold', 'the two-second hold on the flag, world still running: ' + holdInfo);

    // ---- 3. a CHECKPOINT claimed ----------------------------------------------
    await page.waitForFunction('APP.run.holdT <= 0', { timeout: 8000 });
    await page.evaluate(function () {
      var f = APP.run.course.flags[0];
      APP.run.ball.x = f.x; APP.run.ball.y = f.y;
      APP.run.ball.z = heightAt(APP.run.grid, f.x, f.y);
      APP.run.ball.vx = 0; APP.run.ball.vy = 0;
    });
    await wait(220);
    var credit = await page.evaluate(
      'JSON.stringify({credit: APP.run.credit, shown: +APP.run.creditShown.toFixed(2), receipt: +APP.run.receipt.toFixed(2), raise: +APP.run.flagRaise[0].toFixed(2)})');
    await shot('5-flag', 'checkpoint claimed, flag raising, receipt beside the clock: ' + credit);

    // ---- 4. hole out, the course card, and the save ---------------------------
    await page.evaluate(function () {
      var c = APP.run.course;
      APP.run.ball.x = c.cup.x; APP.run.ball.y = c.cup.y;
      APP.run.ball.z = heightAt(APP.run.grid, c.cup.x, c.cup.y);
      APP.run.ball.vx = 0; APP.run.ball.vy = 0; APP.run.holdT = 0;
    });
    await wait(500);
    await shot('6-cup', 'the ball settling into the cup shaft, the near lip cutting it off');
    await page.waitForFunction('APP.state === "CARD"', { timeout: 15000 });
    await shot('7-card', 'the course card: ' + await page.evaluate('JSON.stringify(APP.lastCard)'));

    // ---- 5. save, quit, RELOAD, CONTINUE --------------------------------------
    await tap('Escape');
    await page.waitForFunction('APP.state === "MENU"', { timeout: 5000 });
    var stored = await page.evaluate('window.localStorage.getItem(SAVE_KEY)');
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction('typeof APP !== "undefined" && APP.state === "MENU"', { timeout: 15000 });
    await shot('8-reload', 'after a full page reload, CONTINUE is live: ' + stored);
    await tap('Enter');
    await page.waitForFunction('APP.state === "PLAY"', { timeout: 5000 });
    await shot('9-continue', 'CONTINUE resumed on course ' + (await page.evaluate('APP.course') + 1));

    // ---- 6. the win state -----------------------------------------------------
    await tap('Escape');
    await page.waitForFunction('APP.state === "PAUSE"', { timeout: 5000 });
    await shot('10-pause', 'ESC: RESUME / RESTART COURSE / QUIT TO MENU');
    await choose(PAUSE, 'QUIT TO MENU');
    await page.waitForFunction('APP.state === "MENU"', { timeout: 5000 });
    await page.keyboard.down('Control'); await page.keyboard.down('Shift');
    await page.keyboard.press('KeyU');
    await page.keyboard.up('Shift'); await page.keyboard.up('Control');
    await wait(250);
    await shot('11-unlock', 'CTRL+SHIFT+U: ' + (await page.evaluate('APP.save.unlocked')) + ' courses unlocked');

    // Course 6, the last course, and the two systems the video names.
    await choose(MENU, 'COURSE SELECT');
    await page.waitForFunction('APP.state === "SELECT"', { timeout: 5000 });
    await shot('12-select', 'course select, every course unlocked with its card');
    for (var q = 0; q < 5; q++) await tap('ArrowDown');
    await tap('Enter');
    await page.waitForFunction('APP.state === "PLAY"', { timeout: 5000 });
    await page.evaluate('APP.iris = null;');

    // The muncher's pull field against the water gate it sits above.
    await page.evaluate(function () {
      var r = APP.run.course.routes[0];
      var p = pointAt(r, r.total * 0.63);
      APP.run.ball.x = p.x; APP.run.ball.y = p.y;
      APP.run.ball.z = heightAt(APP.run.grid, p.x, p.y);
      APP.run.ball.vx = 0; APP.run.ball.vy = 6;
      APP.cam = newCam(APP.run.ball);
    });
    await wait(700);
    await shot('13-muncher', 'THE LONG SIXTH: the vacuum drawing the line off the dry slot');

    // The rival, on the leg below the water gate.
    await page.evaluate(function () {
      var riv = null;
      APP.run.bodies.forEach(function (b) { if (b.prim === 'RIVAL') riv = b; });
      APP.run.ball.x = riv.hx - 1.6; APP.run.ball.y = riv.hy - 2.2;
      APP.run.ball.z = heightAt(APP.run.grid, APP.run.ball.x, APP.run.ball.y);
      APP.run.ball.vx = 0; APP.run.ball.vy = 0;
      APP.cam = newCam(APP.run.ball);
    });
    await hold('KeyS', 900);
    var riv = await page.evaluate(
      'JSON.stringify((function(){var r=null;APP.run.bodies.forEach(function(b){if(b.prim==="RIVAL")r=b;});' +
      'return {engaged:r.engaged, down:+r.downT.toFixed(2), active:r.active, sp:+Math.hypot(r.vx,r.vy).toFixed(2)};})())');
    await shot('14-rival', 'THE LONG SIXTH: the rival marble, chasing — ' + riv);

    // The round scorecard: the win state.
    await tap('Escape');
    await page.waitForFunction('APP.state === "PAUSE"', { timeout: 5000 });
    await choose(PAUSE, 'QUIT TO MENU');
    await page.waitForFunction('APP.state === "MENU"', { timeout: 5000 });
    await choose(MENU, 'SCORECARD');
    await page.waitForFunction('APP.state === "VIEWCARD"', { timeout: 5000 });
    await shot('15-round', 'the round scorecard: ' + await page.evaluate('JSON.stringify(roundTotals(APP.save))'));

    // And the real win: hole out on the sixth.
    await tap('Escape');
    await choose(MENU, 'COURSE SELECT');
    for (var q2 = 0; q2 < 5; q2++) await tap('ArrowDown');
    await tap('Enter');
    await page.waitForFunction('APP.state === "PLAY"', { timeout: 5000 });
    await page.evaluate(function () {
      var c = APP.run.course;
      APP.run.ball.x = c.cup.x; APP.run.ball.y = c.cup.y;
      APP.run.ball.z = heightAt(APP.run.grid, c.cup.x, c.cup.y);
      APP.run.ball.vx = 0; APP.run.ball.vy = 0; APP.run.holdT = 0; APP.iris = null;
    });
    await page.waitForFunction('APP.state === "CARD"', { timeout: 15000 });
    await tap('Enter');
    await page.waitForFunction('APP.state === "ROUND"', { timeout: 8000 });
    await shot('16-win', 'ROUND COMPLETE — ' + await page.evaluate('JSON.stringify(roundTotals(APP.save))'));
  } finally {
    await browser.close();
  }

  console.log('\nWALKTHROUGH');
  log.forEach(function (l) { console.log(l); });
  if (errors.length) {
    console.log('\nCONSOLE / PAGE ERRORS:');
    errors.forEach(function (e) { console.log('  ' + e); });
    process.exit(1);
  }
  console.log('\n  ' + log.length + ' beats captured to tests/_out/walk-*.png, zero console errors.');
}

if (require.main === module) {
  main().then(function () { process.exit(0); })
        .catch(function (e) { console.error('\nFAILED: ' + String(e.stack || e)); process.exit(2); });
}
