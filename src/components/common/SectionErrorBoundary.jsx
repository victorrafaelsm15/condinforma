import { Component } from 'react';

// Boundary local, pra isolar uma SEÇÃO da página (não a página inteira) —
// diferente do ErrorBoundary global em src/components/ErrorBoundary.jsx,
// que cobre o app inteiro e é sempre a última linha de defesa. Motivo de
// existir: campos de formulário são o alvo mais comum de conflito com
// extensões de navegador (Grammarly, gerenciadores de senha, localizadores
// de cupom) que injetam elementos/wrappers no DOM por conta própria — se
// o React tentar reconciliar esse nó depois e a extensão tiver alterado a
// estrutura, o React pode lançar um erro real durante o commit. Isso é
// fora do nosso controle (não é um bug do nosso código), mas não precisa
// derrubar a aplicação inteira: só essa seção reseta pro fallback.
export default class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Erro isolado numa seção do Cond Informa:', error, info);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ? this.props.fallback(() => this.setState({ error: null })) : null;
    }
    return this.props.children;
  }
}
