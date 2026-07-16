import gsap from 'gsap';

const PANEL_SELECTOR = '[data-fx-panel]';
const DURATION = 0.35;
const EASE = 'expo.out';

let boundRoot = null;
let onOver = null;
let onOut = null;
let current = null;
let active = false;

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
    onComplete() {
      gsap.set(panel, { clearProps: 'y,boxShadow,borderColor' });
    },
  });
}

/**
 * Delegated hover glow for `[data-fx-panel]` roots (header ticker, agenda
 * strip, and the three column panels). Uses bubbling `pointerover`/
 * `pointerout` delegation on `root` rather than capture-phase mouseenter/
 * mouseleave: mouseenter/leave fire once per descendant boundary crossed
 * (every nested element inside a panel re-triggers them), which flickered
 * the glow as the pointer moved over children. `pointerover`/`pointerout`
 * bubble, so a single delegated pair plus `closest()` resolution and a
 * `current` panel tracker treats the whole panel as one hover region and
 * only transitions focus when the pointer actually crosses a panel
 * boundary, not a child boundary.
 * @param {{ root: Document }} ctx
 */
export function mount(ctx) {
  if (active) return;
  const root = ctx?.root ?? document;

  onOver = (e) => {
    const panel = e.target.closest?.(PANEL_SELECTOR);
    if (!panel || panel === current) return;
    if (current) focusOut(current);
    focusIn(panel);
    current = panel;
  };
  onOut = (e) => {
    const panel = e.target.closest?.(PANEL_SELECTOR);
    if (!panel || panel.contains(e.relatedTarget)) return;
    focusOut(panel);
    current = null;
  };

  root.addEventListener('pointerover', onOver);
  root.addEventListener('pointerout', onOut);
  boundRoot = root;
  active = true;
}

export function unmount() {
  if (!active) return;
  boundRoot.removeEventListener('pointerover', onOver);
  boundRoot.removeEventListener('pointerout', onOut);
  gsap.killTweensOf(PANEL_SELECTOR);
  gsap.set(PANEL_SELECTOR, { clearProps: 'y,boxShadow,borderColor' });
  onOver = null;
  onOut = null;
  boundRoot = null;
  current = null;
  active = false;
}
