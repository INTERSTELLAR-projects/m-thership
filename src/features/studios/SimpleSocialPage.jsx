// Admin view of the "Simple Social — coming soon" Studio. Same locked preview card clients see in their portal
// (PortalStudios.jsx), so what we show and what they see never drift. Nothing on it can run.
import PageHeader from "@/components/PageHeader";
import StudioPreview from "@/features/portal/PortalStudios";

export default function SimpleSocialPage() {
  return (
    <div className="min-h-screen bg-background pb-16">
      <PageHeader breadcrumb="Studio / Simple Social" title="Simple Social" rightText="Coming soon · locked in every portal" />
      <div className="px-5 py-6 md:px-8">
        <StudioPreview tab="studio_simple_social" client={{ business: "Your clients" }} call={async () => ({})} preview previewId="admin" />
      </div>
    </div>
  );
}
