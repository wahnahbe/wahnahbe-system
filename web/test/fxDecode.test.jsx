import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import gsap from 'gsap';

vi.mock('gsap', () => {
  const gsapMock = {
    registerPlugin: vi.fn(),
    to: vi.fn(() => ({ kill: vi.fn() })),
    killTweensOf: vi.fn(),
    set: vi.fn(),
  };
  // decode.js does `import gsap from 'gsap'` (default import), so the mock
  // needs a `default` export; named `gsap` is kept too for callers that
  // destructure it.
  return { gsap: gsapMock, default: gsapMock };
});
vi.mock('gsap/ScrambleTextPlugin', () => ({ ScrambleTextPlugin: {} }));

// Imported after the mocks above so decode.js picks up the mocked gsap.
import { mount, unmount, __originalTextSize } from '../src/fx/decode.js';

/** Flushes the MutationObserver's microtask-queued callback. */
function flushMutations() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function appendTitle(text) {
  const title = document.createElement('div');
  title.setAttribute('data-fx-title', '');
  title.textContent = text;
  document.body.appendChild(title);
  return title;
}

function appendNoteLine(text) {
  const notes = document.createElement('div');
  notes.setAttribute('data-fx-notes', '');
  const line = document.createElement('div');
  line.setAttribute('data-fx-note-line', '');
  line.textContent = text;
  notes.appendChild(line);
  document.body.appendChild(notes);
  return { notes, line };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  unmount();
  document.body.innerHTML = '';
});

it('decodes a notification line whose container mounts into the DOM after decode.mount() already ran', async () => {
  // decode.mount() requires a [data-fx-title] to proceed at all (existing
  // no-op guard) — every test needs one present.
  appendTitle('SECTION');
  // No [data-fx-notes] container exists yet at mount time: Notification
  // renders null until a note is set, so this is the common case.
  mount({ root: document });

  const { line } = appendNoteLine('+15 XP BANKED');
  await flushMutations();

  expect(gsap.to).toHaveBeenCalledWith(line, expect.objectContaining({
    scrambleText: expect.objectContaining({ text: '+15 XP BANKED', chars: 'upperCase' }),
  }));
});

it('prunes the originalText map entry when its notification container is removed from the DOM', async () => {
  appendTitle('SECTION');
  mount({ root: document });
  const sizeWithTitleOnly = __originalTextSize();

  const { notes } = appendNoteLine('+15 XP BANKED');
  await flushMutations();
  expect(__originalTextSize()).toBe(sizeWithTitleOnly + 1);

  notes.remove();
  await flushMutations();
  expect(__originalTextSize()).toBe(sizeWithTitleOnly);
});

it('unmount restores the title text verbatim and kills its scramble tween', async () => {
  const title = appendTitle('RANK STATUS');
  mount({ root: document });

  // mount() immediately fires one gsap.to() call to scramble the titles —
  // capture the mocked tween handle it was given back so we can assert
  // unmount() kills it.
  const titleTweenHandle = gsap.to.mock.results[gsap.to.mock.results.length - 1].value;

  unmount();

  expect(title.textContent).toBe('RANK STATUS');
  expect(titleTweenHandle.kill).toHaveBeenCalled();
});
