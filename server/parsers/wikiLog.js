// Entries look like: "## [2026-07-10] teach | <title> → 6 pages touched. <body…>"
export function parseWikiLog(md, n = 6) {
  const out = [...md.matchAll(/^## \[(\d{4}-\d{2}-\d{2})\] (\S+) \| (.+)$/gm)].map((m) => {
    let title = m[3];
    const arrow = title.indexOf('→');
    if (arrow !== -1) title = title.slice(0, arrow);
    return { date: m[1], kind: m[2], title: title.trim() };
  });
  return out.reverse().slice(0, n); // file is chronological; newest last → reverse
}
