import { useAuth } from "@/lib/AuthContext";
import PageNotFound from "@/lib/PageNotFound";

export default function ProtectedRoute({ children, requiredRole = "admin" }) {
  const { user } = useAuth();

  if (!user || user.role !== requiredRole) {
    return <PageNotFound />;
  }

  return children;
}