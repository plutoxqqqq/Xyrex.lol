(function () {
  const THEME_KEY = 'xyrex_new_ui_theme';
  const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

  const themeDefaults = {
    bg: '#06070d',
    bg2: '#0a0c14',
    panel: '#111426',
    panel2: '#12172b',
    card: '#12162a',
    text: '#eef1ff',
    muted: '#aeb5d6',
    accent: '#8f9cff',
    accentSoft: '#b2bcff',
    success: '#5dd39e',
    warning: '#f0c36f',
    danger: '#ff4d6d'
  };

  const themeFields = [
    ['bg', ['--bg']],
    ['bg2', ['--bg-2', '--surface-2']],
    ['panel', ['--panel', '--surface']],
    ['panel2', ['--panel-2', '--surface-3']],
    ['card', ['--card']],
    ['text', ['--text']],
    ['muted', ['--muted', '--text-soft']],
    ['accent', ['--periwinkle', '--accent']],
    ['accentSoft', ['--periwinkle-2', '--accent-soft']],
    ['success', ['--accent-success', '--success']],
    ['warning', ['--accent-warning', '--warning']],
    ['danger', ['--accent-danger', '--danger']]
  ];

  function safeParseTheme(value) {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function hexToRgba(hex, alpha = 1) {
    if (!HEX_COLOR_RE.test(hex)) return null;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const safeAlpha = Math.max(0, Math.min(1, Number(alpha)));
    return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
  }

  function shiftHex(hex, amount) {
    if (!HEX_COLOR_RE.test(hex)) return null;
    const channel = offset => Math.max(0, Math.min(255, parseInt(hex.slice(offset, offset + 2), 16) + amount));
    const toHex = value => value.toString(16).padStart(2, '0');
    return `#${toHex(channel(1))}${toHex(channel(3))}${toHex(channel(5))}`;
  }

  function getSavedThemeObject() {
    return safeParseTheme(localStorage.getItem(THEME_KEY));
  }

  function getCurrentTheme() {
    return { ...themeDefaults, ...(getSavedThemeObject() || {}) };
  }

  function applyTheme(themeIdOrThemeObj) {
    const root = document.documentElement;
    const theme = typeof themeIdOrThemeObj === 'object' ? themeIdOrThemeObj : getSavedThemeObject();
    const normalized = { ...themeDefaults, ...(theme || {}) };

    themeFields.forEach(([key, cssVars]) => {
      const value = normalized[key];
      if (!HEX_COLOR_RE.test(value)) return;
      cssVars.forEach(cssVar => root.style.setProperty(cssVar, value));
    });

    const accent = normalized.accent;
    const accentSoft = normalized.accentSoft;
    const accentBorder = hexToRgba(accent, 0.44) || 'rgba(143, 156, 255, 0.44)';
    const accentGlow = hexToRgba(accentSoft, 0.38) || 'rgba(178, 188, 255, 0.38)';
    const accentHover = shiftHex(accent, 16) || themeDefaults.accent;

    root.style.setProperty('--accent-hover', accentHover);
    root.style.setProperty('--accent-border', accentBorder);
    root.style.setProperty('--accent-glow', accentGlow);
    root.style.setProperty('--border', 'rgba(255,255,255,0.11)');
    root.style.setProperty('--border-strong', 'rgba(255,255,255,0.24)');
    root.style.setProperty('--shadow', '0 10px 24px rgba(0,0,0,0.35)');

    window.dispatchEvent(new Event('xyrex:theme-updated'));
    return normalized;
  }

  function applyCustomAccent(color) {
    if (!HEX_COLOR_RE.test(color || '')) return false;
    const current = getCurrentTheme();
    const updated = { ...current, accent: color, accentSoft: shiftHex(color, 24) || current.accentSoft };
    localStorage.setItem(THEME_KEY, JSON.stringify(updated));
    applyTheme(updated);
    return true;
  }

  function loadSavedTheme() {
    const theme = getSavedThemeObject();
    if (!theme || typeof theme !== 'object') {
      applyTheme(themeDefaults);
      return { ...themeDefaults };
    }
    return applyTheme(theme);
  }

  function resetThemeOverrides() {
    const root = document.documentElement;
    themeFields.forEach(([, cssVars]) => {
      cssVars.forEach(cssVar => root.style.removeProperty(cssVar));
    });
    [
      '--accent-hover',
      '--accent-border',
      '--accent-glow',
      '--border',
      '--border-strong',
      '--shadow'
    ].forEach(cssVar => root.style.removeProperty(cssVar));
    window.dispatchEvent(new Event('xyrex:theme-updated'));
    return { ...themeDefaults };
  }

  window.XyrexTheme = {
    THEME_KEY,
    themeDefaults,
    hexToRgba,
    applyTheme,
    applyCustomAccent,
    loadSavedTheme,
    resetThemeOverrides,
    getCurrentTheme
  };
})();
