export const NAMED_LEVELS = [
  { level: 1, name: 'Apprentice', min: 0 },
  { level: 2, name: 'Practitioner', min: 40 },
  { level: 3, name: 'Analyst', min: 120 },
  { level: 4, name: 'Engineer', min: 240 },
  { level: 5, name: 'Forward-Deployed Master', min: 400 },
  { level: 6, name: 'Architect', min: 560 },
  { level: 7, name: 'Netrunner', min: 760 },
  { level: 8, name: 'Ghost', min: 1000 },
  { level: 9, name: 'Sovereign', min: 1300 },
  { level: 10, name: 'Monarch', min: 1650 },
];
const LAST_NAMED_WIDTH = 450; // width of level 10 → 11
const STAR_GROWTH = 1.28;

export function thresholdFor(level) {
  if (level <= 10) return NAMED_LEVELS[level - 1].min;
  let min = NAMED_LEVELS[9].min;
  let width = LAST_NAMED_WIDTH;
  for (let l = 11; l <= level; l += 1) {
    min += width;
    width = Math.round((width * STAR_GROWTH) / 10) * 10;
  }
  return min;
}

export function levelNameFor(level) {
  return level <= 10 ? NAMED_LEVELS[level - 1].name : `Monarch ★${level - 9}`;
}

export const totalXp = (reportXp, ledger) =>
  reportXp + ledger.entries.reduce((sum, e) => sum + e.amount, 0);

export function levelInfo(xp) {
  const clamped = Math.max(0, xp);
  let level = 1;
  while (clamped >= thresholdFor(level + 1)) level += 1;
  const min = thresholdFor(level);
  const xpForNext = thresholdFor(level + 1) - min;
  const xpIntoLevel = clamped - min;
  return { level, name: levelNameFor(level), xpIntoLevel, xpForNext, pct: Math.round((xpIntoLevel / xpForNext) * 100) };
}

export function newCrossings(prevXp, nextXp, ledger) {
  const recorded = new Set(ledger.crossings.map((c) => c.level));
  const out = [];
  for (let l = levelInfo(prevXp).level + 1; l <= levelInfo(nextXp).level; l += 1) {
    if (prevXp < thresholdFor(l) && nextXp >= thresholdFor(l) && !recorded.has(l)) out.push(l);
  }
  return out;
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
