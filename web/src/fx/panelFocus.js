import gsap from 'gsap';

const PANEL_SELECTOR = '[data-fx-panel]';
const DURATION = 0.35;
const EASE = 'expo.out';

let boundRoot = null;
let onEnter = null;
let onLeave = null;

function focusIn(panel) {
  gsap.to(panel, {
    duration: DURATION,
    ease: EASE,
    y: -1,
    boxShadow: '0 0 26px rgba(210,75,255,.55)',
    borderColor: 'rgba(210,75,255,.95)',
  });
}

function focusOut(panel) {
  gsap.to(panel, {
    duration: DURATION,
    ease: EASE,
    y: 0,
    boxShadow: '0 0 0px rgba(210,75,255,0)',
    borderColor: 'rgba(210,75,255,.5)',
  });
}

/**
 * Delegated hover glow for `[data-fx-panel]` roots (header ticker, agenda
 * strip, and the three column panels). Delegation on `root` in the capture
 * phase means it survives React re-renders that replace panel DOM nodes —
 * mouseenter/mouseleave don't bubble, but capture-phase listeners still see
 * them on the way down, so no re-binding is needed after a refresh.
 * @param {{ root: Document }} ctx
 */
export function mount(ctx) {
  const root = ctx?.root ?? document;
  if (onEnter) return; // idempotent

  onEnter = (e) => {
    const panel = e.target.closest?.(PANEL_SELECTOR);
    if (panel) focusIn(panel);
  };
  onLeave = (e) => {
    const panel = e.target.closest?.(PANEL_SELECTOR);
    if (panel) focusOut(panel);
  };

  root.addEventListener('mouseenter', onEnter, true);
  root.addEventListener('mouseleave', onLeave, true);
  boundRoot = root;
}

export function unmount() {
  if (!onEnter) return;
  boundRoot.removeEventListener('mouseenter', onEnter, true);
  boundRoot.removeEventListener('mouseleave', onLeave, true);
  gsap.killTweensOf(PANEL_SELECTOR);
  onEnter = null;
  onLeave = null;
  boundRoot = null;
}
