# Changelog

## 2026-08-04

### Added
- Script Library search, filter chips (Favorites, Working, Keyless, Free, Mobile, Low sUNC), and sorting (Recommended, Recently updated, Name, Lowest sUNC needed), with live result counts.
- A detail view for every script showing full stats, the complete loader, tags, and a shareable `?script=<id>` deep link that opens the script directly.
- Compatibility matching in the script detail view: the sUNC floor of each script is checked against every executor listed on the site, so the modal names which executors clear the bar and by how much.
- Favorites for scripts, persisted per account through the existing scoped-storage shim and pinned to the top of the Recommended sort.
- A grid view alongside the grouped category view, with the choice and the sort mode remembered between visits.
- Saved Scripts gained per-item copy, load, and delete controls, a search box, a live character counter, and JSON export/import that merges by newest `updatedAt`.
- "Save to my scripts" in the script detail view, which copies a library script straight into Saved Scripts.
- A toast system and a clipboard fallback, so copy still works outside secure contexts instead of failing silently.
- Executor sorting (featured, name, sUNC, trust, price), a live result count, and a Live Status filter wired to the WEAO feed.

### Changed
- Script cards lead with a status pill and a labelled stat grid instead of a row of visually identical badges.
- Script categories are derived from the catalog, so a category exists only while it holds scripts and appears automatically when the first one is added.
- Categories now render expanded by default rather than all collapsed.
- Executor search matches descriptions, tags, features, platforms, and pricing rather than names only, and supports multiple terms.
- The Recent Changes tab became a dated changelog timeline driven by `data/site-changelog.js`, replacing a single line pointing at Discord.
- Comparison selections are removable chips instead of decorative `×` text.
- Renamed the "Popular Scripts" tab to "Script Library" and dropped the stale `[NEW]` and `[UPDATED]` tab labels.

### Fixed
- Paid and invite-only scripts no longer render a copy button that copies a placeholder such as `PURCHASE FROM DISCORD`; they show how to obtain the script instead.
- Smart Rankings read `High` and `Medium` trust levels again. The trust map only had `trusted`/`caution` keys, so 11 of 37 executors silently contributed no trust signal to the safety score.
- The comparison table can pick a winner for Key System and Trust Level again; both lookups compared against values that never occur in the data (`'key'`, `'trusted'`).
- Comparison rows for Cheat Type and Status no longer test lowercase strings against capitalised data.
- The script library toolbar no longer stretches to a 260px-tall search box on narrow screens, where the horizontal `flex-basis` became a vertical one.

### Removed
- Roughly 1,400 lines of commented-out placeholder entries from `data/popular-scripts.js`.
- Nine empty game categories that rendered as identical "No scripts added yet" accordions.
- The red alert badge that fired on every script without a listed Discord, which read as an error state on most of the library.

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
