import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Loader } from '@mantine/core';
import ProtectedRoute from './components/ProtectedRoute';

const AdminLayout = lazy(() => import('./layouts/AdminLayout'));

// Cada página vira um chunk próprio carregado sob demanda — o objetivo
// principal é o colaborador de zeladoria, que abre só ExecutarChecklistPage
// direto pelo QR Code numa conexão móvel fraca: sem isso, ele baixava o
// mesmo bundle gigante que inclui o painel administrativo inteiro (Mantine
// Tabs/Modal/Menu, jsPDF/html2canvas dos relatórios, tudo), que ele nunca
// usa. Router lazy-loading agrupa naturalmente em 3 blocos por padrão de
// navegação: painel do gestor (tudo dentro de AdminLayout), fluxo público
// do colaborador (ExecutarChecklistPage) e fluxo público do morador
// (StatusPublicoPage) — landing/login/assinatura também saem do bundle
// principal como efeito colateral direto do mesmo padrão.
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminSignup = lazy(() => import('./pages/AdminSignup'));
const AssinaturaPage = lazy(() => import('./pages/AssinaturaPage'));
const TermosPage = lazy(() => import('./pages/TermosPage'));
const PrivacidadePage = lazy(() => import('./pages/PrivacidadePage'));

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const CondominioPage = lazy(() => import('./pages/CondominioPage'));
const SindicoDashboard = lazy(() => import('./pages/SindicoDashboard'));
const QrCodesCondominioPage = lazy(() => import('./pages/QrCodesCondominioPage'));
const QrCodesPickerPage = lazy(() => import('./pages/QrCodesPickerPage'));
const AmbientePage = lazy(() => import('./pages/AmbientePage'));
const OcorrenciasPage = lazy(() => import('./pages/OcorrenciasPage'));
const RelatoriosPage = lazy(() => import('./pages/RelatoriosPage'));
const SubUsuariosPage = lazy(() => import('./pages/SubUsuariosPage'));
const AuditoriaPage = lazy(() => import('./pages/AuditoriaPage'));
const SegurancaPage = lazy(() => import('./pages/SegurancaPage'));
const UsuariosPage = lazy(() => import('./pages/UsuariosPage'));

const ExecutarChecklistPage = lazy(() => import('./pages/ExecutarChecklistPage'));
const StatusPublicoPage = lazy(() => import('./pages/StatusPublicoPage'));

function PageFallback() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader color="brand" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
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
    </Suspense>
  );
}
