(function () {
  const themeApi = window.XyrexTheme || null;
  const THEME_KEY = themeApi?.THEME_KEY || 'xyrex_new_ui_theme';
  const AI_ENDPOINT = 'https://text.pollinations.ai/';
  const THEME_MODAL_ID = 'newUiThemeModal';
  const AI_REQUEST_TIMEOUT_MS = 14000;
  const AI_MAX_ATTEMPTS = 4;
  const themeDefaults = themeApi?.themeDefaults || {
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
    warning: '#f0c36f'
  };
  const pastelThemePresets = [
    {
      id: 'lavender-mist',
      label: 'Lavender Mist',
      colors: {
        bg: '#191a29', bg2: '#21233a', panel: '#2a2d49', panel2: '#323556', card: '#3a3e66',
        text: '#f8f4ff', muted: '#d5cde8', accent: '#c5b7ff', accentSoft: '#e2d8ff', success: '#9fe0bf', warning: '#ffd8a8'
      }
    },
    {
      id: 'mint-cloud',
      label: 'Mint Cloud',
      colors: {
        bg: '#182324', bg2: '#223032', panel: '#2c3f41', panel2: '#355053', card: '#3f6064',
        text: '#f2fffa', muted: '#c9e8dd', accent: '#9ddfd3', accentSoft: '#c5f1e8', success: '#a8eac8', warning: '#ffd9aa'
      }
    },
    {
      id: 'peach-haze',
      label: 'Peach Haze',
      colors: {
        bg: '#2a1f1d', bg2: '#352724', panel: '#43312d', panel2: '#523a35', card: '#60443e',
        text: '#fff5ef', muted: '#e8ccc2', accent: '#ffb8a6', accentSoft: '#ffd8cc', success: '#b7e5be', warning: '#ffe0a6'
      }
    },
    {
      id: 'powder-sky',
      label: 'Powder Sky',
      colors: {
        bg: '#1a2230', bg2: '#232d3f', panel: '#2d3950', panel2: '#36445f', card: '#425373',
        text: '#f1f7ff', muted: '#c8d8ec', accent: '#abcfff', accentSoft: '#d4e6ff', success: '#a7dfcf', warning: '#ffe0aa'
      }
    },
    {
      id: 'pink-bloom',
      label: 'Pink Bloom',
      colors: {
        bg: '#2b1423', bg2: '#381a2d', panel: '#4a223c', panel2: '#5d2b4d', card: '#723760',
        text: '#fff0fb', muted: '#efbfdc', accent: '#ff78c9', accentSoft: '#ffc4e8', success: '#a4e6c8', warning: '#ffd7ad'
      }
    }
  ];
  let cssLoaded = false;
  let gridObserver = null;
  function loadCss() {
    if (cssLoaded || document.querySelector('link[data-new-ui-css="true"]')) {
      cssLoaded = true;
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/new-ui.css?v=2.1.3';
    link.dataset.newUiCss = 'true';
    document.head.appendChild(link);
    cssLoaded = true;
  }
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function getThemeFromStorage() {
    if (themeApi?.getCurrentTheme) return themeApi.getCurrentTheme();
    try {
      return JSON.parse(localStorage.getItem(THEME_KEY) || 'null');
    } catch {
      return null;
    }
  }
  function hexToRgb(hex) {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!match) return null;
    return { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) };
  }
  function rgbToHex(r, g, b) {
    return `#${[r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
  }
  function shiftRgb(rgb, amount) {
    return rgbToHex(rgb.r + amount, rgb.g + amount, rgb.b + amount);
  }
  function mixRgb(a, b, ratio) {
    return rgbToHex(
      a.r * (1 - ratio) + b.r * ratio,
      a.g * (1 - ratio) + b.g * ratio,
      a.b * (1 - ratio) + b.b * ratio
    );
  }
  function applyTheme(theme) {
    if (themeApi?.applyTheme) return themeApi.applyTheme(theme);
  }
  function clearThemeOverrides() {
    if (themeApi?.resetThemeOverrides) themeApi.resetThemeOverrides();
  }
  function closeThemeModal() {
    const modal = document.getElementById(THEME_MODAL_ID);
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
  }
  function ensureThemeModal() {
    if (document.getElementById(THEME_MODAL_ID)) return;
    const modal = document.createElement('div');
    modal.id = THEME_MODAL_ID;
    modal.className = 'new-ui-theme-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <section class="new-ui-theme-panel" role="dialog" aria-modal="true" aria-label="Theme Customizer">
        <header class="new-ui-theme-head">
          <div>
            <h3>Theme Customizer</h3>
            <p>Adjust the full site palette and mood, then apply it to reload with your selected theme</p>
          </div>
          <button type="button" class="new-ui-theme-close" aria-label="Close Theme Customizer">✕</button>
        </header>
        <div class="new-ui-theme-tabs" role="tablist" aria-label="Theme customizer mode">
          <button type="button" class="new-ui-theme-tab is-active" role="tab" aria-selected="true" data-theme-tab-target="newUiThemeBasicPanel">Basic</button>
          <button type="button" class="new-ui-theme-tab" role="tab" aria-selected="false" data-theme-tab-target="newUiThemeAdvancedPanel">Advanced</button>
        </div>
        <section id="newUiThemeBasicPanel" class="new-ui-theme-panel-block" role="tabpanel">
          <p class="new-ui-theme-note">Choose a pastel preset</p>
          <div id="newUiPresetSwatches" class="new-ui-preset-swatches"></div>
        </section>
        <section id="newUiThemeAdvancedPanel" class="new-ui-theme-panel-block" role="tabpanel" hidden>
          <div class="new-ui-theme-grid">
            <label>Background <input type="color" id="newUiBg" value="#06070d" /></label>
            <label>Background 2 <input type="color" id="newUiBg2" value="#0a0c14" /></label>
            <label>Panel <input type="color" id="newUiPanel" value="#111426" /></label>
            <label>Panel 2 <input type="color" id="newUiPanel2" value="#12172b" /></label>
            <label>Card <input type="color" id="newUiCard" value="#12162a" /></label>
            <label>Text <input type="color" id="newUiText" value="#eef1ff" /></label>
            <label>Muted Text <input type="color" id="newUiMuted" value="#aeb5d6" /></label>
            <label>Primary Accent <input type="color" id="newUiAccent" value="#8f9cff" /></label>
            <label>Secondary Accent <input type="color" id="newUiAccentSoft" value="#b2bcff" /></label>
            <label>Success Accent <input type="color" id="newUiSuccess" value="#5dd39e" /></label>
            <label>Warning Accent <input type="color" id="newUiWarning" value="#f0c36f" /></label>
          </div>
        </section>
        <div class="new-ui-theme-preview" id="newUiThemePreview">
          <strong id="newUiThemePreviewLabel">Pending theme: Current</strong>
          <div class="new-ui-theme-preview-swatches" id="newUiThemePreviewSwatches"></div>
        </div>
        <div class="new-ui-theme-actions">
          <button type="button" class="btn-primary" id="saveNewUiThemeBtn">Apply Theme</button>
          <button type="button" class="btn-danger" id="resetNewUiThemeBtn">Reset</button>
        </div>
      </section>
    `;
    document.body.appendChild(modal);
    const colorInputMap = {
      bg: '#newUiBg',
      bg2: '#newUiBg2',
      panel: '#newUiPanel',
      panel2: '#newUiPanel2',
      card: '#newUiCard',
      text: '#newUiText',
      muted: '#newUiMuted',
      accent: '#newUiAccent',
      accentSoft: '#newUiAccentSoft',
      success: '#newUiSuccess',
      warning: '#newUiWarning'
    };
    const saved = { ...themeDefaults, ...(getThemeFromStorage() || {}) };
    const presetWrap = modal.querySelector('#newUiPresetSwatches');
    presetWrap.innerHTML = pastelThemePresets.map(preset => `
      <button
        type="button"
        class="new-ui-preset-swatch"
        title="${escapeHtml(preset.label)}"
        aria-label="${escapeHtml(preset.label)}"
        data-preset-id="${escapeHtml(preset.id)}"
        style="background: radial-gradient(circle at 28% 22%, ${preset.colors.accentSoft}, ${preset.colors.accent} 44%, ${preset.colors.panel} 100%);"
      ></button>
    `).join('');
    const setInputValues = palette => {
      const merged = { ...themeDefaults, ...(palette || {}) };
      Object.entries(colorInputMap).forEach(([key, selector]) => {
        const input = modal.querySelector(selector);
        if (!input) return;
        input.value = merged[key] || themeDefaults[key];
      });
    };
    const renderPendingPreview = (palette, labelText = 'Pending theme: Custom') => {
      const merged = { ...themeDefaults, ...(palette || {}) };
      const previewLabel = modal.querySelector('#newUiThemePreviewLabel');
      const previewSwatches = modal.querySelector('#newUiThemePreviewSwatches');
      if (previewLabel) previewLabel.textContent = labelText;
      if (previewSwatches) {
        previewSwatches.innerHTML = ['bg', 'panel', 'card', 'accent', 'accentSoft', 'text']
          .map(key => `<span style="background:${merged[key] || themeDefaults[key]}"></span>`)
          .join('');
      }
    };
    const collectInputValues = () => {
      const payload = {};
      Object.entries(colorInputMap).forEach(([key, selector]) => {
        const input = modal.querySelector(selector);
        payload[key] = input?.value || themeDefaults[key];
      });
      return payload;
    };
    const setThemeTab = panelId => {
      modal.querySelectorAll('.new-ui-theme-tab').forEach(tab => {
        const active = tab.getAttribute('data-theme-tab-target') === panelId;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      modal.querySelectorAll('.new-ui-theme-panel-block').forEach(panel => {
        panel.hidden = panel.id !== panelId;
      });
    };
    setThemeTab('newUiThemeBasicPanel');
    setInputValues(saved);
    renderPendingPreview(saved, 'Pending theme: Current');
    Object.values(colorInputMap).forEach(selector => {
      modal.querySelector(selector)?.addEventListener('input', () => {
        renderPendingPreview(collectInputValues(), 'Pending theme: Custom');
        modal.querySelectorAll('.new-ui-preset-swatch').forEach(swatch => swatch.classList.remove('is-selected'));
      });
    });
    modal.querySelectorAll('.new-ui-theme-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        setThemeTab(tab.getAttribute('data-theme-tab-target'));
      });
    });
    presetWrap.addEventListener('click', event => {
      const trigger = event.target.closest('[data-preset-id]');
      if (!trigger) return;
      const preset = pastelThemePresets.find(item => item.id === trigger.getAttribute('data-preset-id'));
      if (!preset) return;
      modal.querySelectorAll('.new-ui-preset-swatch').forEach(swatch => {
        swatch.classList.toggle('is-selected', swatch === trigger);
      });
      setInputValues(preset.colors);
      renderPendingPreview(preset.colors, `Pending theme: ${preset.label}`);
    });
    modal.querySelector('#saveNewUiThemeBtn').addEventListener('click', () => {
      const payload = collectInputValues();
      localStorage.setItem(THEME_KEY, JSON.stringify(payload));
      window.location.reload();
    });
    modal.querySelector('#resetNewUiThemeBtn').addEventListener('click', () => {
      Object.entries(colorInputMap).forEach(([key, selector]) => {
        const input = modal.querySelector(selector);
        if (input) input.value = themeDefaults[key];
      });
      localStorage.removeItem(THEME_KEY);
      window.location.reload();
    });
    modal.querySelector('.new-ui-theme-close').addEventListener('click', closeThemeModal);
    modal.addEventListener('click', event => {
      if (event.target === modal) closeThemeModal();
    });
  }
  function toggleThemeCustomizer() {
    if (!document.body.classList.contains('new-ui-enabled')) return;
    const modal = document.getElementById(THEME_MODAL_ID);
    if (!modal) return;
    const isHidden = modal.getAttribute('aria-hidden') !== 'false';
    modal.setAttribute('aria-hidden', isHidden ? 'false' : 'true');
    if (isHidden) modal.querySelector('.new-ui-theme-close')?.focus();
  }
  function ensureInsightsPanel() {
    const executorsPage = document.querySelector('#executorsPage');
    if (!executorsPage || executorsPage.querySelector('.new-ui-panel.executor-insights')) return;
    const panel = document.createElement('section');
    panel.className = 'new-ui-panel executor-insights';
    panel.innerHTML = `
      <div class="insights-head">
        <h3>Executor Insights</h3>
        <span class="new-ui-chip no-text-select">AI Powered</span>
      </div>
      <p class="modal-headline">Select <strong>AI Insight</strong> on any executor card to generate a focused executor-specific research summary</p>
      <div id="executorInsightResult" class="ai-result" hidden></div>
    `;
    const grid = executorsPage.querySelector('#productGrid');
    if (grid) executorsPage.insertBefore(panel, grid);
  }
  function tryConsumeAiToken() {
    // Token accounting is owned by the vault in script.js (which always loads
    // before this file); duplicating the rules here would just widen the
    // surface console scripts can attack.
    const vault = window.XyrexTokenVault;
    if (!vault || typeof vault.consume !== 'function') {
      console.warn('Xyrex token vault unavailable; AI Insight blocked.');
      return false;
    }
    return vault.consume() === true;
  }
  function productFromCard(card) {
    const name = card.querySelector('.product-name')?.textContent?.trim() || 'Unknown Executor';
    const catalogProduct = (Array.isArray(window.XYREX_EXECUTOR_PRODUCTS) ? window.XYREX_EXECUTOR_PRODUCTS : [])
      .find(item => String(item.name || '').toLowerCase() === name.toLowerCase());
    return {
      ...(catalogProduct || {}),
      name,
      description: catalogProduct?.description || card.querySelector('.summary')?.textContent?.trim() || 'No description available',
      price: catalogProduct?.price || card.querySelector('.price')?.textContent?.trim() || 'Unknown',
      freeOrPaid: catalogProduct?.freeOrPaid || card.dataset.price || 'Unknown',
      sunc: catalogProduct?.sunc ?? card.querySelector('.sunc')?.textContent?.trim() ?? 'Unknown',
      status: catalogProduct?.status || card.dataset.status || 'Unknown',
      trustLevel: catalogProduct?.trustLevel || card.dataset.trustLevel || 'Unknown',
      stability: catalogProduct?.stability || card.dataset.stability || 'Unknown',
      platform: catalogProduct?.platform || card.dataset.platform || 'Unknown',
      keySystem: catalogProduct?.keySystem || card.dataset.keySystem || 'Unknown',
      tags: catalogProduct?.tags || card.dataset.tags || 'Unknown',
      execution: catalogProduct?.execution || card.dataset.execution || 'Unknown'
    };
  }

  function formatInsightLoadingStatus(product, phase = 0) {
    const platformText = Array.isArray(product.platform) ? product.platform.join(', ') : product.platform;
    const statuses = [
      `Reading local Xyrex metadata for ${product.name}...`,
      `Reviewing ${platformText || 'platform'}, ${product.keySystem || 'key-system'}, and pricing signals...`,
      `Researching public context for ${product.name}...`,
      `Writing a concise AI Insight for ${product.name}...`
    ];
    return statuses[phase % statuses.length];
  }

  function extractInsightPayload(text) {
    const raw = String(text || '').trim();
    if (!raw) return '';
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string') return parsed;
      if (typeof parsed?.content === 'string') return parsed.content;
      if (typeof parsed?.response === 'string') return parsed.response;
      if (typeof parsed?.text === 'string') return parsed.text;
      if (Array.isArray(parsed?.choices) && typeof parsed.choices[0]?.message?.content === 'string') {
        return parsed.choices[0].message.content;
      }
    } catch {
      // no-op
    }
    const fenced = raw.match(/```(?:json|text|markdown)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return fenced[1].trim();
    return raw;
  }
  function cleanInsightText(text) {
    const extracted = extractInsightPayload(text)
      .replace(/\{\s*"role"\s*:\s*"assistant"[\s\S]*$/i, '')
      .replace(/"reasoning_content"\s*:\s*"[\s\S]*?"\s*,?/gi, '')
      .replace(/⚠️\s*\*\*IMPORTANT NOTICE\*\*[\s\S]*?continue to work normally\.?/gi, '')
      .replace(/pollinations legacy text api[\s\S]*?models\.?/gi, '')
      .replace(/^\s*\{[\s\S]*\}\s*$/g, '')
      .trim();
    return extracted
      .split('\n')
      .map(line => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .map(line => line.replace(/([A-Za-z0-9])\.(\s*)$/g, '$1$2'))
      .join('\n')
      .trim();
  }
  function renderInsightText(text) {
    const cleaned = cleanInsightText(text).trim();
    return cleaned || buildFallbackInsight({ name: 'Executor' });
  }

  function formatInsightList(values, fallback = 'Not listed in local Xyrex metadata') {
    return Array.isArray(values) && values.length ? values.join(', ') : fallback;
  }

  function formatInsightPrice(product) {
    const options = Array.isArray(product.pricingOptions) && product.pricingOptions.length ? product.pricingOptions : [product.price || product.freeOrPaid || 'Unknown'];
    return options.join(', ').replace(/\$\s*\{\s*\.(\d{1,2})/g, '$$1.$1');
  }

  function buildFallbackInsight(product, researchNote = 'Research was limited or unavailable, so this uses local Xyrex metadata only') {
    const sunc = Number.isFinite(product.sunc) ? `${product.sunc}%` : 'Missing';
    const strengths = [
      Array.isArray(product.pros) && product.pros.length ? product.pros.join('; ') : '',
      Number.isFinite(product.sunc) ? `Listed sUNC is ${sunc}` : '',
      product.keySystem ? `Key system: ${product.keySystem}` : ''
    ].filter(Boolean);
    const weaknesses = [
      Array.isArray(product.cons) && product.cons.length ? product.cons.join('; ') : '',
      product.trustLevel && product.trustLevel !== 'Unknown' ? `Trust level is listed as ${product.trustLevel}` : 'Trust level is not confirmed in local metadata',
      product.status && product.status !== 'Unknown' ? `Status is listed as ${product.status}` : 'Current status is not confirmed in local metadata'
    ].filter(Boolean);
    return `**Overview**\n\n- ${product.name} appears to be ${String(product.description || 'an executor listed on Xyrex').replace(/\.(?=\s*$)/, '')}\n- Platforms: ${formatInsightList(product.platform, 'Unknown')}\n\n**Strengths**\n\n${(strengths.length ? strengths : ['No confirmed strengths beyond being listed in local metadata']).map(item => `- ${item}`).join('\n')}\n\n**Weaknesses / Risks**\n\n${weaknesses.map(item => `- ${item}`).join('\n')}\n\n**Best For**\n\n- Users specifically looking for ${formatInsightList(product.platform, 'the supported platform')} executors with ${product.freeOrPaid || 'unknown'} pricing\n\n**Watch Out For**\n\n- Verify official links, current status, pricing, and key-system requirements before relying on it\n- ${researchNote}\n\n**Quick Verdict**\n\n- Based on available evidence, ${product.name} is only as reliable as its listed Xyrex metadata confirms; missing fields should be treated as uncertainty`;
  }

  function pause(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  async function requestInsight(prompt) {
    let lastError = null;
    for (let attempt = 0; attempt < AI_MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
      try {
        const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const response = await fetch(`${AI_ENDPOINT}${encodeURIComponent(`${prompt}
Response nonce: ${nonce}`)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`AI request failed (${response.status})`);
        const text = (await response.text()).trim();
        if (!text) throw new Error('AI request returned an empty response');
        const cleaned = renderInsightText(text);
        if (!cleaned) throw new Error('AI request returned invalid content');
        return cleaned;
      } catch (error) {
        lastError = error;
        const backoffMs = 350 * (2 ** attempt);
        if (attempt < AI_MAX_ATTEMPTS - 1) await pause(backoffMs);
      } finally {
        window.clearTimeout(timeoutId);
      }
    }
    throw lastError || new Error('AI request failed');
  }

  function renderInsightMarkdown(markdownText) {
    const rawText = cleanInsightText(markdownText);
    if (!window.marked || !window.DOMPurify) {
      const fallback = document.createElement('div');
      fallback.textContent = rawText;
      return fallback;
    }
    const unsafeHtml = marked.parse(rawText.replace(/\n{3,}/g, '\n\n'));
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-insight-markdown';
    wrapper.innerHTML = DOMPurify.sanitize(unsafeHtml, { USE_PROFILES: { html: true } });
    wrapper.querySelectorAll('table').forEach(table => table.remove());
    wrapper.querySelectorAll('a').forEach(link => {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
    return wrapper;
  }

  function setInsightResult(result, product, markdownText) {
    result.textContent = '';
    const title = document.createElement('strong');
    title.className = 'no-text-select';
    title.textContent = product.name;
    result.appendChild(title);
    result.appendChild(renderInsightMarkdown(markdownText));
  }

  async function generateInsight(product) {
    const platformText = Array.isArray(product.platform) ? product.platform.join(', ') : product.platform;
    const tagsText = Array.isArray(product.tags) ? product.tags.join(', ') : product.tags;
    const prosText = Array.isArray(product.pros) ? product.pros.join('; ') : 'None listed';
    const consText = Array.isArray(product.cons) ? product.cons.join('; ') : 'None listed';
    const prompt = [
      'You are generating an executor-specific AI Insight for Xyrex.lol, not a chat assistant reply.',
      'Perform research using any public knowledge or research capability available to this API. If you cannot verify current public information, clearly state that research is limited.',
      'Combine the provided local Xyrex metadata with researched context. Never invent facts, never fake sources, and never claim an executor is safe unless supported.',
      'Focus only on the selected executor. Do not recommend unrelated executors. Do not include tables, graphs, code, download steps, or generic disclaimers.',
      'Use exactly these bold headings: **Overview**, **Strengths**, **Weaknesses / Risks**, **Best For**, **Watch Out For**, **Quick Verdict**.',
      'Use short paragraphs and bullet points only.',
      '',
      'Local Xyrex metadata:',
      `Name: ${product.name}`,
      `Description: ${product.description}`,
      `Platform: ${platformText || 'Unknown'}`,
      `sUNC: ${Number.isFinite(product.sunc) ? `${product.sunc}%` : 'Missing'}`,
      `Stability: ${product.stability || 'Unknown'}`,
      `Trust Level: ${product.trustLevel || 'Unknown'}`,
      `Execution Level: ${product.execution || 'Unknown'}`,
      `Key System: ${product.keySystem || 'Unknown'}`,
      `Price: ${formatInsightPrice(product)}`,
      `Status: ${product.status || 'Unknown'}`,
      `Tags: ${tagsText || 'Unknown'}`,
      `Pros: ${prosText}`,
      `Cons: ${consText}`,
      `Official site: ${product.officialSite || 'Not listed'}`,
      `Official Discord: ${product.officialDiscord || 'Not listed'}`
    ].join('\n');

    try {
      const researched = await requestInsight(prompt);
      const cleaned = cleanInsightText(researched).trim();
      if (cleaned && /\*\*Overview\*\*/i.test(cleaned) && /\*\*Quick Verdict\*\*/i.test(cleaned)) return cleaned;
    } catch (error) {
      console.warn('AI Insight research request failed; using local fallback.', error);
      return buildFallbackInsight(product, 'Research request failed, so this insight is based on local Xyrex metadata only');
    }
    return buildFallbackInsight(product, 'Research output was incomplete, so this insight is based on local Xyrex metadata only');
  }


  async function handleInsightClick(card, button) {
    const result = document.querySelector('#executorInsightResult');
    if (!result) return;
    const product = productFromCard(card);
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!tryConsumeAiToken()) {
      window.alert('You have no AI Insight tokens remaining. Daily tokens reset at midnight, or you can buy more in the Token Shop.');
      return;
    }
    button.disabled = true;
    button.textContent = 'Generating...';
    result.hidden = false;
    let loadingPhase = 0;
    setInsightResult(result, product, formatInsightLoadingStatus(product, loadingPhase));
    const loadingTimer = window.setInterval(() => {
      loadingPhase += 1;
      const target = result.querySelector('p');
      if (target) target.textContent = formatInsightLoadingStatus(product, loadingPhase);
    }, 850);
    try {
      const insight = await generateInsight(product);
      setInsightResult(result, product, insight);
    } catch (error) {
      setInsightResult(result, product, buildFallbackInsight(product, 'Research request failed, so this insight is based on local Xyrex metadata only'));
      console.warn(error);
    } finally {
      window.clearInterval(loadingTimer);
      button.disabled = false;
      button.textContent = 'AI Insight';
    }
  }
  function enhanceCardsForNewUi() {
    const executorsPage = document.querySelector('#executorsPage');
    if (!executorsPage) return;
    executorsPage.querySelectorAll('.card').forEach(card => {
      const existingActionRow = card.querySelector('.new-ui-actions');
      if (existingActionRow) existingActionRow.remove();
      const infoBtn = card.querySelector('.info-btn');
      if (!infoBtn) return;
      const actionRow = document.createElement('div');
      actionRow.className = 'new-ui-actions';
      infoBtn.classList.add('new-ui-info-btn');
      actionRow.appendChild(infoBtn);
      const aiBtn = document.createElement('button');
      aiBtn.type = 'button';
      aiBtn.className = 'new-ui-ai-btn';
      aiBtn.textContent = 'AI Insight';
      aiBtn.addEventListener('click', () => handleInsightClick(card, aiBtn));
      actionRow.appendChild(aiBtn);
      card.appendChild(actionRow);
    });
  }
  function restoreDefaultCardActions() {
    document.querySelectorAll('.card .new-ui-actions').forEach(row => {
      const infoBtn = row.querySelector('.info-btn');
      if (infoBtn) {
        infoBtn.classList.remove('new-ui-info-btn');
        row.parentElement.appendChild(infoBtn);
      }
      row.remove();
    });
  }
  function watchGridUpdates() {
    const grid = document.querySelector('#productGrid');
    if (!grid || gridObserver) return;
    gridObserver = new MutationObserver(() => {
      if (!document.body.classList.contains('new-ui-enabled')) return;
      enhanceCardsForNewUi();
    });
    gridObserver.observe(grid, { childList: true });
  }
  function stopWatchingGridUpdates() {
    if (!gridObserver) return;
    gridObserver.disconnect();
    gridObserver = null;
  }
  function injectBadge() {
    const header = document.querySelector('.subpage-header h2');
    if (!header || document.querySelector('.new-ui-badge')) return;
    const badge = document.createElement('span');
    badge.className = 'new-ui-badge';
    badge.textContent = 'New UI Active';
    header.insertAdjacentElement('afterend', badge);
  }
  function removeInjectedElements() {
    document.querySelectorAll('.new-ui-badge, .new-ui-panel').forEach(node => node.remove());
    const modal = document.getElementById(THEME_MODAL_ID);
    if (modal) modal.remove();
  }
  function enable() {
    loadCss();
    document.body.classList.add('new-ui-enabled');
    ensureThemeModal();
    ensureInsightsPanel();
    enhanceCardsForNewUi();
    watchGridUpdates();
    applyTheme(getThemeFromStorage());
  }
  function disable() {
    document.body.classList.remove('new-ui-enabled');
    closeThemeModal();
    stopWatchingGridUpdates();
    restoreDefaultCardActions();
    removeInjectedElements();
    clearThemeOverrides();
  }
  window.XyrexNewUI = {
    enable,
    disable,
    toggleThemeCustomizer,
    applyStoredTheme() {
      applyTheme(getThemeFromStorage());
    }
  };
})();
