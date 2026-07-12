import matter from 'gray-matter';

export function parseJpProgress(md) {
  const { data } = matter(md);
  if (!data.current_level) throw new Error('jp progress frontmatter missing current_level');
  if (data.last_session == null) throw new Error('jp progress frontmatter missing last_session');

  const rollingComp = (data.rolling_comp ?? []).map(Number);
  if (rollingComp.some(Number.isNaN)) {
    throw new Error('jp progress rolling_comp contains a non-numeric entry');
  }

  const rollingAvg = rollingComp.length
    ? rollingComp.reduce((a, b) => a + b, 0) / rollingComp.length : 0;
  const toDateStr = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
  return {
    level: String(data.current_level),
    streak: Number(data.streak ?? 0),
    rollingComp,
    rollingAvg,
    lastSession: toDateStr(data.last_session),
    paused: data.paused === true || data.paused === 'true',
  };
}
