import React from 'react';
import SlideFrame from '@/features/presentations/slides/SlideFrame';
import FullBleedBackdrop from '@/features/presentations/slides/FullBleedBackdrop';
import CoverSlide from '@/features/presentations/slides/layouts/CoverSlide';
import ListSlide from '@/features/presentations/slides/layouts/ListSlide';
import BulletsSlide from '@/features/presentations/slides/layouts/BulletsSlide';
import CardsSlide from '@/features/presentations/slides/layouts/CardsSlide';
import SplitSlide from '@/features/presentations/slides/layouts/SplitSlide';
import ImageSlide from '@/features/presentations/slides/layouts/ImageSlide';
import StatsSlide from '@/features/presentations/slides/layouts/StatsSlide';
import ChartSlide from '@/features/presentations/slides/layouts/ChartSlide';
import QuoteSlide from '@/features/presentations/slides/layouts/QuoteSlide';
import CompareSlide from '@/features/presentations/slides/layouts/CompareSlide';
import TimelineSlide from '@/features/presentations/slides/layouts/TimelineSlide';
import ClosingSlide from '@/features/presentations/slides/layouts/ClosingSlide';
import SectionSlide from '@/features/presentations/slides/layouts/SectionSlide';
import BigStatSlide from '@/features/presentations/slides/layouts/BigStatSlide';
import PricingSlide from '@/features/presentations/slides/layouts/PricingSlide';

const LAYOUTS = {
  cover: CoverSlide,
  list: ListSlide,
  bullets: BulletsSlide,
  cards: CardsSlide,
  split: SplitSlide,
  image: ImageSlide,
  stats: StatsSlide,
  chart: ChartSlide,
  quote: QuoteSlide,
  compare: CompareSlide,
  timeline: TimelineSlide,
  closing: ClosingSlide,
  section: SectionSlide,
  bigstat: BigStatSlide,
  pricing: PricingSlide,
  // aliases a generator might use
  'two-column': CompareSlide,
  comparison: CompareSlide,
  'image-text': SplitSlide
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
      pad={slide.layout === 'cover' ? '58px 88px 70px' : undefined}
      backdrop={isImage ? <FullBleedBackdrop theme={theme} slide={slide} /> : null}
    >
      <Layout slide={slide} theme={theme} />
    </SlideFrame>
  );
}
