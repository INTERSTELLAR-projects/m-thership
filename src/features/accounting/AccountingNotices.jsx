// In-app notification for Accounting & Tax reminders (estimated-tax due soon, monthly close).
// Mounted once in the admin Layout; renders nothing for non-admins or when there is no new alert.
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

const SESSION_KEY = "acct_notice_hidden";

export default function AccountingNotices() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    if (!user || user.role !== "admin" || !base44.entities.AccountingAlert) return undefined;
    let hidden = [];
    try { hidden = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "[]"); } catch { hidden = []; }
    let alive = true;
    base44.entities.AccountingAlert.filter({ status: "new" }, "due_date", 5)
      .then((rows) => { if (alive) setAlert((Array.isArray(rows) ? rows : []).find((a) => !hidden.includes(a.id)) || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [user]);

  // The Accounting tab shows the same alert inline, so the floating card stays out of the way there.
  if (!alert || (location.pathname === "/financial" && /tab=accounting/.test(location.search))) return null;
  const hide = () => {
    try {
      const prev = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "[]");
      sessionStorage.setItem(SESSION_KEY, JSON.stringify([...prev, alert.id]));
    } catch { /* session-only convenience */ }
    setAlert(null);
  };
  const due = alert.due_date ? new Date(`${alert.due_date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-md border border-ink bg-ink text-white shadow-[0_20px_40px_-20px_rgba(0,0,0,.6)]">
      <div className="h-[3px] flame-bg" />
      <div className="flex items-start gap-3 p-4">
        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-[#ff6a00]" />
        <div className="min-w-0 flex-1">
          <p className="mono-label !text-[9px] text-white/50">{alert.kind === "usage" ? "Fair use" : "Accounting"}{due && alert.kind !== "usage" ? ` · due ${due}` : ""}</p>
          <p className="mt-1 text-[13px] font-semibold leading-snug">{alert.title}</p>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => { base44.entities.AccountingAlert.update(alert.id, { status: "seen" }).catch(() => {}); setAlert(null); navigate(alert.link || (alert.kind === "usage" ? "/client-usage" : "/financial?tab=accounting")); }}
              className="rounded-md px-3 py-1.5 text-[12px] font-semibold text-white flame-bg">
              Open
            </button>
            <button onClick={hide} className="text-[11.5px] text-white/55 hover:text-white">Later</button>
          </div>
        </div>
        <button onClick={hide} className="text-white/40 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
