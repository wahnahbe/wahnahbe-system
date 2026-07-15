import gsap from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(DrawSVGPlugin);

const RING_SELECTOR = '[data-fx-ring]';
const HIGH_MOMENTUM_SELECTOR = '[data-momentum-high]';
const BREATHE_CLASS = 'fx-ring-breathe';

let tween = null;
let ringEl = null;

/**
 * Draws the momentum ring's progress circle in on mount, and adds a breathing
 * glow class when the ring's wrapper is flagged high-momentum (>=70, set by
 * HeaderTicker). Silent no-op if the ring isn't in the DOM.
 * @param {{ root: Document }} ctx
 */
export function mount(ctx) {
  const root = ctx?.root ?? document;
  const ring = root.querySelector(RING_SELECTOR);
  if (!ring) return;

  ringEl = ring;
  tween = gsap.from(ring, { drawSVG: '0%', duration: 1.4, ease: 'power2.inOut' });

  if (ring.closest(HIGH_MOMENTUM_SELECTOR)) ring.classList.add(BREATHE_CLASS);
}

export function unmount() {
  tween?.kill();
  tween = null;
  ringEl?.classList.remove(BREATHE_CLASS);
  ringEl = null;
}
