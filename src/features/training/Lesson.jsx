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

// react-markdown hands each renderer a `node` prop; drop it so it never reaches the DOM.
const el = (Tag, className, extra = {}) => {
  const C = ({ node: _node, ...p }) => <Tag className={className} {...extra} {...p} />;
  C.displayName = `Md${Tag}`;
  return C;
};
const MD = {
  h1: el("h3", "mt-5 text-[19px] font-semibold tracking-[-0.02em]"),
  h2: el("h3", "mt-5 text-[17px] font-semibold tracking-[-0.02em]"),
  h3: el("h4", "mt-4 text-[15px] font-semibold"),
  p: el("p", "mt-3 text-[15px] leading-relaxed text-ink/80"),
  ul: el("ul", "mt-3 space-y-2 [&>li]:relative [&>li]:pl-4 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[9px] [&>li]:before:h-1.5 [&>li]:before:w-1.5 [&>li]:before:bg-[#ff3c00] [&>li]:before:content-['']"),
  ol: el("ol", "mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-ink/80"),
  li: el("li", "text-[15px] leading-relaxed text-ink/80"),
  blockquote: el("blockquote", "mt-4 border-l-2 border-[#ffaa00] bg-[#ffaa00]/10 px-3 py-2 text-[13.5px] text-ink/75 [&_p]:mt-0"),
  a: el("a", "text-[#ff3c00] underline", { target: "_blank", rel: "noreferrer" }),
  strong: el("strong", "font-semibold text-ink"),
  code: el("code", "bg-ink/[0.06] px-1 font-mono text-[12.5px]"),
  img: el("img", "mt-3 h-auto w-full border border-hair", { alt: "", loading: "lazy" }),
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
