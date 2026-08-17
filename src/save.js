// SAVE — localStorage, versioned and defensive, namespaced.
//
// localStorage works on file:// and survives a full browser restart. The slot's name is
// frozen; the PAYLOAD carries its own version, and a payload of the wrong version is
// thrown away for a fresh round rather than migrated. Reachable from real UI, never from
// a debug key.

var SAVE_KEY = 'paperlinks_save_v1';
var SAVE_VERSION = 1;

function blankSave(n) {
  var cards = [];
  for (var i = 0; i < n; i++) cards.push(null);
  return { v: SAVE_VERSION, unlocked: 1, pointer: 0, cards: cards };
}

function loadSave(n) {
  var raw = null;
  try { raw = window.localStorage.getItem(SAVE_KEY); } catch (e) { return blankSave(n); }
  if (!raw) return blankSave(n);
  var p;
  try { p = JSON.parse(raw); } catch (e) { return blankSave(n); }
  if (!p || p.v !== SAVE_VERSION || !Array.isArray(p.cards)) return blankSave(n);
  var s = blankSave(n);
  s.unlocked = Math.max(1, Math.min(n, p.unlocked | 0));
  s.pointer = Math.max(0, Math.min(n - 1, p.pointer | 0));
  for (var i = 0; i < n; i++) {
    var c = p.cards[i];
    // A card unlocks nothing on its own: `unlocked` is the only gate, and it is clamped.
    if (c && typeof c.net === 'number' && typeof c.shots === 'number' && isFinite(c.net))
      s.cards[i] = { net: c.net, shots: c.shots | 0 };
  }
  return s;
}

function writeSave(s) {
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* full or blocked */ }
}

function eraseSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* nothing to erase */ }
}

function hasProgress(s) {
  if (s.unlocked > 1) return true;
  for (var i = 0; i < s.cards.length; i++) if (s.cards[i]) return true;
  return false;
}
