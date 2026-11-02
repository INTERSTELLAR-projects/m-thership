// Renders signature assets (GIF/PNG) in the browser, shows them instantly from a local
// blob URL, then uploads them so the copied signature points at hosted images.
import { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { renderAsset, estimateSize } from "./assetRender";

// Bump when the renderer's output changes so old cached files are re-rendered.
const RENDER_VERSION = 5;

export function assetKey(spec) {
  const s = JSON.stringify({ v: RENDER_VERSION, ...spec });
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `${spec.kind}-${(h >>> 0).toString(36)}`;
}

// key -> { status: rendering|local|uploading|ready|failed, local, url, width, height, blob, promise }
const mem = new Map();
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

function ensureRendered(key, spec) {
  let e = mem.get(key);
  if (e) return e;
  e = { status: "rendering", ...estimateSize(spec) };
  mem.set(key, e);
  e.promise = renderAsset(spec)
    .then((r) => {
      e.blob = r.blob;
      e.local = URL.createObjectURL(r.blob);
      e.width = r.width;
      e.height = r.height;
      e.status = "local";
      emit();
    })
    .catch((err) => {
      console.warn("Signature asset failed", key, err);
      e.status = "failed";
      emit();
    });
  return e;
}

function upload(key) {
  const e = mem.get(key);
  if (!e) return Promise.resolve(null);
  if (e.status === "ready") return Promise.resolve(e);
  if (e.status === "uploading") return e.uploadPromise;
  if (e.status !== "local") return Promise.resolve(null);
  e.status = "uploading";
  emit();
  const ext = e.blob.type === "image/gif" ? "gif" : "png";
  const file = new File([e.blob], `sig-${key}.${ext}`, { type: e.blob.type });
  e.uploadPromise = base44.integrations.Core.UploadFile({ file })
    .then(({ file_url }) => {
      e.url = file_url;
      e.status = "ready";
      emit();
      return e;
    })
    .catch((err) => {
      console.warn("Signature asset upload failed", key, err);
      e.status = "local";
      emit();
      return null;
    });
  return e.uploadPromise;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * specMap: { key: spec } used by the current signature.
 * saved:   { key: { url, w, h } } persisted on the signature record.
 * onSaved(key, {url,w,h}) is called when an asset finishes uploading.
 */
export function useSignatureAssets(specMap, saved, onSaved) {
  const [, setTick] = useState(0);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const specRef = useRef(specMap);
  specRef.current = specMap;
  const keys = Object.keys(specMap).sort().join("|");

  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);

  const uploadAll = async (entries, isCancelled = () => false) => {
    for (const [k] of entries) {
      if (isCancelled()) return;
      const e = mem.get(k);
      if (!e) continue;
      if (e.status === "local" || e.status === "uploading") {
        const r = await upload(k);
        if (r?.url) onSavedRef.current(k, { url: r.url, w: r.width, h: r.height });
      } else if (e.status === "ready" && e.url && !savedRef.current?.[k]) {
        onSavedRef.current(k, { url: e.url, w: e.width, h: e.height });
      }
    }
  };

  const renderAll = (entries) => {
    for (const [k, spec] of entries) {
      const s = savedRef.current?.[k];
      if (s?.url) {
        if (!mem.has(k)) mem.set(k, { status: "ready", url: s.url, width: s.w, height: s.h });
        continue;
      }
      ensureRendered(k, spec);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(specRef.current);
    const t = setTimeout(async () => {
      renderAll(entries);
      setTick((x) => x + 1);
      await Promise.all(entries.map(([k]) => mem.get(k)?.promise));
      await sleep(1200);
      if (!cancelled) uploadAll(entries, () => cancelled);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);

  const get = (key, final = false) => {
    const s = saved?.[key];
    if (s?.url) return { url: s.url, width: s.w, height: s.h };
    const e = mem.get(key);
    if (!e) return null;
    if (e.status === "failed") return { failed: true };
    if (e.url) return { url: e.url, width: e.width, height: e.height };
    if (!final && e.local) return { url: e.local, width: e.width, height: e.height };
    return null;
  };

  const pending = Object.keys(specMap).filter((k) => get(k, true) === null).length;

  // Render + upload everything right now (used when copying before the idle upload ran).
  const ensureAll = async () => {
    const entries = Object.entries(specRef.current);
    renderAll(entries);
    await Promise.all(entries.map(([k]) => mem.get(k)?.promise));
    await Promise.all(entries.map(([k]) => upload(k)));
    await uploadAll(entries);
    return true;
  };

  return { get, pending, ensureAll };
}
