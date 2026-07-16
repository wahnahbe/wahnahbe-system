import gsap from 'gsap';

const PANEL_SELECTOR = '[data-fx-panel]';
const CASCADE_ATTR = 'fxCascade';
const CASCADE_PROPS = 'clipPath,y,opacity';

let active = false;
let timeline = null;
// Persists across mount/unmount cycles within the module's lifetime (i.e. the
// page session) so a later re-gate (level-up, settings toggle) that remounts
// every fx module doesn't replay the intro wipe — this cascade is a one-shot
// page-load effect, not a recurring one.
let hasRun = false;

/**
 * One-shot page-load cascade: wipes each `[data-fx-panel]` in from a clipped
 * sliver, staggered. Sets `document.documentElement.dataset.fxCascade = '1'`
 * for the duration so the CSS `dashIn` intro animation (which would
 * otherwise fight this timeline) is suppressed via the
 * `[data-fx-cascade="1"] [data-fx-panel] { animation: none }` rule in
 * index.html. Silent no-op if no panels are in the DOM. Only plays once per
 * session — subsequent mounts (after an unrelated re-gate) are a no-op.
 * @param {{ root: Document }} ctx
 */
export function mount(ctx) {
  if (active) return;
  const root = ctx?.root ?? document;
  const panels = Array.from(root.querySelectorAll(PANEL_SELECTOR));
  if (panels.length === 0) return;

  active = true;
  if (hasRun) return;
  hasRun = true;

  document.documentElement.dataset[CASCADE_ATTR] = '1';

  timeline = gsap.timeline({
    onComplete: () => {
      delete document.documentElement.dataset[CASCADE_ATTR];
    },
  });
  timeline.from(panels, {
    clipPath: 'inset(0 100% 0 0)',
    y: 8,
    opacity: 0.3,
    duration: 0.7,
    ease: 'expo.out',
    stagger: 0.09,
  });
}

export function unmount() {
  if (!active) return;
  delete document.documentElement.dataset[CASCADE_ATTR];
  timeline?.kill();
  timeline = null;
  gsap.set(PANEL_SELECTOR, { clearProps: CASCADE_PROPS });
  active = false;
}
