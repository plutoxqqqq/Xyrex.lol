/**
 * @name DraftVault
 * @author Joseph
 * @description Manually save, name, restore, edit, and delete Discord message drafts
 * @version 2.1.0
 * @invite https://discord.gg/CnVeapcxtV
 */

module.exports = class DraftVault {
  constructor() {
    this.pluginName = "DraftVault";

    this.settings = {
      enabled: true,
      detectInterval: 700,
      maxDrafts: 100,
      minLength: 1,
      replaceAppsButton: true,
      fallbackFloatingButton: true,
      panelWidth: 520,
      compactCards: false,
      showStats: true,
      showTags: true,
      panelOpacity: 92
    };

    this.detectTimer = null;
    this.buttonInterval = null;
    this.panel = null;
    this.backdrop = null;

    this.currentText = "";
    this.currentLocation = "";
    this.currentPath = "";
    this.onTextboxKeydown = this.handleTextboxKeydown.bind(this);
    this.commandSendInFlight = false;
    this.collapsedSections = { currentMessage: false, savedDrafts: false };
  }

  start() {
    this.loadSettings();
    this.injectCSS();

    this.detectCurrentText();
    this.mountButton();
    document.addEventListener("keydown", this.onTextboxKeydown, true);

    this.detectTimer = setInterval(() => {
      this.detectCurrentText();
      this.updateLivePreview();
    }, this.settings.detectInterval);

    this.buttonInterval = setInterval(() => {
      if (!document.querySelector(".draftvault-panel")) {
        this.mountButton();
      }
    }, 2500);

    this.toast("DraftVault started", "success");
  }

  stop() {
    clearInterval(this.detectTimer);
    clearInterval(this.buttonInterval);

    this.removeButtons();
    this.showOriginalAppsButtons();
    this.closePanel();
    document.removeEventListener("keydown", this.onTextboxKeydown, true);

    document.querySelectorAll(".draftvault-backdrop,.draftvault-panel").forEach(function(el) {
      el.remove();
    });

    if (BdApi.clearCSS) {
      BdApi.clearCSS("DraftVaultCSS");
    } else if (BdApi.DOM && BdApi.DOM.removeStyle) {
      BdApi.DOM.removeStyle("DraftVaultCSS");
    }
  }

  toast(text, type) {
    try {
      if (BdApi.showToast) {
        BdApi.showToast(text, { type: type });
      } else if (BdApi.UI && BdApi.UI.showToast) {
        BdApi.UI.showToast(text, { type: type });
      }
    } catch (e) {
      console.log("[DraftVault]", text);
    }
  }

  loadSettings() {
    try {
      if (BdApi.Data && BdApi.Data.load) {
        var saved = BdApi.Data.load(this.pluginName, "settings");
        if (saved) this.settings = Object.assign({}, this.settings, saved);
      }
    } catch (e) {
      console.error("[DraftVault] Failed to load settings:", e);
    }
  }

  saveSettings() {
    try {
      if (BdApi.Data && BdApi.Data.save) {
        BdApi.Data.save(this.pluginName, "settings", this.settings);
      }
    } catch (e) {
      console.error("[DraftVault] Failed to save settings:", e);
    }
  }

  getDrafts() {
    try {
      if (BdApi.Data && BdApi.Data.load) {
        return BdApi.Data.load(this.pluginName, "drafts") || {};
      }
    } catch (e) {
      console.error("[DraftVault] Failed to load drafts:", e);
    }

    return {};
  }

  saveDrafts(drafts) {
    try {
      if (BdApi.Data && BdApi.Data.save) {
        BdApi.Data.save(this.pluginName, "drafts", drafts);
      }
    } catch (e) {
      console.error("[DraftVault] Failed to save drafts:", e);
    }
  }

  injectCSS() {
    var css = `
      :root {
        --draftvault-accent: var(--main-color, #8b5cf6);
        --draftvault-accent-hover: var(--hover-color, #a855f7);
        --draftvault-bg: var(--popout-shading, rgba(5, 0, 12, 0.92));
        --draftvault-card-bg: var(--card-shading, rgba(255, 255, 255, 0.06));
        --draftvault-text: var(--normal-text, #f4f4f5);
        --draftvault-muted: var(--muted-text, #a1a1aa);
        --draftvault-danger: var(--danger-color, #982929);
      }

      @keyframes draftvault-panel-open {
        0% {
          opacity: 0;
          transform: translateY(12px) scale(0.965);
          filter: blur(4px);
        }

        100% {
          opacity: 1;
          transform: translateY(0) scale(1);
          filter: blur(0);
        }
      }

      @keyframes draftvault-panel-close {
        0% {
          opacity: 1;
          transform: translateY(0) scale(1);
          filter: blur(0);
        }

        100% {
          opacity: 0;
          transform: translateY(10px) scale(0.965);
          filter: blur(4px);
        }
      }

      @keyframes draftvault-backdrop-open {
        from {
          opacity: 0;
        }

        to {
          opacity: 1;
        }
      }

      @keyframes draftvault-backdrop-close {
        from {
          opacity: 1;
        }

        to {
          opacity: 0;
        }
      }

      .draftvault-apps-button {
        width: 32px !important;
        height: 32px !important;
        min-width: 32px !important;
        min-height: 32px !important;
        max-width: 32px !important;
        max-height: 32px !important;
        padding: 4px !important;
        margin: 0 2px !important;
        border: none !important;
        outline: none !important;
        background: transparent !important;
        color: var(--interactive-normal, #b5bac1) !important;
        border-radius: 8px !important;
        cursor: pointer !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        vertical-align: middle !important;
        line-height: 1 !important;
        font-size: 0 !important;
        overflow: visible !important;
        transition: transform 0.16s ease, box-shadow 0.2s ease, background 0.16s ease, color 0.16s ease !important;
      }

      .draftvault-apps-button:hover {
        color: var(--interactive-hover, #dbdee1) !important;
        background: var(--background-modifier-hover, rgba(255, 255, 255, 0.08)) !important;
        transform: translateY(-1px) scale(1.045) !important;
        box-shadow: 0 8px 24px rgba(139, 92, 246, 0.24) !important;
      }

      .draftvault-apps-button:active {
        transform: translateY(0) scale(0.98) !important;
      }

      .draftvault-apps-button .draftvault-icon,
      .draftvault-apps-button svg {
        width: 22px !important;
        height: 22px !important;
        min-width: 22px !important;
        min-height: 22px !important;
        max-width: 22px !important;
        max-height: 22px !important;
        display: block !important;
        color: inherit !important;
        fill: currentColor !important;
        stroke: none !important;
        pointer-events: none !important;
        opacity: 1 !important;
        visibility: visible !important;
      }

      .draftvault-apps-button svg path {
        fill: currentColor !important;
        opacity: 1 !important;
        visibility: visible !important;
      }

      .draftvault-floating-button {
        position: fixed;
        right: 32px;
        bottom: 86px;
        z-index: 9997;
        border: 1px solid rgba(139, 92, 246, 0.65);
        background: rgba(17, 18, 23, 0.92);
        color: white;
        border-radius: 999px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 900;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
        backdrop-filter: blur(10px);
      }

      .draftvault-floating-button:hover {
        background: rgba(139, 92, 246, 0.35);
        transform: translateY(-1px);
      }

      .draftvault-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.16);
        z-index: 9998;
        pointer-events: auto;
        animation: draftvault-backdrop-open 0.16s ease forwards;
      }

      .draftvault-backdrop.draftvault-closing {
        animation: draftvault-backdrop-close 0.14s ease forwards !important;
        pointer-events: none !important;
      }

      .draftvault-panel {
        position: fixed;
        top: 72px;
        right: 24px;
        width: 520px;
        max-width: calc(100vw - 48px);
        max-height: calc(100vh - 120px);
        background: var(--draftvault-bg);
        color: white;
        border: 1px solid rgba(139, 92, 246, 0.55);
        border-radius: 18px;
        box-shadow:
          0 20px 70px rgba(0, 0, 0, 0.5),
          0 0 28px rgba(139, 92, 246, 0.25);
        z-index: 9999;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        animation: draftvault-panel-open 0.18s cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        transform-origin: bottom right;
      }

      .draftvault-panel.draftvault-closing {
        animation: draftvault-panel-close 0.14s ease forwards !important;
        pointer-events: none !important;
      }

      .draftvault-header {
        padding: 14px;
        background:
          linear-gradient(
            135deg,
            rgba(139, 92, 246, 0.28),
            rgba(17, 18, 23, 1)
          );
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .draftvault-header strong {
        display: block;
        font-size: 16px;
      }

      .draftvault-header span {
        display: block;
        margin-top: 2px;
        color: #c4c4cc;
        font-size: 12px;
      }

      .draftvault-close {
        width: 30px;
        height: 30px;
        border: none;
        border-radius: 9px;
        background: rgba(255, 255, 255, 0.1);
        color: white;
        font-size: 18px;
        cursor: pointer;
      }

      .draftvault-close:hover {
        background: rgba(255, 255, 255, 0.18);
      }

      .draftvault-content {
        padding: 12px;
        overflow-y: auto;
      }

      .draftvault-section {
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.045);
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 12px;
        margin-bottom: 12px;
      }

      .draftvault-section-title {
        color: #c4b5fd;
        font-size: 11px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 8px;
      }

      .draftvault-input,
      .draftvault-textarea {
        width: 100%;
        box-sizing: border-box;
        background: rgba(0, 0, 0, 0.22);
        color: #f4f4f5;
        border: 1px solid rgba(139, 92, 246, 0.35);
        border-radius: 10px;
        padding: 9px;
        font-size: 13px;
        outline: none;
      }

      .draftvault-input:focus,
      .draftvault-textarea:focus {
        border-color: rgba(139, 92, 246, 0.85);
      }

      .draftvault-textarea {
        min-height: 105px;
        resize: vertical;
        line-height: 1.38;
        margin-top: 8px;
      }

      .draftvault-live-preview {
        color: #e5e7eb;
        font-size: 13px;
        line-height: 1.38;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 130px;
        overflow-y: auto;
        padding: 10px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.055);
        border-left: 3px solid #8b5cf6;
        margin-top: 8px;
      }

      .draftvault-empty {
        padding: 18px;
        color: #a1a1aa;
        text-align: center;
        font-size: 13px;
      }

      .draftvault-card {
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-left: 3px solid #8b5cf6;
        padding: 10px;
        margin-bottom: 10px;
      }

      .draftvault-name {
        font-size: 14px;
        font-weight: 900;
        color: #f5f3ff;
        margin-bottom: 5px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .draftvault-meta {
        display: flex;
        justify-content: flex-start;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 7px;
        color: #c4b5fd;
        font-size: 11px;
        font-weight: 900;
      }

      .draftvault-location {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .draftvault-time {
        color: #a1a1aa;
        white-space: nowrap;
      }

      .draftvault-tags {
        color: #d8b4fe;
        font-size: 11px;
        font-weight: 800;
      }

      .draftvault-preview {
        color: #e5e7eb;
        font-size: 13px;
        line-height: 1.38;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 90px;
        overflow: hidden;
        margin-bottom: 9px;
      }

      .draftvault-actions {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 7px;
      }

      .draftvault-action,
      .draftvault-primary {
        border: 1px solid rgba(139, 92, 246, 0.45);
        background: rgba(139, 92, 246, 0.16);
        color: white;
        border-radius: 10px;
        padding: 8px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 800;
      }

      .draftvault-primary {
        width: 100%;
        margin-top: 8px;
        background: rgba(139, 92, 246, 0.28);
      }

      .draftvault-action:hover,
      .draftvault-primary:hover {
        background: rgba(139, 92, 246, 0.36);
      }

      .draftvault-delete {
        border-color: rgba(248, 113, 113, 0.5);
        background: rgba(248, 113, 113, 0.13);
      }

      .draftvault-delete:hover {
        background: rgba(248, 113, 113, 0.26);
      }

      .draftvault-footer {
        padding: 10px 12px 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        gap: 8px;
      }

      .draftvault-footer button {
        flex: 1;
        border: 1px solid rgba(139, 92, 246, 0.45);
        background: rgba(139, 92, 246, 0.16);
        color: white;
        border-radius: 11px;
        padding: 8px;
        cursor: pointer;
        font-weight: 800;
        font-size: 12px;
      }

      .draftvault-footer button:hover {
        background: rgba(139, 92, 246, 0.3);
      }

      .draftvault-settings {
        padding: 10px;
        color: var(--text-normal);
      }

      .draftvault-settings-header {
        margin-bottom: 8px;
      }
      .draftvault-section-toggle {
        width: 100%;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        color: #e9e6ff;
        border-radius: 10px;
        padding: 10px 12px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 8px;
        text-align: left;
      }
      .draftvault-section-toggle::after {
        content: "−";
        float: right;
        font-size: 15px;
        margin-top: -2px;
      }
      .draftvault-section-toggle[aria-expanded="false"]::after {
        content: "+";
      }

      .draftvault-settings-title {
        margin: 0;
        font-size: 18px;
        font-weight: 800;
      }

      .draftvault-settings-subtitle {
        margin-top: 2px;
        color: var(--text-muted);
        font-size: 12px;
      }

      .draftvault-settings-group {
        margin-bottom: 8px;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid var(--background-modifier-accent);
        background: var(--background-secondary);
      }

      .draftvault-settings-group-title {
        margin: 0 0 6px;
        color: #c4b5fd;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .draftvault-setting-row {
        min-height: 34px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .draftvault-setting-label {
        font-size: 13px;
        font-weight: 600;
      }

      .draftvault-setting-input {
        width: 90px;
        box-sizing: border-box;
        background: var(--background-primary);
        color: var(--text-normal);
        border: 1px solid var(--background-modifier-accent);
        border-radius: 7px;
        padding: 5px 8px;
        font-size: 13px;
      }

      .draftvault-setting-input:focus {
        outline: none;
        border-color: var(--brand-500, #8b5cf6);
      }

      .draftvault-setting-row input[type="checkbox"] {
        width: 14px;
        height: 14px;
      }

      .draftvault-settings-buttons {
        display: flex;
        gap: 6px;
      }

      .draftvault-settings-buttons button,
      .draftvault-settings-save {
        border: 1px solid rgba(139, 92, 246, 0.5);
        background: rgba(139, 92, 246, 0.16);
        color: var(--text-normal);
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }

      .draftvault-settings-buttons button:hover,
      .draftvault-settings-save:hover {
        background: rgba(139, 92, 246, 0.28);
      }

      .draftvault-settings-save {
        margin-top: 4px;
        width: 100%;
      }

      .draftvault-counts {
        margin-top: 8px;
        color: #d1d5db;
        font-size: 11px;
        font-weight: 700;
      }

      /* DraftVault scrollbars only */
      .draftvault-content,
      .draftvault-live-preview,
      .draftvault-textarea {
        scrollbar-width: thin;
        scrollbar-color: var(--main-color, #8b5cf6) transparent;
      }

      .draftvault-content::-webkit-scrollbar,
      .draftvault-live-preview::-webkit-scrollbar,
      .draftvault-textarea::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      .draftvault-content::-webkit-scrollbar-track,
      .draftvault-live-preview::-webkit-scrollbar-track,
      .draftvault-textarea::-webkit-scrollbar-track {
        background: transparent;
      }

      .draftvault-content::-webkit-scrollbar-thumb,
      .draftvault-live-preview::-webkit-scrollbar-thumb,
      .draftvault-textarea::-webkit-scrollbar-thumb {
        background: var(--main-color, #8b5cf6);
        border-radius: 999px;
        border: 2px solid transparent;
        background-clip: content-box;
      }

      .draftvault-content::-webkit-scrollbar-thumb:hover,
      .draftvault-live-preview::-webkit-scrollbar-thumb:hover,
      .draftvault-textarea::-webkit-scrollbar-thumb:hover {
        background: var(--hover-color, #a855f7);
        border: 2px solid transparent;
        background-clip: content-box;
      }
    `;

    if (BdApi.injectCSS) {
      BdApi.injectCSS("DraftVaultCSS", css);
    } else if (BdApi.DOM && BdApi.DOM.addStyle) {
      BdApi.DOM.addStyle("DraftVaultCSS", css);
    }
  }

  getDraftVaultIcon() {
    return ''
      + '<svg class="draftvault-icon" viewBox="0 0 24 24" aria-hidden="true">'
      + '<path fill="currentColor" d="M6.5 3.5h8.2c.4 0 .78.16 1.06.44l2.3 2.3c.28.28.44.66.44 1.06v12.2c0 .83-.67 1.5-1.5 1.5H6.5C5.67 21 5 20.33 5 19.5v-14C5 4.67 5.67 3.5 6.5 3.5Zm.5 2V19h10V8h-2.8c-.66 0-1.2-.54-1.2-1.2V5.5H7Z"/>'
      + '<path fill="currentColor" d="M8.5 10.25c0-.41.34-.75.75-.75h5.5c.41 0 .75.34.75.75s-.34.75-.75.75h-5.5a.75.75 0 0 1-.75-.75Zm0 3c0-.41.34-.75.75-.75h5.5c.41 0 .75.34.75.75s-.34.75-.75.75h-5.5a.75.75 0 0 1-.75-.75Zm0 3c0-.41.34-.75.75-.75h3.5c.41 0 .75.34.75.75s-.34.75-.75.75h-3.5a.75.75 0 0 1-.75-.75Z"/>'
      + '</svg>';
  }

  mountButton() {
    if (!this.settings.enabled) {
      this.removeButtons();
      this.showOriginalAppsButtons();
      return;
    }

    if (this.settings.replaceAppsButton) {
      var replaced = this.replaceAppsButton();

      if (replaced) {
        this.removeFloatingButton();
        return;
      }
    }

    this.showOriginalAppsButtons();

    if (this.settings.fallbackFloatingButton) {
      this.addFloatingButton();
    }
  }

  findAppsButton() {
    var textbox = this.getTextbox();
    if (!textbox) return null;

    var chatBar =
      textbox.closest('[class*="channelTextArea"]') ||
      textbox.closest('[class*="scrollableContainer"]') ||
      textbox.closest("form") ||
      textbox.parentElement;

    if (!chatBar) return null;

    var controls = Array.from(
      chatBar.querySelectorAll('button, [role="button"], [aria-label], [title]')
    );

    var candidates = [];

    for (var i = 0; i < controls.length; i++) {
      var el = controls[i];

      if (!el) continue;
      if (el.classList && el.classList.contains("draftvault-apps-button")) continue;
      if (el.closest && el.closest(".draftvault-apps-button")) continue;

      var rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (rect.width > 70 || rect.height > 70) continue;

      var label = (
        el.getAttribute("aria-label") ||
        el.getAttribute("title") ||
        el.textContent ||
        ""
      ).toLowerCase();

      if (
        label.includes("app launcher") ||
        label.includes("open app") ||
        label === "apps" ||
        label.includes("apps")
      ) {
        return el;
      }

      var bad =
        label.includes("gift") ||
        label.includes("gif") ||
        label.includes("sticker") ||
        label.includes("emoji") ||
        label.includes("attach") ||
        label.includes("upload") ||
        label.includes("input options") ||
        label.includes("deafen") ||
        label.includes("mute") ||
        label.includes("settings");

      if (!bad) {
        candidates.push(el);
      }
    }

    if (candidates.length) {
      candidates.sort(function(a, b) {
        return b.getBoundingClientRect().left - a.getBoundingClientRect().left;
      });

      return candidates[0];
    }

    return null;
  }

  replaceAppsButton() {
    if (document.querySelector(".draftvault-apps-button")) return true;

    var appsButton = this.findAppsButton();

    if (!appsButton || !appsButton.parentElement) {
      return false;
    }

    appsButton.setAttribute("data-draftvault-hidden-apps", "true");
    appsButton.style.display = "none";

    var button = document.createElement("button");
    button.className = "draftvault-apps-button";
    button.type = "button";
    button.title = "DraftVault";
    button.setAttribute("aria-label", "DraftVault");
    button.innerHTML = this.getDraftVaultIcon();

    var self = this;

    button.onclick = function(event) {
      event.preventDefault();
      event.stopPropagation();

      self.detectCurrentText();
      self.openPanel();
    };

    appsButton.parentElement.insertBefore(button, appsButton.nextSibling);

    return true;
  }

  showOriginalAppsButtons() {
    var hidden = document.querySelectorAll('[data-draftvault-hidden-apps="true"]');

    for (var i = 0; i < hidden.length; i++) {
      hidden[i].style.display = "";
      hidden[i].removeAttribute("data-draftvault-hidden-apps");
    }
  }

  addFloatingButton() {
    if (document.querySelector(".draftvault-floating-button")) return;

    var textbox = this.getTextbox();
    if (!textbox) return;

    var button = document.createElement("button");
    button.className = "draftvault-floating-button";
    button.textContent = "DraftVault";
    button.title = "Open DraftVault";

    var self = this;

    button.onclick = function(event) {
      event.preventDefault();
      event.stopPropagation();
      self.detectCurrentText();
      self.openPanel();
    };

    document.body.appendChild(button);
  }

  removeButtons() {
    this.removeFloatingButton();

    var appButtons = document.querySelectorAll(".draftvault-apps-button");

    for (var i = 0; i < appButtons.length; i++) {
      appButtons[i].remove();
    }
  }

  removeFloatingButton() {
    var buttons = document.querySelectorAll(".draftvault-floating-button");

    for (var i = 0; i < buttons.length; i++) {
      buttons[i].remove();
    }
  }

  getTextbox() {
    var selectors = [
      '[role="textbox"][data-slate-editor="true"]',
      '[data-slate-editor="true"]',
      '[role="textbox"]'
    ];

    for (var i = 0; i < selectors.length; i++) {
      var found = document.querySelector(selectors[i]);
      if (found) return found;
    }

    return null;
  }

  getTextboxText() {
    var textbox = this.getTextbox();
    if (!textbox) return "";

    var text = textbox.innerText || "";

    text = text
      .replace(/\u200B/g, "")
      .replace(/\u00A0/g, " ")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

    return text.trim();
  }

  setTextboxText(text) {
    var textbox = this.getTextbox();

    if (!textbox) {
      this.toast("No message box found", "error");
      return;
    }

    var cleanText = String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

    textbox.focus();

    try {
      var selection = window.getSelection();
      var range = document.createRange();

      range.selectNodeContents(textbox);
      selection.removeAllRanges();
      selection.addRange(range);

      var pasteEvent = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer()
      });

      pasteEvent.clipboardData.setData("text/plain", cleanText);

      textbox.dispatchEvent(pasteEvent);

      setTimeout(() => {
        var current = this.getTextboxText();

        if (current === cleanText) return;

        textbox.focus();

        var fallbackSelection = window.getSelection();
        var fallbackRange = document.createRange();

        fallbackRange.selectNodeContents(textbox);
        fallbackSelection.removeAllRanges();
        fallbackSelection.addRange(fallbackRange);

        document.execCommand("insertText", false, cleanText);
      }, 60);
    } catch (e) {
      console.error("[DraftVault] Paste-style restore failed:", e);

      try {
        textbox.focus();

        var selection2 = window.getSelection();
        var range2 = document.createRange();

        range2.selectNodeContents(textbox);
        selection2.removeAllRanges();
        selection2.addRange(range2);

        document.execCommand("insertText", false, cleanText);
      } catch (err) {
        console.error("[DraftVault] Fallback restore failed:", err);
        this.toast("Could not restore draft", "error");
      }
    }
  }

  getLocationName() {
    var path = location.pathname || "";

    if (path.startsWith("/channels/@me/")) {
      return "DM · " + path.split("/").pop();
    }

    var parts = path.split("/").filter(Boolean);

    if (parts.length >= 3) {
      return "Server Channel · " + parts[2];
    }

    return path || "Unknown";
  }

  detectCurrentText() {
    this.currentText = this.getTextboxText();
    this.currentLocation = this.getLocationName();
    this.currentPath = location.pathname || "";
  }

  updateLivePreview() {
    var preview = document.querySelector(".draftvault-live-preview");
    if (!preview) return;

    this.detectCurrentText();

    if (this.currentText) {
      preview.textContent = this.currentText;
    } else {
      preview.textContent = "Nothing typed right now.";
    }
  }

  makeDefaultDraftName() {
    var now = new Date();
    return "Draft · " + now.toLocaleString();
  }

  normalizeTags(rawTags) {
    var split = String(rawTags || "").split(",");
    var cleaned = [];
    var seen = {};

    for (var i = 0; i < split.length; i++) {
      var tag = split[i].trim().replace(/\s+/g, " ");
      if (!tag) continue;
      var low = tag.toLowerCase();
      if (seen[low]) continue;
      seen[low] = true;
      cleaned.push(tag);
    }

    return cleaned;
  }

  getTextStats(text) {
    var normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var chars = normalized.length;
    var lines = normalized ? normalized.split("\n").length : 0;
    return { chars: chars, lines: lines };
  }

  normalizeCommand(rawCommand) {
    var command = String(rawCommand || "").trim().replace(/\s+/g, " ");
    if (!command) return "";
    if (!/^[\/!%@]/.test(command)) return "";
    return command.toLowerCase();
  }

  getCommandMatch(typedText) {
    var normalized = String(typedText || "").trim();
    if (!normalized) return null;
    var parts = normalized.split(/\s+/);
    var firstToken = parts[0] || "";
    if (!/^[\/!%@]/.test(firstToken)) return null;

    var drafts = this.getDrafts();
    var keys = Object.keys(drafts);
    var commandKey = this.normalizeCommand(firstToken);
    for (var i = 0; i < keys.length; i++) {
      var entry = drafts[keys[i]] || {};
      if (this.normalizeCommand(entry.command) !== commandKey) continue;
      return { draft: entry, followUp: parts.slice(1).join(" ").trim() };
    }
    return null;
  }

  handleTextboxKeydown(event) {
    if (!event || event.key !== "Enter") return;
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    if (this.commandSendInFlight) return;

    var textbox = this.getTextbox();
    if (!textbox || event.target !== textbox) return;

    var match = this.getCommandMatch(this.getTextboxText());
    if (!match || !match.draft || !match.draft.text) return;

    var messageBody = String(match.draft.text).trim();
    if (!messageBody) return;
    if (match.followUp) {
      messageBody += "\n" + match.followUp;
    }

    event.preventDefault();
    event.stopPropagation();
    this.commandSendInFlight = true;
    this.setTextboxText(messageBody);
    var self = this;
    window.setTimeout(function() {
      try {
        textbox.focus();
        textbox.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true
        }));
      } finally {
        window.setTimeout(function() { self.commandSendInFlight = false; }, 40);
      }
    }, 24);
  }

  sortDraftKeys(drafts) {
    var keys = Object.keys(drafts);
    keys.sort(function(a, b) {
      var aDraft = drafts[a] || {};
      var bDraft = drafts[b] || {};
      var aPinned = !!aDraft.pinned;
      var bPinned = !!bDraft.pinned;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return (bDraft.updatedAt || 0) - (aDraft.updatedAt || 0);
    });
    return keys;
  }

  saveCurrentAsNewDraft(name, tagsInput, commandInput) {
    this.detectCurrentText();

    var text = this.currentText || "";

    if (text.length < this.settings.minLength) {
      this.toast("Type something before saving", "error");
      return false;
    }

    var cleanName = String(name || "").trim();
    var rawCommand = String(commandInput || "").trim();
    var command = this.normalizeCommand(rawCommand);

    if (!cleanName) {
      this.toast("Give the draft a name first", "error");
      return false;
    }

    if (rawCommand && !command) {
      this.toast("Command keys must start with /, !, %, or @", "error");
      return false;
    }

    var drafts = this.getDrafts();
    var key = "draft:" + Date.now() + ":" + Math.random().toString(16).slice(2);

    drafts[key] = {
      name: cleanName,
      text: text,
      command: command,
      location: this.currentLocation,
      path: this.currentPath,
      pinned: false,
      tags: this.normalizeTags(tagsInput),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    drafts = this.trimDrafts(drafts);
    this.saveDrafts(drafts);

    this.toast("Draft saved", "success");
    return true;
  }

  trimDrafts(drafts) {
    var keys = Object.keys(drafts);

    if (keys.length <= this.settings.maxDrafts) return drafts;

    keys.sort(function(a, b) {
      return drafts[b].updatedAt - drafts[a].updatedAt;
    });

    var kept = {};

    for (var i = 0; i < Math.min(keys.length, this.settings.maxDrafts); i++) {
      kept[keys[i]] = drafts[keys[i]];
    }

    return kept;
  }

  bindSafeBackdropClose(backdrop, onClose) {
    if (!backdrop || typeof onClose !== "function") return;
    var canClose = false;
    setTimeout(function() {
      canClose = true;
    }, 0);
    backdrop.onclick = function(event) {
      if (!canClose) return;
      if (event && event.target !== backdrop) return;
      onClose();
    };
  }

  openPanel() {
    this.detectCurrentText();
    this.closePanel();

    var self = this;
    var drafts = this.getDrafts();
    var keys = this.sortDraftKeys(drafts);

    this.backdrop = document.createElement("div");
    this.backdrop.className = "draftvault-backdrop";
    this.bindSafeBackdropClose(this.backdrop, function() {
      self.closePanel();
    });

    this.panel = document.createElement("div");
    this.panel.className = "draftvault-panel";

    var header = document.createElement("div");
    header.className = "draftvault-header";

    var title = document.createElement("div");
    title.innerHTML =
      "<strong>DraftVault</strong>" +
      "<span>Manual saved drafts · " + keys.length + " saved</span>";

    var close = document.createElement("button");
    close.className = "draftvault-close";
    close.textContent = "×";
    close.onclick = function() {
      self.closePanel();
    };

    header.appendChild(title);
    header.appendChild(close);

    var content = document.createElement("div");
    content.className = "draftvault-content";

    var currentSection = document.createElement("div");
    currentSection.className = "draftvault-section";

    currentSection.innerHTML =
      '<button type="button" class="draftvault-section-toggle" data-draftvault-section-toggle="currentMessage" aria-expanded="' + (!this.collapsedSections.currentMessage) + '">Current Typed Message</button>' +
      '<div data-draftvault-section-body="currentMessage" ' + (this.collapsedSections.currentMessage ? "hidden" : "") + '>' +
      '<input class="draftvault-input" id="draftvault-new-name" placeholder="Name this draft..." value="' + this.escapeHTML(this.makeDefaultDraftName()) + '">' +
      '<input class="draftvault-input" id="draftvault-new-command" placeholder="Optional command key (example: !response)" style="margin-top:8px;">' +
      '<input class="draftvault-input" id="draftvault-new-tags" placeholder="Tags (comma-separated)" style="margin-top:8px;">' +
      '<div class="draftvault-live-preview">' + this.escapeHTML(this.currentText || "Nothing typed right now.") + '</div>' +
      '<div class="draftvault-counts" id="draftvault-live-counts"></div>' +
      '<button class="draftvault-primary" id="draftvault-save-current">Save Current Message</button>' +
      '</div>';

    content.appendChild(currentSection);

    var savedSection = document.createElement("div");
    savedSection.className = "draftvault-section";

    var savedTitle = document.createElement("button");
    savedTitle.type = "button";
    savedTitle.className = "draftvault-section-toggle";
    savedTitle.setAttribute("data-draftvault-section-toggle", "savedDrafts");
    savedTitle.setAttribute("aria-expanded", String(!this.collapsedSections.savedDrafts));
    savedTitle.textContent = "Saved Drafts";
    savedSection.appendChild(savedTitle);
    var savedBody = document.createElement("div");
    savedBody.setAttribute("data-draftvault-section-body", "savedDrafts");
    if (this.collapsedSections.savedDrafts) savedBody.hidden = true;

    if (!keys.length) {
      var empty = document.createElement("div");
      empty.className = "draftvault-empty";
      empty.textContent = "No saved drafts yet.";
      savedBody.appendChild(empty);
    }

    for (var i = 0; i < keys.length; i++) {
      savedBody.appendChild(this.makeDraftCard(keys[i], drafts[keys[i]]));
    }
    savedSection.appendChild(savedBody);

    content.appendChild(savedSection);

    var footer = document.createElement("div");
    footer.className = "draftvault-footer";

    var refresh = document.createElement("button");
    refresh.textContent = "Refresh";
    refresh.onclick = function() {
      self.openPanel();
    };

    var clear = document.createElement("button");
    clear.textContent = "Clear All";
    clear.onclick = function() {
      if (!confirm("Delete all saved DraftVault drafts?")) return;

      self.saveDrafts({});
      self.openPanel();
      self.toast("All drafts deleted", "info");
    };

    footer.appendChild(refresh);
    var exportButton = document.createElement("button");
    exportButton.textContent = "Export";
    exportButton.onclick = function() {
      var payload = {
        plugin: "DraftVault",
        exportedAt: new Date().toISOString(),
        drafts: self.getDrafts()
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = "DraftVault-Export-" + Date.now() + ".json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function() { URL.revokeObjectURL(url); }, 200);
      self.toast("Drafts exported", "success");
    };
    footer.appendChild(exportButton);

    var importButton = document.createElement("button");
    importButton.textContent = "Import";
    importButton.onclick = function() {
      var fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json,application/json";
      fileInput.onchange = function() {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function() {
          try {
            var parsed = JSON.parse(String(reader.result || "{}"));
            var imported = parsed && parsed.drafts ? parsed.drafts : parsed;
            if (!imported || typeof imported !== "object") throw new Error("Invalid format");
            var allDrafts = self.getDrafts();
            var importedKeys = Object.keys(imported);
            for (var idx = 0; idx < importedKeys.length; idx++) {
              var oldKey = importedKeys[idx];
              var item = imported[oldKey];
              if (!item || typeof item !== "object") continue;
              var newKey = "draft:" + Date.now() + ":" + Math.random().toString(16).slice(2);
              allDrafts[newKey] = {
                name: String(item.name || "Imported Draft"),
                text: String(item.text || ""),
                location: String(item.location || "Unknown"),
                path: String(item.path || ""),
                pinned: !!item.pinned,
                tags: self.normalizeTags(item.tags && item.tags.join ? item.tags.join(",") : item.tags),
                createdAt: Number(item.createdAt) || Date.now(),
                updatedAt: Number(item.updatedAt) || Date.now()
              };
            }
            allDrafts = self.trimDrafts(allDrafts);
            self.saveDrafts(allDrafts);
            self.openPanel();
            self.toast("Drafts imported", "success");
          } catch (error) {
            console.error("[DraftVault] Import failed:", error);
            self.toast("Import failed: invalid JSON", "error");
          }
        };
        reader.readAsText(file);
      };
      fileInput.click();
    };
    footer.appendChild(importButton);
    footer.appendChild(clear);

    this.panel.appendChild(header);
    this.panel.appendChild(content);
    this.panel.appendChild(footer);

    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.panel);

    var saveButton = document.querySelector("#draftvault-save-current");
    var nameInput = document.querySelector("#draftvault-new-name");
    var commandInput = document.querySelector("#draftvault-new-command");
    var tagsInput = document.querySelector("#draftvault-new-tags");
    var liveCounts = document.querySelector("#draftvault-live-counts");
    if (liveCounts) {
      var stats = this.getTextStats(this.currentText);
      liveCounts.textContent = "Characters: " + stats.chars + " · Lines: " + stats.lines;
    }

    if (saveButton && nameInput) {
      saveButton.onclick = function() {
        var saved = self.saveCurrentAsNewDraft(
          nameInput.value,
          tagsInput ? tagsInput.value : "",
          commandInput ? commandInput.value : ""
        );

        if (saved) {
          self.openPanel();
        }
      };
    }
    document.querySelectorAll("[data-draftvault-section-toggle]").forEach(function(toggle) {
      toggle.onclick = function() {
        var key = toggle.getAttribute("data-draftvault-section-toggle");
        var body = document.querySelector('[data-draftvault-section-body="' + key + '"]');
        if (!body) return;
        var collapse = !body.hidden;
        body.hidden = collapse;
        self.collapsedSections[key] = collapse;
        toggle.setAttribute("aria-expanded", String(!collapse));
      };
    });
  }

  makeDraftCard(key, draft) {
    var self = this;

    var card = document.createElement("div");
    card.className = "draftvault-card";

    var date = new Date(draft.updatedAt || Date.now());
    var timeText = date.toLocaleString();

    var preview = draft.text || "";
    if (preview.length > 350) {
      preview = preview.slice(0, 350) + "...";
    }

    card.innerHTML =
      '<div class="draftvault-name">' + this.escapeHTML(draft.name || "Untitled Draft") + '</div>' +
      '<div class="draftvault-meta">' +
        '<span class="draftvault-location">' + this.escapeHTML(draft.location || "Unknown") + '</span>' +
        '<span class="draftvault-time">' + this.escapeHTML(timeText) + '</span>' +
        '<span class="draftvault-tags">' + this.escapeHTML(((draft.tags || []).length ? ("#" + draft.tags.join(" #")) : "No tags")) + '</span>' +
        '<span class="draftvault-tags">' + this.escapeHTML(draft.command ? ("Command: " + draft.command) : "Command: None") + '</span>' +
      '</div>' +
      '<div class="draftvault-preview">' + this.escapeHTML(preview) + '</div>';

    var actions = document.createElement("div");
    actions.className = "draftvault-actions";

    var restore = document.createElement("button");
    restore.className = "draftvault-action";
    restore.textContent = "Restore";

    restore.onclick = function() {
      self.setTextboxText(draft.text || "");
      self.closePanel();
      self.toast("Draft restored", "success");
    };

    var edit = document.createElement("button");
    edit.className = "draftvault-action";
    edit.textContent = "Edit";

    edit.onclick = function() {
      self.openEditPanel(key);
    };

    var del = document.createElement("button");
    del.className = "draftvault-action draftvault-delete";
    del.textContent = "Delete";

    del.onclick = function() {
      if (!confirm("Delete this draft?")) return;

      var drafts = self.getDrafts();
      delete drafts[key];
      self.saveDrafts(drafts);
      self.openPanel();
      self.toast("Draft deleted", "info");
    };

    actions.appendChild(restore);
    var pin = document.createElement("button");
    pin.className = "draftvault-action";
    pin.textContent = draft.pinned ? "Unpin" : "Pin";
    pin.onclick = function() {
      var allDrafts = self.getDrafts();
      if (!allDrafts[key]) return;
      allDrafts[key].pinned = !allDrafts[key].pinned;
      allDrafts[key].updatedAt = Date.now();
      self.saveDrafts(allDrafts);
      self.openPanel();
    };
    actions.appendChild(pin);
    actions.appendChild(edit);
    actions.appendChild(del);

    card.appendChild(actions);

    return card;
  }

  openEditPanel(key) {
    var self = this;
    var drafts = this.getDrafts();
    var draft = drafts[key];

    if (!draft) {
      this.toast("Draft not found", "error");
      return;
    }

    this.closePanel();

    this.backdrop = document.createElement("div");
    this.backdrop.className = "draftvault-backdrop";
    this.bindSafeBackdropClose(this.backdrop, function() {
      self.closePanel();
    });

    this.panel = document.createElement("div");
    this.panel.className = "draftvault-panel";

    var header = document.createElement("div");
    header.className = "draftvault-header";

    var title = document.createElement("div");
    title.innerHTML =
      "<strong>Edit Draft</strong>" +
      "<span>This saved draft only changes when you press Save Changes</span>";

    var close = document.createElement("button");
    close.className = "draftvault-close";
    close.textContent = "×";
    close.onclick = function() {
      self.closePanel();
    };

    header.appendChild(title);
    header.appendChild(close);

    var content = document.createElement("div");
    content.className = "draftvault-content";

    var editSection = document.createElement("div");
    editSection.className = "draftvault-section";

    editSection.innerHTML =
      '<div class="draftvault-section-title">Edit Saved Draft</div>' +
      '<input class="draftvault-input" id="draftvault-edit-name" value="' + this.escapeHTML(draft.name || "Untitled Draft") + '">' +
      '<input class="draftvault-input" id="draftvault-edit-command" value="' + this.escapeHTML(draft.command || "") + '" style="margin-top:8px;" placeholder="Optional command key (example: !response)">' +
      '<input class="draftvault-input" id="draftvault-edit-tags" value="' + this.escapeHTML((draft.tags || []).join(", ")) + '" style="margin-top:8px;" placeholder="Tags (comma-separated)">' +
      '<textarea class="draftvault-textarea" id="draftvault-edit-text">' + this.escapeHTML(draft.text || "") + '</textarea>' +
      '<div class="draftvault-counts" id="draftvault-edit-counts"></div>' +
      '<button class="draftvault-primary" id="draftvault-save-edit">Save Changes</button>';

    content.appendChild(editSection);

    var footer = document.createElement("div");
    footer.className = "draftvault-footer";

    var cancel = document.createElement("button");
    cancel.textContent = "Cancel";
    cancel.onclick = function() {
      self.openPanel();
    };

    var deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.onclick = function() {
      if (!confirm("Delete this draft?")) return;

      var allDrafts = self.getDrafts();
      delete allDrafts[key];
      self.saveDrafts(allDrafts);
      self.openPanel();
      self.toast("Draft deleted", "info");
    };

    footer.appendChild(cancel);
    footer.appendChild(deleteButton);

    this.panel.appendChild(header);
    this.panel.appendChild(content);
    this.panel.appendChild(footer);

    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.panel);

    var saveEdit = document.querySelector("#draftvault-save-edit");
    var nameInput = document.querySelector("#draftvault-edit-name");
    var textArea = document.querySelector("#draftvault-edit-text");
    var commandInput = document.querySelector("#draftvault-edit-command");
    var tagsInput = document.querySelector("#draftvault-edit-tags");
    var editCounts = document.querySelector("#draftvault-edit-counts");
    var originalName = String(draft.name || "");
    var originalText = String(draft.text || "");
    var originalTags = (draft.tags || []).join(",");

    var updateEditCounts = function() {
      if (!editCounts || !textArea) return;
      var stats = self.getTextStats(textArea.value);
      editCounts.textContent = "Characters: " + stats.chars + " · Lines: " + stats.lines;
    };
    updateEditCounts();
    if (textArea) textArea.addEventListener("input", updateEditCounts);

    var isDirty = function() {
      var n = String(nameInput ? nameInput.value : "").trim();
      var t = String(textArea ? textArea.value : "").trim();
      var g = self.normalizeTags(tagsInput ? tagsInput.value : "").join(",");
      return n !== originalName || t !== originalText || g !== originalTags;
    };

    var guardedClose = function(next) {
      if (isDirty() && !confirm("You have unsaved changes. Discard them?")) return;
      next();
    };

    close.onclick = function() { guardedClose(function() { self.closePanel(); }); };
    this.bindSafeBackdropClose(this.backdrop, function() { guardedClose(function() { self.closePanel(); }); });
    cancel.onclick = function() { guardedClose(function() { self.openPanel(); }); };

    if (saveEdit && nameInput && textArea) {
      saveEdit.onclick = function() {
        var newName = String(nameInput.value || "").trim();
        var newText = String(textArea.value || "").trim();

        if (!newName) {
          self.toast("Draft name cannot be empty", "error");
          return;
        }

      if (!newText) {
          self.toast("Draft text cannot be empty", "error");
          return;
        }

        var rawCommand = String(commandInput ? commandInput.value : "").trim();
        var command = self.normalizeCommand(rawCommand);
        if (rawCommand && !command) {
          self.toast("Command keys must start with /, !, %, or @", "error");
          return;
        }

        var allDrafts = self.getDrafts();

        if (!allDrafts[key]) {
          self.toast("Draft not found", "error");
          return;
        }

        allDrafts[key].name = newName;
        allDrafts[key].text = newText;
        allDrafts[key].command = command;
        allDrafts[key].tags = self.normalizeTags(tagsInput ? tagsInput.value : "");
        if (typeof allDrafts[key].pinned !== "boolean") allDrafts[key].pinned = false;
        allDrafts[key].updatedAt = Date.now();

        self.saveDrafts(allDrafts);
        self.openPanel();
        self.toast("Draft updated", "success");
      };
    }
  }

  closePanel() {
    var backdrop = this.backdrop;
    var panel = this.panel;

    this.backdrop = null;
    this.panel = null;

    if (backdrop) {
      backdrop.classList.add("draftvault-closing");
    }

    if (panel) {
      panel.classList.add("draftvault-closing");
    }

    setTimeout(function() {
      document.querySelectorAll(".draftvault-backdrop").forEach(function(el) {
        el.remove();
      });

      document.querySelectorAll(".draftvault-panel").forEach(function(el) {
        el.remove();
      });
    }, 160);
  }

  escapeHTML(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  exportDrafts() {
    var data = {
      exportedAt: new Date().toISOString(),
      drafts: this.getDrafts()
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "draftvault-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
    this.toast("Drafts exported", "success");
  }

  importDrafts() {
    var self = this;
    var file = document.createElement("input");
    file.type = "file";
    file.accept = "application/json";
    file.onchange = function(e) {
      var selected = e.target.files && e.target.files[0];
      if (!selected) return;
      var reader = new FileReader();
      reader.onload = function() {
        try {
          var parsed = JSON.parse(String(reader.result || "{}"));
          var imported = parsed && parsed.drafts ? parsed.drafts : parsed;
          if (!imported || typeof imported !== "object") throw new Error("Invalid format");
          var current = self.getDrafts();
          Object.keys(imported).forEach(function(key) {
            if (!imported[key] || typeof imported[key] !== "object") return;
            current[key] = Object.assign({}, imported[key]);
          });
          self.saveDrafts(current);
          self.toast("Drafts imported", "success");
        } catch (err) {
          self.toast("Import failed", "error");
        }
      };
      reader.readAsText(selected);
    };
    file.click();
  }

  clearAllDrafts() {
    if (!confirm("Clear all saved drafts? This cannot be undone.")) return;
    this.saveDrafts({});
    this.toast("All drafts cleared", "success");
  }

  getSettingsPanel() {
    var panel = document.createElement("div");
    panel.className = "draftvault-settings";

    panel.innerHTML =
      '<div class="draftvault-settings-header">' +
        '<h2 class="draftvault-settings-title">DraftVault</h2>' +
        '<div class="draftvault-settings-subtitle">Save, restore, and manage Discord drafts.</div>' +
      '</div>' +
      '<div class="draftvault-settings-group">' +
        '<div class="draftvault-settings-group-title">General</div>' +
        '<label class="draftvault-setting-row"><span class="draftvault-setting-label">Enable DraftVault</span><input type="checkbox" id="draftvault-enabled" ' + (this.settings.enabled ? "checked" : "") + '></label>' +
        '<label class="draftvault-setting-row"><span class="draftvault-setting-label">Replace Apps Button</span><input type="checkbox" id="draftvault-replace-apps" ' + (this.settings.replaceAppsButton ? "checked" : "") + '></label>' +
        '<label class="draftvault-setting-row"><span class="draftvault-setting-label">Floating Backup Button</span><input type="checkbox" id="draftvault-floating" ' + (this.settings.fallbackFloatingButton ? "checked" : "") + '></label>' +
      '</div>' +
      '<div class="draftvault-settings-group">' +
        '<div class="draftvault-settings-group-title">Limits</div>' +
        '<label class="draftvault-setting-row"><span class="draftvault-setting-label">Max Drafts</span><input class="draftvault-setting-input" id="draftvault-max" type="number" min="5" max="300" value="' + (this.settings.maxDrafts || 100) + '"></label>' +
        '<label class="draftvault-setting-row"><span class="draftvault-setting-label">Min Characters</span><input class="draftvault-setting-input" id="draftvault-min" type="number" min="1" max="50" value="' + (this.settings.minLength || 1) + '"></label>' +
      '</div>' +
      '<div class="draftvault-settings-group">' +
        '<div class="draftvault-settings-group-title">Appearance</div>' +
        '<label class="draftvault-setting-row"><span class="draftvault-setting-label">Panel Width</span><input class="draftvault-setting-input" id="draftvault-panel-width" type="number" min="380" max="760" value="' + (this.settings.panelWidth || 520) + '"></label>' +
        '<label class="draftvault-setting-row"><span class="draftvault-setting-label">Opacity</span><input class="draftvault-setting-input" id="draftvault-panel-opacity" type="number" min="70" max="100" value="' + (this.settings.panelOpacity || 92) + '"></label>' +
        '<label class="draftvault-setting-row"><span class="draftvault-setting-label">Compact Cards</span><input type="checkbox" id="draftvault-compact-cards" ' + (this.settings.compactCards ? "checked" : "") + '></label>' +
        '<label class="draftvault-setting-row"><span class="draftvault-setting-label">Show Stats</span><input type="checkbox" id="draftvault-show-stats" ' + (this.settings.showStats !== false ? "checked" : "") + '></label>' +
        '<label class="draftvault-setting-row"><span class="draftvault-setting-label">Show Tags</span><input type="checkbox" id="draftvault-show-tags" ' + (this.settings.showTags !== false ? "checked" : "") + '></label>' +
      '</div>' +
      '<div class="draftvault-settings-group">' +
        '<div class="draftvault-settings-group-title">Data</div>' +
        '<div class="draftvault-settings-buttons">' +
          '<button type="button" id="draftvault-export">Export</button>' +
          '<button type="button" id="draftvault-import">Import</button>' +
          '<button type="button" id="draftvault-clear">Clear</button>' +
        '</div>' +
      '</div>' +
      '<button class="draftvault-settings-save">Save Settings</button>';

    var self = this;

    panel.querySelector("#draftvault-export").onclick = function() { self.exportDrafts(); };
    panel.querySelector("#draftvault-import").onclick = function() { self.importDrafts(); };
    panel.querySelector("#draftvault-clear").onclick = function() { self.clearAllDrafts(); };

    panel.querySelector(".draftvault-settings-save").onclick = function() {
      self.settings.enabled = panel.querySelector("#draftvault-enabled").checked;
      self.settings.replaceAppsButton = panel.querySelector("#draftvault-replace-apps").checked;
      self.settings.fallbackFloatingButton = panel.querySelector("#draftvault-floating").checked;

      var max = Number(panel.querySelector("#draftvault-max").value);
      self.settings.maxDrafts = Math.max(5, Math.min(300, max || 100));

      var min = Number(panel.querySelector("#draftvault-min").value);
      self.settings.minLength = Math.max(1, Math.min(50, min || 1));
      var panelWidth = Number(panel.querySelector("#draftvault-panel-width").value);
      self.settings.panelWidth = Math.max(380, Math.min(760, panelWidth || 520));
      var panelOpacity = Number(panel.querySelector("#draftvault-panel-opacity").value);
      self.settings.panelOpacity = Math.max(70, Math.min(100, panelOpacity || 92));
      self.settings.compactCards = panel.querySelector("#draftvault-compact-cards").checked;
      self.settings.showStats = panel.querySelector("#draftvault-show-stats").checked;
      self.settings.showTags = panel.querySelector("#draftvault-show-tags").checked;

      self.saveSettings();

      clearInterval(self.detectTimer);
      self.detectTimer = setInterval(function() {
        self.detectCurrentText();
        self.updateLivePreview();
      }, self.settings.detectInterval);

      self.removeButtons();
      self.showOriginalAppsButtons();
      self.mountButton();

      self.toast("DraftVault settings saved", "success");
    };

    return panel;
  }
};
