/*
  id       stable slug, used by deep links and favourites — never reuse one
  category creates the hub category; ordering lives in POPULAR_SCRIPT_CATEGORY_ORDER
  access   'free' | 'paid' | 'invite' — anything but 'free' hides the copy button
  suncMin  numeric floor for filtering and executor matching, 0 means no floor
  status   'Working' | 'Buggy' | 'Patched' | 'Discontinued'
*/

window.XYREX_POPULAR_SCRIPTS = [
  {
    id: 'voidware-rewrite',
    name: 'Voidware Rewrite',
    category: 'Bedwars',
    description: 'Long-running Bedwars combat suite with a large module list and an active development team',
    script: 'loadstring(game:HttpGet("https://raw.githubusercontent.com/VapeVoidware/VWRewrite/master/NewMainScript.lua", true))()',
    access: 'free',
    tags: ['Combat', 'GUI', 'Auto farm', 'Movement'],
    updated: '2026-08-04',
    stats: {
      price: 'Free and Paid',
      keySystem: 'Keyless',
      suncRequired: '80%+',
      suncMin: 80,
      bestExecutor: 'Any compatible executor',
      stability: 'Stable',
      status: 'Working',
      platform: ['PC', 'Mobile'],
      discord: 'https://discord.gg/voidware',
      discordIcon: true
    }
  },
  {
    id: 'catvape',
    name: 'CatVape',
    category: 'Bedwars',
    description: 'Vape-style Bedwars client with a lightweight interface and a low executor requirement',
    script: "loadstring(game:HttpGet('https://raw.githubusercontent.com/MaxlaserTech/CatV6/main/init.lua'), 'init.lua')({})",
    access: 'free',
    tags: ['Combat', 'GUI', 'Movement'],
    updated: '2026-08-04',
    stats: {
      price: 'Free',
      keySystem: 'Keyless',
      suncRequired: '80%+',
      suncMin: 80,
      bestExecutor: 'Any compatible executor',
      stability: 'Stable',
      status: 'Working',
      platform: ['PC', 'Mobile'],
      discord: 'https://discord.gg/catvape',
      discordIcon: true
    }
  },
  {
    id: 'aerov4',
    name: 'AeroV4',
    category: 'Bedwars',
    description: 'Bedwars fork that still loads, but its Discord was taken down so updates and support have stopped',
    script: 'loadstring(game:HttpGet("https://raw.githubusercontent.com/poopparty/poopparty/main/NewMainScript.lua", true))()',
    access: 'free',
    tags: ['Combat', 'GUI', 'Unmaintained'],
    updated: '2026-08-04',
    stats: {
      price: 'Free',
      keySystem: 'Keyless',
      suncRequired: '90%+',
      suncMin: 90,
      bestExecutor: 'Any compatible executor',
      stability: 'Mixed',
      status: 'Buggy',
      platform: ['PC', 'Mobile'],
      discordIcon: false
    }
  },

  {
    id: 'infinite-yield',
    name: 'Infinite Yield',
    category: 'Universal',
    description: 'The most widely used admin command suite, with several hundred commands that work in almost any experience',
    script: 'loadstring(game:HttpGet("https://raw.githubusercontent.com/EdgeIY/infiniteyield/master/source"))()',
    access: 'free',
    tags: ['Admin commands', 'Utility', 'Teleport', 'Beginner friendly'],
    updated: '2026-08-04',
    stats: {
      price: 'Free',
      keySystem: 'Keyless',
      suncRequired: 'Any %',
      suncMin: 0,
      bestExecutor: 'Any compatible executor',
      stability: 'Stable',
      status: 'Working',
      platform: ['PC', 'Mobile'],
      discordIcon: false
    }
  },
  {
    id: 'dark-dex',
    name: 'Dark Dex Explorer',
    category: 'Universal',
    description: 'Instance explorer and property editor for inspecting the game tree while you debug or reverse a script',
    script: 'loadstring(game:HttpGet("https://raw.githubusercontent.com/peyton2465/Dex/master/out.lua"))()',
    access: 'free',
    tags: ['Explorer', 'Debugging', 'Developer tool', 'Utility'],
    updated: '2026-08-04',
    stats: {
      price: 'Free',
      keySystem: 'Keyless',
      suncRequired: 'Any %',
      suncMin: 0,
      bestExecutor: 'Any compatible executor',
      stability: 'Stable',
      status: 'Working',
      platform: ['PC', 'Mobile'],
      discordIcon: false
    }
  },
  {
    id: 'simple-spy',
    name: 'SimpleSpy',
    category: 'Universal',
    description: 'Remote logger that prints readable, copy-ready call code for every RemoteEvent and RemoteFunction a game fires',
    script: 'loadstring(game:HttpGet("https://raw.githubusercontent.com/exxtremestuffs/SimpleSpySource/master/SimpleSpy.lua"))()',
    access: 'free',
    tags: ['Remote spy', 'Debugging', 'Developer tool', 'Utility'],
    updated: '2026-08-04',
    stats: {
      price: 'Free',
      keySystem: 'Keyless',
      suncRequired: '80%+',
      suncMin: 80,
      bestExecutor: 'Any executor with a working hookfunction',
      stability: 'Stable',
      status: 'Working',
      platform: ['PC', 'Mobile'],
      discordIcon: false
    }
  },
  {
    id: 'hydroxide',
    name: 'Hydroxide',
    category: 'Universal',
    description: 'Advanced remote and upvalue inspector for people who want to read a game internals rather than run a premade cheat',
    script: [
      'local owner = "Upbolt"',
      'local branch = "revision"',
      '',
      'local function webImport(file)',
      '\treturn loadstring(game:HttpGetAsync(("https://raw.githubusercontent.com/%s/Hydroxide/%s/%s.lua"):format(owner, branch, file)), file .. ".lua")()',
      'end',
      '',
      'webImport("init")',
      'webImport("ui/main")'
    ].join('\n'),
    access: 'free',
    tags: ['Remote spy', 'Upvalue scanner', 'Debugging', 'Developer tool'],
    updated: '2026-08-04',
    stats: {
      price: 'Free',
      keySystem: 'Keyless',
      suncRequired: '90%+',
      suncMin: 90,
      bestExecutor: 'Executors with full debug library support',
      stability: 'Stable',
      status: 'Working',
      platform: ['PC'],
      discordIcon: false
    }
  },
  {
    id: 'unnamed-esp',
    name: 'Unnamed ESP',
    category: 'Universal',
    description: 'Standalone player ESP with boxes, tracers, and name tags that works in most experiences without per-game setup',
    script: 'loadstring(game:HttpGet("https://raw.githubusercontent.com/ic3w0lf22/Unnamed-ESP/master/UnnamedESP.lua"))()',
    access: 'free',
    tags: ['ESP', 'Visuals', 'Utility'],
    updated: '2026-08-04',
    stats: {
      price: 'Free',
      keySystem: 'Keyless',
      suncRequired: '80%+',
      suncMin: 80,
      bestExecutor: 'Executors with a working Drawing library',
      stability: 'Stable',
      status: 'Working',
      platform: ['PC'],
      discordIcon: false
    }
  },
  {
    id: 'cmd-x',
    name: 'CMD-X',
    category: 'Universal',
    description: 'Clean admin command bar and a lighter alternative to Infinite Yield when you only need the common commands',
    script: 'loadstring(game:HttpGet("https://raw.githubusercontent.com/CMD-X/CMD-X/master/Source"))()',
    access: 'free',
    tags: ['Admin commands', 'Utility', 'Beginner friendly'],
    updated: '2026-08-04',
    stats: {
      price: 'Free',
      keySystem: 'Keyless',
      suncRequired: 'Any %',
      suncMin: 0,
      bestExecutor: 'Any compatible executor',
      stability: 'Stable',
      status: 'Working',
      platform: ['PC', 'Mobile'],
      discordIcon: false
    }
  },
  {
    id: 'sirius',
    name: 'Sirius',
    category: 'Universal',
    description: 'Multi-game hub with per-experience modules and a persistent settings system, from the team behind the Rayfield UI library',
    script: "loadstring(game:HttpGet('https://sirius.menu/script'))()",
    access: 'free',
    tags: ['Hub', 'Multi-game', 'GUI', 'Beginner friendly'],
    updated: '2026-08-04',
    stats: {
      price: 'Free',
      keySystem: 'Keyless',
      suncRequired: '80%+',
      suncMin: 80,
      bestExecutor: 'Any compatible executor',
      stability: 'Stable',
      status: 'Working',
      platform: ['PC', 'Mobile'],
      discord: 'https://discord.gg/sirius',
      discordIcon: true
    }
  },
  {
    id: 'vape-v4',
    name: 'Vape V4',
    category: 'Universal',
    description: 'The Vape client that most Bedwars and Rivals forks are built on, with modules for a wide range of experiences',
    script: "loadstring(game:HttpGet('https://raw.githubusercontent.com/7GrandDadPGN/VapeV4ForRoblox/main/NewMainScript.lua', true))()",
    access: 'free',
    tags: ['Combat', 'Multi-game', 'GUI', 'Movement'],
    updated: '2026-08-04',
    stats: {
      price: 'Free',
      keySystem: 'Keyless',
      suncRequired: '80%+',
      suncMin: 80,
      bestExecutor: 'Any compatible executor',
      stability: 'Stable',
      status: 'Working',
      platform: ['PC', 'Mobile'],
      discordIcon: false
    }
  },

  {
    id: 'kiciahook',
    name: 'KiciaHook',
    category: 'Rivals',
    description: 'Rivals-focused aim and visuals hook loaded through a keyed loader',
    script: 'loadstring(game:HttpGet("https://raw.githubusercontent.com/kiciahook/kiciahook/refs/heads/main/loader.luau"))()',
    access: 'free',
    tags: ['Aim assist', 'Visuals', 'Combat'],
    updated: '2026-08-04',
    stats: {
      price: 'Free',
      keySystem: 'Keyed',
      suncRequired: '90%+',
      suncMin: 90,
      bestExecutor: 'Any compatible executor',
      stability: 'Stable',
      status: 'Working',
      platform: ['PC', 'Mobile'],
      discordIcon: false
    }
  },
  {
    id: 'unnamed-enhancements',
    name: 'Unnamed Enhancements',
    category: 'Rivals',
    description: 'Paid Rivals, Da Hood, and Wild West script sold and delivered through its own Discord server',
    script: '',
    access: 'paid',
    accessNote: 'Sold through the developer Discord. There is no public loader to copy',
    tags: ['Aim assist', 'Combat', 'Multi-game', 'Paid'],
    updated: '2026-08-04',
    stats: {
      price: 'Paid ($14.99)',
      keySystem: 'Keyed',
      suncRequired: '99%+',
      suncMin: 99,
      bestExecutor: 'Volt / Potassium',
      stability: 'Stable',
      status: 'Working',
      platform: ['PC', 'Mobile'],
      discordIcon: false
    }
  }
];
