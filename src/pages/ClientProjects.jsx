import PageHeader from "../components/PageHeader";
import ClientOperations from "../components/dashboard/ClientOperations";
import MinusculeProjects from "../components/dashboard/MinusculeProjects";
import ProjectProgressDashboard from "../components/ProjectProgressDashboard";
import OtherTasksBox from "../components/OtherTasksBox";

export default function ClientProjects() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Portal / Client Projects" rightText="Project Management" />
      <ProjectProgressDashboard />
      <div className="mt-6" />
      <ClientOperations />
      <div className="border-t border-white/[0.04] mt-6" />
      <MinusculeProjects />
      <OtherTasksBox />
    </div>
  );
}