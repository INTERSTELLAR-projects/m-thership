import PageHeader from "../components/PageHeader";
import ClientOperations from "../components/dashboard/ClientOperations";
import ActiveSubscriptions from "../components/dashboard/ActiveSubscriptions";
import FinancialPanel from "../components/dashboard/FinancialPanel";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command Center / Dashboard" rightText="Admin view dashboard" />
      <ClientOperations />
      
      {/* Lower Grid */}
      <div className="px-8 py-6 grid grid-cols-2 gap-6">
        <ActiveSubscriptions />
        <FinancialPanel />
      </div>
    </div>
  );
}