# Changelog

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
