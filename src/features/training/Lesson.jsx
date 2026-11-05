// Lesson body: markdown + video / image embeds. Video links from YouTube, Vimeo and Loom play inline; .mp4/.webm play
// in a <video>; images show full width. Anything else stays a plain link.
import ReactMarkdown from "react-markdown";

export function embedSrc(url) {
  const u = String(url || "").trim();
  let m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/i);
  if (m) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${m[1]}` };
  m = u.match(/vimeo\.com\/(\d+)/i);
  if (m) return { kind: "iframe", src: `https://player.vimeo.com/video/${m[1]}` };
  m = u.match(/loom\.com\/(?:share|embed)\/([\w]+)/i);
  if (m) return { kind: "iframe", src: `https://www.loom.com/embed/${m[1]}` };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) return { kind: "video", src: u };
  if (/\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(u)) return { kind: "image", src: u };
  return { kind: "link", src: u };
}

export function Embed({ e }) {
  const s = embedSrc(e.url);
  const asImage = e.type === "image" || s.kind === "image";
  return (
    <figure className="overflow-hidden border border-hair bg-card">
      {asImage ? (
        <img src={e.url} alt={e.caption || ""} loading="lazy" className="block h-auto w-full" />
      ) : s.kind === "iframe" ? (
        <div className="relative aspect-video w-full bg-ink">
          <iframe src={s.src} title={e.caption || "Training video"} className="absolute inset-0 h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" />
        </div>
      ) : s.kind === "video" ? (
        <video src={s.src} controls playsInline className="block w-full bg-ink" />
      ) : (
        <a href={e.url} target="_blank" rel="noreferrer" className="block px-3 py-3 text-[13px] font-medium text-[#ff3c00] underline">{e.caption || e.url}</a>
      )}
      {e.caption && s.kind !== "link" && <figcaption className="border-t border-hair px-3 py-2 text-[12px] text-ink/60">{e.caption}</figcaption>}
    </figure>
  );
}

const MD = {
  h1: (p) => <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.02em]" {...p} />,
  h2: (p) => <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.02em]" {...p} />,
  h3: (p) => <h4 className="mt-4 text-[15px] font-semibold" {...p} />,
  p: (p) => <p className="mt-3 text-[15px] leading-relaxed text-ink/80" {...p} />,
  ul: (p) => <ul className="mt-3 space-y-2" {...p} />,
  ol: (p) => <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-ink/80" {...p} />,
  li: ({ children, ...p }) => <li className="flex gap-2.5 text-[15px] leading-relaxed text-ink/80 [ol_&]:list-item [ol_&]:block" {...p}><span className="mt-[9px] h-1.5 w-1.5 shrink-0 bg-[#ff3c00] [ol_&]:hidden" aria-hidden="true" /><span className="min-w-0">{children}</span></li>,
  blockquote: (p) => <blockquote className="mt-4 border-l-2 border-[#ffaa00] bg-[#ffaa00]/10 px-3 py-2 text-[13.5px] text-ink/75 [&_p]:mt-0" {...p} />,
  a: (p) => <a className="text-[#ff3c00] underline" target="_blank" rel="noreferrer" {...p} />,
  strong: (p) => <strong className="font-semibold text-ink" {...p} />,
  code: (p) => <code className="bg-ink/[0.06] px-1 font-mono text-[12.5px]" {...p} />,
  img: (p) => <img className="mt-3 h-auto w-full border border-hair" alt="" loading="lazy" {...p} />,
};

export default function Lesson({ md, embeds = [] }) {
  return (
    <div>
      <div className="[&>*:first-child]:mt-0">
        <ReactMarkdown components={MD}>{md || ""}</ReactMarkdown>
      </div>
      {embeds.length > 0 && <div className="mt-5 space-y-4">{embeds.map((e, i) => <Embed key={`${e.url}-${i}`} e={e} />)}</div>}
    </div>
  );
}
