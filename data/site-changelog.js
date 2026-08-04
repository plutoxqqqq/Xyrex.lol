/* Newest first. Entry types: Added | Changed | Fixed | Removed. */

window.XYREX_CHANGELOG = [
  {
    version: 'Script Hub 2.0',
    date: '2026-08-04',
    summary: 'The Script Hub was rebuilt around search, filtering, and per-script detail pages.',
    entries: [
      { type: 'Added', text: 'Script search, filter chips, and sorting, so the library stays usable as it grows' },
      { type: 'Added', text: 'A detail view for every script with the full source, a copy button, and shareable links' },
      { type: 'Added', text: 'Compatibility matching that lists which executors on this site clear a script sUNC requirement' },
      { type: 'Added', text: 'Favourites, so the scripts you actually use stay pinned at the top of the library' },
      { type: 'Added', text: 'A grid view alongside the grouped category view, plus live result counts' },
      { type: 'Added', text: 'Export and import for Saved Scripts, with per-item copy, load, and delete controls' },
      { type: 'Changed', text: 'Script cards now lead with a status pill and a readable stat grid instead of a wall of identical pills' },
      { type: 'Changed', text: 'This changelog replaced the single "join the Discord" line that used to fill this tab' },
      { type: 'Fixed', text: 'Paid and invite-only scripts no longer show a copy button that copies a placeholder instead of a script' },
      { type: 'Fixed', text: 'Executor trust levels are read correctly again in Smart Rankings and the comparison table' },
      { type: 'Removed', text: 'Empty game categories no longer render, and roughly 1,400 lines of placeholder stubs left the catalog file' }
    ]
  },
  {
    version: 'Executor directory update',
    date: '2026-08-04',
    summary: 'The executor grid got the controls it was missing.',
    entries: [
      { type: 'Added', text: 'Sorting by name, sUNC, trust, and price, with a live count of matching executors' },
      { type: 'Added', text: 'A status filter wired to the live WEAO feed, so you can show only undetected executors' },
      { type: 'Changed', text: 'Executor search now matches descriptions, tags, and features instead of names only' },
      { type: 'Fixed', text: 'The comparison table can pick a winner for key system and trust level again' }
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
