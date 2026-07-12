export function parseGradebook(md, n = 5) {
  return [...md.matchAll(/^### (\d{4}-\d{2}-\d{2}) — (.+?) · (\d+)%\s*$/gm)]
    .map((m) => ({ date: m[1], concept: m[2].trim(), pct: Number(m[3]) }))
    .reverse().slice(0, n);
}

export function parseConceptMastery(md) {
  const bands = { solid: 0, forming: 0, shaky: 0 };
  for (const m of md.matchAll(/^\|[^|]+\|\s*(solid|forming|shaky)\s*\|/gm)) bands[m[1]] += 1;
  const total = bands.solid + bands.forming + bands.shaky;
  if (total === 0) throw new Error('no mastery rows found');
  return { bands, total };
}
