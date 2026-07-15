import gsap from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

gsap.registerPlugin(DrawSVGPlugin);

const RING_SELECTOR = '[data-fx-ring]';
const MOMENTUM_ATTR = 'data-momentum-high';
const BREATHE_CLASS = 'fx-ring-breathe';
const DRAW_PROPS = 'strokeDasharray,strokeDashoffset';

let tween = null;
let ringEl = null;
let wrapperEl = null;
let observer = null;
let active = false;

/** @param {Element} wrapper @param {Element} ring */
function syncBreathe(wrapper, ring) {
  ring.classList.toggle(BREATHE_CLASS, wrapper.hasAttribute(MOMENTUM_ATTR));
}

/**
 * Draws the momentum ring's progress circle in on mount, and adds a breathing
 * glow class while the ring's wrapper is flagged high-momentum (>=70, set by
 * HeaderTicker). Silent no-op if the ring isn't in the DOM.
 *
 * DrawSVG's intro tween writes inline strokeDasharray/strokeDashoffset, which
 * would otherwise permanently shadow React's `strokeDasharray` prop (the
 * ring's actual momentum value) after the tween completes. `onComplete`
 * clears those inline props so React regains control of the dash array once
 * the intro animation is done.
 *
 * The high-momentum flag can flip after mount (HeaderTicker re-renders with a
 * new momentum value), so a MutationObserver watches the wrapper's
 * `data-momentum-high` attribute and keeps the breathe class in sync for the
 * life of the mount, rather than evaluating it once.
 * @param {{ root: Document }} ctx
 */
export function mount(ctx) {
  if (active) return;
  const root = ctx?.root ?? document;
  const ring = root.querySelector(RING_SELECTOR);
  if (!ring) return;

  const wrapper = ring.closest('svg')?.parentElement;
  if (!wrapper) return;

  active = true;
  ringEl = ring;
  wrapperEl = wrapper;

  tween = gsap.from(ring, {
    drawSVG: '0%',
    duration: 1.4,
    ease: 'power2.inOut',
    onComplete: () => {
      gsap.set(ring, { clearProps: DRAW_PROPS });
    },
  });

  syncBreathe(wrapper, ring);
  observer = new MutationObserver(() => syncBreathe(wrapper, ring));
  observer.observe(wrapper, { attributes: true, attributeFilter: [MOMENTUM_ATTR] });
}

export function unmount() {
  if (!active) return;
  observer?.disconnect();
  observer = null;
  tween?.kill();
  tween = null;
  if (ringEl) {
    gsap.set(ringEl, { clearProps: DRAW_PROPS });
    ringEl.classList.remove(BREATHE_CLASS);
  }
  ringEl = null;
  wrapperEl = null;
  active = false;
}
