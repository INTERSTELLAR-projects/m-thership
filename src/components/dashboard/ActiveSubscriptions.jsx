const subscriptionGroups = [
  {
    name: "ØRBIT SEO",
    total: 1996,
    clients: [
      { name: "Redline Visuals", amount: 199 },
      { name: "CNG & Rein", amount: 500 },
      { name: "Mow Masters", amount: 500 },
      { name: "Muscle Mentor", amount: 199 },
      { name: "NW Tree Service", amount: 299 },
      { name: "Arcane Ink", amount: 299 },
    ],
  },
  {
    name: "WEB ØPS",
    total: 375,
    clients: [
      { name: "Uplift Aviation", amount: 250 },
      { name: "Maybe Not Safe", amount: 125 },
    ],
  },
  {
    name: "GBP BADGE HOSTING",
    total: 80,
    clients: [
      { name: "Redline Visuals", amount: 20 },
      { name: "Mow Masters", amount: 20 },
      { name: "NW Tree Service", amount: 20 },
      { name: "Arcane Ink", amount: 20 },
    ],
  },
  {
    name: "OPERATIONS MANAGEMENT",
    total: 700,
    clients: [{ name: "NW Tree Service", amount: 700 }],
  },
  {
    name: "SOFTWARE MAINTENANCE",
    total: 325,
    clients: [{ name: "SMPL Social", amount: 325 }],
  },
];

export default function ActiveSubscriptions() {
  return (
    <div className="bg-card rounded-xl border border-white/[0.06] p-6">
      <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase mb-5">
        Active Subscriptions
      </h2>

      <div className="space-y-5">
        {subscriptionGroups.map((group) => (
          <div key={group.name}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/70 text-xs font-semibold tracking-wider uppercase">
                {group.name}
              </span>
              <span className="text-orange-500 text-xs font-bold">
                ${group.total.toLocaleString()}
              </span>
            </div>
            <div className="space-y-1 pl-3 border-l border-white/[0.06]">
              {group.clients.map((client, idx) => (
                <div key={client.name} className="flex items-center justify-between py-0.5">
                  <span className="text-white/35 text-xs">
                    <span className="text-white/20 mr-1.5">{idx + 1}.</span>
                    {client.name}
                  </span>
                  <span className="text-white/40 text-xs font-medium">${client.amount}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="mt-6 pt-4 border-t border-white/[0.08] flex items-center justify-between">
        <span className="text-white font-bold text-sm tracking-wider">TOTAL</span>
        <span className="text-orange-500 font-bold text-lg">$3,476</span>
      </div>
    </div>
  );
}