import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Zap, TrendingUp } from "lucide-react";

const ACCENTS = [
  { ring: "from-orange-500 to-amber-400", glow: "shadow-[0_0_14px_rgba(255,106,0,0.25)]", border: "border-orange-500/25", chip: "bg-orange-500/10 text-orange-300 border-orange-500/25", text: "from-orange-400 to-amber-300" },
  { ring: "from-yellow-400 to-amber-300", glow: "shadow-[0_0_14px_rgba(250,204,21,0.22)]", border: "border-yellow-500/25", chip: "bg-yellow-400/10 text-yellow-600 border-yellow-500/25", text: "from-yellow-300 to-amber-200" },
];

export default function ActiveSubscriptions() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.CRMClient.list("business", 200).then((data) => {
      setClients(data);
      setLoading(false);
    });
  }, []);

  const activeClients = clients.filter((c) => c.status === "Active");

  const groupMap = {};
  activeClients.forEach((client) => {
    (client.services || []).forEach((svc) => {
      if (!svc.name || !svc.price) return;
      const key = svc.name.trim().toUpperCase();
      if (!groupMap[key]) groupMap[key] = { name: svc.name.trim(), clients: [] };
      groupMap[key].clients.push({ name: client.business, amount: svc.price });
    });
  });

  const groups = Object.values(groupMap).sort((a, b) => {
    const totalA = a.clients.reduce((s, c) => s + c.amount, 0);
    const totalB = b.clients.reduce((s, c) => s + c.amount, 0);
    return totalB - totalA;
  });

  const grandTotal = groups.reduce((sum, g) => sum + g.clients.reduce((s, c) => s + c.amount, 0), 0);

  if (loading) {
    return (
      <div className="relative overflow-hidden bg-card rounded-2xl border border-ink/[0.13] p-6 flex items-center justify-center py-12">
        <div className="absolute -top-16 -right-12 w-40 h-40 rounded-full bg-orange-500/[0.08] blur-3xl pointer-events-none" />
        <Loader2 className="w-5 h-5 text-orange-500/40 animate-spin relative" />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-card rounded-2xl border border-ink/[0.13] p-5">
      <div className="absolute -top-20 -right-16 w-44 h-44 rounded-full bg-orange-500/[0.07] blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-10 w-40 h-40 rounded-full bg-yellow-400/[0.05] blur-3xl pointer-events-none" />

      <div className="relative flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-orange-500 to-yellow-400 shadow-[0_0_10px_rgba(255,170,0,0.5)]" />
          <h2 className="font-display text-ink/85 font-bold text-xs tracking-[0.22em] uppercase">Active Subscriptions</h2>
        </div>
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-ink/[0.48]">
          {activeClients.length} <span className="text-ink/[0.38]">clients</span>
        </span>
      </div>

      {groups.length === 0 ? (
        <p className="relative text-ink/[0.43] text-sm py-8 text-center">No active services found. Add services to clients in the CRM.</p>
      ) : (
        <div className="relative space-y-3">
          {groups.map((group, gi) => {
            const groupTotal = group.clients.reduce((s, c) => s + c.amount, 0);
            const share = grandTotal > 0 ? (groupTotal / grandTotal) * 100 : 0;
            const acc = ACCENTS[gi % ACCENTS.length];
            return (
              <div key={group.name} className={`group rounded-xl border ${acc.border} ${acc.glow} bg-gradient-to-b from-ink/[0.03] to-transparent p-3.5 transition-all hover:from-ink/5`}>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-md border ${acc.chip}`}>{group.name}</span>
                    <span className="text-ink/[0.43] text-[10px]">{group.clients.length} subs</span>
                  </div>
                  <span className={`font-bold text-sm bg-gradient-to-r ${acc.text} bg-clip-text text-transparent`}>
                    ${groupTotal.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-ink/[0.04] rounded-full overflow-hidden mb-3">
                  <div className={`h-full rounded-full bg-gradient-to-r ${acc.ring} shadow-[0_0_8px_rgba(255,170,0,0.4)] transition-all duration-700`} style={{ width: `${share}%` }} />
                </div>
                <div className="space-y-1">
                  {group.clients.map((client, idx) => (
                    <div key={`${client.name}-${idx}`} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-ink/[0.03] transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 rounded-md border bg-gradient-to-b ${acc.ring} opacity-80 flex items-center justify-center text-[9px] font-bold text-white/70 shrink-0`}>
                          {client.name?.charAt(0)}
                        </span>
                        <span className="text-ink/55 text-xs truncate">{client.name}</span>
                      </div>
                      <span className="text-ink/70 text-xs font-semibold">${client.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="relative mt-5 pt-4 border-t border-ink/[0.13]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-400" />
            <span className="text-ink font-bold text-sm tracking-[0.18em] uppercase">Total MRR</span>
          </div>
          <div className="text-right">
            <span className={`font-display text-2xl font-extrabold bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(255,170,0,0.4)]`}>
              ${grandTotal.toLocaleString()}
            </span>
            <p className="text-[9px] text-ink/[0.48] tracking-widest uppercase mt-0.5 flex items-center gap-1 justify-end"><TrendingUp className="w-2.5 h-2.5" /> recurring monthly</p>
          </div>
        </div>
      </div>
    </div>
  );
}