import gsap from 'gsap';

const PANEL_SELECTOR = '[data-fx-panel]';
const STREAK_WIDTH = '26%';
const DURATION = 1.8;
const EASE = 'power2.inOut';
const REPEAT_DELAY = 45;
const GOLD_GRADIENT = 'linear-gradient(100deg, transparent 0%, rgba(255,209,102,0) 30%, ' +
  'rgba(255,209,102,.55) 50%, rgba(255,209,102,0) 70%, transparent 100%)';

let active = false;
let panel = null;
let streak = null;
let timeline = null;
let previousPositionInline = null;
let positionMutated = false;

/**
 * Gold light streak sweeping across the header ticker (the first
 * `[data-fx-panel]` — the header, ahead of the agenda strip and the three
 * column panels). A single `<div>` this module owns is appended inside the
 * panel, blended with `mixBlendMode: 'screen'` so it reads as a highlight
 * rather than an opaque bar, and clipped to the panel's own chamfered shape
 * via `clipPath: 'inherit'`. A GSAP timeline slides it from just off the
 * left edge to well past the right edge, repeating indefinitely with a long
 * cooldown between passes.
 *
 * The panel needs a positioned ancestor for the streak's `position:
 * absolute` to anchor to it — `[data-fx-panel]` (HeaderTicker) doesn't set
 * one itself, so this only sets `position: relative` on the panel when its
 * computed position is `static`, and restores the prior inline value on
 * unmount rather than clobbering a position the panel may already own.
 * @param {{ root: Document }} ctx
 */
export function mount(ctx) {
  if (active) return;
  const root = ctx?.root ?? document;
  panel = root.querySelector(PANEL_SELECTOR);
  if (!panel) return;

  active = true;

  if (window.getComputedStyle(panel).position === 'static') {
    previousPositionInline = panel.style.position;
    panel.style.position = 'relative';
    positionMutated = true;
  }

  streak = document.createElement('div');
  streak.setAttribute('data-fx-gilded-sweep', '1');
  Object.assign(streak.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: STREAK_WIDTH,
    height: '100%',
    background: GOLD_GRADIENT,
    mixBlendMode: 'screen',
    clipPath: 'inherit',
    pointerEvents: 'none',
  });
  panel.appendChild(streak);

  timeline = gsap.timeline({ repeat: -1, repeatDelay: REPEAT_DELAY });
  timeline.fromTo(streak, { x: '-20%' }, { x: '120%', duration: DURATION, ease: EASE });
}

export function unmount() {
  if (!active) return;
  timeline?.kill();
  timeline = null;
  streak?.remove();
  streak = null;
  if (positionMutated) {
    panel.style.position = previousPositionInline || '';
    positionMutated = false;
    previousPositionInline = null;
  }
  panel = null;
  active = false;
}
