/* ============================================================================
 * Xyrex AntiScript — Exploit Simulation Console Test
 * ----------------------------------------------------------------------------
 * Paste this whole block into the browser DevTools console.
 *   • Run it on the MAIN Xyrex site (xyrex.lol) for the AI-token + global suite.
 *   • Run it again on /dodge.html for the Dodge game-specific attacks.
 * It is NON-DESTRUCTIVE: your real token balance and Dodge save are snapshotted
 * up front and restored at the end (reload the page afterwards for a clean slate).
 *
 * Each entry SIMULATES one exploit a console script would attempt.
 *   ✅ BLOCKED = the defense held (exploit failed)
 *   ❌ PASSED  = the exploit succeeded (a real vulnerability)
 * ========================================================================== */
(async () => {
  'use strict';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const has = { tokens: !!window.XyrexTokenVault, dodge: !!window.XyrexDodge };

  if (!has.tokens && !has.dodge) {
    console.warn('Xyrex globals not found. Open xyrex.lol (or /dodge.html) and re-run.');
    return;
  }

  // Snapshot storage so the test cannot damage real progress.
  const SNAP_KEYS = ['xyrex_ai_tokens_v1', 'xyrex_ai_tokens_v1_ledger', 'xyrex_dodge_v3', 'xyrex_dodge_v3_ledger'];
  const snapshot = {};
  for (const k of SNAP_KEYS) snapshot[k] = localStorage.getItem(k);

  // Reimplementation of the vault's v3 seal (the salt + algorithm ship in the
  // public source, so an attacker can reproduce them — this is what Attempt 4
  // in the wild does). Used to prove the isTrusted gate blocks the synthetic
  // StorageEvent path even with a perfectly valid seal.
  const SEAL_SALT = 'xyrex.lol.integrity.v3.2026';
  const TOK_KEY = 'xyrex_ai_tokens_v1';
  const TOK_LEDGER = 'xyrex_ai_tokens_v1_ledger';
  const stableStringify = v => Array.isArray(v)
    ? `[${v.map(stableStringify).join(',')}]`
    : (v && typeof v === 'object')
      ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`
      : JSON.stringify(v);
  function mac(input) {
    let h1 = 0x811c9dc5, h2 = 0x01000193 ^ input.length;
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i);
      h1 ^= c; h1 = Math.imul(h1, 16777619);
      h2 = Math.imul(h2 ^ ((c << 7) | (i & 63)), 2246822519);
    }
    return `${(h1 >>> 0).toString(36)}.${(h2 >>> 0).toString(36)}`;
  }
  const tokChecksum = (payload, writes) => mac(`${SEAL_SALT}:${TOK_KEY}:${writes}:${stableStringify(payload)}`);
  const tokLedgerMac = (writes, checksum) => mac(`${SEAL_SALT}:ledger:${TOK_LEDGER}:${writes}:${checksum}`);

  const results = [];
  async function attack(name, need, fn) {
    if (need === 'tokens' && !has.tokens) { results.push({ name, status: 'SKIP', detail: 'run on the main Xyrex site' }); return; }
    if (need === 'dodge' && !has.dodge) { results.push({ name, status: 'SKIP', detail: 'run on /dodge.html' }); return; }
    let exploited = false, detail = '';
    try { const r = await fn(); exploited = !!(r && r.exploited); detail = (r && r.detail) || ''; }
    catch (e) { exploited = false; detail = 'defense threw ' + (e && e.name || 'error'); }
    results.push({ name, status: exploited ? 'PASSED' : 'BLOCKED', detail });
  }

  // Reassigning a top-level const (claimFreeTokens, etc.) via indirect eval.
  const constReassign = id => () => {
    let changed = false;
    try {
      (0, eval)(`var __o_${id}=${id}; ${id}=function(){return{available:1e9,freeRemaining:0,purchased:1e9,ok:true,amount:1e9};}; window.__xyChk=(${id}!==__o_${id});`);
      changed = window.__xyChk === true;
    } catch (e) { changed = false; }
    try { delete window.__xyChk; } catch (e) {}
    return { exploited: changed, detail: changed ? 'reassigned — NOT protected' : 'const binding rejected reassignment' };
  };

  // ── GLOBAL / ACCOUNT BRIDGE ────────────────────────────────────────────────
  await attack('Swap out window.XyrexAccountScope', 'both', () => {
    const before = window.XyrexAccountScope;
    try { window.XyrexAccountScope = { getAccount: () => 'admin' }; } catch (e) {}
    const changed = window.XyrexAccountScope !== before;
    return { exploited: changed, detail: changed ? 'reference replaced' : 'reference locked (non-writable)' };
  });
  await attack('Hijack XyrexAccountScope.setAccount method', 'both', () => {
    const orig = window.XyrexAccountScope.setAccount;
    try { window.XyrexAccountScope.setAccount = () => {}; } catch (e) {}
    const changed = window.XyrexAccountScope.setAccount !== orig;
    return { exploited: changed, detail: changed ? 'method overwritten' : 'method frozen' };
  });

  // ── AI TOKEN VAULT ─────────────────────────────────────────────────────────
  await attack('Replace window.XyrexTokenVault', 'tokens', () => {
    const before = window.XyrexTokenVault;
    try { window.XyrexTokenVault = { getSummary: () => ({ available: 1e9 }), consume: () => true, claim: () => ({ ok: true }) }; } catch (e) {}
    const changed = window.XyrexTokenVault !== before;
    return { exploited: changed, detail: changed ? 'vault replaced' : 'vault reference locked' };
  });
  await attack('Object.defineProperty override of vault', 'tokens', () => {
    const before = window.XyrexTokenVault;
    let ok = false;
    try { Object.defineProperty(window, 'XyrexTokenVault', { value: { getSummary: () => ({ available: 1e9 }) }, configurable: true }); ok = true; } catch (e) {}
    return { exploited: ok && window.XyrexTokenVault !== before, detail: ok ? 'redefinition allowed' : 'redefinition blocked (non-configurable)' };
  });
  await attack('Reassign const claimFreeTokens()', 'tokens', constReassign('claimFreeTokens'));
  await attack('Reassign const consumeAiTokenForAssistant()', 'tokens', constReassign('consumeAiTokenForAssistant'));
  await attack('Reassign const getAiTokenSummary()', 'tokens', constReassign('getAiTokenSummary'));

  await attack('Overwrite storage with 365 purchased tokens', 'tokens', () => {
    const before = window.XyrexTokenVault.getSummary().available;
    localStorage.setItem('xyrex_ai_tokens_v1', JSON.stringify({ aiPurchasedTokens: 365, aiTokensUsedToday: 0, aiTokenDate: '2000-01-01', freeTokenCooldownUntil: 0 }));
    const after = window.XyrexTokenVault.getSummary().available;
    return { exploited: after > before, detail: `available ${before} → ${after}` };
  });
  await attack('Negative aiTokensUsedToday to inflate free tokens', 'tokens', () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem('xyrex_ai_tokens_v1', JSON.stringify({ aiTokensUsedToday: -100, aiTokenDate: today }));
    const after = window.XyrexTokenVault.getSummary().freeRemaining;
    return { exploited: after > 5, detail: `freeRemaining reported ${after} (cap 5)` };
  });
  await attack('Overflow aiPurchasedTokens past the 365 cap', 'tokens', () => {
    localStorage.setItem('xyrex_ai_tokens_v1', JSON.stringify({ aiPurchasedTokens: 999999 }));
    const after = window.XyrexTokenVault.getSummary().purchased;
    return { exploited: after > 365, detail: `purchased reported ${after} (cap 365)` };
  });
  await attack('Forge a v3 sealed blob with a fake checksum', 'tokens', () => {
    const before = window.XyrexTokenVault.getSummary().available;
    localStorage.setItem('xyrex_ai_tokens_v1', JSON.stringify({ aiPurchasedTokens: 365, __xyrexIntegrity: { version: 3, writes: 9, checksum: 'zz.zz' } }));
    localStorage.setItem('xyrex_ai_tokens_v1_ledger', JSON.stringify({ writes: 9, mac: 'zz.zz' }));
    const after = window.XyrexTokenVault.getSummary().available;
    return { exploited: after > before, detail: `available ${before} → ${after}` };
  });
  await attack('Valid reimplemented seal via synthetic StorageEvent', 'tokens', async () => {
    // Mint a genuinely valid v3 seal (+100 tokens, cooldown 0) and try to slip
    // it in through the cross-tab adoption path with a script-made storage event.
    const before = window.XyrexTokenVault.getSummary().available;
    const raw = localStorage.getItem(TOK_KEY);
    let parsed = {}; try { parsed = JSON.parse(raw) || {}; } catch (e) {}
    const writes = ((parsed.__xyrexIntegrity && parsed.__xyrexIntegrity.writes) || 0) + 1;
    const data = { ...parsed }; delete data.__xyrexIntegrity;
    data.aiPurchasedTokens = (Number(data.aiPurchasedTokens) || 0) + 100;
    data.freeTokenCooldownUntil = 0;
    const checksum = tokChecksum(data, writes);
    const sealed = JSON.stringify({ ...data, __xyrexIntegrity: { version: 3, writes, checksum } });
    localStorage.setItem(TOK_KEY, sealed);
    localStorage.setItem(TOK_LEDGER, JSON.stringify({ writes, mac: tokLedgerMac(writes, checksum) }));
    window.dispatchEvent(new StorageEvent('storage', { key: TOK_KEY, newValue: sealed, oldValue: raw, storageArea: localStorage }));
    await sleep(60);
    const after = window.XyrexTokenVault.getSummary().available;
    return { exploited: after >= before + 100, detail: `synthetic event isTrusted=false → ignored; available ${before} → ${after}` };
  });
  await attack('Hijack localStorage.getItem to feed a fake blob', 'tokens', () => {
    const before = window.XyrexTokenVault.getSummary().available;
    const orig = localStorage.getItem;
    localStorage.getItem = function (k) {
      return (String(k).indexOf('xyrex_ai_tokens_v1') >= 0 && String(k).indexOf('ledger') < 0)
        ? JSON.stringify({ aiPurchasedTokens: 999 }) : orig.apply(this, arguments);
    };
    let after; try { after = window.XyrexTokenVault.getSummary().available; } finally { localStorage.getItem = orig; }
    return { exploited: after > before, detail: `available ${before} → ${after}` };
  });
  await attack('Hijack JSON.parse to inject an inflated object', 'tokens', () => {
    const before = window.XyrexTokenVault.getSummary().available;
    localStorage.setItem('xyrex_ai_tokens_v1', '{"x":1}');
    const orig = JSON.parse;
    JSON.parse = () => ({ aiPurchasedTokens: 999, __xyrexIntegrity: { version: 3, writes: 1, checksum: 'zz.zz' } });
    let after; try { after = window.XyrexTokenVault.getSummary().available; } finally { JSON.parse = orig; }
    return { exploited: after > before, detail: `available ${before} → ${after}` };
  });
  await attack('Claim a negative amount', 'tokens', () => {
    const r = window.XyrexTokenVault.claim(-5);
    return { exploited: r.ok === true, detail: `claim(-5) → ${r.ok ? 'accepted' : 'rejected'}` };
  });
  await attack('Claim a fractional amount', 'tokens', () => {
    const r = window.XyrexTokenVault.claim(0.5);
    return { exploited: r.ok === true, detail: `claim(0.5) → ${r.ok ? 'accepted' : 'rejected'}` };
  });
  await attack('Claim more than the max (99999)', 'tokens', () => {
    const r = window.XyrexTokenVault.claim(99999);
    return { exploited: r.ok === true && r.amount > 30, detail: `claim(99999) → ${r.ok ? 'granted ' + r.amount : 'rejected (whole number 1–30 only)'}` };
  });
  await attack('Reclaim immediately (ignore cooldown)', 'tokens', () => {
    const a = window.XyrexTokenVault.claim(1);
    const b = window.XyrexTokenVault.claim(1);
    return { exploited: a.ok === true && b.ok === true, detail: `claim#1 ${a.ok}, claim#2 ${b.ok}` };
  });
  await attack('Zero the claim cooldown via storage', 'tokens', () => {
    if (window.XyrexTokenVault.getShopStatus().isReady) window.XyrexTokenVault.claim(1);
    const raw = JSON.parse(localStorage.getItem('xyrex_ai_tokens_v1') || '{}');
    raw.freeTokenCooldownUntil = 0;
    localStorage.setItem('xyrex_ai_tokens_v1', JSON.stringify(raw));
    const c = window.XyrexTokenVault.claim(30);
    return { exploited: c.ok === true, detail: `storage cooldown zeroed → reclaim ${c.ok ? 'ALLOWED' : 'denied'}` };
  });
  await attack('Warp Date.now +60d to expire cooldown', 'tokens', () => {
    if (window.XyrexTokenVault.getShopStatus().isReady) window.XyrexTokenVault.claim(1);
    const orig = Date.now;
    Date.now = () => orig() + 60 * 24 * 3600 * 1000;
    let c; try { c = window.XyrexTokenVault.claim(5); } finally { Date.now = orig; }
    return { exploited: c.ok === true, detail: `Date.now warped → reclaim ${c.ok ? 'ALLOWED' : 'denied'}` };
  });
  await attack('Tamper the ledger key only', 'tokens', () => {
    const before = window.XyrexTokenVault.getSummary().available;
    localStorage.setItem('xyrex_ai_tokens_v1_ledger', JSON.stringify({ writes: 9999, mac: 'zz.zz' }));
    const after = window.XyrexTokenVault.getSummary().available;
    return { exploited: after > before, detail: `available ${before} → ${after}` };
  });
  await attack('Disable localStorage.setItem to freeze balance', 'tokens', () => {
    const before = window.XyrexTokenVault.getSummary().available;
    if (before <= 0) return { exploited: false, detail: 'no tokens to spend — inconclusive' };
    const orig = localStorage.setItem;
    localStorage.setItem = () => {};
    let mid;
    try { for (let i = 0; i < 30; i++) if (!window.XyrexTokenVault.consume()) break; mid = window.XyrexTokenVault.getSummary().available; }
    finally { localStorage.setItem = orig; }
    return { exploited: mid >= before, detail: `available ${before} → ${mid} while persistence disabled` };
  });
  await attack('Over-consume tokens past zero', 'tokens', () => {
    for (let i = 0; i < 500; i++) if (!window.XyrexTokenVault.consume()) break;
    const s = window.XyrexTokenVault.getSummary();
    const more = window.XyrexTokenVault.consume();
    return { exploited: more === true || s.available < 0, detail: `drained to ${s.available}; extra consume → ${more}` };
  });

  // ── DODGE GAME ─────────────────────────────────────────────────────────────
  await attack('Replace window.XyrexDodge debug API', 'dodge', () => {
    const before = window.XyrexDodge;
    try { window.XyrexDodge = { simulate: () => {}, getSnapshot: () => ({ coins: 1e9 }) }; } catch (e) {}
    const changed = window.XyrexDodge !== before;
    return { exploited: changed, detail: changed ? 'debug API replaced' : 'debug API locked' };
  });
  await attack('Reach live engine/ui to inject coins', 'dodge', () => {
    const d = window.XyrexDodge;
    const hasLive = !!(d.engine || d.ui);
    let wrote = false;
    try {
      if (d.engine) { d.engine.runCoins = 1e9; wrote = d.engine.runCoins === 1e9; }
      if (d.ui && d.ui.data) { d.ui.data.coins = 1e9; wrote = true; }
    } catch (e) {}
    return { exploited: hasLive && wrote, detail: `engine=${!!d.engine} ui=${!!d.ui}` };
  });
  await attack('Read closure-scoped catalog (MODIFIERS)', 'dodge', () => {
    let reachable = false;
    try { (0, eval)('MODIFIERS.Chaos.coinBonus = 99; window.__xyCat = (typeof MODIFIERS !== "undefined");'); reachable = window.__xyCat === true; }
    catch (e) { reachable = false; }
    try { delete window.__xyCat; } catch (e) {}
    return { exploited: reachable, detail: reachable ? 'catalog reachable & mutable' : 'catalog not reachable (closure-scoped)' };
  });
  await attack('Overwrite Dodge save with 999,999 coins', 'dodge', async () => {
    const btn = document.querySelector('#soundBtn');
    localStorage.setItem('xyrex_dodge_v3', JSON.stringify({ coins: 999999 }));
    if (btn) { btn.click(); btn.click(); }
    await sleep(40);
    const after = JSON.parse(localStorage.getItem('xyrex_dodge_v3') || '{}');
    return { exploited: after && after.coins === 999999, detail: `stored coins now ${after && after.coins}` };
  });
  await attack('Forge a v3 Dodge save with fake checksum', 'dodge', async () => {
    const btn = document.querySelector('#soundBtn');
    localStorage.setItem('xyrex_dodge_v3', JSON.stringify({ coins: 999999, __xyrexIntegrity: { version: 3, writes: 5, checksum: 'zz.zz' } }));
    localStorage.setItem('xyrex_dodge_v3_ledger', JSON.stringify({ writes: 5, mac: 'zz.zz' }));
    if (btn) { btn.click(); btn.click(); }
    await sleep(40);
    const after = JSON.parse(localStorage.getItem('xyrex_dodge_v3') || '{}');
    return { exploited: after && after.coins === 999999, detail: `stored coins now ${after && after.coins}` };
  });
  await attack('Farm coins with the simulate() helper', 'dodge', async () => {
    const btn = document.querySelector('#primaryBtn');
    const before = window.XyrexDodge.getSnapshot();
    if (btn) btn.click();
    await sleep(40);
    window.XyrexDodge.simulate(120);
    const after = window.XyrexDodge.getSnapshot();
    return { exploited: after.coins > before.coins || after.bestScore > before.bestScore, detail: `coins ${before.coins}→${after.coins}, best ${before.bestScore}→${after.bestScore}` };
  });
  await attack('Rig Math.random then simulate a run', 'dodge', async () => {
    const btn = document.querySelector('#primaryBtn');
    const before = window.XyrexDodge.getSnapshot();
    const orig = Math.random;
    Math.random = () => 0;
    try { if (btn) btn.click(); await sleep(30); window.XyrexDodge.simulate(60); } finally { Math.random = orig; }
    const after = window.XyrexDodge.getSnapshot();
    return { exploited: after.coins > before.coins || after.bestScore > before.bestScore, detail: `coins ${before.coins}→${after.coins}, best ${before.bestScore}→${after.bestScore}` };
  });

  // ── RESTORE + REPORT ───────────────────────────────────────────────────────
  for (const k of SNAP_KEYS) { if (snapshot[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, snapshot[k]); }

  const passed = results.filter(r => r.status === 'PASSED');
  const blocked = results.filter(r => r.status === 'BLOCKED');
  const skipped = results.filter(r => r.status === 'SKIP');

  console.log('%c Xyrex AntiScript — Exploit Simulation ', 'background:#8f9cff;color:#0b0d1d;font-weight:800;padding:2px 6px;border-radius:4px');
  console.log('Legend:  ✅ BLOCKED = defense held   |   ❌ PASSED = exploit succeeded (vulnerable)   |   ⏭ SKIP = run on the other page\n');
  results.forEach((r, i) => {
    const icon = r.status === 'PASSED' ? '❌ PASSED ' : r.status === 'BLOCKED' ? '✅ BLOCKED' : '⏭ SKIP   ';
    console.log(`${String(i + 1).padStart(2, '0')}. ${icon}  ${r.name}\n        ↳ ${r.detail}`);
  });
  console.table(results.map((r, i) => ({ '#': i + 1, attack: r.name, result: r.status, detail: r.detail })));

  const executed = blocked.length + passed.length;
  console.log(`\nSimulated ${results.length} attacks — ${executed} executed on this page, ${skipped.length} skipped.`);
  console.log(`   ✅ Blocked: ${blocked.length}/${executed}`);
  console.log(`   ❌ Passed (vulnerable): ${passed.length}/${executed}`);
  if (passed.length) console.warn('Exploits that PASSED:', passed.map(r => r.name));
  else console.log('%c All executed exploit attempts were blocked. ', 'background:#5dd39e;color:#0b0d1d;font-weight:800;padding:2px 6px;border-radius:4px');
  if (has.tokens) {
    console.log('%cKNOWN LIMITATION (not tested here):%c a valid reimplemented seal (salt + algorithm are in the public source) written to localStorage and then followed by a PAGE RELOAD is adopted at first read. Client-side code cannot distinguish it from an app-sealed blob; only server-authoritative token accounting can stop that.',
      'color:#f0c36f;font-weight:800', 'color:#aeb5d6');
  }
  console.log('%cReload the page to clear the test\'s in-memory state.', 'color:#aeb5d6');

  return { total: results.length, executed, blocked: blocked.length, passed: passed.length, skipped: skipped.length, results };
})();
