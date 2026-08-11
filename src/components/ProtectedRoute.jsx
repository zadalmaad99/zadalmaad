import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();

  if (user === undefined) {
    return <div className="loading-screen">جارٍ التحميل...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
