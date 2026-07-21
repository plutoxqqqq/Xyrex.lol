(function () {
  'use strict';

  const STORAGE = {
    fragments: 'xyrex_lore_fragments_v2',
    loreTriggered: 'xyrex_lore_triggered_v2',
    corruptionLevel: 'xyrex_corruption_level_v2'
  };

  const FRAGMENTS = ['NULL', 'TRUST', 'INDEX', 'MIRROR', 'NODE03', 'TRACE', 'ECHO', 'VERIFIED', 'CONTAINMENT', '1.337'];
  const CLICK_SEQUENCE = ['logo', 'search', 'subtitle', 'featured', 'logo'];
  const GLITCH_MESSAGES = ['CONTAINMENT BREACH', 'TRUST LAYER DESYNC', 'NULL ENTRY DETECTED', 'CARD INDEX MISMATCH', 'VERIFIED SIGNAL COMPROMISED', 'MIRROR ROUTE BROKEN', 'NODE03', 'NULL', '1.337'];
  const ARCHIVE_LOGS = [
    'The first scan returned 47 executors. The second returned 48.', 'The extra entry had no name.', 'Trust score did not measure trust. It measured containment drift.',
    'VERIFIED was not a badge. It was a warning.', 'NULL has no official site.', 'Protocol 1.337 was not made to activate. It was made to reveal the damage.',
    'Archive Node 03 failed to respond at 03:17.', 'The directory was rebuilt over the damaged layer.', 'The filters remember what the user hides.', 'The 48th card was never rendered.',
    'Search query "null" returned itself.', 'The mirror sequence restored one route.', 'The trust layer began copying scores between unrelated entries.',
    'The comparison table briefly listed an executor with no columns.', 'The assistant answered a question nobody asked.', 'The saved script panel stored one blank script with no author.',
    'Containment prevented the UI from showing the 48th result.', 'Every VERIFIED mark after 03:17 should be treated as suspect.',
    'The archive can only be read from inside the corrupted layer.', 'If Protocol 1.337 is active, the visible site is already a mirror.'
  ];

  const state = {
    fragments: new Set(parse(localStorage.getItem(STORAGE.fragments), [])), loreTriggered: localStorage.getItem(STORAGE.loreTriggered) === '1',
    corruptionLevel: Number(localStorage.getItem(STORAGE.corruptionLevel) || 0), typedBuffer: '', clickProgress: 0, subtitleClicks: 0, verifiedClicks: 0,
    toastCooldown: null, timers: new Set(), cardTimeouts: new Set(), layoutTimeouts: new Set(), textTimeouts: new Set(), overlayMessages: new Set()
  };

  const ui = { terminal: null, archive: null, overlay: null };
  const REDUCED_MOTION = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function parse(v, fallback) { try { return JSON.parse(v); } catch { return fallback; } }
  function save() { localStorage.setItem(STORAGE.fragments, JSON.stringify([...state.fragments])); localStorage.setItem(STORAGE.loreTriggered, state.loreTriggered ? '1' : '0'); localStorage.setItem(STORAGE.corruptionLevel, String(state.corruptionLevel)); }
  function isInputTarget(el) { return !!el && (el.closest('input, textarea, [contenteditable="true"]')); }
  function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function collectFragment(name, source) {
    if (!FRAGMENTS.includes(name) || state.fragments.has(name)) return;
    state.fragments.add(name); if (!state.loreTriggered) state.loreTriggered = true; autoUnlock1337(); save(); if (state.loreTriggered) toast(`Fragment recovered: ${name}`);
    console.info(`[XYREX ARCHIVE] ${name} recovered via ${source}.`);
  }
  function autoUnlock1337() { const base = FRAGMENTS.filter((f) => f !== '1.337'); if (base.every((f) => state.fragments.has(f))) state.fragments.add('1.337'); }
  function toast(msg) { if (!state.loreTriggered) return; const t = document.createElement('div'); t.className = 'lore-toast'; t.textContent = msg; document.body.appendChild(t); clearTimeout(state.toastCooldown); state.toastCooldown = setTimeout(() => t.remove(), 2500); }

  function buildTerminal() { /* unchanged structure */
    if (ui.terminal) return ui.terminal;
    const root = document.createElement('section'); root.className = 'xyrex-terminal';
    root.innerHTML = `<div class="lore-backdrop" data-close-terminal></div><div class="lore-panel"><div class="lore-panel-header"><strong>THE XYREX ARCHIVE // TERMINAL</strong><button class="lore-panel-close" data-close-terminal type="button">Close</button></div><div class="lore-output" id="loreOutput"></div><form class="lore-input-row"><input class="lore-input" placeholder="Type: help" autocomplete="off" /><button class="lore-submit" type="submit">Run</button></form></div>`;
    document.body.appendChild(root); root.querySelectorAll('[data-close-terminal]').forEach((el) => el.addEventListener('click', closeTerminal));
    const output = root.querySelector('#loreOutput'); const input = root.querySelector('.lore-input');
    const print = (line, cls = '') => { const div = document.createElement('div'); div.className = `lore-line ${cls}`.trim(); div.textContent = line; output.appendChild(div); output.scrollTop = output.scrollHeight; };
    const commandMap = {
      help: () => print('help, status, fragments, logs, decrypt, scan, mirror, null, node03, trace, verified, containment, protocol, protocol 1.337, restore, reset archive, reset archive confirm, clear'),
      status: () => { const ready = state.fragments.has('1.337'); print(`Archive status: ${state.loreTriggered ? 'RECOVERING' : 'DORMANT'}`); print(`Corruption level: ${state.corruptionLevel}`); print(`Fragments recovered: ${state.fragments.size}/10`); print(`Protocol 1.337 ready: ${ready ? 'YES' : 'NO'}`); },
      fragments: () => { const missing = FRAGMENTS.filter((f) => !state.fragments.has(f)); print(`Recovered (${state.fragments.size}/10): ${[...state.fragments].sort().join(', ') || 'None'}`); missing.forEach((_, i) => print(`[REDACTED-${String(i + 1).padStart(2, '0')}]`, 'lore-line-warning')); },
      logs: () => { if (state.fragments.size < 5) return print('Archive locked. Minimum recovery threshold not met.', 'lore-line-warning'); collectFragment('INDEX', 'terminal.logs'); openArchive(); print('Archive logs opened.'); },
      decrypt: () => { print('Decrypting...', 'lore-line-muted'); setTimeout(() => print('01001110 01010101 01001100 01001100 -> NULL', 'lore-line-accent'), 140); setTimeout(() => print('Hint: Node03 failure timestamp mirrors search echo: 03:17', 'lore-line-muted'), 260); },
      scan: () => { print('SCAN 001: 47 entries found'); print('SCAN 002: 48 entries found'); print('WARNING: unnamed entry detected', 'lore-line-warning'); print('TRUST DRIFT: rising'); print('CONTAINMENT: unstable'); collectFragment('INDEX', 'terminal.scan'); },
      mirror: () => { print('Logo reflects Search.'); print('Search reflects Subtitle.'); print('Subtitle reflects Featured.'); print('Featured returns to Logo.'); },
      null: () => print('NULL is the unnamed 48th executor entry left in every scan route.'), node03: () => print('NODE03 failed at 03:17. Query that timestamp in search to recover the echo trace.'),
      trace: () => print('TRACE routes persist in normal queries. Search exactly: null'), verified: () => print('VERIFIED was recast as containment signal, not trust confirmation.'),
      containment: () => print(state.fragments.size < 5 ? 'Containment unstable. Access tier insufficient.' : 'Containment prevented rendering of the 48th card, but did not erase its traces.'),
      protocol: () => print(state.fragments.has('1.337') ? 'Protocol 1.337 ready.' : `Protocol 1.337 dormant. ${10 - state.fragments.size} fragments missing.`),
      restore: () => { restore(); print('Corruption effects removed.'); }, 'reset archive': () => print('Warning: this only resets hidden archive progress. Run: reset archive confirm', 'lore-line-warning'),
      'reset archive confirm': () => { localStorage.removeItem(STORAGE.fragments); localStorage.removeItem(STORAGE.loreTriggered); localStorage.removeItem(STORAGE.corruptionLevel); state.fragments = new Set(); state.loreTriggered = false; restore(); save(); print('Archive progress reset. Normal site data untouched.'); },
      clear: () => { output.innerHTML = ''; }
    };
    root.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); const cmd = input.value.trim().toLowerCase(); if (!cmd) return; print(`> ${cmd}`); if (cmd === 'protocol 1.337') { if (!state.fragments.has('1.337')) print('Protocol 1.337 dormant. Required fragments missing.', 'lore-line-warning'); else { setCorruptionLevel(3); print('Protocol 1.337 engaged.', 'lore-line-accent'); } } else if (commandMap[cmd]) commandMap[cmd](); else print('Unknown command. Type help.', 'lore-line-warning'); input.value = ''; });
    ui.terminal = root; return root;
  }
  function openTerminal() { const t = buildTerminal(); t.classList.add('is-open'); t.querySelector('.lore-input')?.focus(); state.loreTriggered = true; save(); }
  function closeTerminal() { ui.terminal?.classList.remove('is-open'); }

  function buildArchive() { if (ui.archive) return ui.archive; const root = document.createElement('section'); root.className = 'xyrex-archive-modal'; root.innerHTML = '<div class="lore-backdrop" data-close-archive></div><div class="lore-panel"><div class="lore-panel-header"><strong>THE XYREX ARCHIVE // LOGS</strong><button class="lore-panel-close" data-close-archive type="button">Close</button></div><div class="archive-wrap"></div></div>'; const wrap = root.querySelector('.archive-wrap'); ARCHIVE_LOGS.forEach((log, i) => { const b = document.createElement('article'); b.className = 'archive-log'; b.textContent = `[LOG ${String(i + 1).padStart(3, '0')}] ${log}`; wrap.appendChild(b); }); root.querySelectorAll('[data-close-archive]').forEach((el) => el.addEventListener('click', () => root.classList.remove('is-open'))); document.body.appendChild(root); ui.archive = root; return root; }
  function openArchive() { buildArchive().classList.add('is-open'); }

  function applyTimedClass(el, className, min = 300, max = 950, bucket = state.cardTimeouts) { if (!el) return; el.classList.add(className); const timeout = setTimeout(() => { el.classList.remove(className); bucket.delete(timeout); }, Math.floor(min + Math.random() * (max - min))); bucket.add(timeout); }
  function clearTimeoutSet(bucket) { bucket.forEach((id) => clearTimeout(id)); bucket.clear(); }

  function spawnCorruptionOverlay() {
    if (ui.overlay) return ui.overlay;
    const overlay = document.createElement('div'); overlay.id = 'lore-corruption-overlay'; overlay.innerHTML = '<div class="lore-overlay-noise"></div><div class="lore-overlay-messages"></div>';
    document.body.appendChild(overlay); ui.overlay = overlay; return overlay;
  }
  function removeCorruptionOverlay() { if (!ui.overlay) return; ui.overlay.remove(); ui.overlay = null; state.overlayMessages.clear(); }

  function corruptRandomCard() {
    const cards = document.querySelectorAll('.product-card, .executor-card, .card'); if (!cards.length) return;
    const card = pickRandom([...cards]); if (!(card instanceof HTMLElement)) return;
    const title = card.querySelector('h3, h4, .title, .card-title'); if (title) card.dataset.loreTitle = (title.textContent || 'NULL').trim().slice(0, 48);
    applyTimedClass(card, 'lore-card-jitter', 260, 620);
    if (state.corruptionLevel >= 2 && Math.random() < 0.45) applyTimedClass(card, 'lore-card-desync', 260, 700);
    if (state.corruptionLevel >= 2 && Math.random() < 0.34) applyTimedClass(card, 'lore-card-infected', 700, 1800);
    if (state.corruptionLevel >= 3 && Math.random() < 0.38) applyTimedClass(card, 'lore-card-redacted', 300, 920);
    if (state.corruptionLevel >= 3 && Math.random() < 0.24) applyTimedClass(card, 'lore-card-ghost', 260, 760);
  }

  function glitchRandomText() {
    const nodes = document.querySelectorAll('h1, h2, h3, h4, .card-title, .badge, .filter-chip, .filter-label, button, .btn, .lore-line'); if (!nodes.length) return;
    const el = pickRandom([...nodes]); if (!(el instanceof HTMLElement)) return;
    const baseText = (el.textContent || '').trim(); if (!baseText) return;
    el.dataset.loreGlitch = baseText; applyTimedClass(el, 'lore-text-glitch', 280, 620, state.textTimeouts);
  }

  function distortLayoutSlice() {
    const blocks = document.querySelectorAll('main, section, .container, .products-grid, .executor-grid, .filters, .comparison'); if (!blocks.length) return;
    const el = pickRandom([...blocks]); if (!(el instanceof HTMLElement)) return;
    applyTimedClass(el, Math.random() > 0.5 ? 'lore-layout-drift' : 'lore-layout-tear', 260, 720, state.layoutTimeouts);
  }

  function spawnGlitchMessage() {
    if (!ui.overlay || state.overlayMessages.size >= 6) return;
    const host = ui.overlay.querySelector('.lore-overlay-messages'); if (!host) return;
    const msg = document.createElement('span'); msg.className = 'lore-overlay-message'; msg.textContent = pickRandom(GLITCH_MESSAGES);
    msg.style.left = `${Math.floor(Math.random() * 80) + 8}%`; msg.style.top = `${Math.floor(Math.random() * 72) + 8}%`;
    host.appendChild(msg); state.overlayMessages.add(msg);
    setTimeout(() => { msg.remove(); state.overlayMessages.delete(msg); }, REDUCED_MOTION() ? 420 : 1800);
  }

  function startCorruptionTimers() {
    stopCorruptionTimers();
    const addTimer = (fn, ms) => { const id = setInterval(fn, ms); state.timers.add(id); };
    if (state.corruptionLevel === 1) { addTimer(corruptRandomCard, REDUCED_MOTION() ? 6000 : 3200); addTimer(glitchRandomText, 9000); }
    if (state.corruptionLevel === 2) { addTimer(corruptRandomCard, REDUCED_MOTION() ? 3800 : 1550); addTimer(glitchRandomText, 3200); addTimer(distortLayoutSlice, REDUCED_MOTION() ? 7000 : 3800); addTimer(() => toast(pickRandom(GLITCH_MESSAGES)), 16000); addTimer(spawnGlitchMessage, REDUCED_MOTION() ? 5200 : 3000); }
    if (state.corruptionLevel === 3) { addTimer(corruptRandomCard, REDUCED_MOTION() ? 2600 : 920); addTimer(glitchRandomText, REDUCED_MOTION() ? 4600 : 1700); addTimer(distortLayoutSlice, REDUCED_MOTION() ? 5400 : 2200); addTimer(() => toast(pickRandom(GLITCH_MESSAGES)), 9000); addTimer(spawnGlitchMessage, REDUCED_MOTION() ? 3600 : 1400); }
  }
  function stopCorruptionTimers() { state.timers.forEach((id) => clearInterval(id)); state.timers.clear(); clearTimeoutSet(state.cardTimeouts); clearTimeoutSet(state.layoutTimeouts); clearTimeoutSet(state.textTimeouts); }

  function applyCorruptionLevel(level) {
    document.body.classList.remove('lore-corruption-l1', 'lore-corruption-l2', 'lore-corruption-l3');
    stopCorruptionTimers();
    if (level <= 0) { removeCorruptionOverlay(); return; }
    document.body.classList.add(`lore-corruption-l${level}`);
    const overlay = spawnCorruptionOverlay(); overlay.classList.add('is-active');
    if (level === 1 && REDUCED_MOTION()) overlay.style.opacity = '0.12'; else overlay.style.opacity = '';
    startCorruptionTimers();
  }

  function setCorruptionLevel(level) { state.corruptionLevel = Math.max(0, Math.min(3, Number(level) || 0)); save(); applyCorruptionLevel(state.corruptionLevel); }
  function restore() { setCorruptionLevel(0); }
  function clickSequenceStep(step) { const expected = CLICK_SEQUENCE[state.clickProgress]; state.clickProgress = expected === step ? state.clickProgress + 1 : (step === CLICK_SEQUENCE[0] ? 1 : 0); if (state.clickProgress === CLICK_SEQUENCE.length) { state.clickProgress = 0; collectFragment('MIRROR', 'mirror.sequence'); openTerminal(); } }

  document.addEventListener('click', (e) => { const t = e.target; if (!t) return; if (t.closest('#brandHomeBtn, .brand-btn, .brand')) clickSequenceStep('logo'); if (t.closest('#searchInput, .search-input')) clickSequenceStep('search'); if (t.closest('.seo-hero-subtitle')) { clickSequenceStep('subtitle'); state.subtitleClicks += 1; if (state.subtitleClicks >= 3) collectFragment('NODE03', 'subtitle.click3'); } if (t.closest('.product-card, .executor-card, .card, [data-featured="true"]')) clickSequenceStep('featured'); if (t.closest('.legend-icon.verified')) { state.verifiedClicks += 1; if (state.verifiedClicks >= 5) collectFragment('VERIFIED', 'verified.click5'); } if (t.closest('.btn-info, .more-info-btn, [data-action="more-info"], button')) { const txt = (t.textContent || '').toLowerCase(); if (txt.includes('more info') && state.fragments.size >= 5) collectFragment('CONTAINMENT', 'modal.more-info'); } });
  document.addEventListener('input', (e) => { const t = e.target; if (!(t instanceof HTMLInputElement)) return; if (t.matches('#searchInput, .search-input')) { const v = t.value.trim().toLowerCase(); if (v === 'null') collectFragment('TRACE', 'search.null'); if (v === '03:17') collectFragment('ECHO', 'search.0317'); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeTerminal(); ui.archive?.classList.remove('is-open'); } if (e.key.toLowerCase() === 'r' && state.corruptionLevel > 0 && !isInputTarget(e.target)) restore(); if (isInputTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return; state.typedBuffer = (state.typedBuffer + e.key.toLowerCase()).slice(-24); if (state.typedBuffer.endsWith('archive')) openTerminal(); if (state.typedBuffer.endsWith('null')) collectFragment('NULL', 'typed.null'); if (state.typedBuffer.endsWith('xyrex')) { collectFragment('TRUST', 'typed.xyrex'); console.info('[XYREX ARCHIVE] TRUST fragment resonance detected.'); } });

  const subtitle = document.querySelector('.seo-hero-subtitle'); if (!subtitle) console.info('[XYREX ARCHIVE] Missing .seo-hero-subtitle hook. Mirror route degraded.');
  autoUnlock1337();
  if (state.corruptionLevel > 0) applyCorruptionLevel(Math.max(0, Math.min(3, state.corruptionLevel)));
})();

// yo bro i am NOT adding 9/11 simulator 🫩