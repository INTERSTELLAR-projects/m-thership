import React from 'react';
import SlideFrame from '@/components/slides/SlideFrame';
import FullBleedBackdrop from '@/components/slides/FullBleedBackdrop';
import CoverSlide from '@/components/slides/layouts/CoverSlide';
import ListSlide from '@/components/slides/layouts/ListSlide';
import BulletsSlide from '@/components/slides/layouts/BulletsSlide';
import SplitSlide from '@/components/slides/layouts/SplitSlide';
import ImageSlide from '@/components/slides/layouts/ImageSlide';
import StatsSlide from '@/components/slides/layouts/StatsSlide';
import QuoteSlide from '@/components/slides/layouts/QuoteSlide';
import CompareSlide from '@/components/slides/layouts/CompareSlide';
import TimelineSlide from '@/components/slides/layouts/TimelineSlide';
import ClosingSlide from '@/components/slides/layouts/ClosingSlide';

const LAYOUTS = {
  cover: CoverSlide,
  list: ListSlide,
  bullets: BulletsSlide,
  split: SplitSlide,
  image: ImageSlide,
  stats: StatsSlide,
  quote: QuoteSlide,
  compare: CompareSlide,
  timeline: TimelineSlide,
  closing: ClosingSlide
};

export default function SlideRenderer({ slide, theme, index = 0, total = 1, deckTitle = '' }) {
  const Layout = LAYOUTS[slide.layout] || BulletsSlide;
  const isImage = slide.layout === 'image';

  return (
    <SlideFrame
      theme={theme}
      index={index}
      total={total}
      deckTitle={deckTitle}
      hideFooter={slide.layout === 'cover'}
      pad={slide.layout === 'cover' ? '58px 88px 88px' : undefined}
      backdrop={isImage ? <FullBleedBackdrop theme={theme} slide={slide} /> : null}
    >
      <Layout slide={slide} theme={theme} />
    </SlideFrame>
  );
}
