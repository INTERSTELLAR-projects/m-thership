// QR matrix encoder. Wørmhole shipped a hand-written encoder capped at version 10, which can't fit
// long static links at error-correction level H (needed when a logo covers the centre). This wraps
// the battle-tested `qrcode-generator` (versions 1-40) and returns the same boolean matrix shape
// Wørmhole's renderer used: matrix[y][x] === true means a dark module.
import qrcode from "qrcode-generator";

// UTF-8 bytes packed as a "binary string" (the library's default byte mode reads charCode & 0xff).
const toBinary = (s) => {
  const bytes = new TextEncoder().encode(s);
  let out = "";
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
};

export function encodeQR(text, level = "Q") {
  const qr = qrcode(0, level);
  qr.addData(toBinary(String(text || "")), "Byte");
  try {
    qr.make();
  } catch {
    throw new Error("Too much content for one QR code. Shorten it, or switch to a dynamic code.");
  }
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => qr.isDark(y, x)));
}

// H (30% recovery) whenever a logo covers the centre; Q (25%) otherwise.
export const eccFor = (style) => (style?.logo_url ? "H" : "Q");
