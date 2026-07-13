export function parseGradebook(md, n = 5) {
  return [...md.matchAll(/^### (\d{4}-\d{2}-\d{2}) — (.+?) · (\d+)%\s*$/gm)]
    .map((m) => ({ date: m[1], concept: m[2].trim(), pct: Number(m[3]) }))
    .reverse().slice(0, n);
}

/**
 * @param {string} md
 * @param {number} [weakestN]
 * @returns {{ bands: { solid: number, forming: number, shaky: number }, total: number,
 *   weakest: { name: string, score: number, band: string, lastSeen: string }[] }}
 */
export function parseConceptMastery(md, weakestN = 3) {
  const bands = { solid: 0, forming: 0, shaky: 0 };
  const rows = [];
  const rowPattern = /^\|\s*([^|]+?)\s*\|\s*(solid|forming|shaky)\s*\|\s*(\d+)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|/gm;
  for (const m of md.matchAll(rowPattern)) {
    const [, name, band, score, lastSeen] = m;
    bands[band] += 1;
    rows.push({ name, score: Number(score), band, lastSeen });
  }
  const total = bands.solid + bands.forming + bands.shaky;
  if (total === 0) throw new Error('no mastery rows found');
  const weakest = [...rows].sort((a, b) => a.score - b.score).slice(0, weakestN);
  return { bands, total, weakest };
}
