// Copies the rendered signature HTML to the clipboard as rich content,
// so pasting into Gmail / Outlook / Apple Mail keeps the formatting + images.
export async function copyRichHtml(html, plainText) {
  const fallback = plainText || html.replace(/<[^>]+>/g, "");

  // Modern async Clipboard API with ClipboardItem (rich HTML + plain text).
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([fallback], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return true;
    } catch {
      // Some browsers reject write() of text/html without user gesture / permissions;
      // fall through to the execCommand path.
    }
  }

  // Fallback: select the live preview node and run execCommand("copy").
  try {
    const container = document.createElement("div");
    container.innerHTML = html;
    container.setAttribute("contenteditable", "true");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    document.body.appendChild(container);
    const range = document.createRange();
    range.selectNodeContents(container);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("copy");
    sel.removeAllRanges();
    document.body.removeChild(container);
    return true;
  } catch {
    return false;
  }
}

export function downloadHtmlFile(html, filename = "signature.html") {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}