const products = Array.isArray(window.XYREX_EXECUTOR_PRODUCTS) ? window.XYREX_EXECUTOR_PRODUCTS : [];

const EXPLOIT_ASSISTANT_APIS = [
  '/api/exploit-assistant',
  'https://xyrex-ai-api.vercel.app/api/exploit-assistant',
  'https://xyres-ai-api.vercel.app/api/exploit-assistant'
];
const NO_ASSISTANT_TOKENS_MESSAGE = 'You have no AI tokens remaining. Daily tokens reset at midnight, or you can buy more in the Token Shop.';

const FREE_TOKEN_SHOP = Object.freeze({
  minClaim: 1,
  maxClaim: 30,
  maxCooldownMs: 7 * 24 * 60 * 60 * 1000
});
let settingsCooldownTimerId = null;

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

const POPULAR_SCRIPT_CATEGORY_ORDER = [
  'Universal',
  'Bedwars',
  'Rivals',
  'Grace',
  'Pressure',
  'Doors',
  'Steal a Brainrot',
  'Adopt Me',
  'Brookhaven RP',
  'Blox Fruits',
  'Slime RNG',
  'Kick a Lucky Block',
  '99 Nights in the Forest'
];

const WEAO_STATUS_ENDPOINTS = [
  'https://weao.xyz/api/status/exploits',
  'https://api.weao.xyz/status/exploits',
  'https://whatexpsare.online/api/status/exploits',
  'https://api.whatexpsare.online/status/exploits',
];
const WEAO_STATUS_REFRESH_MS = 5 * 60 * 1000;
let weaoStatusTimer = null;

function normalizeExecutorName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(executor|external|internal|windows|android|ios|macos|mac|roblox|exploit)\b/g, '')
    .replace(/\.(lol|gg|xyz|onl|fun|pro|best|wtf|lat)\b/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function getExecutorAliases(product) {
  const aliases = new Set([product.name]);
  const aliasMap = {
    bunni: ['Bunni.lol'],
    macsploit: ['MacSploit', 'Mac Sploit'],
    vegax: ['Vega X', 'VegaX'],
    yubx: ['YuB-X', 'YuBX'],
  };
  (aliasMap[normalizeExecutorName(product.name)] || []).forEach(alias => aliases.add(alias));
  if (product.officialSite) {
    try {
      const host = new URL(product.officialSite).hostname.replace(/^www\./, '').split('.')[0];
      if (host) aliases.add(host);
    } catch (error) {
      // Ignore malformed community-provided URLs; the visible product name remains the primary match key.
    }
  }
  return Array.from(aliases).map(normalizeExecutorName).filter(Boolean);
}

function normalizeWeaoEntry(rawEntry) {
  const source = rawEntry?.properties && typeof rawEntry.properties === 'object'
    ? { ...rawEntry, ...rawEntry.properties }
    : rawEntry;
  const title = source?.title || source?.name || '';
  return {
    title,
    updateStatus: source?.updateStatus,
    status: source?.status || source?.Status || '',
    state: source?.state || '',
    detected: source?.detected,
    version: source?.version || source?.rbxversion || '',
    updatedDate: source?.updatedDate || '',
    platform: source?.platform || '',
    hidden: Boolean(source?.hidden),
    beta: Boolean(source?.beta),
    suncPercentage: source?.suncPercentage,
    uncPercentage: source?.uncPercentage,
    free: source?.free,
    keysystem: source?.keysystem,
    websitelink: source?.websitelink,
    discordlink: source?.discordlink,
    purchaselink: source?.purchaselink,
    rbxversion: source?.rbxversion,
    cost: source?.cost,
    extype: source?.extype,
    decompiler: source?.decompiler,
    raknet: source?.raknet,
    multiInstance: source?.multiInstance ?? source?.multiinstance,
    comment: source?.comment || source?.notes || source?.detectionNote || source?.detectionNotes || source?.detectionReason || '',
    detectionReason: source?.detectionReason || '',
    detectionNarrative: source?.slug?.fullDescription || source?.fullDescription || '',
    lastBanwave: source?.lastBanwave || source?.last_banwave || source?.banwave || source?.lastBan || source?.banWave || '',
    hasIssues: source?.hasIssues,
    unknown: source?.unknown,
  };
}

function normalizeDetectionFromWeao(statusEntry) {
  if (!statusEntry) return 'Unknown';

  const narrativeText = [statusEntry.detectionNarrative, statusEntry.comment, statusEntry.detectionReason]
    .map(value => String(value || '').toLowerCase())
    .join(' ');

  if (/this\s+exploit\s+bypasses?/.test(narrativeText)) {
    if (/might\s+be\s+detected|use\s+at\s+your\s+own\s+risk|banwave|ban\s*wave/.test(narrativeText)) return 'Detected';
    if (/reported\s+as\s+undetected|no\s*bans?|observed\s+no\s+bans/.test(narrativeText)) return 'Undetected';
  }

  if (statusEntry.unknown === true) return 'Unknown';
  if (statusEntry.detected === true) return 'Detected';
  if (statusEntry.detected === false) return 'Undetected';

  const implicitText = [
    statusEntry.status,
    statusEntry.state,
    statusEntry.comment,
    statusEntry.detectionReason,
    statusEntry.detectionNarrative,
  ]
    .map(value => String(value || '').toLowerCase())
    .join(' ');

  if (/\bdetected\b|\bflagged\b|\bunsafe\b|active\s*ban/.test(implicitText)) return 'Detected';
  if (/\bundetected\b|not\s*detected|no\s*bans?|observed\s+no\s+bans|safe/.test(implicitText)) return 'Undetected';
  if (/\bunknown\b|no\s*data|n\/?a/.test(implicitText)) return 'Unknown';

  return 'Unknown';
}

function getWeaoDetectionMessage(statusEntry) {
  if (!statusEntry) return '';

  const directReason = String(statusEntry.detectionReason || '').trim();
  const comment = String(statusEntry.comment || '').trim();
  const narrative = String(statusEntry.detectionNarrative || '').trim();

  if (directReason) return directReason;
  if (comment) return comment;

  if (narrative) {
    const compactNarrative = narrative
      .replace(/\[[^\]]+\]\(([^)]+)\)/g, '$1')
      .replace(/[*_`>#]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const sentenceList = compactNarrative
      .split(/(?<=[.!?])\s+/)
      .map(item => item.trim())
      .filter(Boolean);

    const detectionSentences = sentenceList.filter(sentence => (
      /(detected|undetected|unknown|banwave|ban\s*wave|no\s*bans?|risk|use at your own risk|safe|unsafe)/i.test(sentence)
    ));
    const selected = detectionSentences.slice(0, 2).join(' ');
    if (selected) return selected;

    const lastBanwaveMatch = compactNarrative.match(/last\s*banwave[^.?!]*/i);
    if (lastBanwaveMatch) return lastBanwaveMatch[0].trim();
  }

  if (statusEntry.detected === true) return 'WEAO marks this exploit as detected, but no detailed detection reason was provided.';
  if (statusEntry.detected === false) return 'WEAO marks this exploit as undetected. No extra detection notes were provided.';

  return 'No detection information is currently available.';
}

function getWeaoLastBanwave(statusEntry) {
  if (!statusEntry) return '';
  return String(statusEntry.lastBanwave || '').trim();
}


function buildWeaoFeatureList(match, currentFeatures) {
  const existing = new Set(Array.isArray(currentFeatures) ? currentFeatures.filter(Boolean) : []);
  const normalized = new Set(Array.from(existing).map(feature => String(feature).toLowerCase()));
  const addFeature = (enabled, canonicalName, aliases = []) => {
    if (!enabled) return;
    const keys = [canonicalName, ...aliases].map(item => String(item).toLowerCase());
    if (keys.some(key => normalized.has(key))) return;
    existing.add(canonicalName);
    normalized.add(canonicalName.toLowerCase());
  };

  const sourceText = [match.extype, match.status, match.state, match.comment]
    .map(value => String(value || '').toLowerCase())
    .join(' ');

  addFeature(match.decompiler === true || /decompiler/.test(sourceText), 'Decompiler');
  addFeature(match.raknet === true || /rak\s*net|raknet/.test(sourceText), 'RakNet');
  addFeature(match.multiInstance === true || /multi[-\s]?instance/.test(sourceText), 'Multi-instance', ['multi instance']);

  return Array.from(existing);
}

function getWeaoStatusState(statusEntry) {
  if (!statusEntry) return 'unknown';
  if (statusEntry.hidden || statusEntry.beta) return 'unstable';
  if (statusEntry.updateStatus === true) return 'up';
  if (statusEntry.updateStatus === false) return 'down';
  const text = String(statusEntry.status || statusEntry.state || '').toLowerCase();
  if (/unstable|unknown|outage|maintenance|partial/.test(text)) return 'unstable';
  if (/up|online|working|updated/.test(text)) return 'up';
  if (/down|offline|patched|not\s*updated/.test(text)) return 'down';
  return 'unknown';
}

function getWeaoStatusLabel(statusEntry) {
  const state = getWeaoStatusState(statusEntry);
  if (state === 'up') return 'Working';
  if (state === 'down') return 'Not Working';
  if (state === 'unstable') return 'Unstable';
  return 'Unknown';
}

function getStatusLastUpdated(statusEntry) {
  if (!statusEntry || !statusEntry.updatedDate) return 'Unknown';
  return statusEntry.updatedDate;
}

function getDetectionStatusLabel(statusEntry) {
  const normalized = normalizeDetectionFromWeao(statusEntry);
  return normalized;
}


function applyWeaoStatuses(rawEntries) {
  const entries = (Array.isArray(rawEntries) ? rawEntries : []).map(normalizeWeaoEntry).filter(entry => entry.title);
  const byName = new Map();
  entries.forEach(entry => {
    const key = normalizeExecutorName(entry.title);
    if (key) byName.set(key, entry);
  });

  products.forEach(product => {
    const aliases = getExecutorAliases(product);
    let match = aliases.map(alias => byName.get(alias)).find(Boolean);
    if (!match) {
      match = entries.find(entry => {
        const titleKey = normalizeExecutorName(entry.title);
        return aliases.some(alias => titleKey.includes(alias) || alias.includes(titleKey));
      });
    }

    product.weaoStatus = match || null;

    if (!match) return;

    product.features = buildWeaoFeatureList(match, product.features);

    if (Number.isFinite(Number(match.suncPercentage))) {
      product.sunc = Number(match.suncPercentage);
    } else if (Number.isFinite(Number(match.uncPercentage))) {
      product.sunc = Number(match.uncPercentage);
    }

    if (Array.isArray(match.platform)) {
      product.platform = match.platform.map(normalizePlatformLabel).filter(Boolean);
    } else if (typeof match.platform === 'string' && match.platform.trim()) {
      product.platform = match.platform.split(/[,/|]/).map(item => normalizePlatformLabel(item)).filter(Boolean);
    }

    if (typeof match.keysystem === 'boolean') {
      product.keySystem = match.keysystem ? 'Keyed' : 'Keyless';
    } else if (typeof match.keysystem === 'string' && match.keysystem.trim()) {
      product.keySystem = /keyless|no\s*key/i.test(match.keysystem) ? 'Keyless' : 'Keyed';
    }

    const weaoState = getWeaoStatusState(match);
    if (weaoState === 'up') {
      product.status = 'Working';
    } else if (weaoState === 'down') {
      product.status = 'Down';
    } else if (weaoState === 'unstable') {
      product.status = 'Buggy';
    } else {
      product.status = 'Unknown';
    }

    product.detection = normalizeDetectionFromWeao(match);
    product.detectionMessage = getWeaoDetectionMessage(match);
    product.lastBanwave = getWeaoLastBanwave(match);

    const freeValue = typeof match.free === 'string' ? match.free.toLowerCase() : match.free;
    const confirmedFree = freeValue === true || freeValue === 'true' || freeValue === 'free';
    const confirmedPaid = freeValue === false || freeValue === 'false' || freeValue === 'paid' || Boolean(match.purchaselink) || (typeof match.cost === 'string' && match.cost.trim() && !/free/i.test(match.cost));

    if (confirmedFree && confirmedPaid) {
      product.freeOrPaid = 'both';
    } else if (confirmedFree) {
      product.freeOrPaid = 'free';
    } else if (confirmedPaid) {
      product.freeOrPaid = 'paid';
      const pricing = String(match.cost || '').trim();
      if (pricing) product.pricingOptions = [pricing];
    }

    if (typeof match.websitelink === 'string' && match.websitelink.trim()) product.officialSite = match.websitelink.trim();
    if (typeof match.discordlink === 'string' && match.discordlink.trim()) product.officialDiscord = match.discordlink.trim();
    if (typeof match.version === 'string' && match.version.trim()) product.version = match.version.trim();

    product.weaoLiveData = {
      suncPercentage: match.suncPercentage ?? null,
      uncPercentage: match.uncPercentage ?? null,
      free: match.free ?? null,
      keysystem: match.keysystem ?? null,
      websitelink: match.websitelink || '',
      discordlink: match.discordlink || '',
      purchaselink: match.purchaselink || '',
      rbxversion: match.rbxversion || '',
      cost: match.cost || '',
      extype: match.extype || '',
      version: match.version || '',
      updateStatus: match.updateStatus,
      status: match.status || '',
      state: match.state || '',
      detected: match.detected,
      detectionReason: match.detectionReason || '',
      detectionNarrative: match.detectionNarrative || '',
      detectionMessage: product.detectionMessage || '',
      lastBanwave: product.lastBanwave || '',
      updatedDate: match.updatedDate || '',
      comment: match.comment || '',
      hidden: Boolean(match.hidden),
      beta: Boolean(match.beta),
      title: match.title || '',
      refreshedAt: new Date().toISOString(),
    };
  });
  applyAllFilters();
}

async function fetchWeaoStatuses() {
  let lastError = null;
  for (const endpoint of WEAO_STATUS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`WEAO status request failed with ${response.status}`);
      const data = await response.json();
      applyWeaoStatuses(data);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  console.warn('WEAO executor status data is unavailable; showing unknown status bars.', lastError);
  products.forEach(product => { product.weaoStatus = null; });
  applyAllFilters();
}

function initWeaoStatuses() {
  fetchWeaoStatuses();
  if (weaoStatusTimer) window.clearInterval(weaoStatusTimer);
  weaoStatusTimer = window.setInterval(fetchWeaoStatuses, WEAO_STATUS_REFRESH_MS);
}

const scriptsHubData = {
  popularScripts: Array.isArray(window.XYREX_POPULAR_SCRIPTS) ? window.XYREX_POPULAR_SCRIPTS : []
};


const XYREX_OFFICIAL_DISCORD_URL = 'https://discord.gg/6X8cyjUcAj';

const discordWordmarkSvg = '<svg viewBox="0 0 127.14 96.36" aria-hidden="true" focusable="false"><path fill="currentColor" d="M107.7 8.07A105.15 105.15 0 0081.47 0a72.06 72.06 0 00-3.36 6.83 97.68 97.68 0 00-29.94 0A72.37 72.37 0 0044.8 0 105.89 105.89 0 0018.57 8.08C1.03 34.37-3.72 60 1.39 85.28A105.73 105.73 0 0033.32 96a77.7 77.7 0 006.84-11.16 68.42 68.42 0 01-10.78-5.15c.91-.67 1.8-1.37 2.66-2.09a75.57 75.57 0 0063.48 0c.87.72 1.76 1.42 2.67 2.09a68.68 68.68 0 01-10.8 5.16A77.53 77.53 0 0094.24 96a105.25 105.25 0 0031.91-10.72c6-29.3-1-54.68-18.45-77.21zM42.45 65.69c-6.23 0-11.33-5.69-11.33-12.69s5-12.7 11.33-12.7S53.78 46 53.78 53s-5.03 12.69-11.33 12.69zm42.24 0c-6.23 0-11.33-5.69-11.33-12.69s5-12.7 11.33-12.7S96.02 46 96.02 53s-5.03 12.69-11.33 12.69z"/></svg>';

const popularScriptFileSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true" focusable="false"><path fill="currentColor" d="M288 64C252.7 64 224 92.7 224 128L224 384C224 419.3 252.7 448 288 448L480 448C515.3 448 544 419.3 544 384L544 183.4C544 166 536.9 149.3 524.3 137.2L466.6 81.8C454.7 70.4 438.8 64 422.3 64L288 64zM160 192C124.7 192 96 220.7 96 256L96 512C96 547.3 124.7 576 160 576L352 576C387.3 576 416 547.3 416 512L416 496L352 496L352 512L160 512L160 256L176 256L176 192L160 192z"/></svg>';
const popularScriptCopySvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true" focusable="false"><path fill="currentColor" d="M288 64C252.7 64 224 92.7 224 128L224 384C224 419.3 252.7 448 288 448L480 448C515.3 448 544 419.3 544 384L544 183.4C544 166 536.9 149.3 524.3 137.2L466.6 81.8C454.7 70.4 438.8 64 422.3 64L288 64zM160 192C124.7 192 96 220.7 96 256L96 512C96 547.3 124.7 576 160 576L352 576C387.3 576 416 547.3 416 512L416 496L352 496L352 512L160 512L160 256L176 256L176 192L160 192z"/></svg>';
const popularScriptDiscordSvg = '<svg viewBox="0 0 127.14 96.36" aria-hidden="true" focusable="false"><path fill="currentColor" d="M107.7 8.07A105.15 105.15 0 0081.47 0a72.06 72.06 0 00-3.36 6.83 97.68 97.68 0 00-29.94 0A72.37 72.37 0 0044.8 0 105.89 105.89 0 0018.57 8.08C1.03 34.37-3.72 60 1.39 85.28A105.73 105.73 0 0033.32 96a77.7 77.7 0 006.84-11.16 68.42 68.42 0 01-10.78-5.15c.91-.67 1.8-1.37 2.66-2.09a75.57 75.57 0 0063.48 0c.87.72 1.76 1.42 2.67 2.09a68.68 68.68 0 01-10.8 5.16A77.53 77.53 0 0094.24 96a105.25 105.25 0 0031.91-10.72c6-29.3-1-54.68-18.45-77.21zM42.45 65.69c-6.23 0-11.33-5.69-11.33-12.69s5-12.7 11.33-12.7S53.78 46 53.78 53s-5.03 12.69-11.33 12.69zm42.24 0c-6.23 0-11.33-5.69-11.33-12.69s5-12.7 11.33-12.7S96.02 46 96.02 53s-5.03 12.69-11.33 12.69z"/></svg>';

const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));

const svgIcons = {
  iOS: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M447.1 332.7C446.9 296 463.5 268.3 497.1 247.9C478.3 221 449.9 206.2 412.4 203.3C376.9 200.5 338.1 224 323.9 224C308.9 224 274.5 204.3 247.5 204.3C191.7 205.2 132.4 248.8 132.4 337.5C132.4 363.7 137.2 390.8 146.8 418.7C159.6 455.4 205.8 545.4 254 543.9C279.2 543.3 297 526 329.8 526C361.6 526 378.1 543.9 406.2 543.9C454.8 543.2 496.6 461.4 508.8 424.6C443.6 393.9 447.1 334.6 447.1 332.7zM390.5 168.5C417.8 136.1 415.3 106.6 414.5 96C390.4 97.4 362.5 112.4 346.6 130.9C329.1 150.7 318.8 175.2 321 202.8C347.1 204.8 370.9 191.4 390.5 168.5z"/></svg>',
  Windows: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M96 96L310.6 96L310.6 310.6L96 310.6L96 96zM329.4 96L544 96L544 310.6L329.4 310.6L329.4 96zM96 329.4L310.6 329.4L310.6 544L96 544L96 329.4zM329.4 329.4L544 329.4L544 544L329.4 544L329.4 329.4z"/></svg>',
  Android: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M452.5 317.9C465.8 317.9 476.5 328.6 476.5 341.9C476.5 355.2 465.8 365.9 452.5 365.9C439.2 365.9 428.5 355.2 428.5 341.9C428.5 328.6 439.2 317.9 452.5 317.9zM187.4 317.9C200.7 317.9 211.4 328.6 211.4 341.9C211.4 355.2 200.7 365.9 187.4 365.9C174.1 365.9 163.4 355.2 163.4 341.9C163.4 328.6 174.1 317.9 187.4 317.9zM461.1 221.4L509 138.4C509.8 137.3 510.3 136 510.5 134.6C510.7 133.2 510.7 131.9 510.4 130.5C510.1 129.1 509.5 127.9 508.7 126.8C507.9 125.7 506.9 124.8 505.7 124.1C504.5 123.4 503.2 123 501.8 122.8C500.4 122.6 499.1 122.8 497.8 123.2C496.5 123.6 495.3 124.3 494.2 125.1C493.1 125.9 492.3 127.1 491.7 128.3L443.2 212.4C404.4 195 362.4 186 319.9 186C277.4 186 235.4 195 196.6 212.4L148.2 128.4C147.6 127.2 146.7 126.1 145.7 125.2C144.7 124.3 143.4 123.7 142.1 123.3C140.8 122.9 139.4 122.8 138.1 122.9C136.8 123 135.4 123.5 134.2 124.2C133 124.9 132 125.8 131.2 126.9C130.4 128 129.8 129.3 129.5 130.6C129.2 131.9 129.2 133.3 129.4 134.7C129.6 136.1 130.2 137.3 130.9 138.5L178.8 221.5C96.5 266.2 40.2 349.5 32 448L608 448C599.8 349.5 543.5 266.2 461.1 221.4z"/></svg>',
  macOS: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M128 96C92.7 96 64 124.7 64 160L64 400L128 400L128 160L512 160L512 400L576 400L576 160C576 124.7 547.3 96 512 96L128 96zM19.2 448C8.6 448 0 456.6 0 467.2C0 509.6 34.4 544 76.8 544L563.2 544C605.6 544 640 509.6 640 467.2C640 456.6 631.4 448 620.8 448L19.2 448z"/></svg>',
  warning: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M320 64C334.7 64 348.2 72.1 355.2 85L571.2 485C577.9 497.4 577.6 512.4 570.4 524.5C563.2 536.6 550.1 544 536 544L104 544C89.9 544 76.8 536.6 69.6 524.5C62.4 512.4 62.1 497.4 68.8 485L284.8 85C291.8 72.1 305.3 64 320 64zM320 416C302.3 416 288 430.3 288 448C288 465.7 302.3 480 320 480C337.7 480 352 465.7 352 448C352 430.3 337.7 416 320 416zM320 224C301.8 224 287.3 239.5 288.6 257.7L296 361.7C296.9 374.2 307.4 384 319.9 384C332.5 384 342.9 374.3 343.8 361.7L351.2 257.7C352.5 239.5 338.1 224 319.8 224z"/></svg>',
  trending: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M416 224C398.3 224 384 209.7 384 192C384 174.3 398.3 160 416 160L576 160C593.7 160 608 174.3 608 192L608 352C608 369.7 593.7 384 576 384C558.3 384 544 369.7 544 352L544 269.3L374.6 438.7C362.1 451.2 341.8 451.2 329.3 438.7L224 333.3L86.6 470.6C74.1 483.1 53.8 483.1 41.3 470.6C28.8 458.1 28.8 437.8 41.3 425.3L201.3 265.3C213.8 252.8 234.1 252.8 246.6 265.3L352 370.7L498.7 224L416 224z"/></svg>'
};

const tagSymbolMap = {
  Verified: { symbol: '✓', cls: 'verified' },
  Warning: { symbol: svgIcons.warning, cls: 'warning', isSvg: true },
  Trending: { symbol: svgIcons.trending, cls: 'trending', isSvg: true },
  Internal: { symbol: 'I', cls: 'internal' },
  External: { symbol: 'E', cls: 'external' }
};

const trustRiskMap = { High: 2, Medium: 5, Low: 8, Unknown: 7 };
const stabilityScoreMap = { 'Very stable': 10, Stable: 9, High: 8, Mixed: 6, Basic: 4, Questionable: 3, Unstable: 3, Unknown: 4 };
let lastModalTrigger = null;

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function cleanupAetherCoreBranding() {
  const candidates = qsa('.aethercore-logo, [data-aethercore-logo], img[alt*="AetherCore" i], img[title*="AetherCore" i], img[src*="aethercore" i]');
  const seenKeys = new Set();

  candidates.forEach(node => {
    const keyParts = [
      node.tagName,
      node.getAttribute('src') || '',
      node.getAttribute('alt') || '',
      node.getAttribute('title') || '',
      node.parentElement?.className || ''
    ];
    const key = keyParts.join('|').toLowerCase();
    if (seenKeys.has(key)) {
      node.remove();
      return;
    }
    seenKeys.add(key);
    node.classList.add('aethercore-logo-clean');
    const logoShell = node.closest('.aethercore-logo-wrap, .aethercore-brand, .module-logo, .script-card-meta, .script-card-head');
    if (logoShell) logoShell.classList.add('aethercore-logo-clean-shell');
  });
}

function stripTrailingPeriod(value) {
  const text = String(value ?? '').trim();
  if (/\.\.\.$/.test(text)) return text;
  return text.replace(/\.(?=\s*$)/, '').trim();
}

function cleanMalformedPriceText(value) {
  return String(value ?? '').replace(/\$\s*\{\s*\.(\d{1,2})/g, '$$1.$1');
}

function createTagSymbols(product) {
  const wrap = document.createElement('div');
  wrap.className = 'tag-symbols no-text-select';

  [...new Set(product.tags || [])].forEach(tag => {
    const config = tagSymbolMap[tag];
    if (!config) return;
    const marker = document.createElement('span');
    marker.className = `legend-icon ${config.cls}`;
    if (config.isSvg) marker.innerHTML = `<span class="icon-svg">${config.symbol}</span>`;
    else marker.textContent = config.symbol;
    marker.title = tag;
    marker.setAttribute('aria-label', tag);
    wrap.appendChild(marker);
  });

  return wrap;
}

function getPlatformLogo(platform) {
  return svgIcons[platform] ? `<span class="icon-svg">${svgIcons[platform]}</span>` : '•';
}

function normalizePlatformLabel(platform) {
  const label = String(platform || '').trim().toLowerCase();
  if (!label) return '';
  if (label === 'windows' || label === 'win' || label === 'pc') return 'Windows';
  if (label === 'android') return 'Android';
  if (label === 'ios' || label === 'iphone' || label === 'ipad') return 'iOS';
  if (label === 'macos' || label === 'mac os' || label === 'mac' || label === 'osx' || label === 'macosx') return 'macOS';
  return String(platform || '').trim();
}

function createPlatformChips(platforms) {
  const wrap = document.createElement('div');
  wrap.className = 'platform-chips no-text-select';

  (platforms || []).forEach(platform => {
    const normalizedPlatform = normalizePlatformLabel(platform);
    if (!normalizedPlatform) return;
    const chip = document.createElement('span');
    chip.className = 'platform-chip';
    chip.innerHTML = `<span class="platform-logo">${getPlatformLogo(normalizedPlatform)}</span><span>${escapeHtml(normalizedPlatform)}</span>`;
    wrap.appendChild(chip);
  });

  return wrap;
}

function getPriceLabel(product) {
  if (product.freeOrPaid === 'both') return 'Free + Paid';
  return product.freeOrPaid === 'free' ? 'Free' : 'Paid';
}

function createProductCard(product, index) {
  const card = document.createElement('article');
  card.className = 'card';
  if (product.featured) card.classList.add('featured-card');
  card.setAttribute('data-index', index);
  card.setAttribute('data-name', product.name);
  card.dataset.officialSite = product.officialSite || '';
  card.dataset.officialDiscord = product.officialDiscord || '';
  card.dataset.status = product.status || '';
  card.dataset.trustLevel = product.trustLevel || '';
  card.dataset.stability = product.stability || '';
  card.dataset.platform = (product.platform || []).join(', ');
  card.dataset.keySystem = product.keySystem || '';
  card.dataset.tags = (product.tags || []).join(', ');
  card.dataset.execution = Number.isFinite(product.sunc) ? (product.sunc >= 95 ? 'High' : product.sunc >= 80 ? 'Medium' : 'Low') : 'Unknown';

  const body = document.createElement('div');
  body.className = 'card-body';

  const header = document.createElement('div');
  header.className = 'card-header';

  const left = document.createElement('div');
  left.className = 'card-header-left no-text-select';

  const name = document.createElement('div');
  name.className = 'product-name';
  name.textContent = product.name;
  name.setAttribute('role', 'button');
  name.setAttribute('tabindex', '0');

  left.appendChild(name);
  const right = document.createElement('div');
  right.className = 'card-header-right';

  const sunc = document.createElement('div');
  sunc.className = 'sunc no-text-select';
  sunc.textContent = Number.isFinite(product.sunc) ? `sUNC ${product.sunc}%` : 'sUNC None';
  sunc.title = 'Click to check an sUNC';
  sunc.addEventListener('click', () => openSuncSimulationModal(product));

  right.appendChild(sunc);
  right.appendChild(createTagSymbols(product));

  header.appendChild(left);
  header.appendChild(right);

  const statusState = getWeaoStatusState(product.weaoStatus);
  card.dataset.statusState = statusState;
  name.title = `Current State: ${getWeaoStatusLabel(product.weaoStatus)} • Last Updated: ${getStatusLastUpdated(product.weaoStatus)} • Detection Risk: ${product.detection || getDetectionStatusLabel(product.weaoStatus)} • Reason: ${product.detectionMessage || getWeaoDetectionMessage(product.weaoStatus)}`;

  const statusDetails = document.createElement('div');
  statusDetails.className = 'status-details';
  statusDetails.hidden = true;
  statusDetails.innerHTML = `
    <div class="status-line"><strong>Current State:</strong> ${escapeHtml(getWeaoStatusLabel(product.weaoStatus))}</div>
    <div class="status-line"><strong>Last Updated:</strong> ${escapeHtml(getStatusLastUpdated(product.weaoStatus))}</div>
    <div class="status-line"><strong>Detection Risk:</strong> ${escapeHtml(product.detection || getDetectionStatusLabel(product.weaoStatus))}</div>
    <div class="status-line"><strong>Reason:</strong> ${escapeHtml(product.detectionMessage || getWeaoDetectionMessage(product.weaoStatus))}</div>
    <div class="status-line"><strong>Last Banwave:</strong> ${escapeHtml(product.lastBanwave || getWeaoLastBanwave(product.weaoStatus) || 'Not provided')}</div>
  `;

  const toggleStatusDetails = () => {
    statusDetails.hidden = !statusDetails.hidden;
    card.classList.toggle('card-expanded', !statusDetails.hidden);
  };

  name.addEventListener('click', toggleStatusDetails);
  name.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggleStatusDetails();
  });

  const summary = document.createElement('p');
  summary.className = 'summary';
  summary.textContent = stripTrailingPeriod(product.description);

  const price = document.createElement('div');
  price.className = 'price no-text-select';
  price.textContent = cleanMalformedPriceText(getPriceLabel(product));

  body.appendChild(header);
  body.appendChild(statusDetails);
  body.appendChild(createPlatformChips(product.platform));
  body.appendChild(summary);
  body.appendChild(price);

  const infoBtn = document.createElement('button');
  infoBtn.className = 'info-btn';
  infoBtn.textContent = 'More Info';
  infoBtn.addEventListener('click', () => openModal(product));

  card.appendChild(body);
  card.appendChild(infoBtn);
  return card;
}

const CARD_EXIT_ANIMATION_MS = 210;
const EXECUTOR_SORT_KEY = 'xyrex_executor_sort';
let executorSortMode = 'featured';

function sortExecutors(list) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  const sorted = [...list];

  if (executorSortMode === 'name') return sorted.sort(byName);
  if (executorSortMode === 'sunc') {
    return sorted.sort((a, b) => (Number.isFinite(b.sunc) ? b.sunc : -1) - (Number.isFinite(a.sunc) ? a.sunc : -1) || byName(a, b));
  }
  if (executorSortMode === 'trust') {
    const trustRank = { High: 3, Medium: 2, Low: 1, Unknown: 0 };
    return sorted.sort((a, b) => (trustRank[b.trustLevel] ?? 0) - (trustRank[a.trustLevel] ?? 0) || byName(a, b));
  }
  if (executorSortMode === 'price') return sorted.sort((a, b) => estimatedPriceValue(a) - estimatedPriceValue(b) || byName(a, b));

  return sorted.sort((a, b) => (a.featured === b.featured ? byName(a, b) : a.featured ? -1 : 1));
}

function renderExecutorResultMeta(shownCount) {
  const meta = qs('#executorResultMeta');
  if (!meta) return;
  const total = products.length;
  const word = shownCount === 1 ? 'executor' : 'executors';
  meta.textContent = shownCount === total
    ? `${total} ${word} listed`
    : `Showing ${shownCount} of ${total} ${word}`;
}

function renderProducts(list) {
  const grid = qs('#productGrid');
  const sorted = sortExecutors(list);
  renderExecutorResultMeta(sorted.length);

  if (!grid.dataset.renderVersion) grid.dataset.renderVersion = '0';
  const nextVersion = String(Number(grid.dataset.renderVersion) + 1);
  grid.dataset.renderVersion = nextVersion;

  const oldCards = Array.from(grid.querySelectorAll('.card'));
  if (!oldCards.length) {
    grid.innerHTML = '';
    qs('#noResults').hidden = Boolean(sorted.length);
    sorted.forEach((product, index) => grid.appendChild(createProductCard(product, index)));
    return;
  }
  const existingByName = new Map(oldCards.map(card => [card.getAttribute('data-name'), card]));
  const oldRectByName = new Map(oldCards.map(card => [card.getAttribute('data-name'), card.getBoundingClientRect()]));
  const nextNames = new Set(sorted.map(item => item.name));
  qs('#noResults').hidden = Boolean(sorted.length);

  oldCards.forEach(card => {
    const name = card.getAttribute('data-name');
    if (!nextNames.has(name)) card.classList.add('card-exit');
  });

  window.setTimeout(() => {
    if (grid.dataset.renderVersion !== nextVersion) return;

    oldCards.forEach(card => {
      if (!nextNames.has(card.getAttribute('data-name'))) card.remove();
    });
    if (!sorted.length) return;

    const orderedCards = sorted.map((product, index) => {
      const existingCard = existingByName.get(product.name);
      if (existingCard) {
        const refreshedCard = createProductCard(product, index);
        existingCard.replaceWith(refreshedCard);
        return refreshedCard;
      }
      const newCard = createProductCard(product, index);
      newCard.classList.add('card-enter');
      return newCard;
    });
    orderedCards.forEach(card => grid.appendChild(card));

    orderedCards.forEach(card => {
      const name = card.getAttribute('data-name');
      const oldRect = oldRectByName.get(name);
      if (!oldRect) return;
      const newRect = card.getBoundingClientRect();
      const deltaX = oldRect.left - newRect.left;
      const deltaY = oldRect.top - newRect.top;
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;
      card.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      card.style.transition = 'transform 0s';
      requestAnimationFrame(() => {
        card.classList.add('card-shift');
        card.style.transform = '';
        card.style.transition = '';
        window.setTimeout(() => card.classList.remove('card-shift'), 430);
      });
    });
  }, CARD_EXIT_ANIMATION_MS);
}

function getActiveFilters() {
  const active = {};
  qsa('.filter-checkbox').forEach(input => {
    if (!input.checked) return;
    const group = input.getAttribute('data-filter-group');
    if (!active[group]) active[group] = [];
    active[group].push(input.value);
  });
  return active;
}

function getPriceControls() {
  return { free: qs('#priceFree').checked, paid: qs('#pricePaid').checked, both: qs('#priceBoth').checked };
}

function isPriceMatch(prod, priceControls) {
  if (!priceControls.free && !priceControls.paid && !priceControls.both) return true;

  if (priceControls.free && priceControls.paid) return ['free', 'paid', 'both'].includes(prod.freeOrPaid);
  if (priceControls.both) return prod.freeOrPaid === 'both';
  if (priceControls.free) return prod.freeOrPaid === 'free' || prod.freeOrPaid === 'both';
  if (priceControls.paid) return prod.freeOrPaid === 'paid' || prod.freeOrPaid === 'both';
  return false;
}

function getExecutorSearchHaystack(prod) {
  return [
    prod.name,
    prod.description,
    prod.cheatType,
    prod.keySystem,
    prod.stability,
    prod.status,
    ...(prod.platform || []),
    ...(prod.tags || []),
    ...(prod.features || []),
    ...(prod.pricingOptions || [])
  ].filter(Boolean).join(' ').toLowerCase();
}

function applyAllFilters() {
  const active = getActiveFilters();
  const priceControls = getPriceControls();
  const searchTerms = qs('#searchInput').value.trim().toLowerCase().split(/\s+/).filter(Boolean);

  const filtered = products.filter(prod => {
    if (searchTerms.length) {
      const haystack = getExecutorSearchHaystack(prod);
      if (!searchTerms.every(term => haystack.includes(term))) return false;
    }
    if (active.platform?.length && !active.platform.some(platform => (prod.platform || []).includes(platform))) return false;
    if (active.tags?.length && !active.tags.every(tag => [...(prod.tags || []), ...(prod.features || [])].includes(tag))) return false;
    if (active.cheatType?.length && !active.cheatType.includes(prod.cheatType)) return false;
    if (active.keySystem?.length && !active.keySystem.includes(prod.keySystem)) return false;
    if (active.statusState?.length && !active.statusState.includes(getWeaoStatusState(prod.weaoStatus))) return false;
    if (!isPriceMatch(prod, priceControls)) return false;
    return true;
  });

  renderProducts(filtered);
}

function setCompactModal(isCompact) {
  const modal = qs('#modalOverlay')?.querySelector('.modal');
  if (!modal) return;
  modal.classList.toggle('modal-compact', Boolean(isCompact));
}

function openModal(product) {
  const overlay = qs('#modalOverlay');
  const content = qs('#modalContent');
  setCompactModal(false);
  lastModalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const officialSite = product.officialSite || '';
  const consMarkup = Array.isArray(product.cons) && product.cons.length
    ? `<div class="modal-section"><strong>Cons</strong><ul>${product.cons.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`
    : '';
  const officialSiteHost = officialSite
    ? (() => {
        try {
          return new URL(officialSite).hostname;
        } catch (error) {
          return officialSite;
        }
      })()
    : 'Not provided';

  const faviconUrl = officialSite
    ? `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(officialSite)}`
    : '';

  const officialDiscord = product.officialDiscord || XYREX_OFFICIAL_DISCORD_URL;
  const officialDiscordHost = officialDiscord
    ? (() => {
        try {
          return new URL(officialDiscord).hostname;
        } catch (error) {
          return officialDiscord;
        }
      })()
    : 'Not provided';

  content.innerHTML = `
    <h2>${escapeHtml(product.name)}</h2>
    <p class="modal-headline">${escapeHtml(stripTrailingPeriod(product.description))}</p>
    <div class="modal-layout">
      <div>
        <div class="modal-section"><strong>Pros</strong><ul>${product.pros.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul></div>
        ${consMarkup}
        <div class="modal-section"><strong>Pricing</strong><ul>${product.pricingOptions.map(item => `<li>${escapeHtml(cleanMalformedPriceText(item))}</li>`).join('')}</ul></div>
      </div>
      <aside class="status-panel">
        <h3>Status</h3>
        <div class="status-item"><span>Current State</span><strong class="status-text-${getWeaoStatusState(product.weaoStatus)}">${escapeHtml(getWeaoStatusLabel(product.weaoStatus))}</strong></div>
        <div class="status-item"><span>Last Updated</span><strong>${escapeHtml(getStatusLastUpdated(product.weaoStatus))}</strong></div>
        <div class="status-item"><span>Detection</span><strong>${escapeHtml(getDetectionStatusLabel(product.weaoStatus))}</strong></div>
        <div class="status-item"><span>Trust Level</span><strong>${escapeHtml(product.trustLevel)}</strong></div>
        <div class="status-item"><span>Stability</span><strong>${escapeHtml(product.stability)}</strong></div>
        <div class="status-item"><span>sUNC</span><strong>${Number.isFinite(product.sunc) ? `${product.sunc}%` : 'None'}</strong></div>
        <div class="status-item"><span>Version</span><strong>${escapeHtml(product.version || product.weaoLiveData?.rbxversion || 'Unknown')}</strong></div>
        <div class="status-item status-site">
          <span>Official Site</span>
          ${
            officialSite
              ? `<a class="official-link-btn" href="${escapeHtml(officialSite)}" target="_blank" rel="noopener noreferrer">
                   ${faviconUrl ? `<img src="${escapeHtml(faviconUrl)}" alt="Site icon" />` : ''}
                   <span>${escapeHtml(officialSiteHost)}</span>
                 </a>`
              : `<span class="no-site">Not provided</span>`
          }
        </div>
        <div class="status-item status-site">
          <span>Official Discord</span>
          ${
            officialDiscord
              ? `<a class="official-link-btn" href="${escapeHtml(officialDiscord)}" target="_blank" rel="noopener noreferrer" aria-label="Official Discord server">
                   ${discordWordmarkSvg}
                   <span>${escapeHtml(officialDiscordHost)}</span>
                 </a>`
              : `<span class="no-site">Not provided</span>`
          }
        </div>
      </aside>
    </div>`;

  overlay.classList.remove('is-closing');
  overlay.setAttribute('aria-hidden', 'false');
  qs('#modalCloseBtn').focus();
}

function openSuncSimulationModal(product) {
  const overlay = qs('#modalOverlay');
  const content = qs('#modalContent');
  setCompactModal(false);
  const targetScore = Number.isFinite(product.sunc) ? product.sunc : 0;
  const uncScore = Number.isFinite(Number(product.weaoLiveData?.uncPercentage))
    ? Number(product.weaoLiveData.uncPercentage)
    : null;
  content.innerHTML = `
    <section class="sunc-sim-modal">
      <h2>sUNC Score</h2>
      <p class="modal-headline">Running a standardized sUNC test for <strong>${escapeHtml(product.name)}</strong> based on the latest listed executor data.</p>
      <div class="sunc-sim-progress-wrap" aria-live="polite">
        <div id="suncSimBar" class="sunc-sim-progress-bar"><span id="suncSimFill" class="sunc-sim-progress-fill"></span></div>
        <div id="suncSimValue" class="sunc-sim-value">0%</div>
      </div>
      <h2>UNC Score</h2>
      <p class="modal-headline">Running an UNC test for <strong>${escapeHtml(product.name)}</strong> using the official live status feed.</p>
      <div class="sunc-sim-progress-wrap" aria-live="polite">
        <div id="uncSimBar" class="sunc-sim-progress-bar"><span id="uncSimFill" class="sunc-sim-progress-fill"></span></div>
        <div id="uncSimValue" class="sunc-sim-value">0%</div>
      </div>
      <p class="settings-note">This test will not show UNC or functions passed/failed</p>
    </section>`;

  overlay.classList.remove('is-closing');
  overlay.setAttribute('aria-hidden', 'false');
  qs('#modalCloseBtn').focus();

  const fill = qs('#suncSimFill');
  const value = qs('#suncSimValue');
  const uncFill = qs('#uncSimFill');
  const uncValue = qs('#uncSimValue');
  const durationMs = 1050;
  const startAt = performance.now();

  const step = now => {
    if (overlay.getAttribute('aria-hidden') === 'true') return;
    const progress = Math.min((now - startAt) / durationMs, 1);
    const current = Math.round(targetScore * progress);
    const uncCurrent = Math.round((Number.isFinite(uncScore) ? uncScore : 0) * progress);
    fill.style.width = `${current}%`;
    value.textContent = `${current}%`;
    uncFill.style.width = `${uncCurrent}%`;
    uncValue.textContent = `${uncCurrent}%`;
    if (progress < 1) {
      requestAnimationFrame(step);
      return;
    }
    value.textContent = Number.isFinite(product.sunc) ? `${product.sunc}% confirmed` : 'No score available';
    uncValue.textContent = Number.isFinite(uncScore) ? `${uncScore}% confirmed` : 'No score available';
  };
  requestAnimationFrame(step);
}

// ─── AI token vault ─────────────────────────────────────────────────────────
// Every token rule lives inside this closure so console scripts cannot call
// the seal/verify primitives, rewrite the cooldown math, or monkeypatch the
// storage helpers the vault relies on. The frozen API below only exposes the
// exact operations the UI buttons perform, with all limits enforced inside.
const XyrexTokenVault = (() => {
  const STORAGE_KEY = 'xyrex_ai_tokens_v1';
  const LEDGER_KEY = 'xyrex_ai_tokens_v1_ledger';
  const FREE_DAILY_TOKENS = 5;
  const SEAL_VERSION = 3;
  const SEAL_SALT = 'xyrex.lol.integrity.v3.2026';
  const LEGACY_VERSION = 2;
  const LEGACY_SALT = 'xyrex.lol.integrity.v2.2026';

  // Pristine references captured before any console script can patch them.
  const storageGet = localStorage.getItem.bind(localStorage);
  const storageSet = localStorage.setItem.bind(localStorage);
  const nowMs = Date.now.bind(Date);
  const imul = Math.imul;

  let memData = null;             // authoritative in-session token state
  let lastWrittenRaw = null;      // exact blob of this session's last write
  let writeCounter = 0;
  let cooldownFloor = 0;          // cooldown can never shrink mid-session
  let usedTodayFloor = 0;         // spent free tokens can't be refunded mid-session
  let usedTodayFloorDate = '';
  const externalWrites = new Set();

  // Writes from other tabs arrive as storage events; console writes in this
  // tab never do, which is how tampering is told apart from legit multi-tab use.
  // event.isTrusted is set by the browser and can only be true for a genuine
  // cross-tab write — a script-dispatched `new StorageEvent(...)` is always
  // false, so a same-tab console script cannot forge itself into externalWrites.
  window.addEventListener('storage', event => {
    if (!event.isTrusted) return;
    if (typeof event.key !== 'string' || typeof event.newValue !== 'string') return;
    if (!event.key.endsWith(STORAGE_KEY)) return;
    externalWrites.add(event.newValue);
    if (externalWrites.size > 24) externalWrites.clear();
  });

  window.XyrexAccountScope?.onAccountChange?.(() => {
    memData = null;
    lastWrittenRaw = null;
    writeCounter = 0;
    cooldownFloor = 0;
    usedTodayFloor = 0;
    usedTodayFloorDate = '';
  });

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function mac(input) {
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193 ^ input.length;
    for (let i = 0; i < input.length; i += 1) {
      const code = input.charCodeAt(i);
      h1 ^= code;
      h1 = imul(h1, 16777619);
      h2 = imul(h2 ^ ((code << 7) | (i & 63)), 2246822519);
    }
    return `${(h1 >>> 0).toString(36)}.${(h2 >>> 0).toString(36)}`;
  }

  const checksumFor = (payload, writes) => mac(`${SEAL_SALT}:${STORAGE_KEY}:${writes}:${stableStringify(payload)}`);
  const ledgerMacFor = (writes, checksum) => mac(`${SEAL_SALT}:ledger:${LEDGER_KEY}:${writes}:${checksum}`);

  function legacyChecksum(payload) {
    const input = `${LEGACY_SALT}:${STORAGE_KEY}:${stableStringify(payload)}`;
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function strip(payload) {
    const clean = { ...(payload || {}) };
    delete clean.__xyrexIntegrity;
    return clean;
  }

  function verifySealed(parsed, ledgerRaw) {
    const meta = parsed?.__xyrexIntegrity;
    if (!meta || meta.version !== SEAL_VERSION) return null;
    if (!Number.isInteger(meta.writes) || meta.writes < 1 || typeof meta.checksum !== 'string') return null;
    const clean = strip(parsed);
    if (meta.checksum !== checksumFor(clean, meta.writes)) return null;
    let ledger = null;
    try { ledger = JSON.parse(ledgerRaw); } catch { return null; }
    if (!ledger || ledger.writes !== meta.writes || ledger.mac !== ledgerMacFor(meta.writes, meta.checksum)) return null;
    return { data: clean, writes: meta.writes };
  }

  function verifyLegacy(parsed) {
    const meta = parsed?.__xyrexIntegrity;
    if (!meta || meta.version !== LEGACY_VERSION || typeof meta.checksum !== 'string') return null;
    const clean = strip(parsed);
    return meta.checksum === legacyChecksum(clean) ? { data: clean } : null;
  }

  function localDayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function clampClaimAmount(value) {
    if (!Number.isFinite(value)) return FREE_TOKEN_SHOP.minClaim;
    return Math.min(FREE_TOKEN_SHOP.maxClaim, Math.max(FREE_TOKEN_SHOP.minClaim, Math.trunc(value)));
  }

  function normalize(data) {
    const next = { ...(data || {}) };
    const today = localDayKey();
    if (next.aiTokenDate !== today) {
      next.aiTokenDate = today;
      next.aiTokensUsedToday = 0;
    }
    next.aiTokensUsedToday = Math.min(FREE_DAILY_TOKENS, Math.max(0, Math.trunc(Number(next.aiTokensUsedToday) || 0)));
    next.aiPurchasedTokens = Math.min(365, Math.max(0, Math.trunc(Number(next.aiPurchasedTokens) || 0)));
    next.freeTokenCooldownUntil = Math.min(nowMs() + FREE_TOKEN_SHOP.maxCooldownMs, Math.max(0, Number(next.freeTokenCooldownUntil) || 0));
    next.freeTokenLastClaimAmount = clampClaimAmount(Number(next.freeTokenLastClaimAmount) || FREE_TOKEN_SHOP.minClaim);
    // Session floors: a swapped-in save can never shorten a cooldown this
    // session already observed, nor refund free tokens already spent today.
    if (next.freeTokenCooldownUntil < cooldownFloor) next.freeTokenCooldownUntil = cooldownFloor;
    if (usedTodayFloorDate === today && next.aiTokensUsedToday < usedTodayFloor) next.aiTokensUsedToday = usedTodayFloor;
    return next;
  }

  function persist(data) {
    writeCounter += 1;
    const clean = strip(data);
    const checksum = checksumFor(clean, writeCounter);
    lastWrittenRaw = JSON.stringify({ ...clean, __xyrexIntegrity: { version: SEAL_VERSION, writes: writeCounter, checksum } });
    try {
      storageSet(STORAGE_KEY, lastWrittenRaw);
      storageSet(LEDGER_KEY, JSON.stringify({ writes: writeCounter, mac: ledgerMacFor(writeCounter, checksum) }));
    } catch {
      // Storage may be unavailable; the in-memory state stays authoritative.
    }
    memData = { ...clean };
  }

  function read() {
    let raw = null;
    let ledgerRaw = null;
    try {
      raw = storageGet(STORAGE_KEY);
      ledgerRaw = storageGet(LEDGER_KEY);
    } catch {}

    if (memData !== null) {
      if (raw === lastWrittenRaw) {
        memData = normalize(memData);
        return { ...memData };
      }
      // Storage changed underneath us. Adopt it only when it arrived through
      // a real cross-tab write AND still verifies; anything else is tampering
      // and gets replaced with this session's verified state.
      if (typeof raw === 'string' && externalWrites.has(raw)) {
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch {}
        const verified = parsed ? verifySealed(parsed, ledgerRaw) : null;
        if (verified) {
          writeCounter = Math.max(writeCounter, verified.writes);
          memData = normalize(verified.data);
          lastWrittenRaw = raw;
          return { ...memData };
        }
      }
      console.warn('Xyrex anticheat: AI token storage was modified outside the app — restoring verified state.');
      persist(normalize(memData));
      return { ...memData };
    }

    // First read of the session.
    if (typeof raw === 'string') {
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch {}
      if (parsed && typeof parsed === 'object') {
        const verified = verifySealed(parsed, ledgerRaw);
        if (verified) {
          writeCounter = verified.writes;
          memData = normalize(verified.data);
          lastWrittenRaw = raw;
          return { ...memData };
        }
        // One-time migration of a legacy v2 save from before the ledger existed.
        if (ledgerRaw === null) {
          const legacy = verifyLegacy(parsed);
          if (legacy) {
            persist(normalize(legacy.data));
            return { ...memData };
          }
        }
        console.warn('Xyrex anticheat blocked unverified AI token storage.');
      }
    }
    persist(normalize({}));
    return { ...memData };
  }

  function summarize(data) {
    const freeRemaining = Math.max(0, FREE_DAILY_TOKENS - data.aiTokensUsedToday);
    const purchased = Math.max(0, data.aiPurchasedTokens);
    return { available: freeRemaining + purchased, freeRemaining, purchased };
  }

  return Object.freeze({
    getSummary() {
      return summarize(read());
    },
    getShopStatus() {
      const data = read();
      const cooldownUntil = Math.max(0, Number(data.freeTokenCooldownUntil) || 0);
      const remainingMs = Math.max(0, cooldownUntil - nowMs());
      return {
        available: summarize(data).available,
        cooldownUntil,
        remainingMs,
        isReady: remainingMs <= 0
      };
    },
    claim(amountInput) {
      const rawAmount = Number(amountInput);
      if (!Number.isFinite(rawAmount)) {
        return { ok: false, reason: 'Please enter a valid number.' };
      }
      const amount = clampClaimAmount(rawAmount);
      if (amount !== Math.trunc(rawAmount)) {
        return { ok: false, reason: `Please enter a whole number between ${FREE_TOKEN_SHOP.minClaim} and ${FREE_TOKEN_SHOP.maxClaim}.` };
      }
      const data = read();
      const now = nowMs();
      const cooldownUntil = Math.max(0, Number(data.freeTokenCooldownUntil) || 0, cooldownFloor);
      if (cooldownUntil > now) {
        return { ok: false, reason: `You can claim free tokens again in ${formatDuration(cooldownUntil - now)}.` };
      }
      const cooldownMs = Math.round((amount / FREE_TOKEN_SHOP.maxClaim) * FREE_TOKEN_SHOP.maxCooldownMs);
      data.aiPurchasedTokens = Math.min(365, Math.max(0, data.aiPurchasedTokens) + amount);
      data.freeTokenLastClaimAmount = amount;
      data.freeTokenCooldownUntil = now + cooldownMs;
      cooldownFloor = data.freeTokenCooldownUntil;
      persist(data);
      return { ok: true, amount, cooldownMs };
    },
    consume() {
      const data = read();
      const freeRemaining = Math.max(0, FREE_DAILY_TOKENS - data.aiTokensUsedToday);
      const purchased = Math.max(0, data.aiPurchasedTokens);
      if (freeRemaining + purchased <= 0) return false;
      if (freeRemaining > 0) data.aiTokensUsedToday += 1;
      else data.aiPurchasedTokens = purchased - 1;
      usedTodayFloor = data.aiTokensUsedToday;
      usedTodayFloorDate = data.aiTokenDate;
      persist(data);
      return true;
    }
  });
})();

// Shared with new-ui.js; locked so console scripts cannot swap the vault out.
try {
  Object.defineProperty(window, 'XyrexTokenVault', { value: XyrexTokenVault, writable: false, configurable: false });
} catch {}

// Const bindings (not window properties) so console scripts can neither
// reassign these entry points nor reach anything beyond the vault API.
const getAiTokenSummary = () => XyrexTokenVault.getSummary();
const getFreeTokenShopStatus = () => XyrexTokenVault.getShopStatus();
const claimFreeTokens = amountInput => XyrexTokenVault.claim(amountInput);
const consumeAiTokenForAssistant = () => XyrexTokenVault.consume();

function openEarnTokensModal() {
  const status = getFreeTokenShopStatus();
  if (!status.isReady) {
    openNoAiTokensModal(`Free token claims are on cooldown. Time remaining: ${formatDuration(status.remainingMs)}.`);
    return;
  }
  const overlay = qs('#modalOverlay');
  const content = qs('#modalContent');
  if (!overlay || !content) return;
  setCompactModal(true);
  lastModalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  content.innerHTML = `
    <section class="discord-unavailable-modal" aria-live="polite">
      <div class="discord-unavailable-icon ai-token-unavailable-icon" aria-hidden="true"><span>+</span></div>
      <h2>Earn Free Tokens</h2>
      <p class="modal-headline">Choose a whole number from ${FREE_TOKEN_SHOP.minClaim} to ${FREE_TOKEN_SHOP.maxClaim}. Higher amounts apply a longer cooldown. Claiming ${FREE_TOKEN_SHOP.maxClaim} tokens sets a 1 week cooldown</p>
      <label class="settings-note" for="earnTokensAmountInput">Token amount</label>
      <input id="earnTokensAmountInput" type="number" min="${FREE_TOKEN_SHOP.minClaim}" max="${FREE_TOKEN_SHOP.maxClaim}" step="1" value="${FREE_TOKEN_SHOP.minClaim}" class="xy-amount-input">
      <div class="settings-actions settings-actions-centered">
        <button id="confirmEarnTokensBtn" class="btn-primary settings-action-btn" type="button">Claim Tokens</button>
      </div>
      <p id="earnTokensFeedback" class="settings-note" aria-live="polite"></p>
    </section>`;
  overlay.classList.remove('is-closing');
  overlay.setAttribute('aria-hidden', 'false');
  const amountInput = qs('#earnTokensAmountInput');
  const feedback = qs('#earnTokensFeedback');
  qs('#confirmEarnTokensBtn')?.addEventListener('click', () => {
    const claim = claimFreeTokens(amountInput?.value ?? '');
    if (!claim.ok) {
      if (feedback) feedback.textContent = claim.reason;
      return;
    }
    if (feedback) feedback.textContent = `Success. You earned ${claim.amount} token${claim.amount === 1 ? '' : 's'}. Cooldown: ${formatDuration(claim.cooldownMs)}.`;
    window.setTimeout(() => openSettingsModal(), 550);
  });
  amountInput?.focus();
}

const EXECUTOR_FILTERS_COLLAPSED_KEY = 'xyrex_executor_filters_collapsed';
const EXECUTOR_COLUMNS_KEY = 'xyrex_executor_columns';
const EXECUTOR_DENSITY_KEY = 'xyrex_executor_density';
const EXECUTOR_LEGEND_VISIBLE_KEY = 'xyrex_executor_legend_visible';

function getExecutorPreference(key, fallback) {
  const value = localStorage.getItem(key);
  return value === null ? fallback : value;
}

function getExecutorFiltersCollapsed() {
  return getExecutorPreference(EXECUTOR_FILTERS_COLLAPSED_KEY, 'false') === 'true';
}

function setExecutorFiltersCollapsed(collapsed) {
  localStorage.setItem(EXECUTOR_FILTERS_COLLAPSED_KEY, collapsed ? 'true' : 'false');
  applyExecutorTabPreferences();
}

function getExecutorColumnsPreference() {
  const value = getExecutorPreference(EXECUTOR_COLUMNS_KEY, 'auto');
  return ['auto', '2', '3'].includes(value) ? value : 'auto';
}

function setExecutorColumnsPreference(value) {
  localStorage.setItem(EXECUTOR_COLUMNS_KEY, ['auto', '2', '3'].includes(value) ? value : 'auto');
  applyExecutorTabPreferences();
}

function getExecutorDensityPreference() {
  const value = getExecutorPreference(EXECUTOR_DENSITY_KEY, 'comfortable');
  return value === 'compact' ? 'compact' : 'comfortable';
}

function setExecutorDensityPreference(value) {
  localStorage.setItem(EXECUTOR_DENSITY_KEY, value === 'compact' ? 'compact' : 'comfortable');
  applyExecutorTabPreferences();
}

function getExecutorLegendVisible() {
  return getExecutorPreference(EXECUTOR_LEGEND_VISIBLE_KEY, 'true') !== 'false';
}

function setExecutorLegendVisible(visible) {
  localStorage.setItem(EXECUTOR_LEGEND_VISIBLE_KEY, visible ? 'true' : 'false');
  applyExecutorTabPreferences();
}

function applyExecutorTabPreferences() {
  const filtersCollapsed = getExecutorFiltersCollapsed();
  const columns = getExecutorColumnsPreference();
  const density = getExecutorDensityPreference();
  const legendVisible = getExecutorLegendVisible();
  document.body.classList.toggle('executor-filters-collapsed', filtersCollapsed);
  document.body.classList.toggle('executor-cards-compact', density === 'compact');
  document.body.classList.toggle('executor-legend-hidden', !legendVisible);
  document.body.setAttribute('data-executor-columns', filtersCollapsed ? '3' : columns);
  const sidebar = qs('#sidebar');
  if (sidebar) sidebar.setAttribute('aria-hidden', filtersCollapsed ? 'true' : 'false');
}

function getBetaFeaturesEnabled() {
  return localStorage.getItem('xyrex_beta_features') === 'enabled';
}

function setBetaFeaturesEnabled(enabled) {
  localStorage.setItem('xyrex_beta_features', enabled ? 'enabled' : 'disabled');
  document.body.classList.toggle('beta-features-enabled', enabled);
}

function openSettingsModal() {
  const overlay = qs('#modalOverlay');
  const content = qs('#modalContent');
  setCompactModal(false);
  const tokenSummary = getAiTokenSummary();
  content.innerHTML = `
    <section class="settings-modal">
      <header class="settings-modal-head">
        <h2>Settings</h2>
        <p class="modal-headline">Manage interface preferences and review your AI token balance</p>
      </header>
      <div class="settings-group">
        <h3>Interface</h3>
        <div class="settings-actions">
          <button id="settingsUiModeBtn" class="btn-primary settings-action-btn" type="button">${isNewUiMode ? 'Switch to Default UI' : 'Switch to New UI'}</button>
          <button id="settingsThemeCustomizerBtn" class="btn-primary settings-action-btn" type="button" ${isNewUiMode ? '' : 'disabled'}>Theme Customizer</button>
        </div>
        <p class="settings-note">Theme Customizer is available when New UI mode is active</p>
      </div>
      <div class="settings-group">
        <h3>Executors Tab</h3>
        <div class="settings-actions">
          <button id="settingsCollapseFiltersBtn" class="btn-primary settings-action-btn" type="button">${getExecutorFiltersCollapsed() ? 'Restore Filters' : 'Collapse Filters'}</button>
          <button id="settingsLegendToggleBtn" class="btn-primary settings-action-btn" type="button">${getExecutorLegendVisible() ? 'Hide Legend' : 'Show Legend'}</button>
          <button id="settingsDensityToggleBtn" class="btn-primary settings-action-btn" type="button">${getExecutorDensityPreference() === 'compact' ? 'Comfortable Cards' : 'Compact Cards'}</button>
        </div>
        <label class="settings-field" for="settingsExecutorColumnsSelect">
          <span>Executor cards per row</span>
          <select id="settingsExecutorColumnsSelect" class="settings-select">
            <option value="auto" ${getExecutorColumnsPreference() === 'auto' ? 'selected' : ''}>Automatic</option>
            <option value="2" ${getExecutorColumnsPreference() === '2' ? 'selected' : ''}>2 per row</option>
            <option value="3" ${getExecutorColumnsPreference() === '3' ? 'selected' : ''}>3 per row</option>
          </select>
        </label>
        <p class="settings-note">Collapse Filters completely removes the filters sidebar and automatically uses 3 executor cards per row on wider screens.</p>
      </div>
      <div class="settings-group">
        <h3>Games</h3>
        <div class="settings-actions">
          <button id="settingsDodgeBtn" class="btn-primary settings-action-btn" type="button">Open Dodge</button>
        </div>
        <p class="settings-note">Launch the built-in Dodge game from settings.</p>
      </div>
      <div class="settings-group">
        <h3>AI Usage</h3>
        <p class="settings-token-count">Available AI tokens: <strong>${tokenSummary.available}</strong></p>
        <div class="settings-actions settings-earn-tokens-action">
          <button id="settingsEarnTokensBtn" class="btn-primary settings-action-btn" type="button">Earn Tokens</button>
        </div>
        <p class="settings-note">Claim 1-30 free tokens. Higher amounts apply a longer cooldown</p>
        <p class="settings-note" id="settingsCooldownNote"></p>
      </div>
      <footer class="settings-credit">Made by plutoxqq and slick012</footer>
    </section>`;

  overlay.classList.remove('is-closing');
  overlay.setAttribute('aria-hidden', 'false');

  const uiModeBtn = qs('#settingsUiModeBtn');
  uiModeBtn?.addEventListener('click', async () => {
    isNewUiMode = !isNewUiMode;
    localStorage.setItem(uiModeStorageKey, isNewUiMode ? 'new' : 'default');
    await applyUiMode();
    syncRouteWithState();
    openSettingsModal();
  });

  const collapseFiltersBtn = qs('#settingsCollapseFiltersBtn');
  collapseFiltersBtn?.addEventListener('click', () => {
    setExecutorFiltersCollapsed(!getExecutorFiltersCollapsed());
    openSettingsModal();
  });

  const legendToggleBtn = qs('#settingsLegendToggleBtn');
  legendToggleBtn?.addEventListener('click', () => {
    setExecutorLegendVisible(!getExecutorLegendVisible());
    openSettingsModal();
  });

  const densityToggleBtn = qs('#settingsDensityToggleBtn');
  densityToggleBtn?.addEventListener('click', () => {
    setExecutorDensityPreference(getExecutorDensityPreference() === 'compact' ? 'comfortable' : 'compact');
    openSettingsModal();
  });

  const columnsSelect = qs('#settingsExecutorColumnsSelect');
  columnsSelect?.addEventListener('change', event => {
    setExecutorColumnsPreference(event.target.value);
  });

  const dodgeBtn = qs('#settingsDodgeBtn');
  dodgeBtn?.addEventListener('click', () => {
    window.location.href = '/dodge.html';
  });

  const earnTokensBtn = qs('#settingsEarnTokensBtn');
  const cooldownNote = qs('#settingsCooldownNote');
  if (settingsCooldownTimerId) window.clearInterval(settingsCooldownTimerId);
  const updateCooldownNote = () => {
    if (!cooldownNote) return;
    const status = getFreeTokenShopStatus();
    cooldownNote.textContent = status.isReady ? 'Free token claim is ready now.' : `Next free claim in ${formatDuration(status.remainingMs)}.`;
  };
  updateCooldownNote();
  settingsCooldownTimerId = window.setInterval(updateCooldownNote, 1000);
  earnTokensBtn?.addEventListener('click', openEarnTokensModal);

  const themeBtn = qs('#settingsThemeCustomizerBtn');
  themeBtn?.addEventListener('click', () => {
    if (!isNewUiMode || !window.XyrexNewUI?.toggleThemeCustomizer) return;
    window.XyrexNewUI.toggleThemeCustomizer();
  });

  qs('#modalCloseBtn').focus();
}

function openNoAiTokensModal(message = NO_ASSISTANT_TOKENS_MESSAGE) {
  const overlay = qs('#modalOverlay');
  const content = qs('#modalContent');
  if (!overlay || !content) return;

  setCompactModal(true);
  lastModalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  content.innerHTML = `
    <section class="discord-unavailable-modal ai-token-unavailable-modal" aria-live="polite">
      <div class="discord-unavailable-icon ai-token-unavailable-icon" aria-hidden="true">
        <span>!</span>
      </div>
      <h2>AI Tokens Unavailable</h2>
      <p class="modal-headline">${escapeHtml(message)}</p>
    </section>`;

  overlay.classList.remove('is-closing');
  overlay.setAttribute('aria-hidden', 'false');
  qs('#modalCloseBtn').focus();
}

function closeModal() {
  const overlay = qs('#modalOverlay');
  if (overlay.getAttribute('aria-hidden') === 'true') return;

  overlay.classList.add('is-closing');
  window.setTimeout(() => {
    if (!overlay.classList.contains('is-closing')) return;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('is-closing');
    if (settingsCooldownTimerId) {
      window.clearInterval(settingsCooldownTimerId);
      settingsCooldownTimerId = null;
    }
    qs('#modalContent').innerHTML = '';
    setCompactModal(false);
    if (lastModalTrigger && typeof lastModalTrigger.focus === 'function') lastModalTrigger.focus();
    lastModalTrigger = null;
  }, 190);
}

function detectionRiskScore(product) {
  let score = trustRiskMap[product.trustLevel] ?? 7;
  const status = String(product.status || '').toLowerCase();
  if (status.includes('detected')) score += 2;
  if (status.includes('down')) score += 2;
  if (status.includes('issue')) score += 1;
  if (status.includes('undetected')) score -= 1;
  return Math.max(1, Math.min(10, score));
}

function detectionRiskLabel(product) {
  const score = detectionRiskScore(product);
  if (score <= 3) return 'Low';
  if (score <= 6) return 'Medium';
  return 'High';
}

function estimatedPriceValue(product) {
  const joined = (product.pricingOptions || []).join(' ');
  const numbers = (joined.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(Number.isFinite);
  if (!numbers.length) return product.freeOrPaid === 'free' ? 0 : 999;
  return Math.min(...numbers);
}

const ExecutorScoring = (() => {
  const clamp = value => Math.max(0, Math.min(100, Math.round(value)));
  const list = value => (Array.isArray(value) ? value.filter(Boolean).map(String) : []);
  const has = value => value !== null && value !== undefined && String(value).trim() !== '';
  const mapValue = (value, map) => map[String(value || '').toLowerCase()] ?? null;

  const trustMap = { high: 96, trusted: 96, medium: 68, caution: 68, low: 36, risky: 36, unknown: 52 };
  const stabilityMap = { 'very stable': 100, stable: 92, high: 96, medium: 72, mixed: 62, basic: 48, questionable: 34, low: 46, unstable: 30, unknown: 42 };

  const weighted = parts => {
    const usable = parts.filter(part => part && Number.isFinite(part.value));
    if (!usable.length) return null;
    const totalWeight = usable.reduce((sum, part) => sum + part.weight, 0);
    return clamp(usable.reduce((sum, part) => sum + part.value * part.weight, 0) / totalWeight);
  };

  const stability = product => mapValue(product.stability, stabilityMap);
  const sunc = product => (Number.isFinite(product.sunc) ? clamp(product.sunc) : null);

  const safety = product => weighted([
    { value: mapValue(product.trustLevel, trustMap), weight: 0.52 },
    { value: stability(product), weight: 0.28 },
    { value: has(product.status) || has(product.trustLevel) ? (10 - detectionRiskScore(product)) * 10 : null, weight: 0.2 }
  ]);

  const power = product => weighted([
    { value: sunc(product), weight: 0.65 },
    { value: list(product.features).length ? Math.min(100, list(product.features).length * 14) : null, weight: 0.2 },
    { value: has(product.cheatType) ? (/internal/i.test(product.cheatType) ? 92 : 72) : null, weight: 0.15 }
  ]);

  const value = product => {
    const price = estimatedPriceValue(product);
    const hasPricing = list(product.pricingOptions).length || has(product.freeOrPaid);
    return weighted([
      { value: power(product), weight: 0.4 },
      { value: safety(product), weight: 0.28 },
      { value: !hasPricing ? null : price <= 0 ? 100 : Math.max(18, 100 - price * 2.4), weight: 0.32 }
    ]);
  };

  const overall = product => {
    const scores = [safety(product), power(product), value(product), stability(product)].filter(Number.isFinite);
    return scores.length ? clamp(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
  };

  const coverage = product => [
    product.name,
    list(product.platform).length ? product.platform : '',
    product.cheatType,
    product.keySystem,
    product.freeOrPaid,
    product.stability,
    product.trustLevel,
    product.status,
    Number.isFinite(product.sunc) ? product.sunc : '',
    list(product.pricingOptions).length ? product.pricingOptions : '',
    list(product.tags).length ? product.tags : '',
    list(product.pros).length ? product.pros : '',
    list(product.cons).length ? product.cons : ''
  ].filter(has).length;

  const confidence = product => {
    const score = coverage(product);
    if (score >= 10) return 'High';
    if (score >= 7) return 'Medium';
    return 'Low';
  };

  const risk = product => (has(product.status) || has(product.trustLevel) ? detectionRiskScore(product) : null);

  return Object.freeze({ clamp, list, has, safety, power, value, stability, sunc, overall, coverage, confidence, risk });
})();

function getExecutorSignals(product) {
  const signals = [];
  if (Number.isFinite(product.sunc)) signals.push(`sUNC ${product.sunc}%`);
  if (ExecutorScoring.has(product.trustLevel) && product.trustLevel !== 'Unknown') signals.push(`${product.trustLevel} trust`);
  if (ExecutorScoring.has(product.stability) && product.stability !== 'Unknown') signals.push(product.stability);

  const liveStatus = getWeaoStatusLabel(product.weaoStatus);
  if (liveStatus !== 'Unknown') signals.push(`Live: ${liveStatus}`);
  else if (ExecutorScoring.has(product.status) && product.status !== 'Unknown') signals.push(product.status);

  if (/keyless/i.test(product.keySystem || '')) signals.push('Keyless');
  if (product.freeOrPaid === 'free') signals.push('Free');
  else if (product.freeOrPaid === 'both') signals.push('Free tier');

  const features = ExecutorScoring.list(product.features);
  if (features.length) signals.push(`${features.length} feature${features.length === 1 ? '' : 's'}`);

  return signals;
}

const SMART_RANKING_SCOPES = [
  { id: 'all', label: 'All platforms', match: () => true },
  { id: 'windows', label: 'Windows', match: product => (product.platform || []).some(item => /windows/i.test(item)) },
  { id: 'mobile', label: 'Mobile', match: product => (product.platform || []).some(item => /android|ios/i.test(item)) },
  { id: 'macos', label: 'macOS', match: product => (product.platform || []).some(item => /mac/i.test(item)) }
];

const SMART_RANKING_CATEGORIES = [
  {
    id: 'bestOverall',
    title: 'Best Overall',
    blurb: 'Averaged across safety, capability, value, and stability',
    filter: () => true,
    score: product => ExecutorScoring.overall(product)
  },
  {
    id: 'safest',
    title: 'Safest Right Now',
    blurb: 'Weighted toward trust level, then stability and detection risk',
    filter: () => true,
    score: product => ExecutorScoring.safety(product)
  },
  {
    id: 'bestFree',
    title: 'Best Free Option',
    blurb: 'Best capability-per-cost among executors with a free tier',
    filter: product => ['free', 'both'].includes(String(product.freeOrPaid || '').toLowerCase()),
    score: product => ExecutorScoring.value(product)
  },
  {
    id: 'bestPaid',
    title: 'Best Paid Pick',
    blurb: 'Highest overall score among executors with no free tier',
    filter: product => String(product.freeOrPaid || '').toLowerCase() === 'paid',
    score: product => ExecutorScoring.overall(product)
  },
  {
    id: 'bestKeyless',
    title: 'Best Keyless',
    blurb: 'Top overall score among executors with no key system',
    filter: product => /keyless/i.test(product.keySystem || ''),
    score: product => ExecutorScoring.overall(product)
  },
  {
    id: 'mostStable',
    title: 'Most Stable',
    blurb: 'Ranked purely on the listed stability rating',
    filter: product => Number.isFinite(ExecutorScoring.stability(product)),
    score: product => ExecutorScoring.stability(product)
  },
  {
    id: 'mostPowerful',
    title: 'Most Powerful',
    blurb: 'Weighted toward sUNC coverage, then features and execution type',
    filter: product => Number.isFinite(ExecutorScoring.power(product)),
    score: product => ExecutorScoring.power(product)
  },
  {
    id: 'highestRisk',
    title: 'Highest Risk',
    blurb: 'Listed here so you can avoid them, not pick them',
    filter: product => Number.isFinite(ExecutorScoring.risk(product)),
    score: product => ExecutorScoring.risk(product) * 10,
    invertScoreLabel: true
  }
];

const SMART_RANKING_SCOPE_KEY = 'xyrex_ranking_scope';
let smartRankingScope = 'all';

function computeSmartRanking() {
  const scope = SMART_RANKING_SCOPES.find(item => item.id === smartRankingScope) || SMART_RANKING_SCOPES[0];
  const pool = products.filter(scope.match);

  const categories = SMART_RANKING_CATEGORIES.map(category => {
    const ranked = pool
      .filter(category.filter)
      .map(product => ({ product, score: category.score(product) }))
      .filter(item => Number.isFinite(item.score))
      .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
      .slice(0, 3);

    return {
      id: category.id,
      title: category.title,
      blurb: category.blurb,
      invertScoreLabel: Boolean(category.invertScoreLabel),
      entries: ranked.map(item => ({
        product: item.product,
        score: ExecutorScoring.clamp(item.score),
        confidence: ExecutorScoring.confidence(item.product),
        signals: getExecutorSignals(item.product),
        breakdown: {
          Safety: ExecutorScoring.safety(item.product),
          Power: ExecutorScoring.power(item.product),
          Value: ExecutorScoring.value(item.product)
        }
      }))
    };
  });

  const leaderboard = pool
    .map(product => ({ product, score: ExecutorScoring.overall(product) }))
    .filter(item => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
    .slice(0, 10);

  const winCounts = new Map();
  categories.forEach(category => {
    const winner = category.entries[0];
    if (!winner || category.invertScoreLabel) return;
    winCounts.set(winner.product.name, (winCounts.get(winner.product.name) || 0) + 1);
  });
  const scoredCategoryCount = categories.filter(category => !category.invertScoreLabel && category.entries.length).length;
  const [dominantName, dominantWins] = [...winCounts.entries()].sort((a, b) => b[1] - a[1])[0] || [];

  return {
    scopeLabel: scope.label,
    poolSize: pool.length,
    categories,
    leaderboard,
    dominance: dominantWins >= 3 ? { name: dominantName, wins: dominantWins, total: scoredCategoryCount } : null
  };
}

function renderRankingLeaderboard(leaderboard) {
  if (!leaderboard.length) return '';
  return `
    <section class="ranking-leaderboard" aria-label="Overall executor leaderboard">
      <div class="ranking-leaderboard-head">
        <h4>Overall leaderboard</h4>
        <span>Top ${leaderboard.length} by combined safety, capability, value, and stability</span>
      </div>
      <ol class="ranking-leaderboard-list">
        ${leaderboard.map((entry, index) => `
          <li>
            <button type="button" data-ranking-executor="${escapeHtml(entry.product.name)}">
              <span class="ranking-leaderboard-rank">${index + 1}</span>
              <span class="ranking-leaderboard-name">${escapeHtml(entry.product.name)}</span>
              <span class="ranking-leaderboard-signals">${getExecutorSignals(entry.product).slice(0, 3).map(signal => `<span>${escapeHtml(signal)}</span>`).join('')}</span>
              <span class="ranking-leaderboard-track"><span style="width:${entry.score}%"></span></span>
              <strong>${entry.score}</strong>
            </button>
          </li>`).join('')}
      </ol>
    </section>`;
}

function renderSmartRankingCard(category) {
  if (!category.entries.length) {
    return `
      <article class="smart-ranking-card is-empty">
        <div class="smart-ranking-card-top"><span class="smart-ranking-card-title">${escapeHtml(category.title)}</span></div>
        <p class="smart-ranking-blurb">${escapeHtml(category.blurb)}</p>
        <p class="smart-ranking-empty">No listed executor has the data needed for this ranking in the current scope</p>
      </article>`;
  }

  const [winner, ...runnersUp] = category.entries;
  const scoreLabel = category.invertScoreLabel ? 'Risk' : 'Score';
  const scoreValue = category.invertScoreLabel ? `${Math.round(winner.score / 10)}/10` : `${winner.score}/100`;
  const bars = Object.entries(winner.breakdown)
    .filter(([, value]) => Number.isFinite(value))
    .map(([label, value]) => `
      <div class="smart-ranking-bar">
        <span>${escapeHtml(label)}</span>
        <span class="smart-ranking-bar-track"><span class="smart-ranking-bar-fill" style="width:${value}%"></span></span>
        <strong>${value}</strong>
      </div>`).join('');

  return `
    <article class="smart-ranking-card${category.invertScoreLabel ? ' is-caution' : ''}">
      <div class="smart-ranking-card-top">
        <span class="smart-ranking-card-title">${escapeHtml(category.title)}</span>
        <span class="smart-ranking-confidence">${escapeHtml(winner.confidence)} confidence</span>
      </div>
      <p class="smart-ranking-blurb">${escapeHtml(category.blurb)}</p>

      <button class="smart-ranking-winner" type="button" data-ranking-executor="${escapeHtml(winner.product.name)}">
        <span class="smart-ranking-rank">1</span>
        <span class="smart-ranking-executor">${escapeHtml(winner.product.name)}</span>
        <span class="smart-ranking-score"><small>${escapeHtml(scoreLabel)}</small>${escapeHtml(scoreValue)}</span>
      </button>

      ${winner.signals.length ? `<div class="smart-ranking-signals">${winner.signals.map(signal => `<span>${escapeHtml(signal)}</span>`).join('')}</div>` : ''}
      ${bars ? `<div class="smart-ranking-bars">${bars}</div>` : ''}

      ${runnersUp.length ? `
        <div class="smart-ranking-runners">
          <span class="smart-ranking-runners-label">Runners-up</span>
          ${runnersUp.map((entry, index) => `
            <button class="smart-ranking-runner" type="button" data-ranking-executor="${escapeHtml(entry.product.name)}">
              <span class="smart-ranking-rank">${index + 2}</span>
              <span>${escapeHtml(entry.product.name)}</span>
              <strong>${category.invertScoreLabel ? `${Math.round(entry.score / 10)}/10` : entry.score}</strong>
            </button>`).join('')}
        </div>` : ''}
    </article>`;
}

function renderSmartRankings() {
  const wrap = qs('#smartRankingSections');
  if (!wrap) return;
  const ranking = computeSmartRanking();

  wrap.innerHTML = `
    <div class="smart-ranking-dashboard" aria-label="Smart rankings dashboard">
      <div class="smart-ranking-dashboard-head">
        <p class="smart-ranking-intro">Rankings are recomputed from the executor metadata on this site every time the page loads. Executors missing a field are left out of the rankings that need it rather than guessed at.</p>
        <div class="smart-ranking-scopes" role="group" aria-label="Ranking platform scope">
          ${SMART_RANKING_SCOPES.map(scope => `<button class="script-filter-chip ${scope.id === smartRankingScope ? 'is-active' : ''}" type="button" data-ranking-scope="${scope.id}" aria-pressed="${scope.id === smartRankingScope}">${escapeHtml(scope.label)}</button>`).join('')}
        </div>
        <p class="smart-ranking-kicker">Scored across ${ranking.poolSize} executor${ranking.poolSize === 1 ? '' : 's'} matching ${escapeHtml(ranking.scopeLabel)}</p>
        ${ranking.dominance ? `<p class="smart-ranking-dominance">${escapeHtml(ranking.dominance.name)} currently tops ${ranking.dominance.wins} of the ${ranking.dominance.total} scored categories below, so the runners-up are where the alternatives are</p>` : ''}
      </div>
      ${renderRankingLeaderboard(ranking.leaderboard)}
      <div class="smart-ranking-grid">
        ${ranking.categories.map(renderSmartRankingCard).join('')}
      </div>
    </div>`;

  if (wrap.dataset.rankingsBound === 'true') return;
  wrap.addEventListener('click', event => {
    const scopeButton = event.target.closest('[data-ranking-scope]');
    if (scopeButton) {
      smartRankingScope = scopeButton.getAttribute('data-ranking-scope') || 'all';
      localStorage.setItem(SMART_RANKING_SCOPE_KEY, smartRankingScope);
      renderSmartRankings();
      return;
    }
    const executorButton = event.target.closest('[data-ranking-executor]');
    if (!executorButton) return;
    const product = products.find(item => item.name === executorButton.getAttribute('data-ranking-executor'));
    if (product) openModal(product);
  });
  wrap.dataset.rankingsBound = 'true';
}

let comparisonSelection = [];
let comparisonSearchTerm = '';
let comparisonFilter = 'all';
let comparisonShowAllRows = false;

const COMPARISON_MAX = 3;

function getComparisonRows(selectedProducts) {
  const stabilityValues = selectedProducts.map(item => stabilityScoreMap[item.stability] || 0);
  const riskValues = selectedProducts.map(item => detectionRiskScore(item));
  const priceValues = selectedProducts.map(item => estimatedPriceValue(item));

  return [
    {
      label: 'Overall score',
      values: selectedProducts.map(item => ExecutorScoring.overall(item) ?? -1),
      display: selectedProducts.map(item => { const score = ExecutorScoring.overall(item); return Number.isFinite(score) ? `${score}/100` : 'Unknown'; }),
      best: 'max'
    },
    {
      label: 'Live status',
      values: selectedProducts.map(item => (getWeaoStatusState(item.weaoStatus) === 'up' ? 1 : 0)),
      display: selectedProducts.map(item => getWeaoStatusLabel(item.weaoStatus)),
      best: null
    },
    { label: 'sUNC', values: selectedProducts.map(item => (Number.isFinite(item.sunc) ? item.sunc : -1)), display: selectedProducts.map(item => (Number.isFinite(item.sunc) ? `${item.sunc}%` : 'None')), best: 'max' },
    { label: 'Stability', values: stabilityValues, display: selectedProducts.map(item => item.stability || 'Unknown'), best: 'max' },
    { label: 'Detection Risk', values: riskValues, display: selectedProducts.map((item, index) => `${detectionRiskLabel(item)} (${riskValues[index]}/10)`), best: 'min' },
    { label: 'Price', values: priceValues, display: selectedProducts.map(item => cleanMalformedPriceText(item.pricingOptions?.[0] || item.freeOrPaid || 'Unknown')), best: 'min' },
    { label: 'Platform', values: selectedProducts.map(item => (item.platform || []).length), display: selectedProducts.map(item => (item.platform || []).join(', ') || 'Unknown'), best: 'max' },
    { label: 'Key System', values: selectedProducts.map(item => (/keyless/i.test(item.keySystem || '') ? 1 : 0)), display: selectedProducts.map(item => item.keySystem || 'Unknown'), best: 'max' },
    { label: 'Cheat Type', values: selectedProducts.map(item => (/internal/i.test(item.cheatType || '') ? 1 : 0)), display: selectedProducts.map(item => item.cheatType || 'Unknown'), best: null },
    { label: 'Listed Status', values: selectedProducts.map(item => (/undetected|working/i.test(item.status || '') ? 1 : 0)), display: selectedProducts.map(item => item.status || 'Unknown'), best: null },
    { label: 'Trust Level', values: selectedProducts.map(item => ({ high: 3, trusted: 3, medium: 2, caution: 2, low: 0, risky: 0 }[String(item.trustLevel || '').toLowerCase()] ?? 1)), display: selectedProducts.map(item => item.trustLevel || 'Unknown'), best: 'max' },
    { label: 'Features', values: selectedProducts.map(item => (item.features || []).length), display: selectedProducts.map(item => (item.features || []).join(', ') || 'None listed'), best: 'max' },
    { label: 'Pros', values: selectedProducts.map(() => 0), display: selectedProducts.map(item => (item.pros || []).slice(0, 3).join(', ') || 'None listed'), best: null },
    { label: 'Cons', values: selectedProducts.map(() => 0), display: selectedProducts.map(item => (item.cons || []).slice(0, 3).join(', ') || 'None listed'), best: null }
  ];
}

function buildComparisonMarkdown(selectedProducts, rows) {
  const header = `| Metric | ${selectedProducts.map(item => item.name).join(' | ')} |`;
  const divider = `| --- | ${selectedProducts.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${row.label} | ${row.display.join(' | ')} |`).join('\n');
  return `Xyrex executor comparison\n\n${header}\n${divider}\n${body}\n\nCompare these yourself: ${window.location.origin}/scripthub?compare=${encodeURIComponent(selectedProducts.map(item => item.name).join(','))}`;
}

function renderComparisonSystem() {
  const selector = qs('#comparisonSelector');
  const tableWrap = qs('#comparisonTableWrap');
  const table = qs('#comparisonTable');
  const selectedRow = qs('#comparisonSelectedRow');
  const winnerSummary = qs('#comparisonWinnerSummary');
  const verdictsWrap = qs('#comparisonVerdicts');
  const searchInput = qs('#comparisonSearchInput');
  const filterWrap = qs('#comparisonFilterChips');
  if (!selector || !tableWrap || !table || !selectedRow || !winnerSummary || !verdictsWrap || !searchInput || !filterWrap) return;

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'windows', label: 'Windows' },
    { id: 'mobile', label: 'Mobile' },
    { id: 'free', label: 'Free' },
    { id: 'paid', label: 'Paid' },
    { id: 'keyless', label: 'Keyless' },
    { id: 'highsunc', label: 'High sUNC' }
  ];
  filterWrap.innerHTML = filters.map(filter => `<button type="button" class="comparison-filter-chip ${comparisonFilter === filter.id ? 'is-active' : ''}" data-compare-filter="${filter.id}">${escapeHtml(filter.label)}</button>`).join('');
  filterWrap.querySelectorAll('[data-compare-filter]').forEach(button => {
    button.addEventListener('click', () => {
      comparisonFilter = button.getAttribute('data-compare-filter') || 'all';
      renderComparisonSystem();
    });
  });
  if (!searchInput.dataset.bound) {
    searchInput.addEventListener('input', () => {
      comparisonSearchTerm = searchInput.value.trim().toLowerCase();
      renderComparisonSystem();
    });
    searchInput.dataset.bound = 'true';
  }
  if (searchInput.value !== comparisonSearchTerm) searchInput.value = comparisonSearchTerm;

  const filterMatch = product => {
    if (comparisonSearchTerm && !product.name.toLowerCase().includes(comparisonSearchTerm)) return false;
    if (comparisonFilter === 'windows') return (product.platform || []).some(item => String(item).toLowerCase().includes('windows'));
    if (comparisonFilter === 'mobile') return (product.platform || []).some(item => /(android|ios|mobile)/i.test(String(item)));
    if (comparisonFilter === 'free') return ['free', 'both'].includes(product.freeOrPaid);
    if (comparisonFilter === 'paid') return ['paid', 'both'].includes(product.freeOrPaid);
    if (comparisonFilter === 'keyless') return String(product.keySystem || '').toLowerCase() === 'keyless';
    if (comparisonFilter === 'highsunc') return Number.isFinite(product.sunc) && product.sunc >= 90;
    return true;
  };

  const isFull = comparisonSelection.length >= COMPARISON_MAX;
  const sorted = [...products].filter(filterMatch).sort((a, b) => a.name.localeCompare(b.name));
  selector.innerHTML = sorted.length
    ? sorted.map(product => {
      const selected = comparisonSelection.includes(product.name);
      const sunc = Number.isFinite(product.sunc) ? `<span class="compare-pick-sunc">${product.sunc}%</span>` : '';
      return `<button type="button" class="compare-pick ${selected ? 'is-active' : ''}" data-compare-name="${escapeHtml(product.name)}" aria-pressed="${selected}"${!selected && isFull ? ' disabled' : ''}>${escapeHtml(product.name)}${sunc}</button>`;
    }).join('')
    : '<p class="comparison-selector-empty">No executors match that search or filter</p>';

  selector.querySelectorAll('[data-compare-name]').forEach(button => {
    button.addEventListener('click', () => {
      const name = button.getAttribute('data-compare-name');
      if (!name) return;
      if (comparisonSelection.includes(name)) {
        comparisonSelection = comparisonSelection.filter(item => item !== name);
      } else if (comparisonSelection.length < COMPARISON_MAX) {
        comparisonSelection = [...comparisonSelection, name];
      }
      renderComparisonSystem();
    });
  });

  const slotText = `${comparisonSelection.length} of ${COMPARISON_MAX} selected`;
  selectedRow.innerHTML = comparisonSelection.length
    ? `<span class="comparison-selected-label">${escapeHtml(slotText)}</span>${comparisonSelection.map(name => `<button class="comparison-selected-chip" type="button" data-compare-remove="${escapeHtml(name)}" title="Remove ${escapeHtml(name)}">${escapeHtml(name)}<span aria-hidden="true">✕</span></button>`).join('')}<button class="comparison-clear-btn" type="button" data-compare-clear="true">Clear all</button>`
    : '<span class="comparison-selected-label">Pick 2 or 3 executors below to compare them</span>';

  selectedRow.querySelectorAll('[data-compare-remove]').forEach(button => {
    button.addEventListener('click', () => {
      comparisonSelection = comparisonSelection.filter(item => item !== button.getAttribute('data-compare-remove'));
      renderComparisonSystem();
    });
  });
  selectedRow.querySelector('[data-compare-clear]')?.addEventListener('click', () => {
    comparisonSelection = [];
    renderComparisonSystem();
  });

  const selectedProducts = comparisonSelection
    .map(name => products.find(item => item.name === name))
    .filter(Boolean)
    .slice(0, COMPARISON_MAX);

  if (selectedProducts.length < 2) {
    tableWrap.hidden = true;
    winnerSummary.hidden = true;
    verdictsWrap.hidden = true;
    winnerSummary.innerHTML = '';
    verdictsWrap.innerHTML = '';
    table.innerHTML = '';
    return;
  }

  const allRows = getComparisonRows(selectedProducts);
  const isUninformative = row => row.display.every(value => /^(unknown|none|none listed)$/i.test(String(value).trim()));
  const hiddenRows = allRows.filter(isUninformative);
  const rows = comparisonShowAllRows ? allRows : allRows.filter(row => !isUninformative(row));

  const winnerIndexes = values => {
    const valid = values.filter(Number.isFinite);
    if (!valid.length) return [];
    const max = Math.max(...valid);
    return values.filter(value => value === max).length === 1 ? [values.findIndex(value => value === max)] : [];
  };
  const winnerIndexesMin = values => {
    const valid = values.filter(Number.isFinite);
    if (!valid.length) return [];
    const min = Math.min(...valid);
    return values.filter(value => value === min).length === 1 ? [values.findIndex(value => value === min)] : [];
  };

  const cell = (value, best) => `<td class="${best ? 'is-best' : ''}">${escapeHtml(String(value))}${best ? '<span class="best-label">Best</span>' : ''}</td>`;
  const winsPerProduct = selectedProducts.map(() => 0);

  const bodyRows = rows.map(row => {
    const winners = row.best === 'max' ? winnerIndexes(row.values) : row.best === 'min' ? winnerIndexesMin(row.values) : [];
    winners.forEach(index => { winsPerProduct[index] += 1; });
    return `<tr><th>${escapeHtml(row.label)}</th>${row.display.map((value, index) => cell(value, winners.includes(index))).join('')}</tr>`;
  }).join('');

  table.innerHTML = `
    <thead>
      <tr>
        <th>Metric</th>
        ${selectedProducts.map(item => `<th>${escapeHtml(item.name)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>`;

  const overallScores = selectedProducts.map(item => ExecutorScoring.overall(item));
  const scored = overallScores.filter(Number.isFinite);
  const leadIndex = scored.length
    ? overallScores.indexOf(Math.max(...scored))
    : winsPerProduct.indexOf(Math.max(...winsPerProduct));
  const leader = selectedProducts[leadIndex];
  const leaderScore = overallScores[leadIndex];
  const isTie = scored.length > 1 && scored.filter(score => score === Math.max(...scored)).length > 1;

  winnerSummary.hidden = false;
  winnerSummary.innerHTML = `
    <div class="comparison-winner-main">
      <strong>${isTie ? 'Too close to call' : `${escapeHtml(leader.name)} leads this comparison`}</strong>
      <span>${isTie
        ? 'These executors score the same overall on the data listed here'
        : `Overall score ${Number.isFinite(leaderScore) ? `${leaderScore}/100` : 'unavailable'}, winning ${winsPerProduct[leadIndex]} of ${rows.filter(row => row.best).length} scored metrics`}</span>
    </div>
    <div class="comparison-winner-actions">
      ${hiddenRows.length ? `<button class="btn-ghost-outline" type="button" data-compare-toggle-rows="true">${comparisonShowAllRows ? 'Hide' : 'Show'} ${hiddenRows.length} unknown-only row${hiddenRows.length === 1 ? '' : 's'}</button>` : ''}
      <button class="btn-ghost-outline" type="button" data-compare-copy="true">Copy comparison</button>
      <button class="btn-ghost-outline" type="button" data-compare-link="true">Copy link</button>
    </div>`;

  winnerSummary.querySelector('[data-compare-toggle-rows]')?.addEventListener('click', () => {
    comparisonShowAllRows = !comparisonShowAllRows;
    renderComparisonSystem();
  });
  winnerSummary.querySelector('[data-compare-copy]')?.addEventListener('click', async () => {
    const copied = await copyTextToClipboard(buildComparisonMarkdown(selectedProducts, allRows));
    showToast(copied ? 'Comparison copied as a table' : 'Could not copy the comparison', copied ? 'positive' : 'warning');
  });
  winnerSummary.querySelector('[data-compare-link]')?.addEventListener('click', async () => {
    const link = `${window.location.origin}/scripthub?compare=${encodeURIComponent(selectedProducts.map(item => item.name).join(','))}`;
    const copied = await copyTextToClipboard(link);
    showToast(copied ? 'Comparison link copied' : 'Could not copy the link', copied ? 'positive' : 'warning');
  });

  verdictsWrap.hidden = false;
  verdictsWrap.innerHTML = selectedProducts.map((item, index) => {
    const signals = getExecutorSignals(item);
    const strengths = rows.filter(row => {
      const winners = row.best === 'max' ? winnerIndexes(row.values) : row.best === 'min' ? winnerIndexesMin(row.values) : [];
      return winners.includes(index);
    }).map(row => row.label);
    return `
      <article class="comparison-verdict-card">
        <h4>${escapeHtml(item.name)}</h4>
        ${signals.length ? `<div class="smart-ranking-signals">${signals.map(signal => `<span>${escapeHtml(signal)}</span>`).join('')}</div>` : ''}
        <p><strong>Wins on:</strong> ${strengths.length ? escapeHtml(strengths.join(', ')) : 'No metric outright, it ties or trails on every scored row'}</p>
        <p><strong>Watch-out:</strong> ${escapeHtml((item.cons || [])[0] || 'Review status and trust before use')}</p>
      </article>`;
  }).join('');

  tableWrap.hidden = false;
}

function applyComparisonFromQueryParam() {
  if (!requestedComparison) return;
  const names = requestedComparison.split(',').map(name => name.trim()).filter(Boolean);
  const matched = names
    .map(name => products.find(product => product.name.toLowerCase() === name.toLowerCase()))
    .filter(Boolean)
    .slice(0, COMPARISON_MAX)
    .map(product => product.name);
  if (matched.length < 2) return;

  comparisonSelection = matched;
  syncNavButtonsWithPage('scriptsPage');
  setActivePage('scriptsPage');
  syncSubtabButtons('comparisonPanel');
  setActiveSubtab('comparisonPanel');
  renderComparisonSystem();
}

const SCRIPT_FAVORITES_KEY = 'xyrex_script_favorites_v1';
const SCRIPT_VIEW_KEY = 'xyrex_script_view_v1';
const SCRIPT_SORT_KEY = 'xyrex_script_sort_v1';

const SCRIPT_FILTERS = [
  { id: 'favorites', label: 'Favorites', match: script => getScriptFavorites().includes(script.id) },
  { id: 'working', label: 'Working', match: script => script.status === 'Working' },
  { id: 'keyless', label: 'Keyless', match: script => /keyless/i.test(script.keySystem) },
  { id: 'free', label: 'Free', match: script => script.access === 'free' && /free/i.test(script.price) },
  { id: 'mobile', label: 'Mobile', match: script => script.platform.some(item => /mobile|android|ios/i.test(item)) },
  { id: 'lowsunc', label: 'Low sUNC', match: script => script.suncMin <= 80 }
];

const scriptLibraryState = {
  search: '',
  sort: 'recommended',
  view: 'grouped',
  filters: new Set(),
  collapsed: new Set()
};

let scriptCatalogCache = null;
let scriptToastTimerId = null;

function showToast(message, tone = 'info') {
  if (!message) return;
  let toast = qs('#xyrexToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'xyrexToast';
    toast.className = 'xyrex-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.classList.add('is-visible');
  if (scriptToastTimerId) window.clearTimeout(scriptToastTimerId);
  scriptToastTimerId = window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

async function copyTextToClipboard(text) {
  const value = String(text || '');
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Falls through to the manual selection path below.
  }
  try {
    const helper = document.createElement('textarea');
    helper.value = value;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.top = '-1000px';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    const copied = document.execCommand('copy');
    helper.remove();
    return copied;
  } catch {
    return false;
  }
}

function parseSuncFloor(value) {
  const raw = String(value ?? '').trim();
  if (!raw || /^any/i.test(raw)) return 0;
  const found = raw.match(/\d+(?:\.\d+)?/);
  if (!found) return 0;
  return Math.max(0, Math.min(100, Number(found[0])));
}

function slugifyScriptId(value, fallbackIndex) {
  const slug = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || `script-${fallbackIndex}`;
}

function getScriptStatusTone(status) {
  if (/working|stable/i.test(status)) return 'positive';
  if (/buggy|issue|mixed/i.test(status)) return 'warning';
  if (/patched|down|discontinued|dead/i.test(status)) return 'danger';
  return 'info';
}

function getScriptAccessLabel(script) {
  if (script.access === 'paid') return 'Paid only';
  if (script.access === 'invite') return 'Invite only';
  return '';
}

function getScriptDiscordUrl(stats = {}) {
  const discord = String(stats.discord || '').trim();
  if (!stats.discordIcon || !discord) return '';
  if (/^https?:\/\//i.test(discord)) return discord;
  if (/^(discord\.gg|discord\.com\/invite)\//i.test(discord)) return `https://${discord}`;
  return discord;
}

function getScriptCatalog() {
  if (scriptCatalogCache) return scriptCatalogCache;
  const source = Array.isArray(scriptsHubData.popularScripts) ? scriptsHubData.popularScripts : [];
  const usedIds = new Set();

  scriptCatalogCache = source.map((raw, index) => {
    const stats = raw.stats || {};
    const rawScript = typeof raw.script === 'string' ? raw.script.trim() : '';
    // Older entries stored notes like "PURCHASE FROM DISCORD" in the script field.
    const isPlaceholder = Boolean(rawScript) && !/[({]/.test(rawScript) && rawScript === rawScript.toUpperCase();
    const access = String(raw.access || (isPlaceholder ? 'paid' : 'free')).toLowerCase();

    let id = slugifyScriptId(raw.id || raw.name, index);
    while (usedIds.has(id)) id = `${id}-${index}`;
    usedIds.add(id);

    const discordUrl = getScriptDiscordUrl(stats);
    return {
      id,
      name: raw.name || 'Untitled script',
      category: stripTrailingPeriod(raw.category || raw.game || 'Other') || 'Other',
      description: stripTrailingPeriod(raw.description || ''),
      script: access === 'free' && !isPlaceholder ? rawScript : '',
      access,
      accessNote: raw.accessNote || (isPlaceholder ? rawScript : ''),
      tags: Array.isArray(raw.tags) ? raw.tags.filter(Boolean).map(String) : [],
      updated: String(raw.updated || ''),
      price: cleanMalformedPriceText(stats.price || 'Unknown'),
      keySystem: stats.keySystem || 'Unknown',
      suncRequired: stats.suncRequired || 'Any %',
      suncMin: Number.isFinite(stats.suncMin) ? stats.suncMin : parseSuncFloor(stats.suncRequired),
      bestExecutor: stats.bestExecutor || 'Any compatible executor',
      stability: stats.stability || 'Unknown',
      status: String(stats.status || (stats.buggy ? 'Buggy' : 'Working')),
      platform: Array.isArray(stats.platform) ? stats.platform.filter(Boolean).map(String) : [],
      discordUrl,
      discordState: discordUrl ? 'linked' : stats.discordIcon === false ? 'missing' : 'none'
    };
  });

  return scriptCatalogCache;
}

function getScriptById(scriptId) {
  return getScriptCatalog().find(item => item.id === scriptId) || null;
}

function getScriptFavorites() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SCRIPT_FAVORITES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function toggleScriptFavorite(scriptId) {
  const favorites = getScriptFavorites();
  const next = favorites.includes(scriptId) ? favorites.filter(item => item !== scriptId) : [scriptId, ...favorites];
  localStorage.setItem(SCRIPT_FAVORITES_KEY, JSON.stringify(next));
  return next.includes(scriptId);
}

function getScriptSearchHaystack(script) {
  return [
    script.name,
    script.category,
    script.description,
    script.bestExecutor,
    script.keySystem,
    script.status,
    script.price,
    script.suncRequired,
    ...script.tags,
    ...script.platform
  ].join(' ').toLowerCase();
}

function getFilteredScripts() {
  const activeFilters = SCRIPT_FILTERS.filter(filter => scriptLibraryState.filters.has(filter.id));
  const terms = scriptLibraryState.search.toLowerCase().split(/\s+/).filter(Boolean);

  return getScriptCatalog().filter(script => {
    if (activeFilters.some(filter => !filter.match(script))) return false;
    if (!terms.length) return true;
    const haystack = getScriptSearchHaystack(script);
    return terms.every(term => haystack.includes(term));
  });
}

function getScriptCategoryRank(categoryName) {
  const index = POPULAR_SCRIPT_CATEGORY_ORDER.findIndex(name => name.toLowerCase() === String(categoryName).toLowerCase());
  return index === -1 ? POPULAR_SCRIPT_CATEGORY_ORDER.length : index;
}

function sortScripts(list) {
  const sorted = [...list];
  if (scriptLibraryState.sort === 'name') return sorted.sort((a, b) => a.name.localeCompare(b.name));
  if (scriptLibraryState.sort === 'sunc') return sorted.sort((a, b) => a.suncMin - b.suncMin || a.name.localeCompare(b.name));
  if (scriptLibraryState.sort === 'updated') return sorted.sort((a, b) => b.updated.localeCompare(a.updated) || a.name.localeCompare(b.name));

  const favorites = getScriptFavorites();
  const statusRank = script => (/working/i.test(script.status) ? 0 : /buggy/i.test(script.status) ? 1 : 2);
  return sorted.sort((a, b) => {
    const favoriteDelta = Number(favorites.includes(b.id)) - Number(favorites.includes(a.id));
    if (favoriteDelta) return favoriteDelta;
    const statusDelta = statusRank(a) - statusRank(b);
    if (statusDelta) return statusDelta;
    const categoryDelta = getScriptCategoryRank(a.category) - getScriptCategoryRank(b.category);
    if (categoryDelta) return categoryDelta;
    return a.name.localeCompare(b.name);
  });
}

function getCompatibleExecutors(script) {
  const measured = products.filter(product => Number.isFinite(product.sunc));
  const passing = measured
    .filter(product => product.sunc >= script.suncMin)
    .sort((a, b) => b.sunc - a.sunc || a.name.localeCompare(b.name));
  return { measuredCount: measured.length, passing };
}

function renderScriptStatGrid(script) {
  const rows = [
    ['Game', script.category],
    ['Key system', script.keySystem],
    ['sUNC needed', script.suncRequired],
    ['Platforms', script.platform.length ? script.platform.join(', ') : 'Not listed']
  ];
  return `<dl class="script-stat-grid">${rows.map(([label, value]) => `
    <div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join('')}</dl>`;
}

function renderScriptDiscordButton(script) {
  if (script.discordState !== 'linked') return '';
  return `<a class="script-discord-btn" href="${escapeHtml(script.discordUrl)}" target="_blank" rel="noopener noreferrer" title="Open Discord" aria-label="Open Discord for ${escapeHtml(script.name)}">${popularScriptDiscordSvg}</a>`;
}

function renderScriptCard(script) {
  const isFavorite = getScriptFavorites().includes(script.id);
  const accessLabel = getScriptAccessLabel(script);
  const copyButton = script.script
    ? `<button class="script-copy-btn" type="button" data-script-copy-id="${escapeHtml(script.id)}" title="Copy script" aria-label="Copy the ${escapeHtml(script.name)} script"><span class="script-file-icon">${popularScriptCopySvg}</span></button>`
    : '';

  return `
    <article class="script-card" data-script-id="${escapeHtml(script.id)}">
      <div class="script-card-head">
        <div class="script-card-heading">
          <h4 class="script-card-title">${escapeHtml(script.name)}</h4>
          <span class="script-status-pill ${getScriptStatusTone(script.status)}">${escapeHtml(script.status)}</span>
          ${accessLabel ? `<span class="script-status-pill info">${escapeHtml(accessLabel)}</span>` : ''}
        </div>
        <div class="script-card-meta">
          <button class="script-fav-btn ${isFavorite ? 'is-active' : ''}" type="button" data-script-favorite="${escapeHtml(script.id)}" aria-pressed="${isFavorite}" title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}" aria-label="${isFavorite ? 'Remove' : 'Add'} ${escapeHtml(script.name)} ${isFavorite ? 'from' : 'to'} favorites">★</button>
          ${renderScriptDiscordButton(script)}
          ${copyButton}
        </div>
      </div>
      <p class="script-card-description">${escapeHtml(script.description)}</p>
      ${renderScriptStatGrid(script)}
      ${script.tags.length ? `<div class="script-tag-row">${script.tags.map(tag => `<span class="script-tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
      <div class="script-card-actions">
        <button class="btn-ghost-outline" type="button" data-script-details="${escapeHtml(script.id)}">View details</button>
        ${script.script ? `<button class="btn-ghost-outline" type="button" data-script-toggle-code="${escapeHtml(script.id)}" aria-expanded="false">Show script</button>` : ''}
      </div>
      ${script.script
        ? `<div class="script-code-wrap" data-script-code="${escapeHtml(script.id)}" hidden><pre>${escapeHtml(script.script)}</pre></div>`
        : `<p class="script-access-note">${escapeHtml(script.accessNote || 'This script is not distributed publicly')}</p>`}
    </article>`;
}

function renderScriptCategory(categoryName, scripts, index) {
  const isOpen = !scriptLibraryState.collapsed.has(categoryName);
  return `
    <section class="script-category" data-category-name="${escapeHtml(categoryName)}">
      <button class="script-category-header" type="button" aria-expanded="${isOpen}" aria-controls="script-category-body-${index}">
        <span class="script-category-title">${escapeHtml(categoryName)}</span>
        <span class="script-category-meta">
          <span class="script-category-count">${scripts.length}</span>
          <span class="script-category-arrow" aria-hidden="true">▼</span>
        </span>
      </button>
      <div id="script-category-body-${index}" class="script-category-body ${isOpen ? 'open' : ''}"${isOpen ? ' style="max-height:none"' : ''}>
        ${scripts.map(renderScriptCard).join('')}
      </div>
    </section>`;
}

function renderScriptResultMeta(total, shown, categoryCount) {
  const meta = qs('#scriptResultMeta');
  if (!meta) return;
  const isFiltered = shown !== total;
  const scriptWord = shown === 1 ? 'script' : 'scripts';
  const categoryWord = categoryCount === 1 ? 'category' : 'categories';
  meta.textContent = isFiltered
    ? `Showing ${shown} of ${total} ${scriptWord} across ${categoryCount} ${categoryWord}`
    : `${total} ${scriptWord} across ${categoryCount} ${categoryWord}`;
}

function renderScriptFilterChips() {
  const wrap = qs('#scriptFilterChips');
  if (!wrap) return;
  const catalog = getScriptCatalog();
  const chips = SCRIPT_FILTERS.map(filter => {
    const count = catalog.filter(filter.match).length;
    const isActive = scriptLibraryState.filters.has(filter.id);
    return `<button class="script-filter-chip ${isActive ? 'is-active' : ''}" type="button" data-script-filter="${filter.id}" aria-pressed="${isActive}"${count ? '' : ' disabled'}>${escapeHtml(filter.label)}<span class="script-filter-count">${count}</span></button>`;
  });
  if (scriptLibraryState.filters.size || scriptLibraryState.search) {
    chips.push('<button class="script-filter-chip script-filter-reset" type="button" data-script-reset="true">Reset</button>');
  }
  wrap.innerHTML = chips.join('');
}

function syncScriptToolbar() {
  const searchInput = qs('#scriptSearchInput');
  if (searchInput && searchInput.value !== scriptLibraryState.search) searchInput.value = scriptLibraryState.search;
  const clearBtn = qs('#scriptSearchClear');
  if (clearBtn) clearBtn.hidden = !scriptLibraryState.search;
  const sortSelect = qs('#scriptSortSelect');
  if (sortSelect && sortSelect.value !== scriptLibraryState.sort) sortSelect.value = scriptLibraryState.sort;
  qsa('.script-view-btn').forEach(button => {
    button.classList.toggle('is-active', button.getAttribute('data-script-view') === scriptLibraryState.view);
  });
  renderScriptFilterChips();
}

function renderPopularScripts() {
  const wrap = qs('#popularScriptsList');
  if (!wrap) return;
  syncScriptToolbar();

  const catalog = getScriptCatalog();
  const matches = sortScripts(getFilteredScripts());
  const categories = [...new Set(matches.map(script => script.category))]
    .sort((a, b) => getScriptCategoryRank(a) - getScriptCategoryRank(b) || a.localeCompare(b));
  renderScriptResultMeta(catalog.length, matches.length, categories.length);

  if (!catalog.length) {
    wrap.innerHTML = '<div class="script-empty-state"><p>The script library is empty</p><p>Scripts appear here as soon as they are added to the catalog</p></div>';
    return;
  }

  if (!matches.length) {
    wrap.classList.remove('popular-script-categories', 'script-grid-view');
    wrap.innerHTML = `
      <div class="script-empty-state">
        <p>No scripts match your search or filters</p>
        <button class="btn-ghost-outline" type="button" data-script-reset="true">Clear search and filters</button>
      </div>`;
  } else if (scriptLibraryState.view === 'grid') {
    wrap.classList.remove('popular-script-categories');
    wrap.classList.add('script-grid-view');
    wrap.innerHTML = matches.map(renderScriptCard).join('');
  } else {
    wrap.classList.add('popular-script-categories');
    wrap.classList.remove('script-grid-view');
    wrap.innerHTML = categories
      .map((categoryName, index) => renderScriptCategory(categoryName, matches.filter(script => script.category === categoryName), index))
      .join('');
  }

  bindScriptLibraryEvents(wrap);
}

function resetScriptLibraryFilters() {
  scriptLibraryState.search = '';
  scriptLibraryState.filters.clear();
  renderPopularScripts();
}

async function handleScriptCopy(button, script) {
  const copied = await copyTextToClipboard(script.script);
  if (!copied) {
    showToast('Could not copy automatically, select the script text instead', 'warning');
    return;
  }
  showToast(`${script.name} copied to clipboard`, 'positive');
  if (!button) return;
  button.classList.add('is-copied');
  window.setTimeout(() => button.classList.remove('is-copied'), 900);
}

function bindScriptLibraryEvents(wrap) {
  if (wrap.dataset.popularScriptsBound === 'true') return;

  wrap.addEventListener('click', async event => {
    const resetButton = event.target.closest('[data-script-reset]');
    if (resetButton) {
      resetScriptLibraryFilters();
      return;
    }

    const favoriteButton = event.target.closest('[data-script-favorite]');
    if (favoriteButton) {
      event.stopPropagation();
      const scriptId = favoriteButton.getAttribute('data-script-favorite');
      const isFavorite = toggleScriptFavorite(scriptId);
      showToast(isFavorite ? 'Added to favorites' : 'Removed from favorites', 'info');
      renderPopularScripts();
      return;
    }

    const detailsButton = event.target.closest('[data-script-details]');
    if (detailsButton) {
      event.stopPropagation();
      openScriptDetailModal(detailsButton.getAttribute('data-script-details'));
      return;
    }

    const codeToggle = event.target.closest('[data-script-toggle-code]');
    if (codeToggle) {
      event.stopPropagation();
      const scriptId = codeToggle.getAttribute('data-script-toggle-code');
      const codeBlock = wrap.querySelector(`[data-script-code="${CSS.escape(scriptId)}"]`);
      if (!codeBlock) return;
      const nextHidden = !codeBlock.hidden;
      codeBlock.hidden = nextHidden;
      codeToggle.setAttribute('aria-expanded', String(!nextHidden));
      codeToggle.textContent = nextHidden ? 'Show script' : 'Hide script';
      return;
    }

    const copyButton = event.target.closest('[data-script-copy-id]');
    if (copyButton) {
      event.stopPropagation();
      const script = getScriptById(copyButton.getAttribute('data-script-copy-id'));
      if (script) await handleScriptCopy(copyButton, script);
      return;
    }

    const headerButton = event.target.closest('.script-category-header');
    if (headerButton) {
      const categoryElement = headerButton.closest('.script-category');
      const categoryName = categoryElement?.getAttribute('data-category-name') || '';
      if (scriptLibraryState.collapsed.has(categoryName)) {
        scriptLibraryState.collapsed.delete(categoryName);
      } else {
        scriptLibraryState.collapsed.add(categoryName);
      }
      toggleScriptCategory(categoryElement);
    }
  });

  wrap.dataset.popularScriptsBound = 'true';
}

function buildScriptCompatibilityMarkup(script) {
  const { measuredCount, passing } = getCompatibleExecutors(script);
  if (!measuredCount) {
    return '<p class="script-modal-empty">No executor on this site has a measured sUNC score yet, so compatibility cannot be checked</p>';
  }
  if (!script.suncMin) {
    return `<p class="script-modal-note">This script has no sUNC floor, so any working executor should load it. ${measuredCount} listed executors have a measured score</p>`;
  }
  if (!passing.length) {
    return `<p class="script-modal-note">None of the ${measuredCount} executors with a measured sUNC score reach ${escapeHtml(String(script.suncMin))}%</p>`;
  }
  return `
    <p class="script-modal-note">${passing.length} of ${measuredCount} executors with a measured sUNC score reach ${escapeHtml(String(script.suncMin))}%</p>
    <div class="script-compat-chips">
      ${passing.map(product => `<span class="script-compat-chip">${escapeHtml(product.name)}<span>${escapeHtml(String(product.sunc))}%</span></span>`).join('')}
    </div>`;
}

function openScriptDetailModal(scriptId) {
  const script = getScriptById(scriptId);
  const overlay = qs('#modalOverlay');
  const content = qs('#modalContent');
  if (!script || !overlay || !content) return;

  setCompactModal(false);
  lastModalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const isFavorite = getScriptFavorites().includes(script.id);
  const accessLabel = getScriptAccessLabel(script);
  const detailRows = [
    ['Game', script.category],
    ['Status', script.status],
    ['Price', script.price],
    ['Key system', script.keySystem],
    ['sUNC needed', script.suncRequired],
    ['Best executor', script.bestExecutor],
    ['Stability', script.stability],
    ['Platforms', script.platform.length ? script.platform.join(', ') : 'Not listed'],
    ['Discord', script.discordState === 'linked' ? 'Official server listed' : 'Not listed'],
    ['Entry updated', script.updated || 'Not recorded']
  ];

  content.innerHTML = `
    <section class="script-modal" data-script-id="${escapeHtml(script.id)}">
      <div class="script-modal-head">
        <div>
          <h2>${escapeHtml(script.name)}</h2>
          <p class="script-modal-description">${escapeHtml(script.description)}</p>
        </div>
        <div class="script-modal-pills">
          <span class="script-status-pill ${getScriptStatusTone(script.status)}">${escapeHtml(script.status)}</span>
          ${accessLabel ? `<span class="script-status-pill info">${escapeHtml(accessLabel)}</span>` : ''}
        </div>
      </div>

      ${script.tags.length ? `<div class="script-tag-row">${script.tags.map(tag => `<span class="script-tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}

      <dl class="script-modal-stats">
        ${detailRows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join('')}
      </dl>

      <div class="script-modal-section">
        <h3>Executors that can run this</h3>
        ${buildScriptCompatibilityMarkup(script)}
      </div>

      <div class="script-modal-section">
        <h3>${script.script ? 'Loader' : 'How to get it'}</h3>
        ${script.script
          ? `<div class="script-code-wrap"><pre>${escapeHtml(script.script)}</pre></div>`
          : `<p class="script-modal-note">${escapeHtml(script.accessNote || 'This script is not distributed publicly')}</p>`}
      </div>

      <div class="script-modal-actions">
        ${script.script ? '<button class="btn-primary" type="button" data-modal-copy-script>Copy script</button>' : ''}
        ${script.script ? '<button class="btn-ghost-outline" type="button" data-modal-save-script>Save to my scripts</button>' : ''}
        <button class="btn-ghost-outline" type="button" data-modal-copy-link>Copy link</button>
        <button class="btn-ghost-outline ${isFavorite ? 'is-active' : ''}" type="button" data-modal-favorite>${isFavorite ? 'Remove favorite' : 'Add favorite'}</button>
        ${script.discordState === 'linked' ? `<a class="btn-ghost-outline" href="${escapeHtml(script.discordUrl)}" target="_blank" rel="noopener noreferrer">Open Discord</a>` : ''}
      </div>
    </section>`;

  content.querySelector('[data-modal-copy-script]')?.addEventListener('click', () => handleScriptCopy(null, script));
  content.querySelector('[data-modal-copy-link]')?.addEventListener('click', async () => {
    const link = `${window.location.origin}/scripthub?script=${encodeURIComponent(script.id)}`;
    const copied = await copyTextToClipboard(link);
    showToast(copied ? 'Link copied to clipboard' : 'Could not copy the link', copied ? 'positive' : 'warning');
  });
  content.querySelector('[data-modal-save-script]')?.addEventListener('click', () => {
    saveScriptToLibrary(script);
    showToast(`${script.name} saved to your scripts`, 'positive');
  });
  content.querySelector('[data-modal-favorite]')?.addEventListener('click', event => {
    const nowFavorite = toggleScriptFavorite(script.id);
    event.currentTarget.textContent = nowFavorite ? 'Remove favorite' : 'Add favorite';
    event.currentTarget.classList.toggle('is-active', nowFavorite);
    renderPopularScripts();
  });

  overlay.classList.remove('is-closing');
  overlay.setAttribute('aria-hidden', 'false');
  qs('#modalCloseBtn').focus();
}

function toggleScriptCategory(categoryElement) {
  if (!categoryElement) return;
  const header = categoryElement.querySelector('.script-category-header');
  const body = categoryElement.querySelector('.script-category-body');
  if (!header || !body || body.dataset.animating === 'true') return;

  const shouldOpen = !body.classList.contains('open');
  body.dataset.animating = 'true';

  if (shouldOpen) {
    body.classList.add('open');
    const targetHeight = body.scrollHeight;
    body.style.maxHeight = '0px';
    requestAnimationFrame(() => {
      body.style.maxHeight = `${targetHeight}px`;
    });
  } else {
    const currentHeight = body.scrollHeight;
    body.style.maxHeight = `${currentHeight}px`;
    requestAnimationFrame(() => {
      body.classList.remove('open');
      body.style.maxHeight = '0px';
    });
  }

  header.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');

  const onTransitionEnd = event => {
    if (event.propertyName !== 'max-height') return;
    body.removeEventListener('transitionend', onTransitionEnd);
    if (shouldOpen) body.style.maxHeight = 'none';
    body.dataset.animating = 'false';
  };
  body.addEventListener('transitionend', onTransitionEnd);
}

function initScriptLibraryControls() {
  const storedView = localStorage.getItem(SCRIPT_VIEW_KEY);
  if (storedView === 'grid' || storedView === 'grouped') scriptLibraryState.view = storedView;
  const storedSort = localStorage.getItem(SCRIPT_SORT_KEY);
  if (storedSort && ['recommended', 'updated', 'name', 'sunc'].includes(storedSort)) scriptLibraryState.sort = storedSort;

  const searchInput = qs('#scriptSearchInput');
  searchInput?.addEventListener('input', () => {
    scriptLibraryState.search = searchInput.value.trim();
    renderPopularScripts();
  });
  searchInput?.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !searchInput.value) return;
    event.stopPropagation();
    searchInput.value = '';
    scriptLibraryState.search = '';
    renderPopularScripts();
  });

  qs('#scriptSearchClear')?.addEventListener('click', () => {
    scriptLibraryState.search = '';
    renderPopularScripts();
    searchInput?.focus();
  });

  qs('#scriptSortSelect')?.addEventListener('change', event => {
    scriptLibraryState.sort = event.target.value;
    localStorage.setItem(SCRIPT_SORT_KEY, scriptLibraryState.sort);
    renderPopularScripts();
  });

  qsa('.script-view-btn').forEach(button => {
    button.addEventListener('click', () => {
      scriptLibraryState.view = button.getAttribute('data-script-view') === 'grid' ? 'grid' : 'grouped';
      localStorage.setItem(SCRIPT_VIEW_KEY, scriptLibraryState.view);
      renderPopularScripts();
    });
  });

  qs('#scriptFilterChips')?.addEventListener('click', event => {
    const resetButton = event.target.closest('[data-script-reset]');
    if (resetButton) {
      resetScriptLibraryFilters();
      return;
    }
    const chip = event.target.closest('[data-script-filter]');
    if (!chip) return;
    const filterId = chip.getAttribute('data-script-filter');
    if (scriptLibraryState.filters.has(filterId)) {
      scriptLibraryState.filters.delete(filterId);
    } else {
      scriptLibraryState.filters.add(filterId);
    }
    renderPopularScripts();
  });
}

// Captured before the router rewrites the path, which drops the query string.
const requestedScriptId = new URLSearchParams(window.location.search).get('script') || '';
const requestedComparison = new URLSearchParams(window.location.search).get('compare') || '';

function openScriptFromQueryParam() {
  const scriptId = requestedScriptId;
  if (!scriptId || !getScriptById(scriptId)) return;
  syncNavButtonsWithPage('scriptsPage');
  setActivePage('scriptsPage');
  syncSubtabButtons('popularScriptsPanel');
  setActiveSubtab('popularScriptsPanel');
  openScriptDetailModal(scriptId);
}

function renderRecentChanges() {
  const wrap = qs('#recentChangesList');
  if (!wrap) return;
  const releases = Array.isArray(window.XYREX_CHANGELOG) ? window.XYREX_CHANGELOG : [];
  if (!releases.length) {
    wrap.innerHTML = '<div class="script-empty-state"><p>No changelog entries yet</p></div>';
    return;
  }

  const toneFor = type => ({ added: 'positive', fixed: 'info', changed: 'warning', removed: 'danger' }[String(type).toLowerCase()] || 'info');
  const formatDate = value => {
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  wrap.innerHTML = releases.map(release => `
    <article class="changelog-entry">
      <div class="changelog-entry-head">
        <h4>${escapeHtml(release.version || 'Update')}</h4>
        <time datetime="${escapeHtml(release.date || '')}">${escapeHtml(formatDate(release.date))}</time>
      </div>
      ${release.summary ? `<p class="changelog-summary">${escapeHtml(release.summary)}</p>` : ''}
      <ul class="changelog-items">
        ${(release.entries || []).map(entry => `
          <li>
            <span class="changelog-type ${toneFor(entry.type)}">${escapeHtml(entry.type || 'Changed')}</span>
            <span>${escapeHtml(entry.text || '')}</span>
          </li>`).join('')}
      </ul>
    </article>`).join('');
}

function getAssistantKnowledgeText(product) {
  const platforms = Array.isArray(product.platform) && product.platform.length ? product.platform.join(', ') : 'Unknown';
  const features = Array.isArray(product.features) && product.features.length ? product.features.join(', ') : 'None listed';
  const price = Array.isArray(product.pricingOptions) && product.pricingOptions.length
    ? product.pricingOptions.join(', ')
    : product.freeOrPaid;
  const site = product.officialSite ? ` Official site: ${product.officialSite}.` : ' Official site: Not listed.';
  return `${product.name}: ${stripTrailingPeriod(product.description)}. Platforms: ${platforms}. Features: ${features}. sUNC: ${Number.isFinite(product.sunc) ? `${product.sunc}%` : 'Missing'}. Stability: ${product.stability || 'Unknown'}. Risk: ${detectionRiskLabel(product)} (${detectionRiskScore(product)}/10). Price: ${cleanMalformedPriceText(price)}.${site}`;
}

const assistantIntents = { COMPARE:'compare', RECOMMEND:'recommend', SAFETY:'safety', PRICE:'price', PLATFORM:'platform', SUNC:'sunc', BEGINNER:'beginner', DETAILS:'details', LORE:'lore', FILTER_SHOW:'filter_show', FOLLOW_UP:'follow_up', UNKNOWN:'unknown' };
const assistantSystemPrompt = [
  'You are Xyrex Exploit Assistant, a concise chat assistant for executor questions on Xyrex.lol.',
  'Use local executor metadata first and use the current conversation context to resolve follow-ups.',
  'Answer only the user’s actual question. Do not add unrelated recommendations or separate insight sections.',
  'Avoid recommendation wording unless the user explicitly asks for a recommendation.',
  'Do not invent executor claims. If local metadata does not confirm something, clearly say it is not confirmed by the available Xyrex data.',
  'Keep responses direct with bold labels, short sections, and bullets. Avoid tables unless the user specifically asks for a comparison table.',
  'Never provide exploit code, bypass instructions, download instructions, or steps that increase abuse.'
].join('\n');
const assistantLoadingProfiles = Object.freeze({
  filter: ['Reading your filter request...', 'Matching filters to visible executor cards...', 'Refreshing the executor grid...'],
  compare: ['Pulling both executor profiles...', 'Checking price, platform, trust, and sUNC side by side...', 'Writing a clear verdict...'],
  safety: ['Reviewing trust and status signals...', 'Checking stability and detection-risk notes...', 'Prioritizing the lowest-risk answer...'],
  price: ['Checking free, paid, and key-system fields...', 'Balancing cost against reliability...', 'Summarizing the best value picks...'],
  platform: ['Reading your platform target...', 'Filtering support across executor cards...', 'Ranking compatible options...'],
  sunc: ['Sorting execution and sUNC data...', 'Checking exact sUNC values from local metadata...', 'Preparing the requested sUNC answer...'],
  follow_up: ['Reading your follow-up in context...', 'Reusing the previous executor shortlist...', 'Updating the recommendation...'],
  default: ['Reading current Xyrex executor data...', 'Checking platform, price, key system, and risk...', 'Using the current chat context...', 'Preparing a direct answer...']
});
let assistantContext = { lastIntent:null, lastExecutors:[], lastFilters:{}, lastQuestion:'', lastRecommendation:null, conversationFocus:null, turns:[] };
let assistantReplyTarget = null;
let assistantPanelRefresh = () => {};



function getAssistantConversationExecutors() {
  const names = [];
  const pushName = name => {
    if (name && !names.includes(name)) names.push(name);
  };
  (assistantContext.lastExecutors || []).forEach(pushName);
  pushName(assistantContext.lastRecommendation);
  [...(assistantContext.turns || [])].reverse().forEach(turn => {
    const content = String(turn?.content || '').toLowerCase();
    products.forEach(product => {
      if (content.includes(product.name.toLowerCase())) pushName(product.name);
    });
  });
  return names;
}

function isAssistantFollowUp(input) {
  return /\b(it|that|this|they|them|those|one|same|previous|last|why|what about|how about|cheaper|safer|better|worse|lower|higher|lowest|highest|free|compare them|which of those|that one)\b/i.test(input)
    && getAssistantConversationExecutors().length > 0;
}

function resolveAssistantFollowUpEntities(input, entities) {
  if (!isAssistantFollowUp(input)) return entities;
  const currentEntities = entities || [];
  if (currentEntities.length && !/(compare|vs|versus|better than|safer|cheaper|lower|higher)/i.test(input)) return currentEntities;
  return [...new Set([...currentEntities, ...getAssistantConversationExecutors()].filter(Boolean))];
}

function mergeAssistantFilters(filters) {
  const previous = assistantContext.lastFilters || {};
  return {
    platform: filters.platform?.length ? filters.platform : (previous.platform || []),
    price: filters.price || previous.price || null,
    keySystem: filters.keySystem || previous.keySystem || null,
    cheatType: filters.cheatType || previous.cheatType || null,
    safety: filters.safety || previous.safety || null,
    suncMinimum: filters.suncMinimum || previous.suncMinimum || null
  };
}

function getAssistantLoadingSteps(intentData) {
  if (intentData.wantsFilterAction) return assistantLoadingProfiles.filter;
  if (intentData.isFollowUp) return assistantLoadingProfiles.follow_up;
  if (intentData.intent === assistantIntents.COMPARE) return assistantLoadingProfiles.compare;
  if (intentData.intent === assistantIntents.SAFETY || intentData.intent === assistantIntents.BEGINNER) return assistantLoadingProfiles.safety;
  if (intentData.intent === assistantIntents.PRICE) return assistantLoadingProfiles.price;
  if (intentData.intent === assistantIntents.PLATFORM) return assistantLoadingProfiles.platform;
  if (intentData.intent === assistantIntents.SUNC) return assistantLoadingProfiles.sunc;
  return assistantLoadingProfiles.default;
}

function detectAssistantIntent(message) {
  const raw = String(message || '').trim();
  const input = raw.toLowerCase();
  let entities = products.filter(item => input.includes(item.name.toLowerCase())).map(item => item.name);
  const wantsFilterAction = /(show|filter|display|only show|hide everything except|show me|list only)/i.test(input);
  const filters = { platform: [], price: null, keySystem: null, cheatType: null, safety: null, suncMinimum: null };
  if (/(windows|pc)/i.test(input)) filters.platform.push('Windows');
  if (/(mac|macos)/i.test(input)) filters.platform.push('macOS');
  if (/(android|mobile)/i.test(input)) filters.platform.push('Android');
  if (/(ios|iphone|ipad|mobile)/i.test(input)) filters.platform.push('iOS');
  if (/\bfree\b/i.test(input)) filters.price = 'free'; else if (/\bpaid|cost\b/i.test(input)) filters.price = 'paid';
  if (/keyless/i.test(input)) filters.keySystem = 'keyless'; else if (/keyed|key system/i.test(input)) filters.keySystem = 'keyed';
  if (/internal/i.test(input)) filters.cheatType = 'internal'; else if (/external/i.test(input)) filters.cheatType = 'external';
  if (/(safe|safest|trusted|risk|detected|undetected)/i.test(input)) filters.safety = 'safe';
  if (/(high sunc|highest sunc|highest unc|top sunc)/i.test(input)) filters.suncMinimum = 70;
  const beginner = /(beginner|new|easy|simple|first executor)/i.test(input);
  let intent = assistantIntents.UNKNOWN;
  if (wantsFilterAction) intent = assistantIntents.FILTER_SHOW;
  else if (/\bsunc\b/i.test(input) && /\bunc\b/i.test(input) && /(compare|comparison|\bvs\b|versus|difference|different)/i.test(input)) intent = assistantIntents.SUNC;
  else if (/(compare|\bvs\b|versus|better than|which is better)/i.test(input)) intent = assistantIntents.COMPARE;
  else if (/(best|recommend|what should i use|which one should i use)/i.test(input)) intent = assistantIntents.RECOMMEND;
  else if (/(safe|safest|trusted|risk|detected|undetected)/i.test(input)) intent = assistantIntents.SAFETY;
  else if (/(free|paid|cost|keyless|keyed)/i.test(input)) intent = assistantIntents.PRICE;
  else if (/(windows|mac|android|ios|mobile|pc)/i.test(input)) intent = assistantIntents.PLATFORM;
  else if (/(sunc|unc|score|percentage|highest unc|highest sunc|lowest sunc|lower sunc)/i.test(input)) intent = assistantIntents.SUNC;
  else if (/(\blore\b|archive|fragment|protocol 1\.337|null|terminal command|how.*unlock)/i.test(input)) intent = assistantIntents.LORE;
  else if (beginner) intent = assistantIntents.BEGINNER;
  else if (entities.length) intent = assistantIntents.DETAILS;
  const isFollowUp = isAssistantFollowUp(input);
  entities = resolveAssistantFollowUpEntities(input, entities);
  if (isFollowUp && intent === assistantIntents.UNKNOWN) intent = assistantIntents.FOLLOW_UP;
  const effectiveFilters = isFollowUp ? mergeAssistantFilters(filters) : filters;
  const asksLowest = /\b(lowest|lower|least|minimum|min)\b/i.test(input);
  const asksHighest = /\b(highest|higher|most|maximum|max|top)\b/i.test(input);
  const asksCheapest = /\b(cheapest|lowest price|least expensive)\b/i.test(input);
  const wantsTable = /\b(table|chart|grid)\b/i.test(input);
  return { intent, entities, filters: effectiveFilters, explicitFilters: filters, beginner, wantsFilterAction, isFollowUp, asksLowest, asksHighest, asksCheapest, wantsTable };
}

function recommendationScore(product, userIntent = {}) {
  let score = Number.isFinite(product.sunc) ? product.sunc * 0.55 : 0;
  const trust = String(product.trustLevel || '').toLowerCase();
  score += trust.includes('high') ? 24 : trust.includes('medium') ? 12 : trust.includes('low') ? 2 : 5;
  const stable = String(product.stability || '').toLowerCase();
  if (stable.includes('stable')) score += 12;
  if (/(unstable|unknown)/i.test(stable)) score -= 8;
  const status = String(product.status || '').toLowerCase();
  if (/(down|broken|patched|discontinued|risky|issue|detected)/i.test(status)) score -= 35;
  if (/active|working|online|updated/i.test(status)) score += 9;
  if (userIntent.filters?.price === 'free') score += product.freeOrPaid === 'free' ? 12 : -8;
  if (userIntent.filters?.price === 'paid') score += product.freeOrPaid === 'paid' ? 6 : -4;
  if (userIntent.beginner) score += (product.keySystem === 'keyless' ? 8 : -2) + (product.freeOrPaid === 'free' ? 6 : 0) + (stable.includes('stable') ? 5 : -4);
  if (userIntent.intent === assistantIntents.SAFETY) score += (trust.includes('high') ? 12 : 0) + (/(detected|risky|down)/i.test(status) ? -20 : 4);
  if (userIntent.filters?.platform?.length) score += userIntent.filters.platform.some(p => (product.platform || []).includes(p)) ? 15 : -30;
  if (userIntent.filters?.keySystem) score += product.keySystem === userIntent.filters.keySystem ? 6 : -6;
  return score;
}
function getRankedExecutors(intentData) { return products.map(p => ({ product: p, score: recommendationScore(p, intentData) })).sort((a, b) => b.score - a.score); }
function getAssistantConfidence(items) { const list = Array.isArray(items) ? items : [items]; const v = list.filter(Boolean).map(p => [p.officialSite, Number.isFinite(p.sunc), p.trustLevel !== 'Unknown', p.stability !== 'Unknown', p.status !== 'Unknown', (p.pros || []).length + (p.cons || []).length >= 2].filter(Boolean).length); const avg = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; return avg >= 5 ? 'High' : avg >= 3 ? 'Medium' : 'Low'; }
function applyAssistantFilters(filters) {
  qsa('.filter-checkbox, .price-checkbox').forEach(cb => { cb.checked = false; });
  (filters.platform || []).forEach(platform => { const el = qsa('.filter-checkbox').find(i => i.getAttribute('data-filter-group') === 'platform' && i.value === platform); if (el) el.checked = true; });
  if (filters.keySystem) { const el = qsa('.filter-checkbox').find(i => i.getAttribute('data-filter-group') === 'keySystem' && i.value === filters.keySystem); if (el) el.checked = true; }
  if (filters.cheatType) { const el = qsa('.filter-checkbox').find(i => i.getAttribute('data-filter-group') === 'cheatType' && i.value === filters.cheatType); if (el) el.checked = true; }
  if (filters.price === 'free') qs('#priceFree').checked = true; else if (filters.price === 'paid') qs('#pricePaid').checked = true; else if (filters.price === 'both') qs('#priceBoth').checked = true;
  applyAllFilters();
  const grid = qs('#productGrid'); if (grid) { grid.classList.add('assistant-filter-pulse'); setTimeout(() => grid.classList.remove('assistant-filter-pulse'), 800); }
}

function getLocalAssistantFallback(prompt) {
  const input = String(prompt || '').toLowerCase();
  const mentioned = products.filter(item => input.includes(item.name.toLowerCase()));
  if (mentioned.length) {
    return `Research API is currently unavailable, so I am relying only on local Xyrex data.\n\n${mentioned.map(getAssistantKnowledgeText).join('\n\n')}`;
  }

  if (input.includes('android')) {
    const android = products.filter(item => Array.isArray(item.platform) && item.platform.includes('Android'));
    const ranked = android.sort((a, b) => detectionRiskScore(a) - detectionRiskScore(b) || (Number.isFinite(b.sunc) ? b.sunc : -1) - (Number.isFinite(a.sunc) ? a.sunc : -1));
    return `Research API is currently unavailable, so I am relying only on local Xyrex data.\n\nTop Android options by visible local metrics:\n${ranked.slice(0, 3).map(item => `• ${item.name} — ${detectionRiskLabel(item)} risk, ${item.stability} stability, sUNC ${Number.isFinite(item.sunc) ? `${item.sunc}%` : 'None'}, status ${item.status}`).join('\n')}`;
  }

  if (input.includes('free')) {
    const free = products
      .filter(item => String(item.freeOrPaid).toLowerCase() === 'free')
      .sort((a, b) => detectionRiskScore(a) - detectionRiskScore(b) || (Number.isFinite(b.sunc) ? b.sunc : -1) - (Number.isFinite(a.sunc) ? a.sunc : -1));
    return `Research API is currently unavailable, so I am relying only on local Xyrex data.\n\nFree executors with the lowest visible risk:\n${free.slice(0, 5).map(item => `• ${item.name} — ${detectionRiskLabel(item)} risk (${detectionRiskScore(item)}/10), ${item.stability} stability, sUNC ${Number.isFinite(item.sunc) ? `${item.sunc}%` : 'None'}`).join('\n') || '• None listed'}`;
  }

  if (input.includes('safe') || input.includes('safest') || input.includes('risk') || input.includes('beginner') || input.includes('trust')) {
    const safest = [...products]
      .sort((a, b) => detectionRiskScore(a) - detectionRiskScore(b) || (Number.isFinite(b.sunc) ? b.sunc : -1) - (Number.isFinite(a.sunc) ? a.sunc : -1));
    return `Research API is currently unavailable, so I am relying only on local Xyrex data.\n\nLower-risk beginner-friendly options from visible trust, stability, status, and sUNC data:\n${safest.slice(0, 4).map(item => `• ${item.name} — ${detectionRiskLabel(item)} risk, trust ${item.trustLevel}, stability ${item.stability}, status ${item.status}, sUNC ${Number.isFinite(item.sunc) ? `${item.sunc}%` : 'None'}`).join('\n')}`;
  }

  return `Research API is currently unavailable, so I am relying only on local Xyrex data.\n\nI can still help with safety, platforms, pricing, sUNC, and stability for the executors listed on this page.`;
}


function renderAssistantMarkdown(markdownText) {
  const rawText = String(markdownText || '');

  if (!window.marked || !window.DOMPurify) {
    const fallback = document.createElement('div');
    fallback.textContent = rawText;
    return fallback;
  }

  marked.setOptions({
    breaks: false,
    gfm: true
  });

  const normalizedText = rawText.replace(/\n{3,}/g, '\n\n');
  const unsafeHtml = marked.parse(normalizedText);

  const safeHtml = DOMPurify.sanitize(unsafeHtml, {
    USE_PROFILES: { html: true }
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'assistant-markdown';
  wrapper.innerHTML = safeHtml;


  wrapper.querySelectorAll('table').forEach(table => {
    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'assistant-table-wrap';
    table.parentNode?.insertBefore(scrollWrap, table);
    scrollWrap.appendChild(table);
  });

  wrapper.querySelectorAll('a').forEach(link => {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });

  return wrapper;
}

function setAssistantMessageMarkdown(messageElement, markdownText) {
  if (!messageElement) return;

  messageElement.textContent = '';
  messageElement.appendChild(renderAssistantMarkdown(markdownText));
}


function formatExecutorBullet(product, intentData = {}) {
  const reasonParts = [];
  if (Number.isFinite(product.sunc)) reasonParts.push(`sUNC ${product.sunc}%`);
  if (product.trustLevel && product.trustLevel !== 'Unknown') reasonParts.push(`trust ${product.trustLevel}`);
  if (product.stability && product.stability !== 'Unknown') reasonParts.push(`${product.stability} stability`);
  if (product.status && product.status !== 'Unknown') reasonParts.push(`status ${product.status}`);
  const platformText = (product.platform || []).join(', ') || 'Unknown platform';
  return `- **${product.name}** — ${platformText}; ${product.freeOrPaid}; ${product.keySystem}; ${reasonParts.join(', ') || 'limited public fields'}`;
}


function getAssistantProductsFromNames(names = []) {
  return [...new Set(names)].map(name => products.find(product => product.name === name)).filter(Boolean);
}

function formatSuncValue(product) {
  return Number.isFinite(product?.sunc) ? `${product.sunc}%` : 'Missing';
}

function formatPricingValue(product) {
  const options = Array.isArray(product?.pricingOptions) && product.pricingOptions.length ? product.pricingOptions : [product?.freeOrPaid || 'Unknown'];
  return cleanMalformedPriceText(options.join(', '));
}

function getFiniteSuncProducts(sourceProducts = products) {
  return sourceProducts.filter(product => Number.isFinite(product.sunc));
}

function buildSuncAnswer(intentData) {
  if (/\bsunc\b/i.test(assistantContext.lastQuestion || '') && /\bunc\b/i.test(assistantContext.lastQuestion || '')) {
    return `### sUNC vs UNC

| Term | Meaning | Best use |
| --- | --- | --- |
| sUNC | A compatibility-style score used to describe script/API support coverage in parts of the executor ecosystem. | Estimating broad compatibility, not safety. |
| UNC | A general executor compatibility coverage term for common functions and APIs. | Understanding function/API support, not trust. |

**Important:** neither sUNC nor UNC proves that an executor is safe, undetected, or malware-free.`;
  }
  const scoped = getAssistantProductsFromNames(intentData.entities || []);
  const finite = getFiniteSuncProducts(scoped.length >= 2 ? scoped : products);
  if (!finite.length) return '**sUNC:** Missing\n\n- **Reason:** The current Xyrex metadata does not list confirmed sUNC values for this request';
  const direction = intentData.asksLowest ? 'lowest' : 'highest';
  const sorted = [...finite].sort((a, b) => direction === 'lowest' ? a.sunc - b.sunc : b.sunc - a.sunc);
  const targetValue = sorted[0].sunc;
  const ties = sorted.filter(product => product.sunc === targetValue);
  const label = direction === 'lowest' ? 'Lowest sUNC' : 'Highest sUNC';
  const scopeText = scoped.length >= 2 ? 'among the executors being compared' : 'in the current Xyrex metadata';
  return `**${label}:** ${ties.map(product => product.name).join(', ')}\n\n${ties.map(product => `- **${product.name}**: ${formatSuncValue(product)}`).join('\n')}\n- **Reason:** This is the ${direction} listed sUNC value ${scopeText}`;
}

function buildPriceAnswer(intentData) {
  const mentioned = getAssistantProductsFromNames(intentData.entities || []);
  if (mentioned.length) {
    return mentioned.map(product => `**${product.name} pricing**\n\n- **Type:** ${product.freeOrPaid || 'Unknown'}\n- **Listed price:** ${formatPricingValue(product)}\n- **Key system:** ${product.keySystem || 'Unknown'}`).join('\n\n');
  }
  if (/free/i.test(assistantContext.lastQuestion || '') && intentData.isFollowUp) {
    const previous = getAssistantProductsFromNames(getAssistantConversationExecutors()).slice(0, 1);
    if (previous.length) return buildPriceAnswer({ ...intentData, entities: [previous[0].name] });
  }
  if (intentData.asksCheapest || intentData.filters?.price === 'free') {
    const free = products.filter(product => product.freeOrPaid === 'free' || product.freeOrPaid === 'both');
    return `**Free availability**\n\n${free.map(product => `- **${product.name}**: ${product.freeOrPaid === 'both' ? 'Free + paid plans' : 'Free'}; listed price ${formatPricingValue(product)}`).join('\n') || '- No free executors are listed in the current Xyrex metadata'}`;
  }
  return `**Pricing data**\n\n- The available Xyrex metadata can confirm pricing only for listed executors\n- Ask about a specific executor, for example: **is Solara free?**`;
}

function buildDetailsAnswer(product) {
  return `**${product.name}**\n\n- **Description:** ${stripTrailingPeriod(product.description || 'No description listed')}\n- **Platform:** ${(product.platform || []).join(', ') || 'Unknown'}\n- **Price:** ${formatPricingValue(product)}\n- **Key system:** ${product.keySystem || 'Unknown'}\n- **sUNC:** ${formatSuncValue(product)}\n- **Stability:** ${product.stability || 'Unknown'}\n- **Trust:** ${product.trustLevel || 'Unknown'}\n- **Status:** ${product.status || 'Unknown'}`;
}

function buildSafetyAnswer(intentData) {
  const mentioned = getAssistantProductsFromNames(intentData.entities || []);
  const pool = mentioned.length ? mentioned : products;
  const ranked = [...pool].sort((a, b) => detectionRiskScore(a) - detectionRiskScore(b) || (Number.isFinite(b.sunc) ? b.sunc : -1) - (Number.isFinite(a.sunc) ? a.sunc : -1));
  if (!ranked.length) return '**Safety:** Missing\n\n- **Reason:** The available Xyrex metadata does not confirm safety for this request';
  const heading = mentioned.length >= 2 ? 'Lower visible risk' : 'Lower-risk listed options';
  return `**${heading}:** ${ranked[0].name}\n\n${ranked.slice(0, mentioned.length >= 2 ? mentioned.length : 4).map(product => `- **${product.name}**: ${detectionRiskLabel(product)} risk (${detectionRiskScore(product)}/10), trust ${product.trustLevel || 'Unknown'}, stability ${product.stability || 'Unknown'}, status ${product.status || 'Unknown'}`).join('\n')}\n- **Note:** This does not prove any executor is safe; it only reflects the visible Xyrex metadata`;
}

function buildAssistantComparisonReply(pair, intentData) {
  if (!pair || pair.length < 2) return '**Comparison:** Missing\n\n- **Reason:** I need two listed executors to compare';
  if (intentData?.intent === assistantIntents.SUNC || /sunc/i.test(assistantContext.lastQuestion || '')) {
    return buildSuncAnswer({ ...intentData, entities: pair.map(product => product.name), asksLowest: intentData?.asksLowest !== false });
  }
  if (intentData?.wantsTable) {
    return `| Category | ${pair[0].name} | ${pair[1].name} |\n| --- | --- | --- |\n| Price | ${pair[0].freeOrPaid} | ${pair[1].freeOrPaid} |\n| Platform | ${(pair[0].platform || []).join(', ') || 'Unknown'} | ${(pair[1].platform || []).join(', ') || 'Unknown'} |\n| Key system | ${pair[0].keySystem || 'Unknown'} | ${pair[1].keySystem || 'Unknown'} |\n| sUNC | ${formatSuncValue(pair[0])} | ${formatSuncValue(pair[1])} |\n| Trust | ${pair[0].trustLevel || 'Unknown'} | ${pair[1].trustLevel || 'Unknown'} |\n| Stability | ${pair[0].stability || 'Unknown'} | ${pair[1].stability || 'Unknown'} |\n| Status | ${pair[0].status || 'Unknown'} | ${pair[1].status || 'Unknown'} |`;
  }
  return `**${pair[0].name} vs ${pair[1].name}**\n\n- **${pair[0].name}:** ${pair[0].freeOrPaid}; ${(pair[0].platform || []).join(', ') || 'Unknown platform'}; ${pair[0].keySystem || 'Unknown'}; sUNC ${formatSuncValue(pair[0])}; trust ${pair[0].trustLevel || 'Unknown'}; status ${pair[0].status || 'Unknown'}\n- **${pair[1].name}:** ${pair[1].freeOrPaid}; ${(pair[1].platform || []).join(', ') || 'Unknown platform'}; ${pair[1].keySystem || 'Unknown'}; sUNC ${formatSuncValue(pair[1])}; trust ${pair[1].trustLevel || 'Unknown'}; status ${pair[1].status || 'Unknown'}\n- **Note:** Ask for a specific metric like **lower sUNC**, **safer**, **cheaper**, or **best for Windows** for a direct verdict`;
}

function buildDirectAssistantReply(userMessage, intentData) {
  if (intentData.wantsFilterAction) return '';
  if (/\bsunc\b/i.test(userMessage) && /\bunc\b/i.test(userMessage) && /(compare|comparison|\bvs\b|versus|difference|different)/i.test(userMessage)) {
    return `### sUNC vs UNC\n\n| Term | Meaning | Best use |\n| --- | --- | --- |\n| sUNC | A compatibility-style score used to describe script/API support coverage in parts of the executor ecosystem. | Estimating broad compatibility, not safety. |\n| UNC | A general executor compatibility coverage term for common functions and APIs. | Understanding function/API support, not trust. |\n\n**Important:** neither sUNC nor UNC proves that an executor is safe, undetected, or malware-free.`;
  }
  const mentioned = getAssistantProductsFromNames(intentData.entities || []);
  if (intentData.intent === assistantIntents.LORE) return buildLoreAccessGuide();
  if (intentData.intent === assistantIntents.SUNC) return buildSuncAnswer(intentData);
  if (intentData.intent === assistantIntents.PRICE || intentData.asksCheapest) return buildPriceAnswer(intentData);
  if (intentData.intent === assistantIntents.SAFETY || /\bsafer\b/i.test(userMessage)) return buildSafetyAnswer(intentData);
  if (intentData.intent === assistantIntents.COMPARE && mentioned.length >= 2) return buildAssistantComparisonReply(mentioned.slice(0, 2), intentData);
  if (mentioned.length === 1 || (intentData.intent === assistantIntents.FOLLOW_UP && mentioned.length)) return buildDetailsAnswer(mentioned[0]);
  if (intentData.intent === assistantIntents.RECOMMEND || intentData.intent === assistantIntents.BEGINNER || intentData.intent === assistantIntents.PLATFORM) return buildLocalRecommendationReply(intentData);
  return `**Not confirmed**\n\n- The available Xyrex metadata does not confirm an answer to that exact question\n- Ask about a listed executor, platform, price, sUNC value, status, trust, or stability`;
}


function buildLocalRecommendationReply(intentData) {
  const ranked = getRankedExecutors(intentData || {}).map(item => item.product);
  const mentionedProducts = (intentData?.entities || []).map(name => products.find(product => product.name === name)).filter(Boolean);
  if (intentData?.intent === assistantIntents.COMPARE && mentionedProducts.length >= 2) return buildAssistantComparisonReply(mentionedProducts.slice(0, 2), intentData);
  if (intentData?.intent === assistantIntents.DETAILS && mentionedProducts.length) {
    return `### ${mentionedProducts[0].name} overview

${getAssistantKnowledgeText(mentionedProducts[0])}

**Best follow-up:** ask me to compare it with another executor, check safer alternatives, or filter the page to matching options.

**Confidence:** ${getAssistantConfidence(mentionedProducts[0])} — based only on current Xyrex local data.`;
  }
  const candidates = mentionedProducts.length ? mentionedProducts : ranked;
  const best = candidates[0];
  if (!best) return getLocalAssistantFallback('');
  const heading = intentData?.isFollowUp ? 'Updated answer' : intentData?.intent === assistantIntents.SAFETY || intentData?.intent === assistantIntents.BEGINNER ? 'Lower-risk listed picks' : intentData?.intent === assistantIntents.SUNC ? 'sUNC-focused picks' : intentData?.intent === assistantIntents.PRICE ? 'Value picks' : 'Recommended pick';
  const topList = candidates.slice(0, 4).map(item => formatExecutorBullet(item, intentData)).join('\n');
  const caveat = detectionRiskScore(best) >= 7 || /down|patched|detected|risky|unstable/i.test(`${best.status} ${best.stability}`)
    ? 'Important: the top local match still has risk signals, so treat it cautiously and re-check status before relying on it.'
    : 'The top local match has comparatively stronger visible trust, stability, status, and compatibility signals.';

  return `### ${heading}: ${best.name}

${topList}

**Why this answer fits:** I matched your request against platform, pricing, key system, sUNC, trust, stability, and current status fields. ${caveat}

**Confidence:** ${getAssistantConfidence(candidates.slice(0, 3))} — based only on current Xyrex local data.`;
}


function buildLoreAccessGuide() {
  return `### Full lore access guide

Follow these steps to unlock every lore entry and effect:

1. Open the **Recovered Layer Terminal** by typing **archive** or **xyrex** anywhere on the page.
2. In the terminal, run **decrypt** to recover the **TRUST** fragment.
3. In the terminal, run **logs** to recover the **INDEX** fragment.
4. Click the site logo **seven times** to recover the **NULL** fragment.
5. Type the key sequence **x y r e x** to recover the **MIRROR** fragment.
6. When NULL, TRUST, INDEX, and MIRROR are recovered, fragment **1.337** unlocks automatically.
7. Run **protocol** in the terminal, then run **protocol 1.337** to activate the final sequence.
8. Open the Archive logs once all fragments are complete to view every lore log.

Helpful terminal commands: **help**, **status**, **logs**, **decrypt**, **protocol**, **null**, **restore**, **clear**.

Tip: If you want to reset visual corruption effects, run **restore** in the terminal.`;
}

function isLikelyCannedAssistantReply(replyText) {
  const normalized = String(replyText || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return true;
  const cannedIndicators = [
    'recommended pick: milkers',
    'based on current xyrex-local metrics',
    'confidence: high — based on the current xyrex data'
  ];
  return cannedIndicators.filter(token => normalized.includes(token)).length >= 2;
}

async function askExploitAssistant(message, context = assistantContext) {
  const payload = JSON.stringify({
    message,
    executors: products,
    system: assistantSystemPrompt,
    context: {
      lastIntent: context?.lastIntent || null,
      lastExecutors: context?.lastExecutors || [],
      lastFilters: context?.lastFilters || {},
      lastQuestion: context?.lastQuestion || '',
      lastRecommendation: context?.lastRecommendation || null,
      conversationFocus: context?.conversationFocus || null,
      replyTo: context?.replyTo || null,
      recentTurns: (context?.turns || []).slice(-12)
    },
    replyTo: context?.replyTo || null
  });
  const errors = [];

  for (const apiUrl of EXPLOIT_ASSISTANT_APIS) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        errors.push(`${apiUrl} -> ${response.status} ${response.statusText}${errorText ? `: ${errorText.slice(0, 160)}` : ''}`);
        continue;
      }

      return response.json();
    } catch (error) {
      errors.push(`${apiUrl} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Exploit Assistant API request failed on all endpoints. ${errors.join(' | ')}`);
}

function normalizeAssistantApiReply(data, fallbackText = '') {
  if (!data || typeof data !== 'object') {
    return {
      reply: fallbackText || 'I could not generate a useful response for that question.',
      badges: [],
      followUps: [],
      sources: [],
      intent: 'unknown',
      confidence: 'Low',
      evidenceQuality: 'Weak',
      resolvedExecutors: [],
      conversationFocus: null,
      usedFollowUpContext: false
    };
  }

  return {
    reply: String(data.answerMarkdown || data.reply || fallbackText || '').trim(),
    badges: Array.isArray(data.badges) ? data.badges.filter(Boolean).slice(0, 5) : [data.mode, data.evidenceQuality ? `${data.evidenceQuality} Evidence` : ''].filter(Boolean),
    followUps: Array.isArray(data.followUps) ? data.followUps.filter(Boolean).slice(0, 4) : [],
    sources: Array.isArray(data.sources) ? data.sources.filter(source => source?.url && source?.title).slice(0, 4) : [],
    intent: data.intent || data.mode || 'unknown',
    confidence: data.confidence || 'Low',
    evidenceQuality: data.evidenceQuality || 'Weak',
    resolvedExecutors: Array.isArray(data.resolvedExecutors) ? data.resolvedExecutors.filter(Boolean) : [],
    conversationFocus: data.conversationFocus || null,
    safetyRefused: Boolean(data.safetyRefused),
    usedFollowUpContext: Boolean(data.usedFollowUpContext)
  };
}

function getAssistantSourceMarkdown(sources) {
  const usableSources = Array.isArray(sources) ? sources.filter(source => source?.url && source?.title).slice(0, 4) : [];
  if (!usableSources.length) return '';
  const rows = usableSources.map((source, index) => {
    const label = cleanAssistantSourceLabel(source.title, index + 1);
    const trust = source.trust ? ` — ${source.trust}` : '';
    const date = source.publishedDate ? `, ${source.publishedDate}` : '';
    return `* [${label}](${source.url})${trust}${date}`;
  });
  return `\n\n### Sources\n${rows.join('\n')}`;
}

function cleanAssistantSourceLabel(value, index) {
  const label = String(value || '').replace(/[\[\]\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
  return label.slice(0, 90) || `Source ${index}`;
}

function getAssistantBadgesFromApi(apiReply, fallbackBadges = []) {
  const badges = Array.isArray(apiReply?.badges) && apiReply.badges.length ? apiReply.badges : fallbackBadges;
  return [...new Set((badges || []).filter(Boolean).map(String))].slice(0, 5);
}

function initExploitAssistant() {
  const form = qs('#assistantForm');
  const input = qs('#assistantInput');
  const sendBtn = qs('#assistantSendBtn');
  const messages = qs('#assistantMessages');
  if (!form || !input || !sendBtn || !messages) return;
  if (form.dataset.apiIntegrated === 'true') return;
  form.dataset.apiIntegrated = 'true';

  let loadingInterval = null;
  let assistantMessageCounter = 0;
  const replyBanner = document.createElement('div');
  replyBanner.className = 'assistant-reply-target';
  replyBanner.hidden = true;
  form.parentNode?.insertBefore(replyBanner, form);

  const refreshReplyBanner = () => {
    if (!assistantReplyTarget) {
      replyBanner.hidden = true;
      replyBanner.textContent = '';
      input.placeholder = 'Example: Which executors are safest for beginners?';
      return;
    }

    replyBanner.hidden = false;
    replyBanner.textContent = '';
    const label = document.createElement('span');
    label.textContent = `Replying to: ${assistantReplyTarget.content.slice(0, 120)}${assistantReplyTarget.content.length > 120 ? '…' : ''}`;
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'assistant-reply-cancel';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => {
      assistantReplyTarget = null;
      refreshReplyBanner();
      input.focus();
    });
    replyBanner.append(label, cancel);
    input.placeholder = 'Write a reply aimed at the selected assistant message...';
  };

  const appendMessage = (role, text, badges = [], options = {}) => {
    const bubble = document.createElement('article');
    const messageId = options.id || `assistant-message-${Date.now()}-${assistantMessageCounter += 1}`;
    bubble.className = `assistant-message ${role === 'user' ? 'assistant-user' : 'assistant-bot'}`;
    bubble.dataset.messageId = messageId;
    const visibleBadges = role === 'bot' && Array.isArray(badges) ? badges.filter(badge => badge && badge !== 'Local Data') : [];
    if (visibleBadges.length) {
      const badgeWrap = document.createElement('div');
      badgeWrap.className = 'assistant-badges';
      visibleBadges.forEach(badge => {
        const el = document.createElement('span');
        el.className = 'assistant-badge';
        el.textContent = badge;
        badgeWrap.appendChild(el);
      });
      bubble.appendChild(badgeWrap);
    }

    const content = document.createElement('div');
    content.className = 'assistant-message-content';
    content.textContent = text;
    bubble.appendChild(content);
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  };

  const setReplyTargetFromMessage = messageElement => {
    const content = messageElement?.querySelector('.assistant-message-content, .assistant-markdown')?.textContent || messageElement?.textContent || '';
    const cleaned = content.replace(/\s+/g, ' ').trim().slice(0, 900);
    if (!cleaned) return;
    assistantReplyTarget = {
      id: messageElement.dataset.messageId || '',
      role: 'assistant',
      content: cleaned
    };
    refreshReplyBanner();
    input.focus();
  };

  const appendAssistantActions = (messageElement, apiReply, originalQuestion) => {
    if (!messageElement) return;
    messageElement.querySelector('.assistant-actions')?.remove();
    const actions = document.createElement('div');
    actions.className = 'assistant-actions';

    const actionRow = document.createElement('div');
    actionRow.className = 'assistant-action-row';

    const replyButton = document.createElement('button');
    replyButton.type = 'button';
    replyButton.className = 'assistant-reply-btn';
    replyButton.textContent = 'Reply';
    replyButton.setAttribute('aria-label', 'Reply directly to this assistant message');
    replyButton.addEventListener('click', () => setReplyTargetFromMessage(messageElement));
    actionRow.appendChild(replyButton);

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'assistant-reply-btn';
    copyButton.textContent = 'Copy';
    copyButton.setAttribute('aria-label', 'Copy this assistant reply');
    copyButton.addEventListener('click', async () => {
      const text = messageElement.querySelector('.assistant-markdown, .assistant-message-content')?.textContent || '';
      const copied = await copyTextToClipboard(text.trim());
      showToast(copied ? 'Reply copied to clipboard' : 'Could not copy that reply', copied ? 'positive' : 'warning');
    });
    actionRow.appendChild(copyButton);
    actions.appendChild(actionRow);

    const followUps = Array.isArray(apiReply?.followUps) ? apiReply.followUps.filter(Boolean).slice(0, 4) : [];
    if (followUps.length) {
      const followUpWrap = document.createElement('div');
      followUpWrap.className = 'assistant-followups';
      followUps.forEach(question => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'assistant-followup-chip';
        chip.textContent = question;
        chip.addEventListener('click', () => submitAssistantMessage(question));
        followUpWrap.appendChild(chip);
      });
      actions.appendChild(followUpWrap);
    }

    messageElement.appendChild(actions);
    if (originalQuestion) messageElement.dataset.originalQuestion = originalQuestion.slice(0, 260);
  };

  const updateAssistantContext = (userMessage, replyText, intentData, apiReply = {}) => {
    const resolvedExecutors = Array.isArray(apiReply.resolvedExecutors) && apiReply.resolvedExecutors.length
      ? apiReply.resolvedExecutors
      : intentData.entities;
    assistantContext = {
      lastIntent: apiReply.intent || intentData.intent,
      lastExecutors: resolvedExecutors,
      lastFilters: intentData.filters,
      lastQuestion: userMessage,
      lastRecommendation: resolvedExecutors[0] || getAssistantConversationExecutors()[0] || getRankedExecutors(intentData)[0]?.product?.name || null,
      conversationFocus: apiReply.conversationFocus || null,
      turns: [...(assistantContext.turns || []), { role: 'user', content: userMessage }, { role: 'assistant', content: replyText.slice(0, 1200) }].slice(-16)
    };
  };

  async function submitAssistantMessage(rawMessage) {
    const userMessage = String(rawMessage || input.value || '').trim();
    if (!userMessage) return;

    if (!consumeAiTokenForAssistant()) {
      appendMessage('bot', NO_ASSISTANT_TOKENS_MESSAGE, ['AI Tokens']);
      assistantPanelRefresh();
      openNoAiTokensModal();
      return;
    }
    assistantPanelRefresh();

    const activeReplyTarget = assistantReplyTarget;
    const displayMessage = activeReplyTarget
      ? `↪ ${activeReplyTarget.content.slice(0, 90)}${activeReplyTarget.content.length > 90 ? '…' : ''}\n${userMessage}`
      : userMessage;
    appendMessage('user', displayMessage);
    input.value = '';
    assistantReplyTarget = null;
    refreshReplyBanner();
    input.disabled = true;
    sendBtn.disabled = true;

    const intentData = detectAssistantIntent(userMessage);
    const loadingSteps = getAssistantLoadingSteps(intentData);
    const loadingMessage = appendMessage('bot', loadingSteps[0], [intentData.wantsFilterAction ? 'Filter Mode' : intentData.isFollowUp || activeReplyTarget ? 'Follow-up' : '']);
    let loadIndex = 0;
    if (loadingInterval) clearInterval(loadingInterval);
    loadingInterval = setInterval(() => {
      loadIndex = (loadIndex + 1) % loadingSteps.length;
      const target = loadingMessage.querySelector('.assistant-message-content') || loadingMessage.lastChild;
      if (target) target.textContent = loadingSteps[loadIndex];
    }, 750);

    try {
      let replyText = '';
      let apiReply = null;
      if (intentData.wantsFilterAction) {
        applyAssistantFilters(intentData.filters);
        const matchCount = qs('#productGrid')?.children?.length || 0;
        const filterLabel = [intentData.filters.price, ...(intentData.filters.platform || []), intentData.filters.keySystem].filter(Boolean).join(' + ') || 'requested filters';
        replyText = `### Filter Mode\nI filtered the page to show: ${filterLabel}\n\nMatching executors: ${matchCount}\n\n${matchCount ? 'Done — I filtered the page based on your request.' : 'I applied the filter, but no matching executors were found in the current Xyrex data.'}`;
        apiReply = normalizeAssistantApiReply({ reply: replyText, intent: 'filter_show', badges: ['Filter Mode'], followUps: ['Clear filters?', 'Compare visible executors?'] }, replyText);
      } else {
        try {
          const rawApiReply = await askExploitAssistant(userMessage, { ...assistantContext, replyTo: activeReplyTarget });
          apiReply = normalizeAssistantApiReply(rawApiReply);
          replyText = apiReply.reply || buildDirectAssistantReply(userMessage, intentData);
          if (apiReply.sources.length) replyText += getAssistantSourceMarkdown(apiReply.sources);
        } catch (apiError) {
          replyText = `${buildDirectAssistantReply(userMessage, intentData)}\n\n### Connection Note\nThe live assistant API was unavailable, so I answered using local Xyrex page data only.`;
          apiReply = normalizeAssistantApiReply({ reply: replyText, intent: intentData.intent, badges: ['Local Fallback'], confidence: 'Medium', evidenceQuality: 'Mixed', followUps: ['Try live research again?', 'Compare another executor?'] }, replyText);
          console.warn('Exploit Assistant API fallback:', apiError);
        }
      }

      setAssistantMessageMarkdown(loadingMessage, replyText);
      appendAssistantActions(loadingMessage, apiReply, userMessage);
      if (intentData.wantsFilterAction) {
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'assistant-clear-filters';
        clearBtn.textContent = 'Clear filters';
        clearBtn.addEventListener('click', () => {
          qsa('.filter-checkbox, .price-checkbox').forEach(cb => { cb.checked = false; });
          applyAllFilters();
        });
        loadingMessage.appendChild(clearBtn);
      }
      updateAssistantContext(userMessage, replyText, intentData, apiReply);
    } catch (error) {
      const safeMessage = (error && error.message) ? escapeHtml(error.message) : 'Unknown error';
      setAssistantMessageMarkdown(loadingMessage, `**Not confirmed**\n\n- The assistant could not answer that request because an error occurred.\n- ${safeMessage}`);
    } finally {
      if (loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = null;
      }
      input.disabled = false;
      sendBtn.disabled = false;
      assistantPanelRefresh();
      input.focus();
    }
  }

  const starter = qs('#assistantStarter');
  const tokenMeter = qs('#assistantTokenMeter');
  const charCount = qs('#assistantCharCount');
  const clearBtn = qs('#assistantClearBtn');

  const refreshTokenMeter = () => {
    if (!tokenMeter) return;
    const summary = getAiTokenSummary();
    tokenMeter.textContent = summary.available > 0
      ? `${summary.available} AI token${summary.available === 1 ? '' : 's'} left today`
      : 'No AI tokens left — they reset at midnight';
    tokenMeter.classList.toggle('is-empty', summary.available <= 0);
  };

  const refreshCharCount = () => {
    if (!charCount) return;
    charCount.textContent = `${input.value.length} / ${input.maxLength}`;
  };

  const renderStarter = () => {
    if (!starter) return;
    const hasConversation = messages.querySelector('.assistant-user');
    starter.hidden = Boolean(hasConversation);
    if (hasConversation) return;
    const prompts = [
      'Which executors are safest for beginners?',
      'What is the best free executor right now?',
      'Compare Potassium and Xeno',
      'Which executors work on mobile?',
      'What is the difference between sUNC and UNC?',
      'Show me keyless executors'
    ];
    starter.innerHTML = `
      <p class="assistant-starter-title">Try one of these</p>
      <div class="assistant-starter-chips">
        ${prompts.map(prompt => `<button class="assistant-starter-chip" type="button" data-assistant-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`).join('')}
      </div>`;
  };

  starter?.addEventListener('click', event => {
    const chip = event.target.closest('[data-assistant-prompt]');
    if (!chip) return;
    submitAssistantMessage(chip.getAttribute('data-assistant-prompt') || '');
  });

  input.addEventListener('input', refreshCharCount);

  clearBtn?.addEventListener('click', () => {
    messages.innerHTML = '';
    assistantContext = { lastIntent: null, lastExecutors: [], lastFilters: {}, lastQuestion: '', lastRecommendation: null, conversationFocus: null, turns: [] };
    assistantReplyTarget = null;
    refreshReplyBanner();
    seedWelcomeMessage();
    renderStarter();
    showToast('Conversation cleared', 'info');
  });

  function seedWelcomeMessage() {
    const welcome = appendMessage('bot', 'Hello. I am your Exploit Assistant. Ask me about active executors, compatibility, platforms, pricing, risk, or terminology.', ['Local Data']);
    appendAssistantActions(welcome, { followUps: ['What can you do?', 'Compare sUNC and UNC?', 'Which executors are safest for beginners?'] }, '');
  }

  if (!messages.children.length) seedWelcomeMessage();

  form.addEventListener('submit', event => {
    event.preventDefault();
    submitAssistantMessage(input.value);
  });

  assistantPanelRefresh = () => {
    refreshTokenMeter();
    renderStarter();
    refreshCharCount();
  };
  assistantPanelRefresh();
  refreshReplyBanner();
}


window.XyrexAISystem = Object.freeze({
  ask: askExploitAssistant,
  buildLocalRecommendationReply,
  buildFallback: getLocalAssistantFallback,
  systemPrompt: assistantSystemPrompt,
  endpoints: EXPLOIT_ASSISTANT_APIS
});

const savedScriptsStorageKey = 'xyrex_saved_scripts_v1';
let currentSavedScriptId = null;
let savedScriptsSearchTerm = '';

function getSavedScripts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(savedScriptsStorageKey) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(item => item && typeof item === 'object' && item.id)
      .map(item => ({
        id: String(item.id),
        title: String(item.title || 'Untitled script'),
        body: String(item.body || ''),
        createdAt: Number(item.createdAt) || Number(item.updatedAt) || Date.now(),
        updatedAt: Number(item.updatedAt) || Date.now()
      }));
  } catch {
    return [];
  }
}

function writeSavedScripts(items) {
  localStorage.setItem(savedScriptsStorageKey, JSON.stringify(items));
}

function saveScriptToLibrary(script) {
  const items = getSavedScripts();
  const existing = items.find(item => item.title === script.name);
  const now = Date.now();
  const nextItem = {
    id: existing?.id || `script_${now}`,
    title: script.name,
    body: script.script,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  writeSavedScripts([nextItem, ...items.filter(item => item.id !== nextItem.id)]);
  renderSavedScriptsList();
}

function formatByteSize(value) {
  const characters = String(value || '').length;
  if (characters < 1000) return `${characters} characters`;
  return `${(characters / 1000).toFixed(1)}k characters`;
}

function renderSavedScriptsList() {
  const wrap = qs('#savedScriptsList');
  if (!wrap) return;

  const items = getSavedScripts().sort((a, b) => b.updatedAt - a.updatedAt);
  const term = savedScriptsSearchTerm.toLowerCase();
  const visible = term
    ? items.filter(item => `${item.title} ${item.body}`.toLowerCase().includes(term))
    : items;

  if (!items.length) {
    wrap.innerHTML = '<div class="script-empty-state"><p>No saved scripts yet</p><p>Paste a script above, or save one straight from the Script Library</p></div>';
    return;
  }

  if (!visible.length) {
    wrap.innerHTML = '<div class="script-empty-state"><p>No saved scripts match that search</p></div>';
    return;
  }

  wrap.innerHTML = visible.map(item => `
    <article class="saved-script-item ${item.id === currentSavedScriptId ? 'is-active' : ''}" data-saved-item="${escapeHtml(item.id)}">
      <button class="saved-script-open" type="button" data-saved-script-id="${escapeHtml(item.id)}">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(formatByteSize(item.body))} • updated ${escapeHtml(new Date(item.updatedAt).toLocaleString())}</span>
      </button>
      <div class="saved-script-item-actions">
        <button class="btn-ghost-outline" type="button" data-saved-copy="${escapeHtml(item.id)}">Copy</button>
        <button class="btn-ghost-outline" type="button" data-saved-delete="${escapeHtml(item.id)}">Delete</button>
      </div>
    </article>`).join('');
}

function updateSavedEditorCounter() {
  const counter = qs('#savedScriptCounter');
  const bodyInput = qs('#savedScriptBody');
  if (!counter || !bodyInput) return;
  counter.textContent = formatByteSize(bodyInput.value);
}

function setSavedEditorStatus(message = '') {
  const status = qs('#savedEditorStatus');
  if (!status) return;
  status.textContent = message;
}

function clearSavedScriptEditor() {
  const nameInput = qs('#savedScriptName');
  const bodyInput = qs('#savedScriptBody');
  if (!nameInput || !bodyInput) return;
  nameInput.value = '';
  bodyInput.value = '';
  qs('#savedScriptError').hidden = true;
  updateSavedEditorCounter();
}

function setEditorFromSavedScript(item) {
  const nameInput = qs('#savedScriptName');
  const bodyInput = qs('#savedScriptBody');
  if (!nameInput || !bodyInput) return;
  nameInput.value = item?.title || '';
  bodyInput.value = item?.body || '';
  updateSavedEditorCounter();
  setSavedEditorStatus(item ? `Editing "${item.title}"` : '');
}

function saveScriptFromEditor() {
  const nameInput = qs('#savedScriptName');
  const bodyInput = qs('#savedScriptBody');
  const errorBlock = qs('#savedScriptError');
  if (!nameInput || !bodyInput || !errorBlock) return;

  const trimmedTitle = nameInput.value.trim();
  const trimmedBody = bodyInput.value.trim();

  if (!trimmedTitle || !trimmedBody) {
    errorBlock.hidden = false;
    return;
  }

  errorBlock.hidden = true;

  const items = getSavedScripts();
  const existing = items.find(item => item.id === currentSavedScriptId);
  const now = Date.now();
  const scriptToPersist = {
    id: currentSavedScriptId || `script_${now}`,
    title: trimmedTitle,
    body: bodyInput.value,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  writeSavedScripts([scriptToPersist, ...items.filter(item => item.id !== scriptToPersist.id)]);
  currentSavedScriptId = null;
  clearSavedScriptEditor();
  renderSavedScriptsList();
  setSavedEditorStatus(`Saved "${trimmedTitle}"`);
  showToast(`Saved "${trimmedTitle}"`, 'positive');
  nameInput.focus();
}

function deleteSavedScriptById(scriptId) {
  const items = getSavedScripts();
  const target = items.find(item => item.id === scriptId);
  if (!target) return;
  writeSavedScripts(items.filter(item => item.id !== scriptId));
  if (currentSavedScriptId === scriptId) {
    currentSavedScriptId = null;
    clearSavedScriptEditor();
  }
  renderSavedScriptsList();
  setSavedEditorStatus(`Deleted "${target.title}"`);
  showToast(`Deleted "${target.title}"`, 'info');
}

function deleteSelectedScript() {
  if (!currentSavedScriptId) {
    setSavedEditorStatus('Select a saved script first');
    return;
  }
  deleteSavedScriptById(currentSavedScriptId);
}

function exportSavedScripts() {
  const items = getSavedScripts();
  if (!items.length) {
    showToast('There is nothing to export yet', 'warning');
    return;
  }
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), scripts: items }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `xyrex-saved-scripts-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(`Exported ${items.length} script${items.length === 1 ? '' : 's'}`, 'positive');
}

async function importSavedScripts(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = Array.isArray(parsed) ? parsed : parsed?.scripts;
    if (!Array.isArray(incoming)) throw new Error('Unexpected file shape');

    const existing = getSavedScripts();
    const merged = new Map(existing.map(item => [item.id, item]));
    let added = 0;

    incoming.forEach(item => {
      if (!item || typeof item !== 'object' || !item.title || !item.body) return;
      const id = String(item.id || `script_${Date.now()}_${added}`);
      const current = merged.get(id);
      const updatedAt = Number(item.updatedAt) || Date.now();
      if (current && current.updatedAt >= updatedAt) return;
      merged.set(id, {
        id,
        title: String(item.title),
        body: String(item.body),
        createdAt: Number(item.createdAt) || updatedAt,
        updatedAt
      });
      added += 1;
    });

    writeSavedScripts([...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt));
    renderSavedScriptsList();
    showToast(added ? `Imported ${added} script${added === 1 ? '' : 's'}` : 'Nothing new to import', added ? 'positive' : 'info');
  } catch {
    showToast('That file could not be read as a Xyrex script export', 'warning');
  }
}

function initSavedScripts() {
  const listWrap = qs('#savedScriptsList');
  listWrap?.addEventListener('click', async event => {
    const copyTrigger = event.target.closest('[data-saved-copy]');
    if (copyTrigger) {
      const item = getSavedScripts().find(entry => entry.id === copyTrigger.getAttribute('data-saved-copy'));
      if (!item) return;
      const copied = await copyTextToClipboard(item.body);
      showToast(copied ? `${item.title} copied to clipboard` : 'Could not copy that script', copied ? 'positive' : 'warning');
      return;
    }

    const deleteTrigger = event.target.closest('[data-saved-delete]');
    if (deleteTrigger) {
      deleteSavedScriptById(deleteTrigger.getAttribute('data-saved-delete'));
      return;
    }

    const openTrigger = event.target.closest('[data-saved-script-id]');
    if (!openTrigger) return;
    const selectedId = openTrigger.getAttribute('data-saved-script-id');
    if (selectedId === currentSavedScriptId) {
      currentSavedScriptId = null;
      clearSavedScriptEditor();
      setSavedEditorStatus('');
      renderSavedScriptsList();
      return;
    }
    currentSavedScriptId = selectedId;
    setEditorFromSavedScript(getSavedScripts().find(item => item.id === currentSavedScriptId));
    renderSavedScriptsList();
  });

  qs('#saveScriptBtn')?.addEventListener('click', saveScriptFromEditor);
  qs('#deleteScriptBtn')?.addEventListener('click', deleteSelectedScript);
  qs('#newScriptBtn')?.addEventListener('click', () => {
    currentSavedScriptId = null;
    clearSavedScriptEditor();
    setSavedEditorStatus('');
    renderSavedScriptsList();
    qs('#savedScriptName')?.focus();
  });

  qs('#savedScriptBody')?.addEventListener('input', updateSavedEditorCounter);
  qs('#savedScriptSearch')?.addEventListener('input', event => {
    savedScriptsSearchTerm = event.target.value.trim();
    renderSavedScriptsList();
  });

  qs('#exportScriptsBtn')?.addEventListener('click', exportSavedScripts);
  const importInput = qs('#importScriptsInput');
  qs('#importScriptsBtn')?.addEventListener('click', () => importInput?.click());
  importInput?.addEventListener('change', async event => {
    await importSavedScripts(event.target.files?.[0]);
    event.target.value = '';
  });

  updateSavedEditorCounter();
}


const uiModeStorageKey = 'xyrex_ui_mode';
let isNewUiMode = localStorage.getItem(uiModeStorageKey) === 'new';
let newUiLoadAttempted = false;

function loadNewUiModule() {
  if (window.XyrexNewUI) return Promise.resolve(true);
  if (newUiLoadAttempted) return Promise.resolve(false);
  newUiLoadAttempted = true;

  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = '/new-ui.js?v=2.1.4';
    script.defer = true;
    script.onload = () => resolve(Boolean(window.XyrexNewUI));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

async function applyUiMode() {
  if (!isNewUiMode) {
    if (window.XyrexNewUI) window.XyrexNewUI.disable();
    return;
  }

  const loaded = await loadNewUiModule();
  if (!loaded || !window.XyrexNewUI) {
    isNewUiMode = false;
    localStorage.setItem(uiModeStorageKey, 'default');
    return;
  }

  window.XyrexNewUI.enable();
}

let activePageId = null;
let activeSubtabId = 'smartRankingsPanel';
let suppressRouteSync = false;

const SEO_DEFAULT_TITLE = 'Xyrex.lol | Roblox Executor Directory, sUNC Comparisons, and Script Hub';
const SEO_DEFAULT_DESCRIPTION = 'Xyrex.lol is a Roblox executor and script hub featuring executor comparisons, sUNC scores, platform filters, trusted reviews, popular scripts, and real-time updates.';
const SEO_DEFAULT_IMAGE = 'https://xyrex.lol/otherscripts/logo.png';
const SEO_PATH_META = {
  '/': {
    title: SEO_DEFAULT_TITLE,
    description: SEO_DEFAULT_DESCRIPTION
  },
  '/executors': {
    title: SEO_DEFAULT_TITLE,
    description: SEO_DEFAULT_DESCRIPTION
  },
  '/scripthub': {
    title: 'Xyrex Script Hub | Rankings, Comparisons, and Script Discovery',
    description: 'Explore the Xyrex Script Hub for executor rankings, trusted comparisons, popular scripts, saved scripts, and real-time Roblox script discovery updates'
  },
  '/dodge': {
    title: 'Xyrex Dodge | Play the Built-In Dodge Game',
    description: 'Play Xyrex Dodge, the built-in reflex game with missions, progression, responsive controls, and unlockable rewards.'
  },
  '/dodge.html': {
    title: 'Xyrex Dodge | Play the Built-In Dodge Game',
    description: 'Play Xyrex Dodge, the built-in reflex game with missions, progression, responsive controls, and unlockable rewards.'
  }
};

function updateSeoMetadata() {
  const currentPath = normalisePath(window.location.pathname).replace(/^\/newui/, '') || '/';
  const pageSeo = SEO_PATH_META[currentPath] || SEO_PATH_META['/'];
  const canonicalUrl = `https://xyrex.lol${currentPath === '/' ? '/' : currentPath}`;
  document.title = pageSeo.title;

  const upsertMeta = (selector, attrName, value) => {
    const element = document.querySelector(selector);
    if (!element) return;
    element.setAttribute(attrName, value);
  };

  upsertMeta('meta[name="description"]', 'content', pageSeo.description);
  upsertMeta('meta[property="og:title"]', 'content', pageSeo.title);
  upsertMeta('meta[property="og:description"]', 'content', pageSeo.description);
  upsertMeta('meta[property="og:url"]', 'content', canonicalUrl);
  upsertMeta('meta[name="twitter:title"]', 'content', pageSeo.title);
  upsertMeta('meta[name="twitter:description"]', 'content', pageSeo.description);
  upsertMeta('meta[name="twitter:image"]', 'content', SEO_DEFAULT_IMAGE);
  upsertMeta('meta[property="og:image"]', 'content', SEO_DEFAULT_IMAGE);

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', canonicalUrl);
}

function normalisePath(pathname) {
  const clean = String(pathname || '/').replace(/\/+$/, '');
  return clean || '/';
}

function getRouteStateFromPath(pathname) {
  const segments = normalisePath(pathname).split('/').filter(Boolean).map(item => item.toLowerCase());
  let isRouteNewUi = false;
  let cursor = 0;

  if (segments[0] === 'newui') {
    isRouteNewUi = true;
    cursor = 1;
  }

  let pageId = 'executorsPage';
  let subtabId = 'smartRankingsPanel';
  let redirectToDodge = false;

  if (segments[cursor] === 'scripthub') {
    pageId = 'scriptsPage';
  } else if (segments[cursor] === 'dodge') {
    redirectToDodge = true;
  }

  return {
    isRouteNewUi,
    pageId,
    subtabId,
    redirectToDodge
  };
}

function buildPathFromState() {
  const base = isNewUiMode ? '/newui' : '';
  if (activePageId === 'scriptsPage') return `${base}/scripthub`;

  return `${base}/executors`;
}

function syncRouteWithState(replace = false) {
  if (suppressRouteSync) return;
  const nextPath = buildPathFromState();
  if (normalisePath(window.location.pathname) === normalisePath(nextPath)) return;
  const method = replace ? 'replaceState' : 'pushState';
  window.history[method]({}, '', nextPath);
  updateSeoMetadata();
}

function syncNavButtonsWithPage(targetPageId) {
  qsa('.page-switch-btn').forEach(item => {
    item.classList.toggle('is-active', item.getAttribute('data-page-target') === targetPageId);
  });
}

function syncSubtabButtons(targetSubtabId) {
  qsa('.subtab-btn').forEach(item => {
    const active = item.getAttribute('data-subtab-target') === targetSubtabId;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-selected', String(active));
  });
}


function normalizeIncomingRoute(routeValue) {
  const route = String(routeValue || '').trim();
  if (!route) return '/';

  try {
    const parsed = new URL(route, window.location.origin);
    return parsed.pathname || '/';
  } catch {
    const pathOnly = route.split(/[?#]/)[0];
    return pathOnly.startsWith('/') ? pathOnly : '/';
  }
}

function getInitialRoutePath() {
  const params = new URLSearchParams(window.location.search);
  const routeParam = params.get('route');
  if (!routeParam) return window.location.pathname;
  return normalizeIncomingRoute(routeParam);
}

async function applyRoute(pathname, replace = false) {
  const routeState = getRouteStateFromPath(pathname);

  if (routeState.redirectToDodge) {
    window.location.replace('/dodge.html');
    return;
  }

  suppressRouteSync = true;

  isNewUiMode = routeState.isRouteNewUi;
  localStorage.setItem(uiModeStorageKey, isNewUiMode ? 'new' : 'default');

  syncNavButtonsWithPage(routeState.pageId);
  syncSubtabButtons(routeState.subtabId);
  setActiveSubtab(routeState.subtabId);
  setActivePage(routeState.pageId);
  await applyUiMode();

  suppressRouteSync = false;
  syncRouteWithState(replace);
  updateSeoMetadata();
}

function restartAnimationClass(element, animationClass) {
  if (!element) return;
  element.classList.remove(animationClass);
  void element.offsetWidth;
  element.classList.add(animationClass);
}

function animateMainContentTransition() {
  restartAnimationClass(qs('.main-content'), 'is-view-switching');
}

function shouldReduceMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

function isCoarsePointerDevice() {
  return window.matchMedia?.('(pointer: coarse)')?.matches || false;
}

let activeSubtabTransitionToken = 0;


function setActivePage(targetPageId) {
  if (targetPageId === activePageId) return;

  const nextPage = qs(`#${targetPageId}`);
  if (!nextPage) return;

  qsa('.app-page').forEach(page => {
    const isTarget = page.id === targetPageId;
    page.hidden = !isTarget;
    page.classList.toggle('is-active', isTarget);
  });

  animateMainContentTransition();
  restartAnimationClass(nextPage, 'animate-in-page');
  activePageId = targetPageId;

  const onScriptsPage = targetPageId === 'scriptsPage';
  qs('#sidebar').hidden = onScriptsPage;
  qs('#searchInput').disabled = onScriptsPage;
  qs('#clearSearchBtn').disabled = onScriptsPage;
  qs('.page-layout').classList.toggle('scripts-mode', onScriptsPage);

  syncRouteWithState();
}

function focusFirstElementInPanel(panel) {
  if (!panel) return;
  const focusable = panel.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable) {
    focusable.focus({ preventScroll: true });
    return;
  }
  panel.setAttribute('tabindex', '-1');
  panel.focus({ preventScroll: true });
}

function setActiveSubtab(targetSubtabId, options = {}) {
  const { moveFocus = false } = options;
  if (targetSubtabId === activeSubtabId) {
    if (moveFocus) focusFirstElementInPanel(qs(`#${targetSubtabId}`));
    return;
  }

  const nextPanel = qs(`#${targetSubtabId}`);
  const previousPanel = qs(`#${activeSubtabId}`);
  if (!nextPanel) return;

  const wrapper = nextPanel.parentElement;
  const transitionToken = ++activeSubtabTransitionToken;
  const reduceMotion = shouldReduceMotion();

  if (!previousPanel || reduceMotion) {
    qsa('.subtab-panel').forEach(panel => {
      panel.hidden = panel.id !== targetSubtabId;
      panel.classList.remove('is-transitioning-out', 'is-transitioning-in', 'is-current');
      if (panel.id === targetSubtabId) panel.classList.add('is-current');
    });
    if (moveFocus) focusFirstElementInPanel(nextPanel);
  } else {
    const wrapperHeight = Math.max(previousPanel.offsetHeight, nextPanel.offsetHeight);
    wrapper.style.minHeight = `${wrapperHeight}px`;

    previousPanel.hidden = false;
    nextPanel.hidden = false;

    previousPanel.classList.remove('is-current', 'is-transitioning-in');
    previousPanel.classList.add('is-transitioning-out');

    nextPanel.classList.remove('is-transitioning-out');
    nextPanel.classList.add('is-transitioning-in', 'is-current');

    window.setTimeout(() => {
      if (transitionToken !== activeSubtabTransitionToken) return;
      previousPanel.hidden = true;
      previousPanel.classList.remove('is-transitioning-out');
      nextPanel.classList.remove('is-transitioning-in');
      wrapper.style.minHeight = '';
      if (moveFocus) focusFirstElementInPanel(nextPanel);
    }, 210);
  }

  activeSubtabId = targetSubtabId;
  syncRouteWithState();
}

function injectLegendIcons() {
  qsa('.legend-icon[data-icon]').forEach(icon => {
    const key = icon.getAttribute('data-icon');
    if (!svgIcons[key]) return;
    icon.innerHTML = `<span class="icon-svg">${svgIcons[key]}</span>`;
  });
}

function initScriptsHub() {
  cleanupAetherCoreBranding();
  renderSmartRankings();
  renderComparisonSystem();
  initScriptLibraryControls();
  renderPopularScripts();
  cleanupAetherCoreBranding();
  renderRecentChanges();
  initSavedScripts();
  renderSavedScriptsList();
  initExploitAssistant();

  const subtabButtons = qsa('.subtab-btn');
  subtabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-subtab-target');
      syncSubtabButtons(target);
      setActiveSubtab(target, { moveFocus: !isCoarsePointerDevice() });
    });

    btn.addEventListener('keydown', event => {
      const key = event.key;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) return;
      event.preventDefault();
      const currentIndex = subtabButtons.indexOf(btn);
      let nextIndex = currentIndex;
      if (key === 'ArrowLeft' || key === 'ArrowUp') nextIndex = (currentIndex - 1 + subtabButtons.length) % subtabButtons.length;
      if (key === 'ArrowRight' || key === 'ArrowDown') nextIndex = (currentIndex + 1) % subtabButtons.length;
      if (key === 'Home') nextIndex = 0;
      if (key === 'End') nextIndex = subtabButtons.length - 1;
      const nextButton = subtabButtons[nextIndex];
      if (!nextButton) return;
      nextButton.focus();
      const target = nextButton.getAttribute('data-subtab-target');
      syncSubtabButtons(target);
      setActiveSubtab(target, { moveFocus: !isCoarsePointerDevice() });
    });
  });

  qsa('.page-switch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-page-target');
      syncNavButtonsWithPage(target);
      setActivePage(target);
    });
  });

  qs('#savedScriptsList').addEventListener('click', event => {
    const trigger = event.target.closest('[data-saved-script-id]');
    if (!trigger) return;
    const selectedId = trigger.getAttribute('data-saved-script-id');
    if (selectedId === currentSavedScriptId) {
      currentSavedScriptId = null;
      clearSavedScriptEditor();
      renderSavedScriptsList();
      return;
    }
    currentSavedScriptId = selectedId;
    const selected = getSavedScripts().find(item => item.id === currentSavedScriptId);
    setEditorFromSavedScript(selected);
    renderSavedScriptsList();
  });

  qs('#saveScriptBtn').addEventListener('click', saveScriptFromEditor);
  qs('#deleteScriptBtn').addEventListener('click', deleteSelectedScript);
}

function syncNavigationLayoutMetrics() {
  const topnav = qs('.topnav');
  if (!topnav) return;

  const updateNavHeight = () => {
    const navHeight = Math.max(56, Math.ceil(topnav.getBoundingClientRect().height));
    document.documentElement.style.setProperty('--nav-height', `${navHeight}px`);
  };

  updateNavHeight();
  window.addEventListener('resize', updateNavHeight, { passive: true });
  window.addEventListener('orientationchange', updateNavHeight, { passive: true });

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(updateNavHeight);
    observer.observe(topnav);
  }
}



function hideInitialLoadingOverlay() {
  const overlay = qs('#appLoadingOverlay');
  if (!overlay) return;
  overlay.classList.add('is-hidden');
  window.setTimeout(() => {
    overlay.remove();
  }, 260);
}

function init() {
  applyExecutorTabPreferences();
  setBetaFeaturesEnabled(getBetaFeaturesEnabled());
  syncNavigationLayoutMetrics();

  const storedExecutorSort = localStorage.getItem(EXECUTOR_SORT_KEY);
  const executorSortSelect = qs('#executorSortSelect');
  if (storedExecutorSort && ['featured', 'name', 'sunc', 'trust', 'price'].includes(storedExecutorSort)) {
    executorSortMode = storedExecutorSort;
    if (executorSortSelect) executorSortSelect.value = executorSortMode;
  }
  executorSortSelect?.addEventListener('change', event => {
    executorSortMode = event.target.value;
    localStorage.setItem(EXECUTOR_SORT_KEY, executorSortMode);
    applyAllFilters();
  });

  renderProducts(products);
  initWeaoStatuses();
  initScriptsHub();
  injectLegendIcons();

  qs('#searchInput').addEventListener('input', applyAllFilters);
  qs('#searchInput').addEventListener('keydown', e => {
    const searchInput = qs('#searchInput');
    const searchValue = searchInput.value.trim().toLowerCase();
    if (e.key !== 'Enter') return;

    e.preventDefault();

    if (searchValue === 'dodge') {
      window.location.href = '/dodge.html';
      return;
    }

    applyAllFilters();

    searchInput.blur();
  });

  qs('#clearSearchBtn').addEventListener('click', () => {
    qs('#searchInput').value = '';
    applyAllFilters();
  });

  qs('#brandHomeBtn').addEventListener('click', () => {
    qs('#searchInput').value = '';
    applyAllFilters();
    syncNavButtonsWithPage('executorsPage');
    setActivePage('executorsPage');
  });

  qs('#settingsTabBtn').addEventListener('click', openSettingsModal);

  qsa('.filter-checkbox').forEach(cb => cb.addEventListener('change', applyAllFilters));
  qsa('.price-checkbox').forEach(cb => cb.addEventListener('change', applyAllFilters));

  qs('#resetFilters').addEventListener('click', () => {
    qsa('.filter-checkbox, .price-checkbox').forEach(cb => (cb.checked = false));
    qs('#searchInput').value = '';
    applyAllFilters();
  });

  qs('#modalCloseBtn').addEventListener('click', closeModal);
  qs('#modalOverlay').addEventListener('click', e => {
    if (e.target === qs('#modalOverlay')) closeModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  window.addEventListener('popstate', () => {
    applyRoute(getInitialRoutePath(), true);
  });

  applyRoute(getInitialRoutePath(), true).finally(() => {
    applyComparisonFromQueryParam();
    openScriptFromQueryParam();
    window.setTimeout(hideInitialLoadingOverlay, 1000);
  });

  if (window.XyrexLore?.initLoreSystem) {
    window.XyrexLore.initLoreSystem();
  }
}

document.addEventListener('DOMContentLoaded', init);
