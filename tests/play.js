// A LIVE PLAY SMOKE RUN over a real file:// URL — `node tests/play.js`
//
// Verify the artifact the way a judge will: opened from file://, not over http://.
// This drives real keys through real UI and reads back what the game did, so "it opens
// and does not crash" and "save/quit/reload restores the round" are OBSERVED rather than
// argued. Console and page errors are failures, not noise.

'use strict';
var path = require('path');
var shots = require('./shots.js');

var URL = 'file://' + path.join(__dirname, '..', 'game.html').replace(/\\/g, '/');

async function open(puppeteer, exe) {
  var browser = await puppeteer.launch({
    executablePath: exe, headless: 'new',
    args: ['--allow-file-access-from-files', '--hide-scrollbars', '--force-device-scale-factor=1'],
  });
  var page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  var errors = [];
  page.on('pageerror', function (e) { errors.push('pageerror: ' + e.message); });
  page.on('console', function (m) { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return { browser: browser, page: page, errors: errors };
}

async function hold(page, key, ms) {
  await page.keyboard.down(key);
  await new Promise(function (r) { setTimeout(r, ms); });
  await page.keyboard.up(key);
}
async function tap(page, key) {
  await page.keyboard.press(key);
  await new Promise(function (r) { setTimeout(r, 140); });
}

// Drive the cursor to a NAMED item rather than counting keystrokes, so this harness
// cannot silently pass on a menu whose cursor does not move — which is exactly the bug
// its first run found.
async function choose(page, items, want) {
  for (var i = 0; i < 8; i++) {
    var idx = await page.evaluate('APP.menuIdx');
    if (items[idx] === want) { await tap(page, 'Enter'); return; }
    await tap(page, 'ArrowDown');
    var moved = await page.evaluate('APP.menuIdx');
    if (moved === idx) throw new Error('the ' + want + ' cursor did not move on ArrowDown');
  }
  throw new Error('never reached menu item ' + want);
}
var MENU = ['CONTINUE', 'NEW ROUND', 'COURSE SELECT', 'SCORECARD', 'ERASE SAVE'];
var PAUSE = ['RESUME', 'RESTART COURSE', 'QUIT TO MENU'];

async function main() {
  var exe = shots.findBrowser();
  if (!exe) throw new Error('no installed browser found');
  var puppeteer = require('puppeteer-core');
  var s = await open(puppeteer, exe);
  var out = {};
  try {
    await s.page.goto(URL, { waitUntil: 'load' });
    await s.page.waitForFunction('typeof APP !== "undefined" && APP.state === "MENU"', { timeout: 15000 });
    console.log('  booted from file:// — menu is up');

    // NEW ROUND through real UI.
    await choose(s.page, MENU, 'NEW ROUND');
    await s.page.waitForFunction('APP.state === "PLAY"', { timeout: 5000 });
    console.log('  NEW ROUND -> PLAY');

    var before = await s.page.evaluate('[APP.run.ball.x, APP.run.ball.y]');
    await hold(s.page, 'KeyD', 1200);
    await new Promise(function (r) { setTimeout(r, 400); });
    var after = await s.page.evaluate(
      '[APP.run.ball.x, APP.run.ball.y, Math.hypot(APP.run.ball.vx, APP.run.ball.vy), APP.run.clock, RSTAT.fills, RSTAT.strokes]');
    var moved = Math.hypot(after[0] - before[0], after[1] - before[1]);
    console.log('  held D for 1.2 s: moved ' + moved.toFixed(2) + ' tiles, speed ' +
                after[2].toFixed(2) + ', clock ' + after[3].toFixed(2));
    console.log('  frame cost: ' + after[4] + ' fills, ' + after[5] + ' strokes');
    out.moved = moved; out.clock = after[3];
    out.fills = after[4]; out.strokes = after[5];
    if (moved < 1) throw new Error('the ball did not move under a held key');
    if (after[3] < 1) throw new Error('the clock did not count up');

    // Pause -> quit, through real UI.
    await tap(s.page, 'Escape');
    await s.page.waitForFunction('APP.state === "PAUSE"', { timeout: 3000 });
    await choose(s.page, PAUSE, 'QUIT TO MENU');
    await s.page.waitForFunction('APP.state === "MENU"', { timeout: 3000 });
    console.log('  ESC -> PAUSE -> QUIT TO MENU');

    // Hole out course 1 by teleporting to the cup with real physics still running, so a
    // course is genuinely BANKED, then reload the page and CONTINUE.
    await choose(s.page, MENU, 'NEW ROUND');
    await s.page.waitForFunction('APP.state === "PLAY"', { timeout: 5000 });
    await s.page.evaluate(function () {
      var c = APP.run.course;
      APP.run.ball.x = c.cup.x; APP.run.ball.y = c.cup.y;
      APP.run.ball.z = heightAt(APP.run.grid, c.cup.x, c.cup.y);
      APP.run.ball.vx = 0; APP.run.ball.vy = 0; APP.run.holdT = 0;
    });
    await s.page.waitForFunction('APP.state === "CARD" || APP.state === "ROUND"', { timeout: 15000 });
    var card = await s.page.evaluate('JSON.stringify(APP.lastCard)');
    console.log('  holed out, card banked: ' + card);
    out.card = JSON.parse(card);
    await tap(s.page, 'Escape');
    await s.page.waitForFunction('APP.state === "MENU"', { timeout: 3000 });

    var stored = await s.page.evaluate('window.localStorage.getItem(SAVE_KEY)');
    console.log('  localStorage on file://: ' + stored);
    out.stored = stored;
    if (!stored) throw new Error('nothing was written to localStorage');

    // A FULL page reload — the same thing as closing the tab and reopening game.html.
    await s.page.reload({ waitUntil: 'load' });
    await s.page.waitForFunction('typeof APP !== "undefined" && APP.state === "MENU"', { timeout: 15000 });
    var restored = await s.page.evaluate('JSON.stringify({p:APP.save.pointer,u:APP.save.unlocked,c:APP.save.cards, m:APP.menuIdx})');
    console.log('  after reload, CONTINUE restores: ' + restored);
    out.restored = JSON.parse(restored);
    if (!out.restored.c[0]) throw new Error('the banked card did not survive the reload');
    if (out.restored.m !== 0) throw new Error('the cursor did not start on CONTINUE');

    await tap(s.page, 'Enter');
    await s.page.waitForFunction('APP.state === "PLAY"', { timeout: 5000 });
    console.log('  CONTINUE -> PLAY on course ' + (await s.page.evaluate('APP.course') + 1));

    // The win state: unlock everything, then the round scorecard.
    await tap(s.page, 'Escape');
    await s.page.waitForFunction('APP.state === "PAUSE"', { timeout: 3000 });
    await choose(s.page, PAUSE, 'QUIT TO MENU');
    await s.page.waitForFunction('APP.state === "MENU"', { timeout: 3000 });
    await s.page.keyboard.down('Control'); await s.page.keyboard.down('Shift');
    await s.page.keyboard.press('KeyU');
    await s.page.keyboard.up('Shift'); await s.page.keyboard.up('Control');
    await new Promise(function (r) { setTimeout(r, 200); });
    var unlocked = await s.page.evaluate('APP.save.unlocked');
    console.log('  CTRL+SHIFT+U unlocked ' + unlocked + ' course(s)');
    out.unlocked = unlocked;
  } finally {
    await s.browser.close();
  }
  if (s.errors.length) {
    console.log('\nCONSOLE / PAGE ERRORS:');
    s.errors.forEach(function (e) { console.log('  ' + e); });
    process.exit(1);
  }
  console.log('\n  zero console errors, zero page errors.');
  return out;
}

if (require.main === module) {
  main().then(function () { process.exit(0); })
        .catch(function (e) { console.error('\nFAILED: ' + String(e.stack || e)); process.exit(2); });
}
module.exports = { main: main };
