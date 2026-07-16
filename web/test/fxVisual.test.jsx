import { it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted so the mutable mock state exists before the vi.mock('gsap', ...)
// factory below runs (vi.mock calls are hoisted to the top of the file,
// ahead of normal `const`/`let` declarations — see fxDecode.test.jsx for the
// simpler single-shot version of this pattern; this one needs a persistent
// handle to each `gsap.timeline()` instance since gildedSweep rebuilds its
// timeline rather than reusing one).
const hoisted = vi.hoisted(() => {
  const timelineInstances = [];
  const gsapMock = {
    timeline: vi.fn(() => {
      const instance = { fromTo: vi.fn(), kill: vi.fn() };
      timelineInstances.push(instance);
      return instance;
    }),
    fromTo: vi.fn((target, from, to) => ({ target, from, to, kill: vi.fn() })),
  };
  return { timelineInstances, gsapMock };
});

vi.mock('gsap', () => ({ gsap: hoisted.gsapMock, default: hoisted.gsapMock }));

// Imported after the mock above so gildedSweep/spectral pick up mocked gsap.
import { mount as mountGildedSweep, unmount as unmountGildedSweep } from '../src/fx/gildedSweep.js';
import { mount as mountSpectral, unmount as unmountSpectral } from '../src/fx/spectral.js';

/** Flushes the MutationObserver's microtask-queued callback. */
function flushMutations() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Appends a `[data-fx-panel]` stubbed to report `width` px, as gildedSweep's header ticker would. */
function makePanel(width) {
  const panel = document.createElement('div');
  panel.setAttribute('data-fx-panel', '');
  panel.getBoundingClientRect = () => ({
    width, height: 40, top: 0, left: 0, right: width, bottom: 40, x: 0, y: 0,
  });
  Object.defineProperty(panel, 'offsetWidth', { value: width, configurable: true });
  document.body.appendChild(panel);
  return panel;
}

function makeRadar() {
  const radar = document.createElement('div');
  radar.setAttribute('data-fx-radar', '');
  radar.setAttribute('points', '0,0 1,1');
  radar.style.filter = 'drop-shadow(x)';
  document.body.appendChild(radar);
  return radar;
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.timelineInstances.length = 0;
});

afterEach(() => {
  unmountGildedSweep();
  unmountSpectral();
  document.body.innerHTML = '';
});

it('gildedSweep tweens x in px across the full panel width, not a %-string undershoot', () => {
  makePanel(800);
  mountGildedSweep({ root: document });

  expect(hoisted.timelineInstances.length).toBe(1);
  const instance = hoisted.timelineInstances[0];
  expect(instance.fromTo).toHaveBeenCalledTimes(1);

  const [, fromVars, toVars] = instance.fromTo.mock.calls[0];
  // A %-string here (the pre-fix behavior, e.g. '120%') is relative to the
  // streak's own ~26%-of-panel width, not the panel — asserting a number
  // that reaches the panel's full width is what catches the regression.
  expect(typeof toVars.x).toBe('number');
  expect(toVars.x).toBeGreaterThanOrEqual(800);
  expect(typeof fromVars.x).toBe('number');
  expect(fromVars.x).toBeLessThan(0);
});

it('spectral restores the radar\'s pre-existing inline filter on tween completion instead of clearing it', async () => {
  const radar = makeRadar();
  mountSpectral({ root: document });

  radar.setAttribute('points', '2,2 3,3');
  await flushMutations();

  expect(hoisted.gsapMock.fromTo).toHaveBeenCalledTimes(1);
  // Mid-tween the element opts into the shared filter, clobbering the
  // React-owned drop-shadow for the tween's duration.
  expect(radar.style.filter).toBe('url(#fx-spectral)');

  const [, , toVars] = hoisted.gsapMock.fromTo.mock.calls[0];
  toVars.onComplete();

  expect(radar.style.filter).toBe('drop-shadow(x)');
});
