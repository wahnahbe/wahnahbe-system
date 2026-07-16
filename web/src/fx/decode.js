import gsap from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

gsap.registerPlugin(ScrambleTextPlugin);

const TITLE_SELECTOR = '[data-fx-title]';
const NOTE_LINE_SELECTOR = '[data-fx-note-line]';

let active = false;
let observer = null;
const originalText = new Map(); // Element -> original text, for restore-on-unmount
const tweens = new Set();

/**
 * Test-only seam: exposes the size of the internal originalText map so tests
 * can assert entries are pruned when a notification's DOM is removed, without
 * reaching into module-private state.
 * @returns {number}
 */
export function __originalTextSize() {
  return originalText.size;
}

/**
 * Scramble-decodes one element's text in place, remembering the original so
 * it can be restored verbatim on unmount (including mid-scramble unmounts).
 * @param {Element} el
 * @param {number} duration
 * @param {number} [stagger]
 */
function decodeEl(el, duration, stagger) {
  if (!originalText.has(el)) originalText.set(el, el.textContent);
  const text = originalText.get(el);
  const tween = gsap.to(el, {
    duration,
    scrambleText: { text, chars: 'upperCase', speed: 0.4 },
    ...(stagger != null ? { stagger } : {}),
    onComplete: () => tweens.delete(tween),
  });
  tweens.add(tween);
}

/**
 * Scramble-decode intro for section titles plus live decode of newly
 * inserted notification lines. Silent no-op if no `[data-fx-title]`
 * elements exist. Restores every scrambled element's original text on
 * unmount, killing in-flight tweens first so a mid-scramble unmount never
 * leaves garbled text behind.
 * @param {{ root: Document }} ctx
 */
export function mount(ctx) {
  if (active) return;
  const root = ctx?.root ?? document;
  const titles = Array.from(root.querySelectorAll(TITLE_SELECTOR));
  if (titles.length === 0) return;

  active = true;
  titles.forEach((el) => {
    if (!originalText.has(el)) originalText.set(el, el.textContent);
  });
  const titleTween = gsap.to(titles, {
    duration: 0.9,
    scrambleText: { text: '{original}', chars: 'upperCase', speed: 0.4 },
    stagger: 0.06,
    onComplete: () => tweens.delete(titleTween),
  });
  tweens.add(titleTween);

  // invariant: Notification renders `[data-fx-notes]` conditionally — it
  // returns null when no note is active, so the container (and every line
  // inside it) is a brand-new DOM node each time a notification appears, and
  // it's gone again once the auto-clear timer fires. Querying for the
  // container once at mount time and observing *it* would miss every
  // notification that hadn't appeared yet, and would go blind the instant the
  // current one unmounts. Observing `document.body` with `subtree: true`
  // instead catches every notification's container and lines regardless of
  // when they mount, for as long as this fx module stays active.
  const bodyRoot = root.body ?? root;
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        const lines = node.matches?.(NOTE_LINE_SELECTOR)
          ? [node]
          : Array.from(node.querySelectorAll?.(NOTE_LINE_SELECTOR) ?? []);
        lines.forEach((line) => decodeEl(line, 0.5));
      }
      for (const node of mutation.removedNodes) {
        if (node.nodeType !== 1) continue;
        // Prune any tracked element that was removed directly or as a
        // descendant of a removed subtree, so restore-on-unmount never tries
        // to write text back into a detached node and the map can't leak.
        for (const el of originalText.keys()) {
          if (node === el || node.contains?.(el)) originalText.delete(el);
        }
      }
    }
  });
  observer.observe(bodyRoot, { childList: true, subtree: true });
}

export function unmount() {
  if (!active) return;
  observer?.disconnect();
  observer = null;
  tweens.forEach((tween) => tween.kill());
  tweens.clear();
  originalText.forEach((text, el) => {
    el.textContent = text;
  });
  originalText.clear();
  active = false;
}
