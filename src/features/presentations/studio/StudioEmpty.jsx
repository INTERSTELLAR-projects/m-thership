import React from 'react';
import { ArrowUpRight, Wand2 } from 'lucide-react';

const STARTERS = [
  'Pitch deck for our new AI onboarding product, for operations leaders',
  'Q4 business review for an existing customer: results and next-quarter roadmap',
  'Client proposal for migrating a retailer to a headless ecommerce stack'
];

const STEPS = [
  'Describe the presentation you need',
  'Refine any slide by prompting, or edit it directly',
  'Download as PDF or PowerPoint'
];

export default function StudioEmpty({ onStart }) {
  return (
    <div className="rise-in relative w-full max-w-[760px] px-4 text-center">
      <div
        className="pointer-events-none absolute -bottom-28 -right-10 h-[420px] w-[420px] rounded-full opacity-50 blur-[80px]"
        style={{ background: 'radial-gradient(closest-side, #FD5638, rgba(255,138,107,0) 70%)' }}
        aria-hidden="true"
      />

      <span className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-none border border-border bg-card/80 backdrop-blur-md">
        <Wand2 className="h-5 w-5" />
      </span>
      <h2 className="relative mt-6 font-sans text-3xl font-medium tracking-tight sm:text-[38px]">
        What are we presenting?
      </h2>
      <p className="relative mx-auto mt-3 max-w-[46ch] text-sm leading-relaxed text-muted-foreground sm:text-base">
        Describe the deck in a sentence. Cønstellation writes it, designs every slide, and keeps it editable with a prompt.
      </p>

      <div className="relative mx-auto mt-8 grid max-w-[640px] gap-2">
        {STARTERS.map((starter) => (
          <button
            key={starter}
            type="button"
            onClick={() => onStart(starter)}
            className="group flex items-center gap-3 rounded-none border border-border bg-card/70 px-4 py-3 text-left text-sm backdrop-blur-md transition-all hover:-translate-y-px hover:border-flame hover:bg-card"
          >
            <span className="flex-1 text-muted-foreground transition-colors group-hover:text-foreground">{starter}</span>
            <ArrowUpRight className="h-4 w-4 flex-none text-muted-foreground transition-transform group-hover:-translate-y-0.5" />
          </button>
        ))}
      </div>

      <ol className="relative mx-auto mt-10 flex max-w-[680px] flex-col gap-3 text-left sm:flex-row sm:gap-6">
        {STEPS.map((step, index) => (
          <li key={step} className="flex flex-1 items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-secondary font-mono text-[11px] text-muted-foreground">
              {index + 1}
            </span>
            <span className="text-[13px] leading-snug text-muted-foreground">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
