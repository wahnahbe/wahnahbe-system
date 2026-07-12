import { describe, it, expect, vi } from 'vitest';
import { api } from '../src/api.js';

describe('api client', () => {
  it('unwraps ok envelopes', async () => {
    global.fetch = vi.fn().mockResolvedValue({ json: async () => ({ ok: true, data: { x: 1 } }) });
    expect(await api.get('/dashboard')).toEqual({ x: 1 });
    expect(fetch).toHaveBeenCalledWith('/api/dashboard');
  });
  it('throws the envelope error on ok:false', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 409, json: async () => ({ ok: false, error: 'already completed today' }) });
    await expect(api.send('POST', '/quests/daily/x/complete')).rejects.toThrow('already completed today');
  });
});
