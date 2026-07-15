import gsap from 'gsap';

const TRACK_SELECTOR = '[data-fx-xpbar]';
const SWEEP_WIDTH = 40;

let sweepEl = null;
let tween = null;
let active = false;

/**
 * Adds a light-sweep overlay to the header XP bar track, looping indefinitely.
 * The bar's fill width is owned by React (inline style), so this appends a
 * sibling overlay node inside the track rather than animating the fill.
 * Silent no-op if the track isn't in the DOM.
 * @param {{ root: Document }} ctx
 */
export function mount(ctx) {
  if (active) return;
  const root = ctx?.root ?? document;
  const track = root.querySelector(TRACK_SELECTOR);
  if (!track) return;

  active = true;
  const sweep = document.createElement('div');
  sweep.className = 'fx-sweep';
  Object.assign(sweep.style, {
    position: 'absolute',
    top: '0',
    bottom: '0',
    left: '0',
    width: `${SWEEP_WIDTH}px`,
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.28), transparent)',
    pointerEvents: 'none',
  });
  track.appendChild(sweep);
  sweepEl = sweep;

  const trackWidth = track.getBoundingClientRect().width || track.offsetWidth || 0;
  tween = gsap.fromTo(sweep,
    { x: -SWEEP_WIDTH },
    { x: trackWidth, duration: 3.2, ease: 'none', repeat: -1, repeatDelay: 2 });
}

export function unmount() {
  if (!active) return;
  tween?.kill();
  tween = null;
  sweepEl?.remove();
  sweepEl = null;
  active = false;
}
