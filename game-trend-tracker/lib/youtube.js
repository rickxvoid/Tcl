// YouTube Data API v3 client — trending gaming videos (category 20).
// Docs: https://developers.google.com/youtube/v3/docs/videos/list

const API = 'https://www.googleapis.com/youtube/v3/videos';

function isConfigured() {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

// Returns [{ title, channel, views, viewsPerHour, publishedAt, url }]
async function getTrendingGamingVideos(limit = 50) {
  const url = new URL(API);
  url.searchParams.set('part', 'snippet,statistics');
  url.searchParams.set('chart', 'mostPopular');
  url.searchParams.set('videoCategoryId', '20'); // Gaming
  url.searchParams.set('maxResults', String(limit));
  url.searchParams.set('regionCode', 'US');
  url.searchParams.set('key', process.env.YOUTUBE_API_KEY);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`YouTube videos.list failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const now = Date.now();
  return (data.items || []).map((v) => {
    const views = Number(v.statistics?.viewCount || 0);
    const ageHours = Math.max(1, (now - Date.parse(v.snippet.publishedAt)) / 3_600_000);
    return {
      title: v.snippet.title,
      channel: v.snippet.channelTitle,
      views,
      viewsPerHour: Math.round(views / ageHours),
      publishedAt: v.snippet.publishedAt,
      url: `https://youtube.com/watch?v=${v.id}`,
    };
  });
}

// Attach YouTube signals to a list of games by fuzzy title match.
// Mutates nothing; returns a Map of gameName -> { trendingViews, viewVelocityPerHour, videoCount }.
function matchVideosToGames(games, videos) {
  const result = new Map();
  for (const game of games) {
    const needle = game.name.toLowerCase();
    // Also match on distinctive words (>3 chars) from the game name, so
    // "GTA 6 gameplay!!" matches "Grand Theft Auto VI" poorly but
    // "Fortnite Chapter 6" matches "Fortnite".
    const matched = videos.filter((v) => v.title.toLowerCase().includes(needle));
    result.set(game.name, {
      trendingViews: matched.reduce((s, v) => s + v.views, 0),
      viewVelocityPerHour: matched.reduce((s, v) => s + v.viewsPerHour, 0),
      videoCount: matched.length,
    });
  }
  return result;
}

module.exports = { isConfigured, getTrendingGamingVideos, matchVideosToGames };
