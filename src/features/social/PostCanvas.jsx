import { forwardRef, useEffect, useRef, useState } from "react";
import { SIZE } from "./templates/kit";
import { getTemplate } from "./templates";

/** The post at its real 1080x1080 size. Export renders this node. */
export const PostRender = forwardRef(function PostRender({ template, spec }, ref) {
  const t = getTemplate(template);
  const C = t.Component;
  return (
    <div ref={ref} style={{ width: SIZE, height: SIZE }}>
      <C spec={spec || {}} example={t.example} />
    </div>
  );
});

/** Fits a 1080 post into whatever width it is given (grid cards, detail preview). */
export default function ScaledPost({ template, spec, className = "", style }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const update = () => { if (el.clientWidth) setScale(el.clientWidth / SIZE); };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className={className} style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", overflow: "hidden", ...style }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: SIZE, height: SIZE, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }}>
        <PostRender template={template} spec={spec} />
      </div>
    </div>
  );
}
