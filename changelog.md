# Changelog

## 2026-08-04 — Scripts Hub overhaul

Every Scripts Hub tab rebuilt, plus the controls the executor directory was missing.

### Added
- **Script Library** — search, filter chips (Favorites, Working, Keyless, Free, Mobile, Low sUNC), four sort modes, grouped and grid views with persisted preferences, live result counts, and favorites.
- **Script detail view** — full stats, the complete loader, copy, `?script=<id>` links, save-to-Saved-Scripts, and compatibility matching that names which listed executors clear the script's sUNC floor (`16 of 18 executors with a measured sUNC score reach 90%`).
- **Smart Rankings** — an overall top-10 leaderboard, since the tab previously showed category winners but no actual ranking. Plus runners-up, safety/power/value breakdowns, platform scope chips, click-through to executor profiles, and a Best Paid Pick category so free-tier leaders don't sweep every board.
- **Comparison** — overall-score and live WEAO status rows, a slot counter, clear-all, sUNC on picker chips, copy-as-table, `?compare=` links, and verdicts listing the metrics each executor actually wins.
- **Exploit Assistant** — a token meter showing the daily limit before it runs out, six suggested prompts, clear chat, copy reply, and a character counter.
- **Saved Scripts** — search, per-item copy/load/delete, timestamps and size, a character counter, and JSON export/import merging by newest `updatedAt`.
- **Changelog tab** — a dated timeline with typed entries from `data/site-changelog.js`.
- **Executors** — sorting (featured, name, sUNC, trust, price), a result count, and a Live Status filter on the already-fetched WEAO feed.
- A toast system and a clipboard fallback for non-secure contexts.

### Changed
- Scoring extracted from `computeSmartRanking`'s closure into a shared `ExecutorScoring` engine, so rankings and the comparison verdict no longer disagree.
- Script cards lead with a status pill and a labelled stat grid instead of identical badges. Categories derive from the catalog and render expanded.
- Ranking reasons list real signals (sUNC, trust, live status, key system, feature count) instead of templated filler, and no longer claim to be "Updated for &lt;month&gt;" while recomputing on every load.
- Executor search covers descriptions, tags, features, platforms, and pricing, with multi-term support.
- `data/popular-scripts.js` moved to a richer schema (`id`, `access`, `accessNote`, `tags`, `updated`, `suncMin`); 7 to 13 scripts.
- Renamed Popular Scripts to Script Library and Recent Changes to Changelog; dropped the stale `[NEW]` and `[UPDATED]` labels.

### Fixed
- Paid and invite-only scripts offered a copy button that copied `PURCHASE FROM DISCORD`.
- Smart Rankings ignored trust for 11 of 37 executors: the map keyed `trusted`/`caution` but the data uses `High`/`Medium`.
- Comparison couldn't pick a winner for Key System or Trust Level (compared against `'key'` and `'trusted'`, values that never occur); Cheat Type and Status tested lowercase against capitalised data; the winner formula scored a missing sUNC as 55.
- All-Unknown comparison rows now collapse behind a toggle instead of padding the table.
- Assistant Reply and Copy sat at `opacity: 0` until hover, reserving dead space in every reply and unreachable on touch.
- `?script=` deep links were dropped because the router rewrote the path before the query string was read.
- The library toolbar became a 260px-tall search box on mobile, where a horizontal `flex-basis` turned vertical.

### Removed
- ~1,400 lines of placeholder comments from the catalog, nine empty category accordions, the red no-Discord badge that fired on most cards, the never-populated `#assistantStarter`, and dead code (`getScriptBadges`, `groupScriptsByCategory`, `getPopularScriptCategories`, `openNoOfficialDiscordModal`, and unused `scriptsHubData` keys).

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
