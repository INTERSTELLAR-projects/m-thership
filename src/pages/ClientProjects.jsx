import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import ClientOperations from "../components/dashboard/ClientOperations";
import ProjectProgressDashboard from "../components/ProjectProgressDashboard";
import OtherTasksBox from "../components/OtherTasksBox";

export default function ClientProjects() {
  const [clients, setClients] = useState([]);

  useEffect(() => {
    base44.entities.CRMClient.list("business", 200).then(setClients);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Portal / Client Projects" rightText="Project Management" />
      <ProjectProgressDashboard />
      <div className="mt-6" />
      <ClientOperations />
      <OtherTasksBox clients={clients} />
    </div>
  );
}