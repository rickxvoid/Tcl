// Breakout Radar: surfaces games that are NOT the biggest right now but show
// the strongest early signals of becoming the next big thing — so creators can
// enter the space before it saturates. Heuristic signal, not a guarantee.

// Signal weights:
// - growth:  live-viewer growth over ~1h — the wave is already forming
// - buzz:    YouTube view velocity relative to live audience size — content
//            demand outpacing the live scene
// - access:  viewers per channel — a big audience split across few creators
//            means low competition for a new entrant
// - room:    inverse size — smaller games have more headroom
const WEIGHTS = { growth: 0.4, buzz: 0.3, access: 0.2, room: 0.1 };

const GIANT_RANKS_EXCLUDED = 5; // the current top 5 are already "big"
const MAX_CANDIDATE_VIEWERS = 150_000;
const MIN_CANDIDATE_VIEWERS = 1_000; // below this the data is too noisy

function normalize(values) {
  const max = Math.max(...values, 1e-9);
  return values.map((v) => v / max);
}

function verdictFor(score) {
  if (score >= 75) return 'prime entry window';
  if (score >= 55) return 'strong signal';
  if (score >= 35) return 'on the radar';
  return 'early whisper';
}

// games: twitch-shaped list; ytStats: (name) => { viewVelocityPerHour, ... };
// growthByName: Map(name -> { pct, known }).
function computeBreakout(games, ytStats, growthByName, topN = 5) {
  const byViewers = [...games].sort((a, b) => b.concurrentViewers - a.concurrentViewers);
  const giants = new Set(byViewers.slice(0, GIANT_RANKS_EXCLUDED).map((g) => g.name));
  const candidates = games.filter(
    (g) =>
      !giants.has(g.name) &&
      g.concurrentViewers <= MAX_CANDIDATE_VIEWERS &&
      g.concurrentViewers >= MIN_CANDIDATE_VIEWERS
  );
  if (!candidates.length) return [];

  const growth = candidates.map((g) => Math.max(0, growthByName.get(g.name)?.pct ?? 0));
  const buzz = candidates.map(
    (g) => ytStats(g.name).viewVelocityPerHour / Math.max(g.concurrentViewers, 1)
  );
  const access = candidates.map((g) => g.concurrentViewers / Math.max(g.channelCount, 1));
  const size = candidates.map((g) => g.concurrentViewers);

  const gN = normalize(growth);
  const bN = normalize(buzz);
  const aN = normalize(access);
  const sN = normalize(size);

  return candidates
    .map((g, i) => {
      const gInfo = growthByName.get(g.name);
      const score = Math.round(
        100 *
          (gN[i] * WEIGHTS.growth +
            bN[i] * WEIGHTS.buzz +
            aN[i] * WEIGHTS.access +
            (1 - sN[i]) * WEIGHTS.room)
      );
      const reasons = [];
      if (gInfo?.known && gInfo.pct >= 20) {
        reasons.push(`+${Math.round(gInfo.pct)}% live viewers in ~1h`);
      }
      if (bN[i] >= 0.5) reasons.push('video buzz outpacing live audience');
      if (aN[i] >= 0.5) {
        reasons.push(`${g.channelCount} channels — low creator competition`);
      }
      if (1 - sN[i] >= 0.7) reasons.push('plenty of room to grow');
      if (gInfo && !gInfo.known) reasons.push('growth tracking warming up');
      return {
        name: g.name,
        boxArtUrl: g.boxArtUrl,
        breakoutScore: score,
        verdict: verdictFor(score),
        growthPct: gInfo?.known ? Math.round(gInfo.pct) : null,
        concurrentViewers: g.concurrentViewers,
        channelCount: g.channelCount,
        viewersPerChannel: Math.round(access[i]),
        viewVelocityPerHour: ytStats(g.name).viewVelocityPerHour,
        reasons,
      };
    })
    .sort((a, b) => b.breakoutScore - a.breakoutScore)
    .slice(0, topN);
}

const BREAKOUT_NOTE =
  'Breakout scores are heuristic early signals (viewer growth, buzz-to-size ratio, creator ' +
  'saturation, headroom) — not guarantees. Use them as a shortlist for where to enter early.';

module.exports = { computeBreakout, BREAKOUT_NOTE };
