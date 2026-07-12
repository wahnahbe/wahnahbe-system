import React, { useEffect, useRef, useState } from 'react';
import { C, fonts } from '../theme.js';
import { HudInput, HudSelect, inputStyle } from './bits.jsx';
import { STAT_ABBR } from './StatusPanel.jsx';

const STAT_NAMES = Object.keys(STAT_ABBR);
const REQUIRED_IMPORT_KEYS = ['quests', 'health', 'agenda', 'settings', 'xp'];

function SectionLabel({ children }) {
  return <div style={{ fontSize: 10, color: C.mag, letterSpacing: '.2em' }}>{children}</div>;
}

const dataButtonStyle = {
  background: 'rgba(210,75,255,.12)', border: '1px solid rgba(210,75,255,.5)', color: C.cyan,
  fontSize: 10, letterSpacing: '.12em', padding: '7px 14px', cursor: 'pointer', fontFamily: fonts.mono,
};

/**
 * @typedef {{ id?: string, title: string, xp: number|string, stat: string }} DailyRow
 */

/** @param {{ row: DailyRow, onChange: (patch: Partial<DailyRow>) => void, onRemove: () => void }} props */
function DailyRowEditor({ row, onChange, onRemove }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 46px 90px 24px', gap: 6, alignItems: 'center' }}>
      <HudInput value={row.title} onChange={(e) => onChange({ title: e.target.value })}
        style={{ minWidth: 0, fontSize: 10 }} />
      <HudInput type="number" value={row.xp} onChange={(e) => onChange({ xp: e.target.value })}
        style={{ minWidth: 0, fontSize: 10, textAlign: 'center' }} />
      <HudSelect value={row.stat} onChange={(e) => onChange({ stat: e.target.value })}
        style={{ minWidth: 0, fontSize: 9 }}>
        {STAT_NAMES.map((name) => <option key={name} value={name}>{STAT_ABBR[name]}</option>)}
        <option value="GENERAL">GEN</option>
      </HudSelect>
      <button onClick={onRemove} style={{
        background: 'none', border: 'none', color: 'rgba(63,232,255,.5)', fontSize: 13, cursor: 'pointer', padding: 0,
      }}>×</button>
    </div>
  );
}

/**
 * Right-side SYS://CONFIG drawer: identity title, daily quest target editor,
 * weigh-in log editor, JSON export/import, and HUD toggles.
 *
 * IMPORT LIMITATION: the design's prototype implies import restores the
 * entire dashboard state, but this build only has mutation endpoints for
 * settings and daily quest targets. Importing a previously exported JSON
 * file therefore applies ONLY the `settings` and `quests.dailies` slices via
 * the existing onSaveSettings/onSaveDailies callbacks — health, agenda, and
 * quest completion history are left untouched.
 *
 * @param {{
 *   open: boolean,
 *   settings: { title: string, scanlines: boolean, jpLabels: boolean, reducedMotion: boolean },
 *   quests: { dailies: DailyRow[] },
 *   health: { weighIns: { date: string, lbs: number }[] },
 *   fullData: unknown,
 *   onClose: () => void,
 *   onSaveSettings: (settings: object) => void,
 *   onSaveDailies: (dailies: { id?: string, title: string, xp: number, stat: string }[]) => void,
 *   onDeleteWeighIn: (date: string) => void,
 *   onError?: (message: string) => void,
 * }} props
 */
export function SettingsDrawer({
  open, settings, quests, health, fullData, onClose, onSaveSettings, onSaveDailies, onDeleteWeighIn, onError,
}) {
  const [titleIn, setTitleIn] = useState(settings?.title ?? '');
  const [dailyRows, setDailyRows] = useState(() => (quests?.dailies ?? []).map((d) => ({ ...d })));
  const fileInputRef = useRef(null);

  // Re-sync local editable copies from server truth each time the drawer is
  // opened, so edits made while closed elsewhere aren't silently clobbered
  // and stale local edits don't linger across sessions.
  useEffect(() => {
    if (open) {
      setTitleIn(settings?.title ?? '');
      setDailyRows((quests?.dailies ?? []).map((d) => ({ ...d })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const commitTitle = () => {
    if (titleIn !== settings.title) onSaveSettings({ ...settings, title: titleIn });
  };

  const updateRow = (idx, patch) => {
    setDailyRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setDailyRows((rows) => [...rows, { title: '', xp: 10, stat: 'GENERAL' }]);
  };

  const removeRow = (idx) => {
    setDailyRows((rows) => rows.filter((_, i) => i !== idx));
  };

  const saveDailies = async () => {
    const cleaned = dailyRows
      .filter((r) => r.title.trim().length > 0)
      .map((r) => {
        const parsedXp = parseInt(r.xp, 10);
        // Coerce to a positive int without silently zeroing invalid input —
        // the server rejects xp <= 0 and would reject the *whole* batch,
        // discarding edits to every other row in this same save.
        return { ...r, title: r.title.trim(), xp: Number.isInteger(parsedXp) && parsedXp > 0 ? parsedXp : 1 };
      });
    const result = await onSaveDailies(cleaned);
    // Re-sync local rows from the server's response (which assigns ids to
    // any new rows) so a second save before closing the drawer edits the
    // same rows instead of minting duplicate ids for already-saved quests.
    if (result?.quests?.dailies) setDailyRows(result.quests.dailies.map((d) => ({ ...d })));
  };

  const toggleSetting = (key) => (e) => onSaveSettings({ ...settings, [key]: e.target.checked });

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wahnahbe-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => onError?.('[SYS] IMPORT FAILED — could not read file');
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const valid = typeof parsed === 'object' && parsed !== null
          && REQUIRED_IMPORT_KEYS.every((k) => k in parsed);
        if (!valid) {
          onError?.('[SYS] IMPORT FAILED — missing required keys');
          return;
        }
        if (parsed.settings) onSaveSettings(parsed.settings);
        if (parsed.quests?.dailies) onSaveDailies(parsed.quests.dailies);
      } catch {
        onError?.('[SYS] IMPORT FAILED — malformed JSON');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div data-screen-label="SETTINGS" style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, zIndex: 80,
      background: 'rgba(15,9,28,.97)', backdropFilter: 'blur(12px)', borderLeft: `1px solid ${C.mag}`,
      boxShadow: '-12px 0 40px rgba(8,5,15,.8)', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', fontFamily: fonts.mono,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px',
        borderBottom: '1px solid rgba(210,75,255,.4)',
      }}>
        <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 15, letterSpacing: '.22em', color: C.mag }}>
          SYS://CONFIG
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid rgba(210,75,255,.4)', color: C.cyan, fontSize: 12,
          padding: '3px 10px', cursor: 'pointer',
        }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SectionLabel>IDENTITY // TITLE</SectionLabel>
          <input value={titleIn} onChange={(e) => setTitleIn(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(); }}
            style={{ ...inputStyle, fontSize: 12, padding: '7px 10px' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionLabel>DAILY QUESTS // TARGETS</SectionLabel>
            <button onClick={addRow} style={{
              background: 'rgba(210,75,255,.12)', border: '1px solid rgba(210,75,255,.5)', color: C.cyan,
              fontSize: 9, letterSpacing: '.1em', padding: '4px 10px', cursor: 'pointer', fontFamily: fonts.mono,
            }}>+ ADD</button>
          </div>
          {dailyRows.map((row, idx) => (
            <DailyRowEditor key={row.id ?? `new-${idx}`} row={row}
              onChange={(patch) => updateRow(idx, patch)} onRemove={() => removeRow(idx)} />
          ))}
          <button onClick={saveDailies} style={{ ...dataButtonStyle, alignSelf: 'flex-start' }}>
            SAVE TARGETS
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SectionLabel>WEIGH-IN LOG // EDIT</SectionLabel>
          {(health?.weighIns ?? []).map((w) => (
            <div key={w.date} style={{
              display: 'flex', alignItems: 'center', gap: 10, border: '1px solid rgba(210,75,255,.2)',
              padding: '5px 10px',
            }}>
              <div style={{ flex: 1, fontSize: 10.5, color: 'rgba(242,234,255,.8)' }}>{w.date}</div>
              <div style={{ fontSize: 11, color: C.cyan }}>{w.lbs} LBS</div>
              <button onClick={() => onDeleteWeighIn(w.date)} style={{
                background: 'none', border: 'none', color: 'rgba(63,232,255,.5)', fontSize: 13, cursor: 'pointer', padding: 0,
              }}>×</button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SectionLabel>DATA // PERSISTENCE</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={handleExport} style={dataButtonStyle}>EXPORT JSON</button>
            <button onClick={handleImportClick} style={dataButtonStyle}>IMPORT JSON</button>
          </div>
          <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleImportFile}
            style={{ display: 'none' }} />
          <div style={{ fontSize: 9, color: 'rgba(242,234,255,.4)', letterSpacing: '.06em' }}>
            [SYS] All state persists to this device automatically.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 10 }}>
          <SectionLabel>TOGGLES</SectionLabel>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: C.text, letterSpacing: '.06em' }}>
            <input type="checkbox" checked={!!settings.scanlines} onChange={toggleSetting('scanlines')} />
            SCANLINES
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: C.text, letterSpacing: '.06em' }}>
            <input type="checkbox" checked={!!settings.jpLabels} onChange={toggleSetting('jpLabels')} />
            JP LABELS
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: C.text, letterSpacing: '.06em' }}>
            <input type="checkbox" checked={!!settings.reducedMotion} onChange={toggleSetting('reducedMotion')} />
            REDUCED MOTION
          </label>
          <div style={{ fontSize: 9, color: 'rgba(242,234,255,.4)', letterSpacing: '.06em' }}>
            Reduced motion disables glitch, boot, and pulse effects.
          </div>
        </div>
      </div>
    </div>
  );
}
