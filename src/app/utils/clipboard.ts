/**
 * Safe clipboard copy that works even when navigator.clipboard is blocked
 * by a permissions policy (e.g. inside sandboxed iframes).
 * Falls back to the legacy execCommand approach.
 */
export function safeCopy(text: string): Promise<void> {
  // Try modern API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    ok ? resolve() : reject(new Error("execCommand copy failed"));
  });
}
