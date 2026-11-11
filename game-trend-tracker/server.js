require('dotenv').config();
const path = require('path');
const express = require('express');
const { getTrends } = require('./lib/trends');

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory cache keeps us far inside free API quotas even with many clients.
const CACHE_TTL_MS = 2 * 60 * 1000;
let cache = null; // { data, expiresAt }
let inflight = null;

app.get('/api/trends', async (req, res) => {
  try {
    if (cache && Date.now() < cache.expiresAt) {
      return res.json(cache.data);
    }
    // Coalesce concurrent requests into one upstream fetch.
    if (!inflight) {
      inflight = getTrends()
        .then((data) => {
          cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
          return data;
        })
        .finally(() => {
          inflight = null;
        });
    }
    res.json(await inflight);
  } catch (err) {
    console.error('trends error:', err);
    res.status(502).json({ error: 'Failed to fetch trend data', detail: err.message });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Game Trend Tracker running at http://localhost:${PORT}`);
  if (!process.env.TWITCH_CLIENT_ID) {
    console.log('No API keys found — running in DEMO MODE (see .env.example).');
  }
});
