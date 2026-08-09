import { Routes, Route } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import LandingPage from './pages/LandingPage';
import AdminLogin from './pages/AdminLogin';
import AdminSignup from './pages/AdminSignup';
import AssinaturaPage from './pages/AssinaturaPage';
import TermosPage from './pages/TermosPage';
import PrivacidadePage from './pages/PrivacidadePage';
import AdminDashboard from './pages/AdminDashboard';
import CondominioPage from './pages/CondominioPage';
import SindicoDashboard from './pages/SindicoDashboard';
import QrCodesCondominioPage from './pages/QrCodesCondominioPage';
import AmbientePage from './pages/AmbientePage';
import OcorrenciasPage from './pages/OcorrenciasPage';
import RelatoriosPage from './pages/RelatoriosPage';
import UsuariosPage from './pages/UsuariosPage';
import SubUsuariosPage from './pages/SubUsuariosPage';
import AuditoriaPage from './pages/AuditoriaPage';
import SegurancaPage from './pages/SegurancaPage';
import QrCodesPickerPage from './pages/QrCodesPickerPage';
import ExecutarChecklistPage from './pages/ExecutarChecklistPage';
import StatusPublicoPage from './pages/StatusPublicoPage';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/signup" element={<AdminSignup />} />
      {/* Pública mas sensível à sessão: funciona tanto pra quem ainda não
          tem conta (cria conta + assina) quanto pra cliente já logado
          trocando de plano pelas Configurações — ver AssinaturaPage.jsx. */}
      <Route path="/assinar" element={<AssinaturaPage />} />
      <Route path="/termos" element={<TermosPage />} />
      <Route path="/privacidade" element={<PrivacidadePage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/condominios/:id" element={<CondominioPage />} />
          <Route path="/admin/condominios/:id/dashboard" element={<SindicoDashboard />} />
          <Route path="/admin/condominios/:id/qrcodes" element={<QrCodesCondominioPage />} />
          <Route path="/admin/qrcodes" element={<QrCodesPickerPage />} />
          <Route path="/admin/ambientes/:id" element={<AmbientePage />} />
          <Route path="/admin/ocorrencias" element={<OcorrenciasPage />} />
          <Route path="/admin/relatorios" element={<RelatoriosPage />} />
          <Route path="/admin/sub-usuarios" element={<SubUsuariosPage />} />
          <Route path="/admin/auditoria" element={<AuditoriaPage />} />
          <Route path="/admin/seguranca" element={<SegurancaPage />} />
          <Route path="/admin/usuarios" element={<UsuariosPage />} />
        </Route>
      </Route>

      <Route path="/ambiente/:id/executar" element={<ExecutarChecklistPage />} />
      <Route path="/ambiente/:id/status" element={<StatusPublicoPage />} />
    </Routes>
  );
}
