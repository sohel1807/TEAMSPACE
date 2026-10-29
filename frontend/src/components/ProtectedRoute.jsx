import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
export default function ProtectedRoute({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="loading">Loading your workspace…</div>;
  return user ? children : <Navigate to="/login" replace />;
}
