// Rótulo de "quem reportou" uma ocorrência — usado na aba Ocorrências
// dentro de AmbientePage, na página agregada OcorrenciasPage e na seção
// de pendentes da tela de execução do checklist, pra não triplicar a
// mesma lógica em três lugares.
export function reporterLabel(ocorrencia) {
  if (ocorrencia.reported_by_role === 'morador') {
    const parts = [ocorrencia.reporter_name, ocorrencia.reporter_unidade].filter((v) => v && v.trim());
    return parts.length ? `Morador: ${parts.join(' — ')}` : 'Morador';
  }
  if (ocorrencia.reported_by_role === 'colaborador') {
    return ocorrencia.reporter_name?.trim() ? `Colaborador: ${ocorrencia.reporter_name}` : 'Colaborador';
  }
  return null;
}
