import { base44 } from "@/api/base44Client";

// Thin client for the account-security backend function. Throws an Error whose message is the server's text.
export async function sec(action, args = {}) {
  try {
    return (await base44.functions.invoke("account-security", { action, ...args })).data;
  } catch (e) {
    const d = e?.response?.data || {};
    const err = new Error(d.error || e?.message || "Something went wrong. Try again.");
    err.code = d.code;
    err.status = e?.response?.status;
    err.locked_until = d.locked_until;
    throw err;
  }
}

// True when a portal call was refused because this session still needs its second step.
export const needsSecondFactor = (e) => e?.response?.status === 428 && e?.response?.data?.code === "2fa_required";

export function downloadCodes(codes) {
  const text = ["Interstellar Møthership: recovery codes", "=".repeat(38), "", "Keep these somewhere safe. Each code works once,", "if you can't use your authenticator app or email.", "", ...codes, ""].join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url; a.download = "interstellar-recovery-codes.txt"; a.click();
  URL.revokeObjectURL(url);
}
