import { it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { useRankFx, createUseRankFx } from '../src/hooks/useRankFx.js';

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

it('never mounts a module whose import resolves after the gate flips off mid-flight', async () => {
  // Regression test for the stale-async-mount race: the hook's effect
  // cleanup sets `cancelled = true` synchronously on unmount/re-run, but a
  // dynamic import already in flight only checks that flag *after* it
  // resolves. Uses createUseRankFx to inject a manually-resolvable loader
  // for panelFocus (the only fx unlocked at level 2) instead of the static
  // FX_MODULES map, so the promise can be held open across the gate flip.
  let resolveLoader;
  const pending = new Promise((resolve) => {
    resolveLoader = resolve;
  });
  const mountSpy = vi.fn();
  const useInjectedRankFx = createUseRankFx({ panelFocus: () => pending });

  function InjectedHarness({ level, settings }) {
    useInjectedRankFx(level, settings);
    return null;
  }

  const { rerender } = render(
    <InjectedHarness level={2} settings={{ reducedMotion: false, fxRank: true }} />
  );

  // Flip the gate off while the panelFocus import is still pending — this
  // runs the effect cleanup (cancelled = true) before the import settles.
  rerender(<InjectedHarness level={2} settings={{ reducedMotion: false, fxRank: false }} />);

  resolveLoader({ mount: mountSpy, unmount: () => {} });
  await pending;
  await waitFor(() => {}); // let the hook's post-await continuation run

  expect(mountSpy).not.toHaveBeenCalled();
});
