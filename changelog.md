# Changelog

## 2026-08-04 — Scripts Hub overhaul

Every tab in the Scripts Hub was rebuilt, plus supporting work on the executor directory. 13 scripts across 3 categories, 37 executors, one shared scoring engine.

### Added

**Script Library** (renamed from Popular Scripts)
- In-panel search across names, games, descriptions, tags, features, best-executor, and platforms, with multi-term support.
- Filter chips with live counts: Favorites, Working, Keyless, Free, Mobile, Low sUNC.
- Sorting by Recommended, Recently updated, Name, and Lowest sUNC needed.
- A grid view alongside the grouped category view. View and sort choices persist between visits.
- Live result counts (`Showing 2 of 13 scripts across 1 category`).
- A detail view per script with full stats, the complete loader, tags, copy, copy-link, add-to-favorites, and Discord.
- Compatibility matching: each script's sUNC floor is checked against every executor on the site, and the detail view names which ones clear it and by how much (`16 of 18 executors with a measured sUNC score reach 90%`).
- Favorites, persisted per account through the existing scoped-storage shim and pinned to the top of the Recommended sort.
- Shareable `?script=<id>` links that open a script's detail view directly.
- "Save to my scripts", which copies a library script into Saved Scripts.
- A "suggest a script" prompt linking to the Discord.

**Smart Rankings**
- An overall leaderboard of the top 10 executors by combined score, with signal chips and score bars. The tab previously showed category winners but never an actual ranking.
- Runners-up (ranks 2 and 3) on every card, plus a safety/power/value breakdown for the winner.
- Platform scope chips (All / Windows / Mobile / macOS) that recompute every board against that subset.
- Click-through from any executor — winner, runner-up, or leaderboard row — to its full profile.
- A "Best Paid Pick" category scoped to executors with no free tier, so free-tier leaders no longer sweep every board.
- A note naming any executor that tops most categories, pointing readers at the runners-up.

**Executor Comparison**
- An overall score row and a live WEAO status row.
- A "n of 3 selected" counter, a disabled picker state once full, clear-all, and sUNC values on the picker chips.
- Copy-as-markdown-table and shareable `?compare=` links.
- Verdict cards listing which metrics each executor actually wins, plus its signal chips.

**Exploit Assistant**
- A live AI token meter, so the daily limit is visible before it runs out rather than only when it does.
- Six suggested prompts, filling the starter element that had been dead markup.
- A clear-chat button, a copy button on every reply, and an input character counter.

**Saved Scripts**
- Per-item copy, load, and delete controls, and a search box.
- A live character counter, a New button, and a status line.
- JSON export and import, merging by newest `updatedAt`.
- Per-item timestamps and size.

**Changelog** (renamed from Recent Changes)
- A dated timeline with typed entries, driven by `data/site-changelog.js`.

**Executor directory**
- Sorting by featured, name, sUNC, trust, and price, with a live result count.
- A Live Status filter (Working / Not working / Unstable / Unknown) wired to the WEAO feed, which was already being fetched but never exposed as a filter.

**Shared**
- A toast system and a clipboard fallback, so copy still works outside secure contexts instead of failing silently.

### Changed
- Extracted the safety/power/value/stability scoring out of `computeSmartRanking`'s closure into a shared `ExecutorScoring` engine. Smart Rankings and the comparison verdict now agree, instead of the comparison using its own formula.
- Script cards lead with a status pill and a labelled stat grid instead of a row of visually identical badges.
- Script categories are derived from the catalog, so a category exists only while it holds scripts and appears automatically when the first one is added.
- Script categories render expanded by default rather than all collapsed.
- Ranking justifications list real signals (sUNC value, trust level, live status, key system, feature count) instead of templated text like "balanced safety, stability, value, and capability metadata".
- Ranking cards no longer claim to be "Updated for <month>" when they are recomputed on every page load; they state the scope and pool size.
- Executor search matches descriptions, tags, features, platforms, and pricing rather than names only, and supports multiple terms.
- Comparison selections are removable chips instead of decorative `×` text.
- `data/popular-scripts.js` moved to a richer schema (`id`, `access`, `accessNote`, `tags`, `updated`, `suncMin`) and grew from 7 to 13 scripts.
- Renamed the "Popular Scripts" tab to "Script Library" and "Recent Changes" to "Changelog", and dropped the stale `[NEW]` and `[UPDATED]` tab labels.

### Fixed
- Paid and invite-only scripts no longer render a copy button that copies a placeholder such as `PURCHASE FROM DISCORD`; they show how to obtain the script instead.
- Smart Rankings read `High` and `Medium` trust levels again. The trust map only had `trusted`/`caution` keys, so 11 of 37 executors silently contributed no trust signal to the safety score.
- The comparison table can pick a winner for Key System and Trust Level again; both lookups compared against values that never occur in the data (`'key'`, `'trusted'`).
- Comparison rows for Cheat Type and Status no longer test lowercase strings against capitalised data.
- The comparison winner is no longer chosen by a formula that scored a missing sUNC as 55.
- Comparison rows where every selected executor reads Unknown are hidden behind a toggle rather than padding the table.
- Assistant Reply and Copy buttons no longer sit at `opacity: 0` until hover, which reserved dead space in every reply and made them unreachable on touch devices.
- Deep links survive load. The router rewrote the path before the query string was read, so `?script=` was discarded.
- The script library toolbar no longer stretches to a 260px-tall search box on narrow screens, where a horizontal `flex-basis` became a vertical one.

### Removed
- Roughly 1,400 lines of commented-out placeholder entries from `data/popular-scripts.js`.
- Nine empty game categories that rendered as identical "No scripts added yet" accordions.
- The red alert badge that fired on every script without a listed Discord, which read as an error state on most of the library.
- The empty `#assistantStarter` element that CSS had been hiding with `display: none` since nothing ever populated it.
- Dead code left behind by the rewrite: `getScriptBadges`, `groupScriptsByCategory`, `getPopularScriptCategories`, `openNoOfficialDiscordModal`, `NO_OFFICIAL_DISCORD_MESSAGE`, and the unused `smartRankingLabels` and `recentChanges` entries in `scriptsHubData`.

## 2026-07-18

### Fixed
- Patched the console-script exploits against AI Tokens: the seal/verify primitives and cooldown math now live inside a private vault closure, so scripts can no longer forge token amounts, zero out claim cooldowns, or reassign the token entry points.
- Patched the Dodge console exploits: the `window.XyrexDodge` debug surface no longer exposes the live engine/UI, closing off direct coin injection, forced `assisted = false` runs (utilities with coin gain), fake run summaries, and story/daily progress bypasses.

### Added
- New v3 save integrity format for Dodge saves and AI token storage: write-counter sealed checksums plus a companion ledger key, with one-time migration that preserves legitimate v2 saves and token balances.
- Live tamper detection: token state and Dodge saves edited in localStorage mid-session are detected, ignored, and overwritten with the verified in-memory state (including writes coming from other tabs that fail verification).
- Run plausibility ceilings in Dodge: physically impossible score/coin/shard/graze/combo totals mark the run as assisted instead of recording it, with generous margins so legitimate play is never affected.
- Session floors for AI tokens: an observed claim cooldown can never shrink and spent free tokens cannot be refunded within a session, regardless of storage swaps.

### Changed
- Dodge now captures pristine `Math.random`, `requestAnimationFrame`, and localStorage references at load, so later console monkeypatching cannot rig wave generation, fake the frame clock, or intercept saves.
- Dodge's headless `simulate()` debug helper always counts as an assisted run, so fast-forwarded runs can never earn coins, bests, missions, or campaign progress.
- Deep-froze the Dodge catalogs (modifiers, powerups, themes, stages, modes, story chapters, rewards) and locked the `XyrexAccountScope` bridge to a non-writable, non-configurable property so prices, rewards, and the account bridge cannot be edited or swapped even via leaked references.
- new-ui.js now consumes AI tokens through the shared vault in script.js instead of keeping its own copy of the token accounting rules.
- Cross-tab storage adoption for AI tokens and Dodge saves now requires `event.isTrusted`, so a same-tab console script that dispatches a synthetic `StorageEvent` with a validly reimplemented seal is ignored rather than adopted. (A validly reimplemented seal written to storage followed by a page reload remains adoptable — an inherent limit of client-side integrity on a static site; only server-authoritative accounting closes it.)

### Tooling
- Added `tools/anticheat-console-test.js`, a paste-into-DevTools script that simulates 30 exploit attacks (23 AI-token/global on the main site, 9 Dodge on /dodge.html) and reports which were blocked vs. which passed. It snapshots and restores real progress, and prints the known client-side limitation explicitly.

## 2026-06-27

### Fixed
- Tightened the AetherBeds AntiCheat speed validation so increased player speed values are detected instead of being treated as the new allowed movement cap.
- Kept legitimate speed sources safe by accounting for Speed Boots, the Assassin kit, and the Speed Lines battlepass reward before flagging suspicious speed changes.

### Changed
- Updated normal movement speed enforcement to use a derived legitimate speed limit rather than the mutable `player.speed` value that speed modules can modify.
