import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { fonts } from '../theme.js';
import { RankInsignia } from './RankInsignia.jsx';

gsap.registerPlugin(ScrambleTextPlugin, DrawSVGPlugin);

const PARTICLE_COUNT = 24;
const PARTICLE_MIN_DIST = 120;
const PARTICLE_MAX_DIST = 320;

const ringStyle = {
  position: 'absolute', top: '50%', left: '50%', width: 220, height: 220,
  marginTop: -110, marginLeft: -110, borderRadius: '50%',
  border: '2px solid rgba(242,234,255,.85)', pointerEvents: 'none',
};

const particleBaseStyle = {
  position: 'absolute', top: '50%', left: '50%', width: 4, height: 4,
  marginTop: -2, marginLeft: -2, borderRadius: '50%', background: '#3FE8FF',
  pointerEvents: 'none',
};

/**
 * Builds the GSAP master timeline for the ascension ceremony: backdrop snap,
 * scramble-decode the rank name onto its already-correct text, draw the
 * insignia's paths in, then an outward ring + particle shockwave.
 * @param {{ backdrop: Element, name: Element|null, insignia: Element|null, ring: Element|null, particles: Element|null }} els
 * @returns {gsap.core.Timeline}
 */
function buildTimeline({ backdrop, name, insignia, ring, particles }) {
  const tl = gsap.timeline();

  tl.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.18 });

  if (name) {
    const original = name.textContent;
    tl.to(name, {
      duration: 1.1,
      scrambleText: { text: original, chars: 'upperCase', speed: 0.4 },
    }, '-=0.02');
  }

  const paths = insignia ? Array.from(insignia.querySelectorAll('path, circle')) : [];
  if (paths.length > 0) {
    tl.fromTo(paths, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.9, stagger: 0.12 }, '-=0.7');
  }

  if (ring) {
    tl.fromTo(ring, { scale: 0, opacity: 1 }, { scale: 2.2, opacity: 0, duration: 0.9, ease: 'expo.out' }, '-=0.3');
  }

  if (particles) {
    const particleEls = Array.from(particles.children);
    particleEls.forEach((p, i) => {
      const angle = Math.random() * Math.PI * 2;
      const dist = gsap.utils.random(PARTICLE_MIN_DIST, PARTICLE_MAX_DIST);
      tl.to(p, {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        opacity: 0,
        duration: 1.2,
      }, i === 0 ? '-=0.85' : '<0.01');
    });
  }

  return tl;
}

/**
 * Full-screen ascension ceremony shown when an award crosses a level
 * threshold. Under `reducedMotion` it renders a static fallback (current
 * markup + a large insignia, no GSAP). Otherwise it builds a master timeline
 * on mount: backdrop opacity snap, scramble-decode of the rank name, insignia
 * draw-in, and an outward ring + particle shockwave. Click anywhere reverts
 * the in-flight timeline (GSAP 3.11+ restores all touched inline state,
 * including the scrambled text, rather than freezing mid-tween) and
 * dismisses.
 * @param {{ level: number|string, name: string, reducedMotion?: boolean, onClose: () => void }} props
 */
export function AscensionOverlay({ level, name, reducedMotion, onClose }) {
  const backdropRef = useRef(null);
  const nameRef = useRef(null);
  const insigniaRef = useRef(null);
  const ringRef = useRef(null);
  const particlesRef = useRef(null);
  const tlRef = useRef(null);

  useEffect(() => {
    if (reducedMotion) return undefined;

    const tl = buildTimeline({
      backdrop: backdropRef.current,
      name: nameRef.current,
      insignia: insigniaRef.current,
      ring: ringRef.current,
      particles: particlesRef.current,
    });
    tlRef.current = tl;

    return () => {
      tl.revert();
      tlRef.current = null;
    };
  }, [reducedMotion]);

  const handleClick = () => {
    tlRef.current?.revert();
    tlRef.current = null;
    onClose();
  };

  const label = String(name ?? level).toUpperCase();
  const insigniaSize = reducedMotion ? 72 : 96;

  return (
    <div ref={backdropRef} onClick={handleClick} style={{
      position: 'fixed', inset: 0, zIndex: 90, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
      background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,255,255,.32), rgba(8,5,15,.94) 75%)',
      backdropFilter: 'blur(4px)', fontFamily: fonts.mono,
      ...(reducedMotion ? { animation: 'ascendIn .7s steps(8) both' } : null),
    }}>
      {!reducedMotion && <div ref={ringRef} style={ringStyle} />}
      {!reducedMotion && (
        <div ref={particlesRef} style={{ position: 'absolute', top: '50%', left: '50%', width: 0, height: 0 }}>
          {Array.from({ length: PARTICLE_COUNT }, (_, i) => <div key={i} style={particleBaseStyle} />)}
        </div>
      )}
      <div style={{ fontSize: 11, color: '#FFFFFF', letterSpacing: '.5em' }}>SYS://ASCENSION</div>
      <div ref={insigniaRef}>
        <RankInsignia level={typeof level === 'number' ? level : 1} size={insigniaSize} color="#F2EAFF" />
      </div>
      <div ref={nameRef} style={{
        fontFamily: fonts.display, fontWeight: 700, fontSize: 84, lineHeight: 1, letterSpacing: '.12em',
        color: '#F2EAFF', textShadow: '0 0 30px rgba(255,255,255,.9),0 0 70px rgba(255,255,255,.5)',
        textAlign: 'center',
        ...(reducedMotion ? { animation: 'glitchTxt 1.1s steps(4) 3' } : null),
      }}>LEVEL UP — {label}</div>
      <div style={{ width: 280, height: 1, background: 'linear-gradient(90deg,transparent,#FFFFFF,transparent)' }} />
      <div style={{ fontSize: 11, color: 'rgba(242,234,255,.7)', letterSpacing: '.2em' }}>
        [SYS] THRESHOLD BREACHED. NEW CAPACITY UNLOCKED.
      </div>
      <div style={{
        fontSize: 9, color: 'rgba(255,255,255,.6)', letterSpacing: '.3em',
        ...(reducedMotion ? { animation: 'bootBlink 1.2s step-end infinite' } : null),
      }}>CLICK TO DISMISS</div>
    </div>
  );
}
