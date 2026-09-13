// Upload de foto (checklist, ocorrência) sempre vira uma string base64
// direto numa coluna de texto no banco — sem limite nenhum antes disso,
// dava pra anexar um vídeo, um ZIP, ou uma foto de 20 MB que trava o envio
// numa conexão de garagem/subsolo (o público-alvo mais comum dessas
// telas). `accept="image/*"` no <FileButton> é só uma dica pro seletor de
// arquivo do sistema operacional — quem escolhe "todos os arquivos" no
// diálogo passa direto por ela, então a validação de verdade precisa
// acontecer aqui.
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB — cobre foto de celular com folga, sem deixar passar vídeo/arquivo grande

export function validateImageFile(file) {
  if (!file.type.startsWith('image/')) {
    return 'Só é possível anexar arquivos de imagem.';
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'Essa imagem é muito grande (máximo 5 MB). Tente uma foto com menos resolução.';
  }
  return null;
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
