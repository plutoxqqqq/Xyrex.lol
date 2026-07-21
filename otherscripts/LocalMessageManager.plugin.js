/**
 * @name LocalMessageManager
 * @author Pluto
 * @description Locally edit/delete/restore messages
 */

module.exports = class LocalMessageManager {
    constructor() {
        this.localEdits = new Map();
        this.localDeletes = new Set();

        this.defaultSettings = {
            showLocalLabels: true
        };

        this.settings = Object.assign(
            {},
            this.defaultSettings,
            BdApi.Data.load("LocalMessageManager", "settings") || {}
        );

        this.contextMenuPatch = null;
        this.messageObserver = null;
        this.toolbarObserver = null;

        this.scanInterval = null;
        this.scanQueued = false;

        this.mouseMoveListener = null;
        this.keyDownListener = null;
        this.keyUpListener = null;
        this.scrollListener = null;
        this.resizeListener = null;

        this.activeMessageEl = null;
        this.activeMessageId = null;
        this.shiftHeld = false;

        this.css = `
            .lmm-deleted-placeholder {
                color: var(--text-muted);
                font-style: italic;
                font-size: 0.85em;
                opacity: 0.7;
                display: inline-block;
                padding: 2px 0;
            }

            .lmm-edited-tag {
                font-size: 0.65em;
                color: var(--text-muted);
                margin-left: 4px;
                font-style: italic;
            }

            .lmm-hidden-message-content {
                display: none !important;
            }

            .lmm-modal-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.6);
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .lmm-modal {
                background: var(--background-secondary);
                border: 1px solid var(--background-modifier-accent);
                border-radius: 10px;
                padding: 20px;
                width: 480px;
                max-width: 90vw;
                box-shadow: 0 8px 32px rgba(0,0,0,0.4);
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .lmm-modal h3 {
                margin: 0;
                color: var(--header-primary);
                font-size: 1rem;
                font-weight: 600;
            }

            .lmm-modal small {
                color: var(--text-muted);
            }

            .lmm-modal textarea {
                background: var(--background-tertiary);
                border: 1px solid var(--background-modifier-accent);
                border-radius: 6px;
                color: var(--text-normal);
                font-family: inherit;
                font-size: 0.95em;
                padding: 8px 10px;
                resize: vertical;
                min-height: 90px;
                outline: none;
                width: 100%;
                box-sizing: border-box;
            }

            .lmm-modal textarea:focus {
                border-color: var(--brand-experiment, #5865f2);
            }

            .lmm-modal-buttons {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
            }

            .lmm-btn {
                padding: 7px 16px;
                border-radius: 5px;
                border: none;
                cursor: pointer;
                font-size: 0.9em;
                font-weight: 500;
            }

            .lmm-btn:hover {
                filter: brightness(1.08);
            }

            .lmm-btn-confirm {
                background: var(--brand-experiment, #5865f2);
                color: #fff;
            }

            .lmm-btn-cancel {
                background: var(--background-modifier-accent);
                color: var(--text-normal);
            }

            .lmm-native-toolbar-btn {
                width: 32px !important;
                height: 32px !important;
                min-width: 32px !important;
                min-height: 32px !important;
                max-width: 32px !important;
                max-height: 32px !important;
                padding: 4px !important;
                margin: 0 !important;
                border: none !important;
                outline: none !important;
                background: transparent !important;
                color: var(--interactive-normal) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                cursor: pointer !important;
                pointer-events: auto !important;
                opacity: 1 !important;
                visibility: visible !important;
                box-sizing: border-box !important;
                flex: 0 0 32px !important;
                position: relative !important;
                z-index: 999 !important;
                border-radius: 4px !important;
            }

            .lmm-native-toolbar-btn:hover {
                background: var(--background-modifier-hover) !important;
                color: var(--interactive-hover) !important;
            }

            .lmm-native-toolbar-btn.lmm-danger:hover {
                color: var(--status-danger, #ed4245) !important;
            }

            .lmm-native-toolbar-btn.lmm-good:hover {
                color: var(--status-positive, #3ba55d) !important;
            }

            .lmm-native-toolbar-btn svg {
                width: 20px !important;
                height: 20px !important;
                min-width: 20px !important;
                min-height: 20px !important;
                display: block !important;
                pointer-events: none !important;
                color: inherit !important;
                fill: currentColor !important;
                opacity: 1 !important;
                visibility: visible !important;
            }

            .lmm-native-toolbar-btn svg path {
                fill: currentColor !important;
            }
        `;
    }

    start() {
        BdApi.DOM.addStyle("LocalMessageManager", this.css);

        this.patchContextMenu();
        this.startMessageObserver();
        this.startToolbarInjector();

        BdApi.UI.showToast("LocalMessageManager enabled", { type: "success" });
    }

    stop() {
        BdApi.DOM.removeStyle("LocalMessageManager");

        if (this.contextMenuPatch) {
            this.contextMenuPatch();
            this.contextMenuPatch = null;
        }

        if (this.messageObserver) {
            this.messageObserver.disconnect();
            this.messageObserver = null;
        }

        if (this.toolbarObserver) {
            this.toolbarObserver.disconnect();
            this.toolbarObserver = null;
        }

        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }

        if (this.mouseMoveListener) {
            document.removeEventListener("mousemove", this.mouseMoveListener, true);
            this.mouseMoveListener = null;
        }

        if (this.keyDownListener) {
            document.removeEventListener("keydown", this.keyDownListener, true);
            this.keyDownListener = null;
        }

        if (this.keyUpListener) {
            document.removeEventListener("keyup", this.keyUpListener, true);
            this.keyUpListener = null;
        }

        if (this.scrollListener) {
            document.removeEventListener("scroll", this.scrollListener, true);
            this.scrollListener = null;
        }

        if (this.resizeListener) {
            window.removeEventListener("resize", this.resizeListener, true);
            this.resizeListener = null;
        }

        this.removeAllNativeToolbarButtons();

        document.querySelectorAll("[data-lmm-id]").forEach(el => this.restoreElement(el));

        this.activeMessageEl = null;
        this.activeMessageId = null;
        this.shiftHeld = false;
        this.scanQueued = false;

        BdApi.UI.showToast("LocalMessageManager disabled", { type: "info" });
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.style.padding = "16px";

        const row = document.createElement("label");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.justifyContent = "space-between";
        row.style.gap = "16px";
        row.style.color = "var(--text-normal)";
        row.style.cursor = "pointer";

        const textWrap = document.createElement("div");

        const title = document.createElement("div");
        title.textContent = "Show local labels";
        title.style.fontWeight = "600";
        title.style.marginBottom = "4px";

        const note = document.createElement("div");
        note.textContent = "Shows “edited locally” and “message locally deleted” labels.";
        note.style.color = "var(--text-muted)";
        note.style.fontSize = "13px";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = !!this.settings.showLocalLabels;

        checkbox.addEventListener("change", () => {
            this.settings.showLocalLabels = checkbox.checked;
            this.saveSettings();
            this.refreshAllAlteredMessages();
        });

        textWrap.appendChild(title);
        textWrap.appendChild(note);
        row.appendChild(textWrap);
        row.appendChild(checkbox);
        panel.appendChild(row);

        return panel;
    }

    saveSettings() {
        BdApi.Data.save("LocalMessageManager", "settings", this.settings);
    }

    patchContextMenu() {
        this.contextMenuPatch = BdApi.ContextMenu.patch("message", (tree, props) => {
            const message = props?.message;
            const messageId = message?.id;
            if (!messageId) return;

            const isDeleted = this.localDeletes.has(messageId);
            const isEdited = this.localEdits.has(messageId);

            const items = [
                BdApi.ContextMenu.buildItem({ type: "separator" }),
                BdApi.ContextMenu.buildItem({
                    label: "Local Edit",
                    id: "lmm-context-edit",
                    action: () => this.openEditModal({
                        id: messageId,
                        content: this.localEdits.get(messageId) ?? message.content ?? ""
                    })
                }),
                BdApi.ContextMenu.buildItem({
                    label: "Local Delete",
                    id: "lmm-context-delete",
                    danger: true,
                    action: () => this.localDelete(messageId)
                })
            ];

            if (isDeleted || isEdited) {
                items.push(
                    BdApi.ContextMenu.buildItem({
                        label: "Local Restore",
                        id: "lmm-context-restore",
                        action: () => this.restoreAllLocalChanges(messageId)
                    })
                );
            }

            try {
                this.insertContextItemsAboveReport(tree, items);
            } catch (err) {
                console.error("[LocalMessageManager] Context menu patch failed:", err);
            }
        });
    }

    insertContextItemsAboveReport(tree, items) {
        const children = this.findContextMenuChildren(tree);
        if (!Array.isArray(children)) return;

        const reportIndex = this.findContextMenuItemIndex(children, "report message");

        if (reportIndex !== -1) {
            children.splice(reportIndex, 0, ...items);
        } else {
            children.push(...items);
        }
    }

    findContextMenuChildren(tree) {
        if (Array.isArray(tree?.props?.children)) return tree.props.children;

        try {
            const found = BdApi.Utils.findInTree(
                tree,
                node => Array.isArray(node?.props?.children),
                { walkable: ["props", "children"] }
            );

            return found?.props?.children ?? null;
        } catch {
            return null;
        }
    }

    findContextMenuItemIndex(children, wantedText) {
        const wanted = wantedText.toLowerCase();

        for (let i = 0; i < children.length; i++) {
            const label = this.getReactMenuLabel(children[i]);
            if (label.includes(wanted)) return i;
        }

        return -1;
    }

    getReactMenuLabel(node) {
        const values = [];

        const walk = value => {
            if (!value) return;

            if (typeof value === "string") {
                values.push(value);
                return;
            }

            if (Array.isArray(value)) {
                value.forEach(walk);
                return;
            }

            if (typeof value === "object") {
                if (typeof value.props?.label === "string") values.push(value.props.label);
                if (typeof value.props?.children === "string") values.push(value.props.children);
                if (value.props?.children) walk(value.props.children);
            }
        };

        walk(node);

        return values.join(" ").toLowerCase();
    }

    startToolbarInjector() {
        this.mouseMoveListener = event => {
            if (event.target?.closest?.(".lmm-native-toolbar-btn")) return;

            const messageEl = this.getMessageElementFromTarget(event.target);
            if (!messageEl) return;

            const messageId = this.getMessageIdFromElement(messageEl);
            if (!messageId) return;

            this.activeMessageEl = messageEl;
            this.activeMessageId = messageId;

            this.queueToolbarScan(true);
        };

        this.keyDownListener = event => {
            if (event.key !== "Shift") return;
            if (this.shiftHeld) return;

            this.shiftHeld = true;
            this.queueToolbarScan(true);
        };

        this.keyUpListener = event => {
            if (event.key !== "Shift") return;

            this.shiftHeld = false;
            this.queueToolbarScan(true);
        };

        this.scrollListener = () => this.queueToolbarScan(true);
        this.resizeListener = () => this.queueToolbarScan(true);

        document.addEventListener("mousemove", this.mouseMoveListener, true);
        document.addEventListener("keydown", this.keyDownListener, true);
        document.addEventListener("keyup", this.keyUpListener, true);
        document.addEventListener("scroll", this.scrollListener, true);
        window.addEventListener("resize", this.resizeListener, true);

        this.toolbarObserver = new MutationObserver(() => {
            this.queueToolbarScan();
        });

        this.toolbarObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        this.scanInterval = setInterval(() => {
            this.scanAndPatchToolbars();
        }, 100);

        this.queueToolbarScan(true);
    }

    queueToolbarScan(force = false) {
        if (force) this.removeStaleToolbarButtons();

        if (this.scanQueued) return;
        this.scanQueued = true;

        requestAnimationFrame(() => {
            this.scanQueued = false;
            this.scanAndPatchToolbars();
        });
    }

    scanAndPatchToolbars() {
        if (!this.activeMessageEl || !this.activeMessageId) return;

        const toolbar = this.findHoverToolbarForActiveMessage();

        if (!toolbar) {
            this.removeStaleToolbarButtons();
            return;
        }

        this.patchOneToolbar(toolbar, this.activeMessageEl, this.activeMessageId);
        this.removeStaleToolbarButtons();
    }

    findHoverToolbarForActiveMessage() {
        const messageEl = this.activeMessageEl;
        if (!messageEl) return null;

        const messageRect = messageEl.getBoundingClientRect();
        if (messageRect.width <= 0 || messageRect.height <= 0) return null;

        const candidates = [
            ...document.querySelectorAll("[role='toolbar']"),
            ...document.querySelectorAll("[class*='buttonsInner']"),
            ...document.querySelectorAll("[class*='buttonContainer']")
        ];

        let best = null;
        let bestScore = Infinity;

        for (const candidate of candidates) {
            const toolbar = this.findActualButtonContainer(candidate);
            if (!toolbar) continue;

            if (toolbar.querySelector(".lmm-native-toolbar-btn")) {
                best = toolbar;
                break;
            }

            const buttons = [...toolbar.querySelectorAll("button, [role='button']")]
                .filter(btn => !btn.classList?.contains("lmm-native-toolbar-btn"));

            if (!buttons.length) continue;

            const labels = this.getToolbarLabels(toolbar);

            const isLikelyMessageToolbar =
                labels.includes("add reaction") ||
                labels.includes("add super reaction") ||
                labels.includes("reply") ||
                labels.includes("more") ||
                labels.includes("message actions") ||
                labels.includes("copy link") ||
                labels.includes("mark unread") ||
                labels.includes("pin message");

            const rect = toolbar.getBoundingClientRect();

            if (rect.width <= 0 || rect.height <= 0) continue;
            if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
            if (rect.right < 0 || rect.left > window.innerWidth) continue;

            const overlapsMessageY =
                rect.bottom >= messageRect.top - 12 &&
                rect.top <= messageRect.bottom + 12;

            const closeToMessage =
                Math.abs(rect.right - messageRect.right) <= 160 &&
                rect.bottom >= messageRect.top - 48 &&
                rect.top <= messageRect.bottom + 48;

            if (!isLikelyMessageToolbar && !closeToMessage) continue;
            if (!overlapsMessageY && !closeToMessage) continue;

            const yDistance = Math.abs(
                ((rect.top + rect.bottom) / 2) -
                ((messageRect.top + messageRect.bottom) / 2)
            );

            const rightEdgeDistance = Math.abs(rect.right - messageRect.right);

            const score = yDistance + rightEdgeDistance * 0.15;

            if (score < bestScore) {
                bestScore = score;
                best = toolbar;
            }
        }

        return best;
    }

    patchOneToolbar(target, messageEl, messageId) {
        if (!target || !messageId) return;

        const hasLocalChanges =
            this.localEdits.has(messageId) ||
            this.localDeletes.has(messageId);

        const wantedActions = [];

        if (hasLocalChanges) wantedActions.push("restore");
        if (this.shiftHeld) wantedActions.push("edit");
        wantedActions.push("delete");

        const signature = [
            messageId,
            this.shiftHeld ? "shift" : "normal",
            hasLocalChanges ? "changed" : "clean",
            wantedActions.join(",")
        ].join("|");

        if (
            target.getAttribute("data-lmm-signature") === signature &&
            target.querySelector(".lmm-native-toolbar-btn")
        ) {
            return;
        }

        this.removeNativeToolbarButtonsFrom(target);

        const buttons = [];

        if (hasLocalChanges) {
            buttons.push(
                this.createNativeToolbarButton(target, {
                    action: "restore",
                    title: "Local Restore",
                    className: "lmm-good",
                    messageId,
                    svg: this.getRestoreSvg(),
                    onClick: () => {
                        this.restoreAllLocalChanges(messageId);

                        BdApi.UI.showToast("Message locally restored", {
                            type: "success"
                        });

                        target.removeAttribute("data-lmm-signature");
                        this.queueToolbarScan(true);
                    }
                })
            );
        }

        if (this.shiftHeld) {
            buttons.push(
                this.createNativeToolbarButton(target, {
                    action: "edit",
                    title: "Local Edit",
                    messageId,
                    svg: this.getEditSvg(),
                    onClick: () => {
                        const el = this.findMessageElement(messageId) || messageEl;

                        this.openEditModal({
                            id: messageId,
                            content: this.getMessageText(el, messageId)
                        });

                        target.removeAttribute("data-lmm-signature");
                        this.queueToolbarScan(true);
                    }
                })
            );
        }

        buttons.push(
            this.createNativeToolbarButton(target, {
                action: "delete",
                title: "Local Delete",
                className: "lmm-danger",
                messageId,
                svg: this.getDeleteSvg(),
                onClick: () => {
                    this.localDelete(messageId);

                    BdApi.UI.showToast("Message locally deleted", {
                        type: "success"
                    });

                    target.removeAttribute("data-lmm-signature");
                    this.queueToolbarScan(true);
                }
            })
        );

        const fragment = document.createDocumentFragment();
        buttons.forEach(button => fragment.appendChild(button));

        const anchor =
            this.findToolbarButtonByLabel(target, [
                "add reaction",
                "add super reaction",
                "reaction"
            ]) ||
            this.findFirstRealToolbarButton(target);

        target.insertBefore(fragment, anchor || target.firstChild || null);
        target.setAttribute("data-lmm-signature", signature);
    }

    findActualButtonContainer(toolbar) {
        if (!toolbar) return null;

        if (toolbar.matches?.("[class*='buttonsInner']")) {
            return toolbar;
        }

        const inner =
            toolbar.querySelector?.("[class*='buttonsInner']") ||
            toolbar.querySelector?.("[role='toolbar']");

        if (inner) return inner;

        return toolbar;
    }

    createNativeToolbarButton(toolbar, { action, title, svg, className = "", messageId, onClick }) {
        const template = this.findFirstRealToolbarButton(toolbar);

        const btn = document.createElement("button");
        btn.type = "button";

        const templateClass =
            template?.className && typeof template.className === "string"
                ? template.className
                : "";

        btn.className = `${templateClass} lmm-native-toolbar-btn ${className}`.trim();

        btn.setAttribute("aria-label", title);
        btn.setAttribute("title", title);
        btn.setAttribute("tabindex", "0");
        btn.setAttribute("data-lmm-action", action);
        btn.setAttribute("data-lmm-message-id", messageId);

        btn.innerHTML = svg.trim();

        const stop = event => {
            event.preventDefault();
            event.stopPropagation();

            if (typeof event.stopImmediatePropagation === "function") {
                event.stopImmediatePropagation();
            }
        };

        const run = event => {
            stop(event);

            try {
                onClick(event);
            } catch (err) {
                console.error("[LocalMessageManager] Toolbar button action failed:", err);

                BdApi.UI.showToast("LocalMessageManager button failed. Check console.", {
                    type: "error"
                });
            }
        };

        btn.addEventListener("pointerdown", stop, true);
        btn.addEventListener("mousedown", stop, true);
        btn.addEventListener("mouseup", stop, true);
        btn.addEventListener("click", run, true);

        btn.addEventListener(
            "keydown",
            event => {
                if (event.key === "Enter" || event.key === " ") {
                    run(event);
                }
            },
            true
        );

        return btn;
    }

    getToolbarLabels(toolbar) {
        return [...toolbar.querySelectorAll("[aria-label], [title]")]
            .map(el => {
                return `${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""}`;
            })
            .join(" ")
            .toLowerCase();
    }

    findToolbarButtonByLabel(toolbar, labelParts) {
        const buttons = [...toolbar.querySelectorAll("button, [role='button']")];

        return buttons.find(button => {
            if (button.classList?.contains("lmm-native-toolbar-btn")) return false;

            const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("title") || ""}`
                .toLowerCase();

            return labelParts.some(part => label.includes(part));
        });
    }

    findFirstRealToolbarButton(toolbar) {
        return [...toolbar.querySelectorAll("button, [role='button']")].find(button => {
            if (button.classList?.contains("lmm-native-toolbar-btn")) return false;
            return true;
        }) ?? null;
    }

    removeNativeToolbarButtonsFrom(container) {
        container?.querySelectorAll?.(":scope > .lmm-native-toolbar-btn").forEach(btn => btn.remove());
        container?.removeAttribute?.("data-lmm-signature");
    }

    removeAllNativeToolbarButtons() {
        document.querySelectorAll(".lmm-native-toolbar-btn").forEach(btn => btn.remove());

        document.querySelectorAll("[data-lmm-signature]").forEach(el => {
            el.removeAttribute("data-lmm-signature");
        });
    }

    removeStaleToolbarButtons() {
        document.querySelectorAll(".lmm-native-toolbar-btn").forEach(btn => {
            const toolbar =
                btn.parentElement?.matches?.("[class*='buttonsInner'], [role='toolbar']")
                    ? btn.parentElement
                    : btn.closest("[class*='buttonsInner'], [role='toolbar']");

            if (!toolbar) {
                btn.remove();
                return;
            }

            const rect = toolbar.getBoundingClientRect();

            const offscreen =
                rect.width <= 0 ||
                rect.height <= 0 ||
                rect.bottom < 0 ||
                rect.top > window.innerHeight ||
                rect.right < 0 ||
                rect.left > window.innerWidth;

            if (offscreen) {
                btn.remove();
                toolbar.removeAttribute("data-lmm-signature");
                return;
            }

            if (!this.activeMessageId) return;

            const btnMessageId = btn.getAttribute("data-lmm-message-id");

            if (btnMessageId && btnMessageId !== this.activeMessageId) {
                btn.remove();
                toolbar.removeAttribute("data-lmm-signature");
            }
        });
    }

    startMessageObserver() {
        this.messageObserver = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    this.reapplyToNode(node);
                }
            }
        });

        const chat =
            document.querySelector("[class*='messagesWrapper']")
            ?? document.querySelector("[data-list-id='chat-messages']")
            ?? document.body;

        this.messageObserver.observe(chat, {
            childList: true,
            subtree: true
        });
    }

    reapplyToNode(node) {
        const candidates = [];

        if (this.getMessageIdFromElement(node)) {
            candidates.push(node);
        }

        node.querySelectorAll?.("[id^='chat-messages-'], [data-list-item-id*='chat-messages']")
            .forEach(el => candidates.push(el));

        for (const el of candidates) {
            const messageId = this.getMessageIdFromElement(el);
            if (!messageId) continue;

            if (this.localDeletes.has(messageId)) {
                this.applyDelete(el, messageId);
            } else if (this.localEdits.has(messageId)) {
                this.applyEdit(el, messageId, this.localEdits.get(messageId));
            }
        }
    }

    refreshAllAlteredMessages() {
        const alteredIds = new Set([
            ...this.localDeletes,
            ...this.localEdits.keys()
        ]);

        for (const messageId of alteredIds) {
            const el = this.findMessageElement(messageId);
            if (!el) continue;

            this.restoreElement(el);

            if (this.localDeletes.has(messageId)) {
                this.applyDelete(el, messageId);
            } else if (this.localEdits.has(messageId)) {
                this.applyEdit(el, messageId, this.localEdits.get(messageId));
            }
        }
    }

    localDelete(messageId) {
        this.localDeletes.add(messageId);

        const el = this.findMessageElement(messageId);
        if (el) this.applyDelete(el, messageId);
    }

    localRestore(messageId) {
        this.localDeletes.delete(messageId);

        const el = this.findMessageElement(messageId);
        if (!el) return;

        this.restoreElement(el);

        if (this.localEdits.has(messageId)) {
            this.applyEdit(el, messageId, this.localEdits.get(messageId));
        }
    }

    restoreAllLocalChanges(messageId) {
        this.localDeletes.delete(messageId);
        this.localEdits.delete(messageId);

        const el = this.findMessageElement(messageId);
        if (el) this.restoreElement(el);
    }

    applyDelete(el, messageId) {
        if (!el) return;

        const content = this.getOrCreateMessageContentElement(el);

        if (content && !el.hasAttribute("data-lmm-original-content")) {
            el.setAttribute("data-lmm-original-content", content.innerHTML);
        }

        el.setAttribute("data-lmm-id", messageId);
        el.setAttribute("data-lmm-type", "delete");

        const thingsToHide = el.querySelectorAll(
            [
                "[class*='attachment']",
                "[class*='Attachment']",
                "[class*='embed']",
                "[class*='Embed']",
                "[class*='imageWrapper']",
                "[class*='ImageWrapper']",
                "[class*='mediaAttachmentsContainer']",
                "[class*='oneByOneGrid']",
                "[class*='reaction']",
                "[class*='Reaction']",
                "video",
                "img",
                "picture",
                "canvas"
            ].join(", ")
        );

        thingsToHide.forEach(child => {
            if (child.closest(".lmm-native-toolbar-btn")) return;
            if (child.closest("[role='toolbar']")) return;

            child.setAttribute("data-lmm-hidden", "true");
            child.style.display = "none";
        });

        if (!content) return;

        if (this.settings.showLocalLabels) {
            content.classList.remove("lmm-hidden-message-content");
            content.innerHTML = `<span class="lmm-deleted-placeholder">[message locally deleted]</span>`;
        } else {
            content.innerHTML = "";
            content.classList.add("lmm-hidden-message-content");
        }
    }

    openEditModal(message) {
        const currentText = this.localEdits.get(message.id) ?? message.content ?? "";

        const overlay = document.createElement("div");
        overlay.className = "lmm-modal-overlay";

        overlay.innerHTML = `
            <div class="lmm-modal">
                <h3>Local Edit Message</h3>
                <small>Only you will see this change.</small>
                <textarea id="lmm-textarea">${this.escapeHtml(currentText)}</textarea>
                <div class="lmm-modal-buttons">
                    <button class="lmm-btn lmm-btn-cancel" id="lmm-cancel">Cancel</button>
                    <button class="lmm-btn lmm-btn-confirm" id="lmm-save">Save Locally</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const textarea = overlay.querySelector("#lmm-textarea");
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);

        const keyHandler = event => {
            if (event.key === "Escape") {
                close();
            }

            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                overlay.querySelector("#lmm-save")?.click();
            }
        };

        const close = () => {
            overlay.remove();
            document.removeEventListener("keydown", keyHandler);
        };

        overlay.querySelector("#lmm-cancel").onclick = close;

        overlay.querySelector("#lmm-save").onclick = () => {
            const newText = textarea.value.trim();

            if (newText !== "") {
                this.localDeletes.delete(message.id);
                this.localEdits.set(message.id, newText);

                const el = this.findMessageElement(message.id);
                if (el) {
                    this.restoreElement(el);
                    this.applyEdit(el, message.id, newText);
                }

                BdApi.UI.showToast("Message locally edited", {
                    type: "success"
                });
            }

            close();
            this.queueToolbarScan(true);
        };

        overlay.addEventListener("click", event => {
            if (event.target === overlay) close();
        });

        document.addEventListener("keydown", keyHandler);
    }

    applyEdit(el, messageId, newText) {
        if (!el) return;
        if (this.localDeletes.has(messageId)) return;

        const content = this.getOrCreateMessageContentElement(el);
        if (!content) return;

        if (!el.hasAttribute("data-lmm-original-content")) {
            el.setAttribute("data-lmm-original-content", content.innerHTML);
        }

        el.setAttribute("data-lmm-id", messageId);
        el.setAttribute("data-lmm-type", "edit");

        content.classList.remove("lmm-hidden-message-content");

        const label = this.settings.showLocalLabels
            ? `<span class="lmm-edited-tag">(edited locally)</span>`
            : "";

        content.innerHTML = `${this.escapeHtml(newText)}${label}`;
    }

    restoreEdit(messageId) {
        this.localEdits.delete(messageId);

        const el = this.findMessageElement(messageId);
        if (el) this.restoreElement(el);
    }

    getMessageElementFromTarget(target) {
        if (!target?.closest) return null;

        return target.closest("[id^='chat-messages-']")
            ?? target.closest("li[id*='chat-messages-']")
            ?? target.closest("[data-list-item-id*='chat-messages']")
            ?? target.closest("[class*='messageListItem']");
    }

    getMessageIdFromElement(el) {
        if (!el || el.nodeType !== 1) return null;

        const sources = [];

        if (el.id) sources.push(el.id);

        const listId = el.getAttribute?.("data-list-item-id");
        if (listId) sources.push(listId);

        const innerWithId = el.querySelector?.("[id*='chat-messages-']");
        if (innerWithId?.id) sources.push(innerWithId.id);

        const innerWithListId = el.querySelector?.("[data-list-item-id*='chat-messages']");
        const innerListId = innerWithListId?.getAttribute?.("data-list-item-id");
        if (innerListId) sources.push(innerListId);

        for (const source of sources) {
            const snowflakes = String(source).match(/\d{15,25}/g);

            if (snowflakes?.length) {
                return snowflakes[snowflakes.length - 1];
            }
        }

        return null;
    }

    findMessageElement(messageId) {
        return document.querySelector(`[id$="-${messageId}"]`)
            ?? document.querySelector(`[id="chat-messages-${messageId}"]`)
            ?? document.querySelector(`li[id*="${messageId}"]`)
            ?? document.querySelector(`[data-list-item-id*="${messageId}"]`)
            ?? document.querySelector(`[id*="${messageId}"]`);
    }

    getMessageText(messageEl, messageId) {
        if (this.localEdits.has(messageId)) {
            return this.localEdits.get(messageId);
        }

        if (!messageEl) return "";

        const content = messageEl.querySelector("[class*='messageContent']");
        return content?.innerText ?? "";
    }

    getOrCreateMessageContentElement(messageEl) {
        let content = messageEl.querySelector("[class*='messageContent'], .lmm-created-message-content");

        if (content) return content;

        const container =
            messageEl.querySelector("[class*='contents']") ||
            messageEl.querySelector("[class*='container']") ||
            messageEl;

        content = document.createElement("div");
        content.className = "lmm-created-message-content";
        content.style.color = "var(--text-normal)";
        content.style.marginTop = "2px";

        container.appendChild(content);

        return content;
    }

    restoreElement(el) {
        const originalContent = el.getAttribute("data-lmm-original-content");
        const content = el.querySelector("[class*='messageContent'], .lmm-created-message-content");

        if (content && originalContent !== null) {
            content.innerHTML = originalContent;
            content.classList.remove("lmm-hidden-message-content");
        }

        if (content?.classList.contains("lmm-created-message-content") && !originalContent) {
            content.remove();
        }

        el.querySelectorAll("[data-lmm-hidden='true']").forEach(child => {
            child.style.removeProperty("display");
            child.removeAttribute("data-lmm-hidden");
        });

        el.removeAttribute("data-lmm-id");
        el.removeAttribute("data-lmm-type");
        el.removeAttribute("data-lmm-original-content");
    }

    getDeleteSvg() {
        return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM7 9h2v10h6V9h2v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9Z"/>
            </svg>
        `;
    }

    getRestoreSvg() {
        return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5a7 7 0 1 1-6.32 4H3l4-4 4 4H8.02A5 5 0 1 0 12 7V5Zm-1 4h2v4.2l3 1.8-1 1.7-4-2.4V9Z"/>
            </svg>
        `;
    }

    getEditSvg() {
        return `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 17.25V20h2.75L17.81 8.94l-2.75-2.75L4 17.25ZM19.71 7.04a1 1 0 0 0 0-1.41l-1.34-1.34a1 1 0 0 0-1.41 0l-1.06 1.06 2.75 2.75 1.06-1.06Z"/>
            </svg>
        `;
    }

    escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }
};
