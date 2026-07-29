import { Navigate, Outlet } from 'react-router-dom';
import { isLoggedIn } from '../lib/authService';

export default function ProtectedRoute() {
  return isLoggedIn() ? <Outlet /> : <Navigate to="/admin/login" replace />;
}
