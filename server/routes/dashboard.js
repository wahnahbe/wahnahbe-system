import { Router } from 'express';
import { readVaultSection } from '../vaultReader.js';
import { parseReportCard } from '../parsers/reportCard.js';
import { parseJpProgress } from '../parsers/jpProgress.js';
import { parseWikiLog } from '../parsers/wikiLog.js';
import { parseGradebook, parseConceptMastery } from '../parsers/tutorFiles.js';
import { readStateFile } from '../state/io.js';
import { totalXp, levelInfo, momentum, localDateStr } from '../xp.js';

export function dashboardRouter(config) {
  const r = Router();
  r.get('/dashboard', (_req, res) => {
    const s = config.sources;
    const learning = readVaultSection(s.reportCard, parseReportCard);
    const japanese = readVaultSection(s.jpProgress, parseJpProgress);
    const activity = readVaultSection(s.wikiLog, parseWikiLog);
    const tutor = {
      gradebook: readVaultSection(s.gradebook, parseGradebook),
      mastery: readVaultSection(s.conceptMastery, parseConceptMastery),
    };
    const quests = readStateFile(config.stateDir, 'quests');
    const health = readStateFile(config.stateDir, 'health');
    const agenda = readStateFile(config.stateDir, 'agenda');
    const settings = readStateFile(config.stateDir, 'settings');
    const ledger = readStateFile(config.stateDir, 'xpLedger');

    const reportXp = learning.ok ? learning.data.totalXp : 0;
    const total = totalXp(reportXp, ledger);
    const ledgerXp = total - reportXp;
    const xp = { total, reportXp, ledgerXp, ...levelInfo(total), ...(learning.ok ? {} : { degraded: true }) };
    const today = localDateStr();

    res.json({ ok: true, data: {
      learning, japanese, activity, tutor,
      quests, health, agenda, settings,
      xp, momentum: momentum(quests, today), today,
    } });
  });
  return r;
}
