import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Loader } from '@mantine/core';
import ProtectedRoute from './components/ProtectedRoute';

// "Failed to fetch dynamically imported module" acontece sobretudo quando
// um deploy novo já saiu (hashes de arquivo mudaram) enquanto essa aba
// ainda está com o index.html antigo em memória — a aba nunca vai
// conseguir buscar aquele chunk específico de novo, não importa quantas
// vezes tentar, porque o arquivo simplesmente não existe mais no servidor.
// Um reload da página resolve na hora (busca o index.html novo, com os
// hashes certos). Só tenta reload UMA vez por sessão (sessionStorage) pra
// não entrar em loop infinito se o problema for outra coisa (rede caída
// de verdade, por exemplo) — nesse caso o erro segue normalmente pro
// ErrorBoundary, que já mostra uma tela com botão de recarregar.
function lazyWithChunkRetry(importer) {
  return lazy(async () => {
    try {
      return await importer();
    } catch (error) {
      const key = 'condinforma-chunk-reload-attempted';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        // A promise fica pendente de propósito — a página recarrega antes
        // dela resolver ou rejeitar de verdade.
        return new Promise(() => {});
      }
      throw error;
    }
  });
}

const AdminLayout = lazyWithChunkRetry(() => import('./layouts/AdminLayout'));

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
const LandingPage = lazyWithChunkRetry(() => import('./pages/LandingPage'));
const AdminLogin = lazyWithChunkRetry(() => import('./pages/AdminLogin'));
const AdminSignup = lazyWithChunkRetry(() => import('./pages/AdminSignup'));
const AssinaturaPage = lazyWithChunkRetry(() => import('./pages/AssinaturaPage'));
const TermosPage = lazyWithChunkRetry(() => import('./pages/TermosPage'));
const PrivacidadePage = lazyWithChunkRetry(() => import('./pages/PrivacidadePage'));

const AdminDashboard = lazyWithChunkRetry(() => import('./pages/AdminDashboard'));
const CondominioPage = lazyWithChunkRetry(() => import('./pages/CondominioPage'));
const SindicoDashboard = lazyWithChunkRetry(() => import('./pages/SindicoDashboard'));
const QrCodesCondominioPage = lazyWithChunkRetry(() => import('./pages/QrCodesCondominioPage'));
const QrCodesPickerPage = lazyWithChunkRetry(() => import('./pages/QrCodesPickerPage'));
const AmbientePage = lazyWithChunkRetry(() => import('./pages/AmbientePage'));
const OcorrenciasPage = lazyWithChunkRetry(() => import('./pages/OcorrenciasPage'));
const RelatoriosPage = lazyWithChunkRetry(() => import('./pages/RelatoriosPage'));
const SubUsuariosPage = lazyWithChunkRetry(() => import('./pages/SubUsuariosPage'));
const AuditoriaPage = lazyWithChunkRetry(() => import('./pages/AuditoriaPage'));
const SegurancaPage = lazyWithChunkRetry(() => import('./pages/SegurancaPage'));
const UsuariosPage = lazyWithChunkRetry(() => import('./pages/UsuariosPage'));

const ExecutarChecklistPage = lazyWithChunkRetry(() => import('./pages/ExecutarChecklistPage'));
const StatusPublicoPage = lazyWithChunkRetry(() => import('./pages/StatusPublicoPage'));

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
