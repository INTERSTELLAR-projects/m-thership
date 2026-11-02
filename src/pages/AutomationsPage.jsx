import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import AutomationsHub from "@/features/automations/AutomationsHub";

// Sidebar route for the Automations hub (same view as Settings > Automations).
export default function AutomationsPage() {
  return (
    <div className="pb-16">
      <PageHeader breadcrumb="Agency / Automations" title="Every /Automation" rightText="Internal + external">
        <Link to="/settings?tab=automations" className="text-[12px] text-ink/55 hover:text-[#ff3c00]">Open in Settings</Link>
      </PageHeader>
      <div className="px-4 pt-6 md:px-8">
        <AutomationsHub />
      </div>
    </div>
  );
}
