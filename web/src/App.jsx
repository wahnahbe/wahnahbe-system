import React, { useEffect, useState, useCallback } from 'react';
import { useDashboard } from './hooks/useDashboard.js';
import { useRankFx } from './hooks/useRankFx.js';
import { C, fonts } from './theme.js';
import { HeaderTicker } from './components/HeaderTicker.jsx';
import { AgendaStrip } from './components/AgendaStrip.jsx';
import { StatusPanel } from './components/StatusPanel.jsx';
import { QuestsPanel } from './components/QuestsPanel.jsx';
import { SkillsPanel } from './components/SkillsPanel.jsx';
import { BootSequence } from './components/BootSequence.jsx';
import { Notification } from './components/Notification.jsx';
import { AscensionOverlay } from './components/AscensionOverlay.jsx';
import { SettingsDrawer } from './components/SettingsDrawer.jsx';

const NOTE_AUTO_CLEAR_MS = 3500;

/**
 * Root HUD composition: wires useDashboard() into the panel grid plus the
 * boot/notification/ascension overlays and the settings drawer.
 */
export default function App() {
  const { data, error, act } = useDashboard();
  const [booted, setBooted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [note, setNote] = useState(null);
  const [ascendLevel, setAscendLevel] = useState(null);

  useRankFx(data?.xp?.level ?? 1, data?.settings ?? {});

  useEffect(() => {
    if (!note) return undefined;
    const t = setTimeout(() => setNote(null), NOTE_AUTO_CLEAR_MS);
    return () => clearTimeout(t);
  }, [note]);

  const run = useCallback(async (method, path, body, successLines) => {
    try {
      const result = await act(method, path, body);
      if (result?.award) {
        setNote({ lines: successLines ?? [`+${result.award.amount} XP BANKED`] });
        if (result.award.ascended) setAscendLevel(result.award.ascended);
      } else if (successLines) {
        setNote({ lines: successLines });
      }
      return result;
    } catch (e) {
      setNote({ lines: ['[SYS] ERROR', e.message] });
      return null;
    }
  }, [act]);

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: fonts.mono, padding: 24 }}>
        {error ? `[SYS] LINK ERROR: ${error}` : '[SYS] CONNECTING…'}
      </div>
    );
  }

  const { settings } = data;
  const rm = settings.reducedMotion;

  return (
    <div data-rm={rm ? '1' : '0'} style={{
      position: 'relative', minHeight: '100vh', overflow: 'hidden',
      background: `radial-gradient(ellipse 80% 60% at 50% -10%, rgba(60,25,100,.55), rgba(8,5,15,0) 60%), ${C.bg}`,
      color: C.text, fontFamily: fonts.mono,
    }}>
      {settings.scanlines && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 40, pointerEvents: 'none',
          background: 'repeating-linear-gradient(0deg, rgba(63,232,255,.022) 0 1px, transparent 1px 3px)',
        }} />
      )}
      <HeaderTicker xp={data.xp} momentum={data.momentum} settings={settings}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleMotion={() => run('PUT', '/settings', { ...settings, reducedMotion: !rm })} />
      <AgendaStrip agenda={data.agenda} today={data.today}
        onAdd={(ev) => run('POST', '/agenda', ev)}
        onDelete={(id) => run('DELETE', `/agenda/${id}`)} />
      <div data-fx-root style={{
        position: 'relative',
        display: 'grid', gridTemplateColumns: '335px 1fr 355px', gap: 14, padding: 14,
        height: 'calc(100vh - 176px)', boxSizing: 'border-box',
      }}>
        <StatusPanel learning={data.learning} health={data.health} mastery={data.tutor.mastery}
          byStat={data.xp.byStat} showJp={settings.jpLabels}
          onLogWeighIn={(lbs) => run('POST', '/health/weighins', { lbs }, ['[SYS] WEIGH-IN LOGGED'])} />
        <QuestsPanel quests={data.quests} today={data.today} showJp={settings.jpLabels}
          onCompleteDaily={(id) => run('POST', `/quests/daily/${id}/complete`)}
          onAddSide={(s) => run('POST', '/quests/side', s)}
          onCompleteSide={(id) => run('POST', `/quests/side/${id}/complete`)}
          onDeleteSide={(id) => run('DELETE', `/quests/side/${id}`)}
          onAddMain={(m) => run('POST', '/quests/main', m)}
          onMainPct={(id, pct) => run('PATCH', `/quests/main/${id}`, { pct })} />
        <SkillsPanel learning={data.learning} tutor={data.tutor} activity={data.activity}
          japanese={data.japanese} showJp={settings.jpLabels}
          onTrain={(stat, amount) => run('POST', '/xp/award',
            { amount, stat, reason: 'TRAINING SESSION', source: 'training' })} />
      </div>
      <Notification note={note} />
      {ascendLevel && <AscensionOverlay level={ascendLevel} onClose={() => setAscendLevel(null)} />}
      {!booted && !rm && <BootSequence onDone={() => setBooted(true)} />}
      <SettingsDrawer open={settingsOpen} settings={settings} quests={data.quests} health={data.health}
        onClose={() => setSettingsOpen(false)}
        onSaveSettings={(s) => run('PUT', '/settings', s, ['[SYS] CONFIG SAVED'])}
        onSaveDailies={(dailies) => run('PUT', '/quests/dailies', { dailies }, ['[SYS] DAILY TARGETS UPDATED'])}
        onDeleteWeighIn={(date) => run('DELETE', `/health/weighins/${date}`)}
        onError={(msg) => setNote({ lines: [msg] })}
        fullData={data} />
    </div>
  );
}
