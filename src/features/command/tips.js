// Short, page-aware tips shown on the Ask bar so the useful moves are obvious. One tip per page.
// `ask` = a sample question the tip can drop into the bar (never sent until Justin presses send).
// {client} is filled with the open client's name on a client profile.
export const TIPS = [
  { match: /^\/clients\/[^/]+/, text: "On a client: the Agents view shows what's running, what's due and what the Brain still needs.", ask: "What's left for {client}?" },
  { match: /^\/crm/, text: "Drag a lead to the next stage on the board. Numbers live in the collapsed section at the bottom.", ask: "Which leads need a follow-up today?" },
  { match: /^\/pipeline/, text: "Drag a lead to the next stage. Won opens onboarding; Lost asks why.", ask: "Which leads need a follow-up today?" },
  { match: /^\/$/, text: "Answer the questions in Needs you, then approve. Say “something came up” to re-plan the day.", ask: "What needs my yes today?" },
  { match: /^\/brain/, text: "Teach the Brain by talking: tap the mic and answer the question on screen.", ask: "What does the Brain still not know?" },
  { match: /^\/(flight-plan|tasks\/sops)/, text: "Each SOP step becomes tasks when a client buys. Use Start a service on a client.", ask: "Start Mission ALPHA for " },
  { match: /^\/tasks/, text: "Type a task here and it lands on the board: “Add task: send Summit the audit Friday”.", ask: "Add task: " },
  { match: /^\/agents/, text: "Click a client on the right to see its agents; open a client profile for its own Agents view.", ask: "Which agents failed this week?" },
  { match: /^\/email/, text: "Start from the Mission brief template. Nothing sends until you tick the check and press Send.", ask: "Draft an email to " },
  { match: /^\/financial/, text: "Accounting & taxes lives in the tab bar here. Log expenses by voice from anywhere.", ask: "Log an expense: " },
  { match: /^\/(signatures|qr)/, text: "Put a signature or QR code in a client's folder and it shows in their portal.", ask: "" },
  { match: /^\/launch/, text: "Approvals only shows what truly needs your yes. Approve a whole group at once.", ask: "What's blocking launch?" },
  { match: /.*/, text: "Press / to type here from any page, or ⌘K to jump anywhere.", ask: "" },
];

export function tipFor(pathname) {
  return TIPS.find((t) => t.match.test(pathname)) || null;
}

const KEY = "ms_tips_hidden";
export function hiddenTips() { try { return JSON.parse(window.localStorage.getItem(KEY) || "[]"); } catch { return []; } }
export function hideTip(id) { try { window.localStorage.setItem(KEY, JSON.stringify([...new Set([...hiddenTips(), id])])); } catch { /* per-viewer only */ } }
export function hideAllTips() { try { window.localStorage.setItem(KEY, JSON.stringify(["*"])); } catch { /* ignore */ } }
