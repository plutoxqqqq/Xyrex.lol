# Tools

## anticheat-console-test.js

A browser DevTools console script that simulates 20+ exploit attacks against the
Xyrex AntiScript defenses and reports which were **blocked** and which **passed**
(i.e. succeeded — a vulnerability).

### How to use

1. Open **xyrex.lol** (the main site) in your browser.
2. Open DevTools → **Console**.
3. Paste the entire contents of `anticheat-console-test.js` and press Enter.
4. Read the report. Every executed attack should show `✅ BLOCKED`; a
   `❌ PASSED` row means that exploit got through.
5. Repeat on **/dodge.html** to run the Dodge game-specific attacks (they are
   auto-skipped on the main site, and the token attacks are auto-skipped on the
   Dodge page).

The script snapshots your AI-token balance and Dodge save before running and
restores them afterwards, so it will not damage real progress. Reload the page
after running to clear the test's in-memory state.

### What it covers

- **Global bridge:** swapping/hijacking `window.XyrexAccountScope`.
- **AI tokens:** replacing/redefining the token vault, reassigning the `const`
  token entry points, forging or overflowing token storage, hijacking
  `localStorage`/`JSON.parse`, warping `Date.now`, and bypassing the claim
  cooldown and amount limits.
- **Dodge:** replacing the debug API, reaching the live engine/UI, forging the
  save, farming coins with `simulate()`, and rigging `Math.random`.
