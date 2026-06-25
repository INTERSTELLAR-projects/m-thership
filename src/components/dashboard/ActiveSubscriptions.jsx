import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";

export default function ActiveSubscriptions() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.CRMClient.list("business", 200).then((data) => {
      setClients(data);
      setLoading(false);
    });
  }, []);

  // Build service groups: group all services across all active clients by service name
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
      <div className="bg-card rounded-xl border border-white/[0.06] p-6 flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-white/20 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-white/[0.06] p-6">
      <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase mb-5">
        Active Subscriptions
      </h2>

      {groups.length === 0 ? (
        <p className="text-white/25 text-sm">No active services found. Add services to clients in the CRM.</p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => {
            const groupTotal = group.clients.reduce((s, c) => s + c.amount, 0);
            return (
              <div key={group.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/70 text-xs font-semibold tracking-wider uppercase">
                    {group.name}
                  </span>
                  <span className="text-orange-500 text-xs font-bold">
                    ${groupTotal.toLocaleString()}
                  </span>
                </div>
                <div className="space-y-1 pl-3 border-l border-white/[0.06]">
                  {group.clients.map((client, idx) => (
                    <div key={`${client.name}-${idx}`} className="flex items-center justify-between py-0.5">
                      <span className="text-white/35 text-xs">
                        <span className="text-white/20 mr-1.5">{idx + 1}.</span>
                        {client.name}
                      </span>
                      <span className="text-white/40 text-xs font-medium">${client.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-white/[0.08] flex items-center justify-between">
        <span className="text-white font-bold text-sm tracking-wider">TOTAL</span>
        <span className="text-orange-500 font-bold text-lg">${grandTotal.toLocaleString()}</span>
      </div>
    </div>
  );
}