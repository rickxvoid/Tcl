// Twitch Helix API client using the client-credentials (app access) flow.
// Docs: https://dev.twitch.tv/docs/api/

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const HELIX = 'https://api.twitch.tv/helix';

let cachedToken = null; // { accessToken, expiresAt }

function isConfigured() {
  return Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
}

async function getToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken;
  }
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials',
  });
  const res = await fetch(TOKEN_URL, { method: 'POST', body: params });
  if (!res.ok) {
    throw new Error(`Twitch token request failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.accessToken;
}

async function helixGet(path, searchParams) {
  const token = await getToken();
  const url = new URL(`${HELIX}${path}`);
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
    else url.searchParams.set(key, value);
  }
  const res = await fetch(url, {
    headers: {
      'Client-Id': process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Twitch ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Top games by current viewership, with each game's top live streamers.
// Returns [{ id, name, boxArtUrl, concurrentViewers, channelCount, streamers: [...] }]
async function getTopGames(limit = 12, streamersPerGame = 5) {
  const top = await helixGet('/games/top', { first: limit });
  const games = [];
  for (const game of top.data) {
    // Top 100 streams for the game — enough to sum a solid concurrent-viewer
    // figure (the long tail below the top 100 is a small fraction of the total).
    const streams = await helixGet('/streams', { game_id: game.id, first: 100 });
    const concurrentViewers = streams.data.reduce((sum, s) => sum + s.viewer_count, 0);
    games.push({
      id: game.id,
      name: game.name,
      boxArtUrl: game.box_art_url.replace('{width}', '285').replace('{height}', '380'),
      concurrentViewers,
      channelCount: streams.data.length,
      streamers: streams.data.slice(0, streamersPerGame).map((s) => ({
        name: s.user_name,
        title: s.title,
        viewers: s.viewer_count,
        platform: 'twitch',
        startedAt: s.started_at,
        url: `https://twitch.tv/${s.user_login}`,
      })),
    });
  }
  return games;
}

module.exports = { isConfigured, getTopGames };
