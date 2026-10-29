import React, { useEffect, useRef, useState } from 'react';
import { SLIDE_W } from '@/lib/slideThemes';

export default function ScaledSlide({ children, className = '', style }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.25);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      if (el.clientWidth) setScale(el.clientWidth / SLIDE_W);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', overflow: 'hidden', ...style }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: SLIDE_W,
          transform: `scale(${scale})`,
          transformOrigin: 'top left'
        }}
      >
        {children}
      </div>
    </div>
  );
}
