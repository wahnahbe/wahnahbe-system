export const LEVELS = [
  { level: 1, name: 'Apprentice', min: 0 },
  { level: 2, name: 'Practitioner', min: 40 },
  { level: 3, name: 'Analyst', min: 120 },
  { level: 4, name: 'Engineer', min: 240 },
  { level: 5, name: 'Forward-Deployed Master', min: 400 },
];

export const totalXp = (reportXp, ledger) =>
  reportXp + ledger.entries.reduce((sum, e) => sum + e.amount, 0);

export function levelInfo(xp) {
  const idx = Math.max(0, LEVELS.findLastIndex((l) => xp >= l.min));
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const xpIntoLevel = Math.max(0, xp - cur.min);
  const xpForNext = next ? next.min - cur.min : null;
  const pct = next ? Math.round((xpIntoLevel / xpForNext) * 100) : 100;
  return { level: cur.level, name: cur.name, xpIntoLevel, xpForNext, pct };
}

export function newCrossings(prevXp, nextXp, ledger) {
  const recorded = new Set(ledger.crossings.map((c) => c.level));
  return LEVELS.filter((l) => prevXp < l.min && nextXp >= l.min && !recorded.has(l.level))
    .map((l) => l.level);
}

export const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function momentum(quests, todayStr) {
  const per = quests.dailies.length;
  if (per === 0) return 0;
  const [y, m, d] = todayStr.split('-').map(Number);
  let done = 0;
  for (let i = 0; i < 7; i += 1) {
    const day = localDateStr(new Date(y, m - 1, d - i));
    done += (quests.completions[day] ?? []).length;
  }
  return Math.round((done / (per * 7)) * 100);
}
