import { Routes, Route } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import LandingPage from './pages/LandingPage';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import CondominioPage from './pages/CondominioPage';
import SindicoDashboard from './pages/SindicoDashboard';
import QrCodesCondominioPage from './pages/QrCodesCondominioPage';
import AmbientePage from './pages/AmbientePage';
import OcorrenciasPage from './pages/OcorrenciasPage';
import RelatoriosPage from './pages/RelatoriosPage';
import ExecutarChecklistPage from './pages/ExecutarChecklistPage';
import StatusPublicoPage from './pages/StatusPublicoPage';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route path="/admin/login" element={<AdminLogin />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/condominios/:id" element={<CondominioPage />} />
          <Route path="/admin/condominios/:id/dashboard" element={<SindicoDashboard />} />
          <Route path="/admin/condominios/:id/qrcodes" element={<QrCodesCondominioPage />} />
          <Route path="/admin/ambientes/:id" element={<AmbientePage />} />
          <Route path="/admin/ocorrencias" element={<OcorrenciasPage />} />
          <Route path="/admin/relatorios" element={<RelatoriosPage />} />
        </Route>
      </Route>

      <Route path="/ambiente/:id/executar" element={<ExecutarChecklistPage />} />
      <Route path="/ambiente/:id/status" element={<StatusPublicoPage />} />
    </Routes>
  );
}
