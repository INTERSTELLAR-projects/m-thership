import PageHeader from "../components/PageHeader";

export default function PlaceholderPage({ title, subtitle }) {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb={`Command Center / ${title}`} rightText={subtitle || "Coming Soon"} />
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/[0.06] border border-orange-500/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-orange-500/40 text-2xl font-bold">IC</span>
          </div>
          <h2 className="text-ink/[0.58] text-lg font-semibold mb-1">{title}</h2>
          <p className="text-ink/[0.33] text-sm">This module is under development</p>
        </div>
      </div>
    </div>
  );
}