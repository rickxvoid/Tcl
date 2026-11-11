// Realistic demo data used when API keys are not configured. Numbers get a
// small random jitter on every call so auto-refresh feels live.

const BASE_GAMES = [
  {
    name: 'Grand Theft Auto V',
    boxArt: 'Grand%20Theft%20Auto%20V',
    viewers: 612000, channels: 4100, ytViews: 48_000_000, ytVelocity: 920_000, ytVideos: 11,
    streamers: [
      ['xQc', 92000], ['Kai Cenat', 88000], ['Jynxzi', 41000], ['summit1g', 28000], ['Lirik', 21000],
    ],
  },
  {
    name: 'League of Legends',
    boxArt: 'League%20of%20Legends',
    viewers: 344000, channels: 3200, ytViews: 21_000_000, ytVelocity: 310_000, ytVideos: 8,
    streamers: [
      ['Caedrel', 71000], ['Tyler1', 38000], ['LCK', 33000], ['Thebausffs', 17000], ['Nemesis', 12000],
    ],
  },
  {
    name: 'Fortnite',
    boxArt: 'Fortnite',
    viewers: 289000, channels: 8900, ytViews: 64_000_000, ytVelocity: 1_400_000, ytVideos: 14,
    streamers: [
      ['Ninja', 44000], ['SypherPK', 31000], ['Clix', 29000], ['Peterbot', 18000], ['Mongraal', 11000],
    ],
  },
  {
    name: 'VALORANT',
    boxArt: 'VALORANT',
    viewers: 231000, channels: 5100, ytViews: 17_500_000, ytVelocity: 260_000, ytVideos: 7,
    streamers: [
      ['VCT', 64000], ['TenZ', 27000], ['Tarik', 25000], ['Shroud', 19000], ['Kyedae', 9000],
    ],
  },
  {
    name: 'Counter-Strike 2',
    boxArt: 'Counter-Strike%202',
    viewers: 204000, channels: 2700, ytViews: 12_800_000, ytVelocity: 190_000, ytVideos: 6,
    streamers: [
      ['ESL_CSGO', 58000], ['s1mple', 24000], ['ohnePixel', 22000], ['m0NESY', 13000], ['fl0m', 8000],
    ],
  },
  {
    name: 'Minecraft',
    boxArt: 'Minecraft',
    viewers: 168000, channels: 6300, ytViews: 71_000_000, ytVelocity: 1_100_000, ytVideos: 16,
    streamers: [
      ['Dream', 32000], ['TommyInnit', 21000], ['Philza', 15000], ['CaptainSparklez', 9000], ['Grian', 7000],
    ],
  },
  {
    name: 'Apex Legends',
    boxArt: 'Apex%20Legends',
    viewers: 96000, channels: 1900, ytViews: 6_400_000, ytVelocity: 88_000, ytVideos: 4,
    streamers: [
      ['ImperialHal', 19000], ['aceu', 14000], ['NiceWigg', 9000], ['Sweetdreams', 6000], ['Verhulst', 4000],
    ],
  },
  {
    name: 'Call of Duty: Warzone',
    boxArt: 'Call%20of%20Duty%3A%20Warzone',
    viewers: 84000, channels: 2400, ytViews: 9_200_000, ytVelocity: 140_000, ytVideos: 5,
    streamers: [
      ['Nickmercs', 17000], ['TimTheTatman', 15000], ['Swagg', 8000], ['Aydan', 6000], ['JoeWo', 3000],
    ],
  },
  // ---- Smaller, fast-rising games (feed the Breakout Radar) ----
  {
    name: 'ARC Raiders',
    boxArt: 'ARC%20Raiders',
    viewers: 38000, channels: 310, ytViews: 9_500_000, ytVelocity: 610_000, ytVideos: 6,
    growthPct: 142,
    streamers: [['shroud', 12000], ['DrLupo', 7000], ['CohhCarnage', 4000]],
  },
  {
    name: 'REPO',
    boxArt: 'REPO',
    viewers: 12000, channels: 180, ytViews: 4_800_000, ytVelocity: 210_000, ytVideos: 4,
    growthPct: 210,
    streamers: [['insym', 4000], ['8bitryan', 2500], ['CaseOh', 2000]],
  },
  {
    name: 'Schedule I',
    boxArt: 'Schedule%20I',
    viewers: 22000, channels: 260, ytViews: 7_200_000, ytVelocity: 330_000, ytVideos: 5,
    growthPct: 118,
    streamers: [['Sodapoppin', 6000], ['Forsen', 4500], ['DisguisedToast', 3000]],
  },
  {
    name: 'Deadlock',
    boxArt: 'Deadlock',
    viewers: 29000, channels: 410, ytViews: 5_100_000, ytVelocity: 280_000, ytVideos: 4,
    growthPct: 85,
    streamers: [['Grubby', 8000], ['Avoidingthepuddle', 5000], ['Dendi', 3500]],
  },
  {
    name: 'Hades II',
    boxArt: 'Hades%20II',
    viewers: 18000, channels: 350, ytViews: 3_200_000, ytVelocity: 150_000, ytVideos: 3,
    growthPct: 64,
    streamers: [['Haelian', 3500], ['Vorime', 2000], ['Cristina Vee', 1500]],
  },
];

function jitter(n, pct = 0.06) {
  const delta = n * pct * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(n + delta));
}

// Same shape as twitch.getTopGames() output, plus a parallel YouTube map —
// so the aggregator treats demo and live data identically.
function getMockData() {
  const games = BASE_GAMES.map((g) => ({
    id: g.name,
    name: g.name,
    boxArtUrl: `https://static-cdn.jtvnw.net/ttv-boxart/${g.boxArt}-285x380.jpg`,
    concurrentViewers: jitter(g.viewers),
    channelCount: jitter(g.channels, 0.03),
    streamers: g.streamers.map(([name, viewers]) => ({
      name,
      title: `${g.name} — live now`,
      viewers: jitter(viewers, 0.08),
      platform: 'twitch',
      startedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
      url: `https://twitch.tv/${name.toLowerCase().replace(/\s+/g, '')}`,
    })),
  }));

  const youtubeByGame = new Map(
    BASE_GAMES.map((g) => [
      g.name,
      {
        trendingViews: jitter(g.ytViews, 0.04),
        viewVelocityPerHour: jitter(g.ytVelocity, 0.1),
        videoCount: g.ytVideos,
      },
    ])
  );

  // Simulated ~1h viewer growth (live mode measures this from real snapshots).
  const growthByGame = new Map(
    BASE_GAMES.map((g) => [
      g.name,
      { pct: jitter(g.growthPct ?? 5, 0.15), known: true },
    ])
  );

  return { games, youtubeByGame, growthByGame };
}

module.exports = { getMockData };
