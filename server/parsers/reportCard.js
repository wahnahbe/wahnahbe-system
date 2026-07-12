const strip = (s) => s.replace(/\*/g, '').trim();

export function parseReportCard(md) {
  // Stat averages table: rows "| <name> | <avg or —> | <status> |" after the octagon header.
  const stats = [];
  const rowRe = /^\|\s*([^|]+?)\s*\|\s*([\d.]+|—)\s*\|\s*([^|]+?)\s*\|\s*$/gm;
  const tableStart = md.indexOf('| Stat | Average | Status |');
  if (tableStart === -1) throw new Error('stat table not found');
  // Bound the scan to just the octagon table: from its header to the next `## ` heading
  // (or end of file), so a malformed table can't absorb pipe-rows from later sections.
  const nextHeadingIdx = md.indexOf('\n## ', tableStart);
  const tableRegion = nextHeadingIdx === -1 ? md.slice(tableStart) : md.slice(tableStart, nextHeadingIdx);
  for (const m of tableRegion.matchAll(rowRe)) {
    stats.push({ name: strip(m[1]), average: m[2] === '—' ? null : Number(m[2]), status: strip(m[3]) });
    if (stats.length === 8) break;
  }
  if (stats.length !== 8) throw new Error(`expected 8 stats, got ${stats.length}`);

  const xpM = md.match(/\*\*Total XP:\*\*\s*(\d+)/);
  const lvlM = md.match(/\*\*Level:\*\*\s*(\d+)\s*—\s*\*([^*]+)\*/);
  const sesM = md.match(/\*\*Sessions graded:\*\*\s*(\d+)/);
  if (!xpM || !lvlM) throw new Error('experience block not found');

  // Entries are best-effort: scope to the session log section, and if that section is
  // missing entirely, return no entries rather than throwing (XP/stats are load-bearing;
  // entries are decorative and must not be taken down by entry-format drift).
  const logSectionStart = md.indexOf('## Session & assignment log');
  const entries = logSectionStart === -1 ? [] : [...md.slice(logSectionStart).matchAll(
    /^### Entry (\d+) — (\d{4}-\d{2}-\d{2}) — (.+?) · \*[^*]*\* · Grade: ([^—\n]+?)(?:\s*—.*)?$/gm,
  )].map((m) => ({ n: Number(m[1]), date: m[2], title: strip(m[3]), grade: strip(m[4]) }))
    .sort((a, b) => b.n - a.n).slice(0, 5);

  return {
    stats,
    totalXp: Number(xpM[1]),
    level: Number(lvlM[1]),
    levelName: strip(lvlM[2]),
    sessionsGraded: sesM ? Number(sesM[1]) : 0,
    entries,
  };
}
