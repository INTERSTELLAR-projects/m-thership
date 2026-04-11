import PageHeader from "../components/PageHeader";
import ClientOperations from "../components/dashboard/ClientOperations";

export default function ClientProjects() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Portal / Client Projects" rightText="Project Management" />
      <ClientOperations />
    </div>
  );
}