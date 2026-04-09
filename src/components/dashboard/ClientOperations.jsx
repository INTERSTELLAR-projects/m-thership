import { Bell } from "lucide-react";

const cards = [
  { title: "Website Updates" },
  { title: "GBP Updates" },
  { title: "New Website Builds" },
  { title: "Presentations" },
];

export default function ClientOperations() {
  return (
    <section className="px-8 pt-6">
      <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase mb-4">Client Operations</h2>
      <div className="grid grid-cols-2 gap-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="relative bg-card rounded-xl border border-white/[0.06] p-5 min-h-[120px] group hover:border-orange-500/20 transition-all duration-300"
          >
            <div className="flex items-start justify-between">
              <h3 className="text-white/80 text-sm font-medium">{card.title}</h3>
              <div className="relative">
                <Bell className="w-4 h-4 text-white/20 group-hover:text-orange-500/50 transition-colors" />
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full" />
              </div>
            </div>
            <div className="mt-6 text-white/15 text-xs">No updates yet</div>
          </div>
        ))}
      </div>
    </section>
  );
}