import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { useMe } from "@/hooks/use-auth";

export function ProtectedRoute() {
  const { token } = useAuthStore();
  const { isLoading } = useMe();

  if (!token) return <Navigate to="/login" replace />;
  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );
  return <Outlet />;
}

export function AdminRoute() {
  const { user } = useAuthStore();
  if (user?.role !== "admin") return <Navigate to="/user/dashboard" replace />;
  return <Outlet />;
}

export function GuestRoute() {
  const { token, user } = useAuthStore();
  const { isLoading } = useMe();

  if (!token) return <Outlet />;
  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );
  if (!user) return <Outlet />;
  const target = user.role === "admin" ? "/admin/dashboard" : "/";
  return <Navigate to={target} replace />;
}
