import React from 'react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
import SlideRenderer from '@/features/presentations/slides/SlideRenderer';
import ScaledSlide from '@/features/presentations/slides/ScaledSlide';
import { getTheme } from '@/features/presentations/lib/slideThemes';

export default function SlideRail({ slides, themeId, brand, deckTitle, selectedId, onSelect, onReorder, onAdd }) {
  const theme = getTheme(themeId, brand);

  const handleEnd = (result) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    const next = Array.from(slides);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    onReorder(next);
  };

  return (
    <DragDropContext onDragEnd={handleEnd}>
      <Droppable droppableId="slide-rail" direction="horizontal">
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="thin-scroll flex gap-3 overflow-x-auto px-4 py-3"
          >
            {slides.map((slide, index) => (
              <Draggable key={slide.id} draggableId={slide.id} index={index}>
                {(drag) => (
                  <div
                    ref={drag.innerRef}
                    {...drag.draggableProps}
                    {...drag.dragHandleProps}
                    style={drag.draggableProps.style}
                    className="w-[168px] flex-none"
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(slide.id)}
                      className={`w-full overflow-hidden rounded-none border bg-card text-left transition-all ${
                        slide.id === selectedId
                          ? 'border-flame ring-2 ring-flame/25'
                          : 'border-border hover:border-flame'
                      }`}
                    >
                      <ScaledSlide>
                        <SlideRenderer
                          slide={slide}
                          theme={theme}
                          index={index}
                          total={slides.length}
                          deckTitle={deckTitle}
                        />
                      </ScaledSlide>
                    </button>
                    <div className="mt-1.5 flex items-center justify-between px-0.5">
                      <span className="text-[11px] text-muted-foreground">{index + 1}</span>
                      <span className="text-[11px] capitalize text-muted-foreground">{slide.layout}</span>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            <button
              type="button"
              onClick={onAdd}
              className="flex h-[95px] w-[168px] flex-none flex-col items-center justify-center gap-1.5 rounded-none border border-dashed border-border text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Add slide
            </button>
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
