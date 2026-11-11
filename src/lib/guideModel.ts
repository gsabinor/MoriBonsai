/** Modelo técnico idêntico ao importador de 40 campos do Mori Bonsai. Sem conteúdo botânico pré-preenchido. */
export const EVIDENCE = ['Não Confirmado', 'Evidência indireta', 'Confirmado para a espécie'] as const;
export type Evidence = typeof EVIDENCE[number];
export type GuideField = { numero: number; orientacao: string; condicoes: string; bh: string; evidencia: Evidence; fontes: string };
export type GuideDocument = {
  nomePopular: string;
  nomeCientifico: string;
  familia: string;
  contexto: string;
  campos: GuideField[];
};
export const MODULES = [
  { id: 1, name: 'Análise completa da espécie', start: 1, end: 8, description: 'Luz, ciclo foliar, poda, desfolha, aramação e transplante' },
  { id: 2, name: 'Rega em Belo Horizonte', start: 9, end: 13, description: 'Observação do substrato em diferentes condições climáticas, sem agenda fixa' },
  { id: 3, name: 'Formulação de substratos', start: 14, end: 18, description: 'Composição, drenagem e particularidades' },
  { id: 4, name: 'Guia nutricional', start: 19, end: 22, description: 'Adubação e contraindicações' },
  { id: 5, name: 'Calendário anual de Belo Horizonte', start: 23, end: 34, description: 'Orientações mensais condicionadas ao clima e à fenologia' },
  { id: 6, name: 'Técnicas avançadas', start: 35, end: 40, description: 'Casca, galhos, entrenós e peculiaridades' },
] as const;
export const FIELD_NAMES = [
  'Exposição solar','Ciclo foliar','Poda estrutural','Desfolha','Retração dos galhos','Aramação','Época de aramação','Transplante',
  'Até 20 °C','Entre 21 e 28 °C','Acima de 28 °C','Período chuvoso de BH','Período seco de BH',
  'Mistura-base','Drenagem e retenção','Substrato para pré-bonsai','Substrato para bonsai estabelecido','Particularidades do substrato',
  'Adubação orgânica','Adubação química','Épocas e intervalos','Cuidados e contraindicações',
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
  'Características da casca','Flexibilidade dos galhos','Redução de entrenós','Choque ambiental','Esfagno e cobertura','Outras peculiaridades',
] as const;

export function blankGuide(popular = '', scientific = '', family = '', context = ''): GuideDocument {
  return {
    nomePopular: popular, nomeCientifico: scientific, familia: family, contexto: context,
    campos: FIELD_NAMES.map((_, idx) => ({numero: idx + 1, orientacao:'',condicoes:'',bh:'',evidencia:'Não Confirmado' as Evidence,fontes:''})),
  };
}
export function filledCount(guide: GuideDocument): number { return guide.campos.filter(f => f.orientacao.trim()).length; }

export function validateGuide(input: unknown): GuideDocument {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('O JSON deve conter um objeto com a ficha técnica.');
  const obj = input as Record<string, unknown>;
  for (const key of ['nomePopular','nomeCientifico','familia','contexto']) {
    if (typeof obj[key] !== 'string') throw new Error(`O campo ${key} deve ser um texto.`);
    if ((obj[key] as string).length > 10000) throw new Error(`${key} excede o tamanho permitido.`);
  }
  if (!Array.isArray(obj.campos) || obj.campos.length !== 40) throw new Error('A ficha deve conter exatamente 40 campos numerados de 1 a 40.');
  const fields: GuideField[] = [];
  for (let i = 0; i < 40; i++) {
    const entry = obj.campos[i];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || entry.numero !== i+1) throw new Error(`Campo ${i+1}: numeração incorreta ou ausente.`);
    for (const key of ['orientacao','condicoes','bh','fontes']) {
      if (typeof entry[key] !== 'string') throw new Error(`Campo ${i+1}: ${key} deve ser um texto.`);
      if (entry[key].length > 15000) throw new Error(`Campo ${i+1}: ${key} muito longo.`);
    }
    if (!EVIDENCE.includes(entry.evidencia)) throw new Error(`Campo ${i+1}: evidência inválida.`);
    if (entry.evidencia !== 'Não Confirmado' && !entry.fontes.trim()) {
      throw new Error(`Campo ${i+1}: é obrigatório indicar fontes ao marcar evidência confirmada ou indireta.`);
    }
    fields.push({numero:i+1,orientacao:entry.orientacao,condicoes:entry.condicoes,bh:entry.bh,evidencia:entry.evidencia,fontes:entry.fontes});
  }
  const doc: GuideDocument = {
    nomePopular: obj.nomePopular as string, nomeCientifico: obj.nomeCientifico as string,
    familia: obj.familia as string, contexto: obj.contexto as string, campos: fields,
  };
  if (JSON.stringify(doc).length > 240000) throw new Error('A ficha excede o limite de armazenamento.');
  return doc;
}
