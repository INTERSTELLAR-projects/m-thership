import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Maximize, StickyNote, X } from 'lucide-react';
import SlideRenderer from '@/features/presentations/slides/SlideRenderer';
import { SLIDE_W, SLIDE_H } from '@/features/presentations/lib/slideThemes';

// Full-screen presenter.
// → ↓ Space PageDown Enter: next · ← ↑ PageUp Backspace: back · Home / End · N: notes · B: black · F: full screen · Esc: exit
export default function PresentMode({ slides, theme, deckTitle, startIndex = 0, onClose }) {
  const [index, setIndex] = useState(Math.min(Math.max(startIndex, 0), Math.max(slides.length - 1, 0)));
  const [notes, setNotes] = useState(false);
  const [black, setBlack] = useState(false);
  const [scale, setScale] = useState(1);
  const rootRef = useRef(null);
  const wentFull = useRef(false);

  const fit = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight - (notes ? 150 : 0);
    setScale(Math.min(w / SLIDE_W, h / SLIDE_H));
  }, [notes]);

  useEffect(() => {
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [fit]);

  const toggleFull = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => null);
    } else if (el.requestFullscreen) {
      el.requestFullscreen().then(() => { wentFull.current = true; }).catch(() => null);
    }
  }, []);

  // Enter full screen on open; leaving full screen (Esc) closes the presenter.
  useEffect(() => {
    toggleFull();
    const onChange = () => {
      if (!document.fullscreenElement && wentFull.current) onClose();
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => null);
    };
  }, []);

  const go = useCallback((delta) => setIndex((i) => Math.min(Math.max(i + delta, 0), slides.length - 1)), [slides.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); setBlack(false); go(1); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); setBlack(false); go(-1); }
      else if (e.key === 'Home') setIndex(0);
      else if (e.key === 'End') setIndex(slides.length - 1);
      else if (e.key === 'n' || e.key === 'N') setNotes((v) => !v);
      else if (e.key === 'b' || e.key === 'B' || e.key === '.') setBlack((v) => !v);
      else if (e.key === 'f' || e.key === 'F') toggleFull();
      else if (e.key === 'Escape' && !document.fullscreenElement) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, slides.length, toggleFull, onClose]);

  const slide = slides[index];
  if (!slide || typeof document === 'undefined') return null;

  return createPortal(
    <div ref={rootRef} className="group fixed inset-0 z-[200] flex flex-col bg-black text-white" role="dialog" aria-label="Presenting">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <div style={{ width: SLIDE_W * scale, height: SLIDE_H * scale, position: 'relative', opacity: black ? 0 : 1, transition: 'opacity 160ms' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: SLIDE_W, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <SlideRenderer slide={slide} theme={theme} index={index} total={slides.length} deckTitle={deckTitle} />
          </div>
        </div>
        <button type="button" aria-label="Previous slide" onClick={() => go(-1)} className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize" />
        <button type="button" aria-label="Next slide" onClick={() => go(1)} className="absolute inset-y-0 right-0 w-2/3 cursor-e-resize" />
      </div>
      {notes ? (
        <div className="h-[150px] shrink-0 overflow-y-auto border-t border-white/15 bg-[#111] px-6 py-3 text-[15px] leading-relaxed text-white/85">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#ffaa00]">Speaker notes · slide {index + 1}</p>
          {slide.notes || <span className="text-white/40">No notes on this slide.</span>}
        </div>
      ) : null}
      <div className="pointer-events-none absolute right-4 top-4 flex gap-1.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <button type="button" onClick={() => setNotes((v) => !v)} title="Notes (N)" className="rounded bg-white/10 p-2 hover:bg-white/20"><StickyNote className="h-4 w-4" /></button>
        <button type="button" onClick={toggleFull} title="Full screen (F)" className="rounded bg-white/10 p-2 hover:bg-white/20"><Maximize className="h-4 w-4" /></button>
        <button type="button" onClick={onClose} title="Exit (Esc)" className="rounded bg-white/10 p-2 hover:bg-white/20"><X className="h-4 w-4" /></button>
      </div>
      <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-white/10 px-3 py-1.5 font-mono text-[11px] opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <button type="button" onClick={() => go(-1)} aria-label="Previous"><ChevronLeft className="h-4 w-4" /></button>
        {index + 1} / {slides.length}
        <button type="button" onClick={() => go(1)} aria-label="Next"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>,
    document.body
  );
}
