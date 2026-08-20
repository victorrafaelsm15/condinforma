import { Component } from 'react';

// Pega qualquer erro não tratado durante a renderização (em vez de deixar
// a tela em branco sem nenhuma pista) e mostra uma mensagem simples, com o
// erro técnico discreto no rodapé pra facilitar diagnóstico. Não depende
// do Mantine nem de mais nada do app — se o erro vier de dentro do
// MantineProvider ou do router, essa tela ainda precisa conseguir
// renderizar sozinha.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Erro não tratado na renderização do Cond Informa:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', textAlign: 'center', padding: 24,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f5f6fc', color: '#10142c',
        }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 10px' }}>
            Algo deu errado ao carregar o Cond Informa.
          </h1>
          <p style={{ fontSize: 15, color: '#5b6178', maxWidth: 440, margin: '0 0 24px' }}>
            Verifique a configuração ou tente novamente em instantes.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 22px', borderRadius: 100, border: 'none', background: '#3355e8', color: '#fff',
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}
          >
            Recarregar página
          </button>
          <p style={{ fontSize: 11, color: '#8890a6', marginTop: 40, maxWidth: 520 }}>
            {this.state.error?.message || String(this.state.error)}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
