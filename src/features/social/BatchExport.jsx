import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PostRender } from "./PostCanvas";
import { downloadZip, postToPng, slugify } from "./lib/exportPng";
import { captionsText } from "./ui";

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60)));

/** Renders posts offscreen at 1080x1080 and zips their PNGs + caption files. */
export function useBatchExport() {
  const [posts, setPosts] = useState([]);
  const [progress, setProgress] = useState(null); // { done, total }
  const refs = useRef({});

  const run = useCallback(async (list, zipName) => {
    if (!list.length) return;
    refs.current = {};
    setPosts(list);
    setProgress({ done: 0, total: list.length });
    try {
      await nextFrame();
      await nextFrame();
      const files = [];
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const node = refs.current[p.id];
        const base = `${String(i + 1).padStart(2, "0")}-${slugify(p.title)}`;
        const dataUrl = await postToPng(node);
        files.push({ name: `${base}.png`, dataUrl });
        files.push({ name: `${base}.txt`, text: captionsText(p) });
        setProgress({ done: i + 1, total: list.length });
      }
      await downloadZip(files, `${slugify(zipName)}.zip`);
    } finally {
      setPosts([]);
      setProgress(null);
    }
  }, []);

  const node = posts.length
    ? createPortal(
      <div aria-hidden="true" style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>
        {posts.map((p) => <PostRender key={p.id} ref={(el) => { refs.current[p.id] = el; }} template={p.template} spec={p.spec} />)}
      </div>,
      document.body,
    )
    : null;

  return { run, progress, busy: !!progress, node };
}
