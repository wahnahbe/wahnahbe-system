import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

const STATE_SLICES = ['quests', 'health', 'agenda', 'settings'];

export function useDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    api.get('/dashboard').then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    refresh();
    const es = new EventSource('/api/events');
    es.addEventListener('refresh', refresh);
    return () => es.close();
  }, [refresh]);

  const act = useCallback(async (method, path, body) => {
    const result = await api.send(method, path, body);
    setData((prev) => {
      if (!prev) return prev;
      const merged = { ...prev };
      for (const k of STATE_SLICES) if (result[k]) merged[k] = result[k];
      if (result.award) merged.xp = { ...merged.xp, total: result.award.total, ...result.award.xp };
      return merged;
    });
    return result;
  }, []);

  return { data, error, refresh, act };
}
