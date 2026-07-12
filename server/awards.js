import fs from 'node:fs';
import { readStateFile, writeStateFile } from './state/io.js';
import { parseReportCard } from './parsers/reportCard.js';
import { totalXp, levelInfo, newCrossings } from './xp.js';

function reportXpOrZero(config, onWarn = () => {}) {
  try {
    return parseReportCard(fs.readFileSync(config.sources.reportCard, 'utf8')).totalXp;
  } catch (err) {
    onWarn(err);
    return 0;
  }
}

export function awardXp(config, { amount, stat, reason, source }) {
  const ledger = readStateFile(config.stateDir, 'xpLedger');
  const reportXp = reportXpOrZero(config, (err) => console.error(`award: report card unreadable, using 0: ${err.message}`));
  const before = totalXp(reportXp, ledger);
  const entry = { ts: new Date().toISOString(), amount, stat, reason, source };
  const after = before + amount;
  const crossed = newCrossings(before, after, ledger);
  const next = {
    entries: [...ledger.entries, entry],
    crossings: [...ledger.crossings, ...crossed.map((level) => ({ level, ts: entry.ts }))],
  };
  writeStateFile(config.stateDir, 'xpLedger', next);
  return { ledger: next, total: after, amount, xp: levelInfo(after), ascended: crossed.at(-1) ?? null };
}
