/** Dados fictícios para testar layout. NÃO são recomendações de cultivo nem registros reais. */
export type Area = 'Jardim' | 'Área protegida';
export type Plant = {
  id: string;
  name: string;
  scientific: string;
  area: Area;
  since: string;
  lastCare: string;
  note: string;
  emoji: string;
  tint: string;
};
export type CareLog = { id: string; plantId: string; kind: string; date: string; note: string };

export const plants: Plant[] = [
  { id: 'MB-001', name: 'Acer palmatum', scientific: 'Acer palmatum', area: 'Área protegida', since: '12/06/2025', lastCare: 'Inspeção · 06/11/2026', note: 'Acompanhar a resposta à mudança de estação.', emoji: '🍁', tint: 'peach' },
  { id: 'MB-002', name: 'Shimpaku Kishu', scientific: 'Juniperus chinensis (cultivar Kishu)', area: 'Jardim', since: '03/04/2025', lastCare: 'Limpeza · 03/11/2026', note: 'Observar o desenvolvimento da copa.', emoji: '🌲', tint: 'sage' },
  { id: 'MB-003', name: 'Azaleia rosa', scientific: 'Rhododendron sp.', area: 'Área protegida', since: '20/08/2025', lastCare: 'Observação · 31/10/2026', note: 'Registro demonstrativo de floração.', emoji: '🌺', tint: 'rose' },
  { id: 'MB-004', name: 'Jabuticabeira', scientific: 'Plinia sp.', area: 'Jardim', since: '15/02/2026', lastCare: 'Inspeção · 29/10/2026', note: 'Acompanhar a brotação.', emoji: '🌳', tint: 'mint' },
  { id: 'MB-005', name: 'Serissa chinesa', scientific: 'Serissa japonica', area: 'Área protegida', since: '09/09/2026', lastCare: 'Observação · 07/11/2026', note: 'Monitorar adaptação ao local.', emoji: '🌼', tint: 'sand' },
  { id: 'MB-006', name: 'Pitangueira', scientific: 'Eugenia uniflora', area: 'Jardim', since: '22/05/2025', lastCare: 'Poda · 01/11/2026', note: 'Acompanhar novas brotações.', emoji: '🌿', tint: 'sage' },
  { id: 'MB-007', name: 'Grewia — flor-de-lótus', scientific: 'Grewia occidentalis', area: 'Área protegida', since: '11/10/2026', lastCare: 'Inspeção · 05/11/2026', note: 'Exemplo de ficha de observações.', emoji: '🌸', tint: 'rose' },
  { id: 'MB-008', name: 'Acer palmatum II', scientific: 'Acer palmatum', area: 'Área protegida', since: '04/07/2026', lastCare: 'Observação · 08/11/2026', note: 'Segundo exemplar da mesma espécie.', emoji: '🍁', tint: 'peach' },
  { id: 'MB-009', name: 'Azaleia branca', scientific: 'Rhododendron sp.', area: 'Jardim', since: '13/03/2026', lastCare: 'Inspeção · 02/11/2026', note: 'Outro exemplar compartilhando uma ficha de espécie.', emoji: '🌼', tint: 'sand' },
];

export const careLogs: CareLog[] = [
  { id: 'LOG-001', plantId: 'MB-008', kind: 'Observação', date: '08/11/2026', note: 'Verificação geral do exemplar e registro de evolução.' },
  { id: 'LOG-002', plantId: 'MB-005', kind: 'Observação', date: '07/11/2026', note: 'Verificação de adaptação ao ambiente.' },
  { id: 'LOG-003', plantId: 'MB-001', kind: 'Inspeção', date: '06/11/2026', note: 'Avaliação visual das folhas.' },
  { id: 'LOG-004', plantId: 'MB-007', kind: 'Inspeção', date: '05/11/2026', note: 'Registro das condições do exemplar.' },
  { id: 'LOG-005', plantId: 'MB-002', kind: 'Limpeza', date: '03/11/2026', note: 'Retirada de resíduos acumulados.' },
];

export const uniqueSpecies = [...new Set(plants.map((p) => p.scientific))];
