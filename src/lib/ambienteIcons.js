import {
  DoorOpen, Bath, Dumbbell, Trees, Waves, Trophy, Baby, ShieldCheck, ShoppingCart,
  ArrowUpDown, ConciergeBell, Flame, Gamepad2, PawPrint, Blocks, CarFront, Clapperboard,
} from 'lucide-react';

// Paleta fixa de ícones pra tipos de ambiente comuns em condomínio — nome
// salvo em ambientes.icon é a chave (ex: "Bath"), independente do rótulo
// em português (que pode mudar sem migrar dado nenhum). DoorOpen é o
// ícone genérico usado como fallback (ambiente sem ícone escolhido) e
// também faz parte da paleta, pra dar um jeito explícito de "voltar ao
// padrão" no seletor.
export const AMBIENTE_ICON_OPTIONS = [
  { value: 'DoorOpen', label: 'Genérico', Icon: DoorOpen },
  { value: 'Bath', label: 'Banheiro', Icon: Bath },
  { value: 'Dumbbell', label: 'Academia', Icon: Dumbbell },
  { value: 'Trees', label: 'Área de Lazer', Icon: Trees },
  { value: 'Waves', label: 'Piscina', Icon: Waves },
  { value: 'Trophy', label: 'Quadra', Icon: Trophy },
  { value: 'Baby', label: 'Parquinho', Icon: Baby },
  { value: 'ShieldCheck', label: 'Portaria', Icon: ShieldCheck },
  { value: 'ShoppingCart', label: 'Mercadinho', Icon: ShoppingCart },
  { value: 'ArrowUpDown', label: 'Elevador', Icon: ArrowUpDown },
  { value: 'ConciergeBell', label: 'Recepção', Icon: ConciergeBell },
  { value: 'Flame', label: 'Churrasqueira', Icon: Flame },
  { value: 'Gamepad2', label: 'Salão de Jogos', Icon: Gamepad2 },
  { value: 'PawPrint', label: 'Área Pet', Icon: PawPrint },
  { value: 'Blocks', label: 'Brinquedoteca', Icon: Blocks },
  { value: 'CarFront', label: 'Estacionamento', Icon: CarFront },
  { value: 'Clapperboard', label: 'Sala de Vídeo', Icon: Clapperboard },
];

const ICON_BY_VALUE = Object.fromEntries(AMBIENTE_ICON_OPTIONS.map((opt) => [opt.value, opt.Icon]));

// Fallback pro genérico sempre que o valor salvo for vazio ou não bater
// com nenhum ícone da paleta atual (ex: paleta mudou depois).
export function getAmbienteIcon(iconName) {
  return ICON_BY_VALUE[iconName] || DoorOpen;
}
