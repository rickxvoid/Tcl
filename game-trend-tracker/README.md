# Game Trend Tracker

A live dashboard that always knows **which video game is trending right now** across
live streaming and video platforms — concurrent viewers, trending video view velocity,
and estimated streamer earnings.

![demo](https://img.shields.io/badge/demo%20mode-works%20with%20no%20keys-brightgreen)

## Quick start

```bash
cd game-trend-tracker
npm install
npm start
# open http://localhost:3000
```

With no API keys configured it runs in **demo mode** with realistic sample data
(a yellow `DEMO DATA` badge shows in the header), so you can see the full dashboard
immediately.

## Going live with real data

1. Copy `.env.example` to `.env`.
2. **Twitch** (concurrent viewers, top streamers): create a free app at
   [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps), then set
   `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`.
3. **YouTube** (trending gaming video views/velocity): enable the
   [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com)
   in a free Google Cloud project and set `YOUTUBE_API_KEY`.
4. Restart the server. The demo badge disappears and live data flows.

Responses are cached in memory for 2 minutes, keeping usage far inside both free tiers.

## What it tracks

| Signal | Source | Meaning |
|---|---|---|
| Live viewers | Twitch Helix `games/top` + `streams` | Who's being watched *right now* |
| Trending views + velocity | YouTube Data API (gaming category) | Video/short-form momentum |
| Trend score (0–100) | Composite | 60% live viewers, 30% view velocity, 10% channel breadth |
| Short-form momentum | Derived | `surging / hot / rising / steady` badge per game |
| Breakout score (0–100) | Composite | Which *smaller* game is most likely to blow up next |
| Earnings | **Estimates** | See methodology below |

### 🚀 Breakout Radar — get in early

The Breakout Radar answers a different question than the main ranking: not "what's
biggest right now" but **"what's most likely to become the next big thing"** — so
creators can enter a space before it saturates. The current top 5 giants are excluded;
remaining games (up to 150K live viewers) are scored on:

- **Viewer growth (40%)** — live viewers now vs ~1 hour ago, measured from rolling
  in-memory snapshots (the longer the server runs, the sharper this gets)
- **Buzz-to-size ratio (30%)** — YouTube view velocity relative to live audience;
  content demand outpacing the live scene is the classic pre-breakout pattern
- **Creator saturation (20%)** — viewers per channel; a big audience split across
  few creators means low competition for a new entrant
- **Room to grow (10%)** — smaller games have more headroom

Verdict tiers: `prime entry window` (75+) → `strong signal` (55+) → `on the radar`
(35+) → `early whisper`. Each card lists the concrete reasons behind its score.
These are heuristic early signals, not guarantees.

### Why no TikTok / Instagram Reels?

Neither platform offers a public API for trend/view data, and scraping them violates
their terms of service and breaks constantly. Their trend presence is approximated by
the **short-form momentum** signal derived from video view velocity, which correlates
strongly with cross-platform virality.

### Earnings methodology (estimates only)

Real creator payouts are private — no platform publishes them. Figures shown are
labeled estimate **ranges** built from widely published heuristics:

- **Twitch streamers (per hour):** ads at ~2–3 impressions per viewer-hour × $3.50–$10 CPM,
  plus subs at ~1–3× average concurrent viewers × ~$2.50 net/sub/month spread over
  ~80 streaming hours/month.
- **YouTube (per game):** trending views × $1.50–$4.00 RPM (typical gaming range).

Actual earnings vary widely with sponsorships, region, ad load, and sub tiers.

## Architecture

```
server.js            Express server: static frontend + /api/trends (2-min cache)
lib/twitch.js        Twitch Helix client (app-access OAuth, top games + streams)
lib/youtube.js       YouTube Data API client (trending gaming videos)
lib/trends.js        Merges sources, computes trend score, ranks games
lib/earnings.js      Estimate formulas + methodology text
lib/mockData.js      Demo-mode data (same shape as live data)
public/              Vanilla JS dashboard, auto-refreshes every 60s
```

No database, no build step — API keys stay server-side.
