// Aggregation: merge Twitch + YouTube signals into a single ranked list with
// a composite trend score, earnings estimates, and a breakout radar.

const twitch = require('./twitch');
const youtube = require('./youtube');
const { getMockData } = require('./mockData');
const { estimateStreamerHourly, estimateYouTubeRevenue, METHODOLOGY } = require('./earnings');
const { computeBreakout, BREAKOUT_NOTE } = require('./breakout');

// Weighted composite: live concurrent viewers dominate (that's "right now"),
// YouTube view velocity captures short-form/video momentum, channel count is
// a breadth-of-creators signal.
const WEIGHTS = { viewers: 0.6, velocity: 0.3, channels: 0.1 };

// Fetch a wide pool so smaller rising games are visible to the breakout radar;
// only the top slice is shown in the main ranking.
const LIVE_GAME_POOL = 30;
const MAIN_LIST_SIZE = 12;

// Rolling in-memory snapshots of live viewers per game, used to measure
// ~1-hour growth for the breakout radar. One entry per cache refresh.
const history = []; // { t, viewers: Map(name -> concurrentViewers) }
const HISTORY_MAX = 300;

function computeGrowth(games) {
  const now = Date.now();
  // Prefer the snapshot closest to (but at least) 1h old; fall back to the
  // oldest snapshot if it's at least 10 minutes old, else growth is unknown.
  let base = null;
  for (const snap of history) {
    if (now - snap.t >= 60 * 60 * 1000) base = snap;
    else break;
  }
  if (!base && history.length && now - history[0].t >= 10 * 60 * 1000) {
    base = history[0];
  }
  const result = new Map();
  for (const g of games) {
    const prev = base?.viewers.get(g.name);
    if (prev > 0) {
      result.set(g.name, { pct: ((g.concurrentViewers - prev) / prev) * 100, known: true });
    } else {
      result.set(g.name, { pct: 0, known: false });
    }
  }
  return result;
}

function recordSnapshot(games) {
  history.push({
    t: Date.now(),
    viewers: new Map(games.map((g) => [g.name, g.concurrentViewers])),
  });
  if (history.length > HISTORY_MAX) history.shift();
}

function normalize(values) {
  const max = Math.max(...values, 1);
  return values.map((v) => v / max);
}

function momentumLabel(velocityShare) {
  if (velocityShare >= 0.75) return 'surging';
  if (velocityShare >= 0.4) return 'hot';
  if (velocityShare >= 0.15) return 'rising';
  return 'steady';
}

async function getTrends() {
  const sources = { twitch: 'demo', youtube: 'demo' };
  let games;
  let youtubeByGame;
  let growthByName;

  if (twitch.isConfigured()) {
    games = await twitch.getTopGames(LIVE_GAME_POOL);
    sources.twitch = 'live';
  }

  if (games && youtube.isConfigured()) {
    try {
      const videos = await youtube.getTrendingGamingVideos();
      youtubeByGame = youtube.matchVideosToGames(games, videos);
      sources.youtube = 'live';
    } catch (err) {
      console.error('YouTube fetch failed, continuing without it:', err.message);
      sources.youtube = 'error';
    }
  }

  if (games) {
    growthByName = computeGrowth(games);
    recordSnapshot(games);
  } else {
    const mock = getMockData();
    games = mock.games;
    youtubeByGame = mock.youtubeByGame;
    growthByName = mock.growthByGame;
  }

  const yt = (name) =>
    (youtubeByGame && youtubeByGame.get(name)) || {
      trendingViews: 0,
      viewVelocityPerHour: 0,
      videoCount: 0,
    };

  const viewersNorm = normalize(games.map((g) => g.concurrentViewers));
  const velocityNorm = normalize(games.map((g) => yt(g.name).viewVelocityPerHour));
  const channelsNorm = normalize(games.map((g) => g.channelCount));

  const ranked = games
    .map((g, i) => {
      const ytStats = yt(g.name);
      return {
        name: g.name,
        boxArtUrl: g.boxArtUrl,
        trendScore: Math.round(
          100 *
            (viewersNorm[i] * WEIGHTS.viewers +
              velocityNorm[i] * WEIGHTS.velocity +
              channelsNorm[i] * WEIGHTS.channels)
        ),
        shortFormMomentum: momentumLabel(velocityNorm[i]),
        twitch: {
          concurrentViewers: g.concurrentViewers,
          channelCount: g.channelCount,
        },
        youtube: ytStats,
        estimatedYouTubeRevenue: estimateYouTubeRevenue(ytStats.trendingViews),
        streamers: g.streamers.map((s) => ({
          ...s,
          estimatedEarningsPerHour: estimateStreamerHourly(s.viewers),
        })),
      };
    })
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, MAIN_LIST_SIZE)
    .map((g, i) => ({ rank: i + 1, ...g }));

  return {
    generatedAt: new Date().toISOString(),
    demoMode: sources.twitch === 'demo',
    sources,
    methodology: METHODOLOGY,
    breakoutNote: BREAKOUT_NOTE,
    breakout: computeBreakout(games, yt, growthByName),
    games: ranked,
  };
}

module.exports = { getTrends };
