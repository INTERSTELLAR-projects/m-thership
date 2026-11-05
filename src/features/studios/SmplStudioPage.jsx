// Admin view of the co-branded INTERSTELLAR™ × SMPL. "SMPL. Studio" (SMPL Social, coming soon). Same locked preview
// card clients see in their portal (PortalStudios.jsx -> components/brand/SmplCoBrand.jsx), so what we show and what
// they see never drift. Nothing on it can run.
import PageHeader from "@/components/PageHeader";
import StudioPreview from "@/features/portal/PortalStudios";

export default function SmplStudioPage() {
  return (
    <div className="min-h-screen bg-background pb-16">
      <PageHeader breadcrumb="Studio / SMPL. Studio" title="SMPL. Studio" rightText="SMPL Social · coming soon · locked in every portal" />
      <div className="px-5 py-6 md:px-8">
        <StudioPreview tab="studio_smpl" client={{ business: "Your clients" }} call={async () => ({})} preview previewId="admin" />
      </div>
    </div>
  );
}
