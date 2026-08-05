/* Newest first. Entry types: Added | Changed | Fixed | Removed. */

window.XYREX_CHANGELOG = [
  {
    version: 'Scripts Hub 2.0',
    date: '2026-08-04',
    summary: 'Every tab in the Scripts Hub was rebuilt, plus the controls the executor directory was missing.',
    entries: [
      { type: 'Added', text: 'Script Library search, filter chips, sorting, and a grid view, so the library stays usable as it grows' },
      { type: 'Added', text: 'A detail view for every script with the full loader, a copy button, and shareable links' },
      { type: 'Added', text: 'Compatibility matching that names which executors on this site clear a script sUNC requirement' },
      { type: 'Added', text: 'Favorites, so the scripts you actually use stay pinned to the top of the library' },
      { type: 'Added', text: 'An overall leaderboard in Smart Rankings, so the tab shows a ranking rather than one winner per category' },
      { type: 'Added', text: 'Runners-up, a safety/power/value breakdown, and platform scope filters on every ranking card' },
      { type: 'Added', text: 'Click any executor in Smart Rankings or the leaderboard to open its full profile' },
      { type: 'Added', text: 'Comparison gained a live status row, a slot counter, clear-all, copy-as-table, and shareable links' },
      { type: 'Added', text: 'The Exploit Assistant shows how many AI tokens you have left before you spend one, plus suggested prompts, clear chat, and copy reply' },
      { type: 'Added', text: 'Export and import for Saved Scripts, with per-item copy, load, and delete controls' },
      { type: 'Added', text: 'Executor sorting by name, sUNC, trust, and price, a live result count, and a status filter wired to the WEAO feed' },
      { type: 'Changed', text: 'Script cards lead with a status pill and a readable stat grid instead of a wall of identical pills' },
      { type: 'Changed', text: 'Ranking reasons list real signals such as sUNC, trust, and live status instead of generic filler' },
      { type: 'Changed', text: 'Rankings and the comparison verdict now share one scoring engine rather than disagreeing' },
      { type: 'Changed', text: 'Executor search matches descriptions, tags, and features instead of names only' },
      { type: 'Changed', text: 'This changelog replaced the single \'join the Discord\' line that used to fill this tab' },
      { type: 'Fixed', text: 'Paid and invite-only scripts no longer show a copy button that copies a placeholder instead of a script' },
      { type: 'Fixed', text: 'Executor trust levels are read correctly again in Smart Rankings and the comparison table' },
      { type: 'Fixed', text: 'Comparison rows where every executor is Unknown are hidden behind a toggle instead of padding the table' },
      { type: 'Fixed', text: 'Assistant Reply and Copy buttons are always visible, so they work on touch devices' },
      { type: 'Removed', text: 'Empty game categories no longer render, and roughly 1,400 lines of placeholder stubs left the catalog file' }
    ]
  },
  {
    version: 'Anti-cheat hardening',
    date: '2026-07-18',
    summary: 'Console exploits against AI tokens and Dodge saves were closed off.',
    entries: [
      { type: 'Fixed', text: 'Token seal and cooldown logic moved into a private vault, so scripts can no longer forge balances' },
      { type: 'Added', text: 'Save integrity checks that detect and revert localStorage edits made mid-session' },
      { type: 'Changed', text: 'Dodge captures pristine timing and storage references at load, so monkeypatching cannot rig runs' }
    ]
  },
  {
    version: 'AetherBeds anti-cheat',
    date: '2026-06-27',
    summary: 'Speed validation was tightened without punishing legitimate speed sources.',
    entries: [
      { type: 'Fixed', text: 'Raised player speed is detected instead of being adopted as the new allowed movement cap' },
      { type: 'Changed', text: 'Speed Boots, the Assassin kit, and the Speed Lines reward are accounted for before anything is flagged' }
    ]
  }
];
