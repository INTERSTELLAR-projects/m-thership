import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SlideRenderer from '@/features/presentations/slides/SlideRenderer';
import ScaledSlide from '@/features/presentations/slides/ScaledSlide';
import StudioEmpty from '@/features/presentations/studio/StudioEmpty';
import { Button } from '@/components/ui/button';

export default function DeckCanvas({ slides, theme, deckTitle, selectedId, onSelect, onStart }) {
  const index = Math.max(
    0,
    slides.findIndex((slide) => slide.id === selectedId)
  );
  const slide = slides[index];

  if (!slides.length) {
    return <StudioEmpty onStart={onStart} />;
  }

  const step = (delta) => {
    const next = index + delta;
    if (next < 0 || next >= slides.length) return;
    onSelect(slides[next].id);
  };

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="w-full max-w-[1000px]">
        <ScaledSlide className="rounded-none border border-border/80 bg-card shadow-[0_18px_50px_-24px_rgba(15,23,42,0.35)]">
          <SlideRenderer slide={slide} theme={theme} index={index} total={slides.length} deckTitle={deckTitle} />
        </ScaledSlide>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => step(-1)} disabled={index === 0} aria-label="Previous slide">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span>
          Slide {index + 1} of {slides.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => step(1)}
          disabled={index === slides.length - 1}
          aria-label="Next slide"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
