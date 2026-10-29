import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Loader2, Sliders } from 'lucide-react';
import MessageBubble from '@/features/presentations/studio/MessageBubble';
import DeckOptions from '@/features/presentations/studio/DeckOptions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const EXAMPLES = [
  'A 10-slide client proposal for migrating a retailer to a headless ecommerce stack',
  'Q4 business review for an existing customer: results, learnings, next-quarter roadmap',
  'A pitch deck for our new AI onboarding product, aimed at operations leaders',
  'A services overview deck for a mid-market prospect, focused on outcomes and pricing tiers',
  'A discovery workshop agenda and findings summary for a manufacturing client'
];

export default function ChatPanel({ messages, onSend, busy, statusText, options, onOptionsChange, projects }) {
  const [value, setValue] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, statusText]);

  const submit = () => {
    const text = value.trim();
    if (!text || busy) return;
    setValue('');
    onSend(text);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
          SF
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">Deck assistant</p>
          <p className="truncate text-[11px] text-muted-foreground">Prompt a deck, then refine any slide</p>
        </div>
        <Button
          variant={showOptions ? 'secondary' : 'ghost'}
          size="icon"
          className="ml-auto h-8 w-8"
          onClick={() => setShowOptions((open) => !open)}
          aria-label="Deck options"
        >
          <Sliders className="h-4 w-4" />
        </Button>
      </div>

      <div ref={scrollRef} className="thin-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Describe the presentation you need and Cønstellation will write it and design every slide. Then keep prompting to
              change anything.
            </p>
            <div className="space-y-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setValue(example)}
                  className="w-full rounded-none border border-border bg-card/70 px-3 py-2.5 text-left text-[13px] leading-snug text-muted-foreground backdrop-blur-md transition-colors hover:border-flame hover:bg-card hover:text-foreground"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => <MessageBubble key={index} message={message} />)
        )}

        {busy ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {statusText || 'Working'}
          </div>
        ) : null}
      </div>

      <div className="border-t border-border/70 p-3">
        {showOptions ? (
          <div className="mb-3">
            <DeckOptions options={options} onChange={onOptionsChange} projects={projects} />
          </div>
        ) : null}
        <div className="relative">
          <Textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Describe the deck, or ask for a change…"
            rows={3}
            className="resize-none pr-12 text-sm"
          />
          <Button
            size="icon"
            className="absolute bottom-2.5 right-2.5 h-8 w-8"
            onClick={submit}
            disabled={busy || !value.trim()}
            aria-label="Send"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">Enter to send, Shift + Enter for a new line</p>
      </div>
    </div>
  );
}
