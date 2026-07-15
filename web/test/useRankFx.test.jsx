import { it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { useRankFx } from '../src/hooks/useRankFx.js';

afterEach(cleanup);

const mounted = [];

function mockModule(name) {
  return {
    mount: () => mounted.push(name),
    unmount: () => {
      const i = mounted.indexOf(name);
      if (i >= 0) mounted.splice(i, 1);
    },
  };
}

vi.mock('../src/fx/panelFocus.js', () => mockModule('panelFocus'));
vi.mock('../src/fx/energyFlow.js', () => mockModule('energyFlow'));
vi.mock('../src/fx/ringDraw.js', () => mockModule('ringDraw'));

function Harness({ level, settings }) {
  useRankFx(level, settings);
  return null;
}

it('mounts nothing at level 1', async () => {
  mounted.length = 0;
  render(<Harness level={1} settings={{ reducedMotion: false, fxRank: true }} />);
  await waitFor(() => {}); // let any pending microtasks flush
  expect(mounted).toEqual([]);
});

it('mounts exactly panelFocus, energyFlow, ringDraw at level 4', async () => {
  mounted.length = 0;
  render(<Harness level={4} settings={{ reducedMotion: false, fxRank: true }} />);
  await waitFor(() => expect(mounted.sort()).toEqual(['energyFlow', 'panelFocus', 'ringDraw'].sort()));
});

it('mounts nothing when reducedMotion is true, even at a high level', async () => {
  mounted.length = 0;
  render(<Harness level={4} settings={{ reducedMotion: true, fxRank: true }} />);
  await waitFor(() => {});
  expect(mounted).toEqual([]);
});

it('mounts nothing when fxRank is false, even at a high level', async () => {
  mounted.length = 0;
  render(<Harness level={4} settings={{ reducedMotion: false, fxRank: false }} />);
  await waitFor(() => {});
  expect(mounted).toEqual([]);
});

it('unmounts everything when settings flip fxRank off', async () => {
  mounted.length = 0;
  const { rerender } = render(<Harness level={4} settings={{ reducedMotion: false, fxRank: true }} />);
  await waitFor(() => expect(mounted.length).toBe(3));
  rerender(<Harness level={4} settings={{ reducedMotion: false, fxRank: false }} />);
  await waitFor(() => expect(mounted).toEqual([]));
});
