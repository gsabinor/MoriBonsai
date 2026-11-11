import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, BookOpenText, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  Clock3, Info, Leaf, LoaderCircle, RefreshCcw, ShieldCheck, Sprout, Trees,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FIELD_NAMES, validateGuide } from '../lib/guideModel';
import type { GuideDocument, GuideField } from '../lib/guideModel';

/** O calendário é consultivo: apenas lê fichas previamente aprovadas na Biblioteca.
 * Não cria tarefas, não sugere regas automáticas e não altera tabelas.
 */
export type CalendarPlant = { id: string; name: string; scientific_name: string | null; species_id: string | null };
type SpeciesRow = { id: string; popular_name: string; scientific_name: string | null };
type ApprovedGuideRow = { id: string; approved_at: string | null; content: GuideDocument };
type Props = {
  collectionId: string;
  plants: CalendarPlant[];
  initialPlantId?: string;
  onOpenLibrary: () => void;
};

const MONTH_NAMES = FIELD_NAMES.slice(22, 34);
const monthEvidenceLabel = (field: GuideField) => field.orientacao.trim()
  ? field.evidencia
  : 'Sem orientação';
const evidenceClass = (field: GuideField) => field.orientacao.trim() && field.evidencia !== 'Não Confirmado'
  ? 'calendar-evidence-supported'
  : 'calendar-evidence-pending';
const formatApproved = (value: string | null) => value
  ? new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  : 'data não registrada';

export default function CultivationCalendar({ collectionId, plants, initialPlantId, onOpenLibrary }: Props) {
  const [mode, setMode] = useState<'plant'|'species'>('plant');
  const [plantId, setPlantId] = useState(initialPlantId ?? '');
  const [speciesId, setSpeciesId] = useState('');
  const [monthIndex, setMonthIndex] = useState(() => new Date().getMonth());
  const [species, setSpecies] = useState<SpeciesRow[]>([]);
  const [loadingSpecies, setLoadingSpecies] = useState(true);
  const [loadingGuide, setLoadingGuide] = useState(false);
  const [guide, setGuide] = useState<ApprovedGuideRow | null>(null);
  const [speciesError, setSpeciesError] = useState('');
  const [guideError, setGuideError] = useState('');
  const [refreshIndex, setRefreshIndex] = useState(0);

  const linkedPlants = useMemo(() => plants.filter(p => p.species_id), [plants]);
  const selectedPlant = plants.find(p => p.id === plantId) ?? null;
  const effectivePlant = selectedPlant ?? (plants[0] ?? null);
  const effectivePlantId = effectivePlant?.id ?? '';
  const effectiveSpeciesId = mode === 'plant' ? (effectivePlant?.species_id ?? '') : (speciesId || species[0]?.id || '');
  const selectedSpecies = species.find(s => s.id === effectiveSpeciesId) ?? null;
  const speciesLinkedCount = plants.filter(p => p.species_id === effectiveSpeciesId).length;

  const reload = useCallback(() => setRefreshIndex(i => i + 1), []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;
    async function loadSpecies() {
      setLoadingSpecies(true);
      setSpeciesError('');
      try {
        const { data, error } = await client.from('species')
          .select('id,popular_name,scientific_name')
          .eq('collection_id', collectionId).order('popular_name').limit(300);
        if (error) throw error;
        if (!cancelled) setSpecies((data ?? []) as SpeciesRow[]);
      } catch (err) {
        if (!cancelled) { setSpecies([]); setSpeciesError(err instanceof Error ? err.message : String(err)); }
      } finally {
        if (!cancelled) setLoadingSpecies(false);
      }
    }
    void loadSpecies();
    return () => { cancelled = true; };
  }, [collectionId, refreshIndex]);

  // Busca SOMENTE a ficha aprovada mais recente da espécie selecionada.
  // Não carrega as fichas de todos os exemplares nem rascunhos em lote.
  useEffect(() => {
    if (!supabase || !effectiveSpeciesId) {
      setGuide(null);
      setGuideError('');
      setLoadingGuide(false);
      return;
    }
    const client = supabase;
    let cancelled = false;
    setGuide(null);
    setGuideError('');
    setLoadingGuide(true);
    async function loadGuide() {
      try {
        const { data, error } = await client.from('species_guides')
          .select('id,approved_at,content')
          .eq('collection_id', collectionId)
          .eq('species_id', effectiveSpeciesId)
          .eq('status', 'approved')
          .order('approved_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        const checked = data ? { ...(data as Omit<ApprovedGuideRow, 'content'>), content: validateGuide(data.content) } : null;
        if (!cancelled) setGuide(checked);
      } catch (err) {
        if (!cancelled) setGuideError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoadingGuide(false);
      }
    }
    void loadGuide();
    return () => { cancelled = true; };
  }, [collectionId, effectiveSpeciesId, refreshIndex]);

  const months = guide?.content.campos.slice(22, 34) ?? [];
  const selectedMonth = months[monthIndex] ?? null;
  const withGuidance = months.filter(f => f.orientacao.trim()).length;
  const withSources = months.filter(f => f.orientacao.trim() && f.evidencia !== 'Não Confirmado').length;

  return <div className="page-enter calendar-page">
    <div className="page-heading mori-interior-heading mori-calendar-heading">
      <div><span className="eyebrow">CULTIVO EM BELO HORIZONTE</span><h1>Calendário consultivo</h1>
        <p>O ano de cultivo, mês a mês, a partir das fichas técnicas que vocês aprovaram.</p>
        <div className="mori-interior-metadata"><span><CalendarDays size={15}/> 12 meses de referência</span><span><ShieldCheck size={15}/> Sem agenda automática de regas</span></div></div>
      <button className="button button-outline" type="button" onClick={reload} disabled={loadingSpecies || loadingGuide}>
        <RefreshCcw size={16} className={loadingSpecies || loadingGuide ? 'spinning' : ''}/> Atualizar
      </button>
    </div>
    <div className="calendar-safety"><ShieldCheck size={21}/><p><b>Referência técnica, não uma ordem de manejo.</b> Antes de intervir, avalie vigor, estágio da planta, substrato, clima e sinais fenológicos. Um campo “Não Confirmado” não deve ser tratado como recomendação.</p></div>
    <div className="calendar-toolbar">
      <div className="calendar-mode" role="group" aria-label="Forma de consulta">
        <button type="button" aria-pressed={mode==='plant'} className={mode==='plant'?'is-selected':''} onClick={()=>setMode('plant')}><Trees size={16}/> Por exemplar</button>
        <button type="button" aria-pressed={mode==='species'} className={mode==='species'?'is-selected':''} onClick={()=>setMode('species')}><Leaf size={16}/> Por espécie</button>
      </div>
      {mode === 'plant' ?
        <label className="calendar-select"><span>Exemplar</span><select aria-label="Selecionar exemplar" value={effectivePlantId} onChange={e=>setPlantId(e.target.value)} disabled={!plants.length}>
          {!plants.length && <option value="">Nenhum exemplar cadastrado</option>}
          {plants.map(p=><option key={p.id} value={p.id}>{p.name}{p.species_id ? '' : ' · espécie não vinculada'}</option>)}
        </select></label> :
        <label className="calendar-select"><span>Espécie</span><select aria-label="Selecionar espécie" value={effectiveSpeciesId} onChange={e=>setSpeciesId(e.target.value)} disabled={!species.length || loadingSpecies}>
          {!species.length && <option value="">Nenhuma espécie cadastrada</option>}
          {species.map(s=><option key={s.id} value={s.id}>{s.popular_name}{s.scientific_name ? ` · ${s.scientific_name}` : ''}</option>)}
        </select></label>}
    </div>
    {speciesError && <div className="live-message live-error" role="alert"><AlertCircle size={17}/><span>Falha ao carregar espécies: {speciesError}</span></div>}
    {guideError && <div className="live-message live-error" role="alert"><AlertCircle size={17}/><span>Falha ao carregar ficha aprovada: {guideError}</span></div>}
    {loadingSpecies || loadingGuide ? <div className="calendar-loading" role="status"><LoaderCircle className="spinning" size={24}/> Carregando ficha técnica...</div> :
    (!effectiveSpeciesId ? <div className="live-empty calendar-empty"><Sprout size={32}/><h3>{mode==='plant' && plants.length ? 'Exemplar sem espécie vinculada' : 'Ainda não há espécies para consultar'}</h3>
      <p>{mode==='plant' && plants.length ? 'Vincule manualmente este exemplar a uma espécie na Biblioteca técnica. Não utilizamos o nome popular para criar vínculos automaticamente.' : 'Cadastre uma espécie na Biblioteca técnica ou um exemplar na coleção para começar.'}</p>
      <button type="button" className="button button-primary" onClick={onOpenLibrary}><BookOpenText size={16}/> Abrir biblioteca técnica</button></div> :
      (!guide && !guideError ? <div className="live-empty calendar-empty"><BookOpenText size={32}/><h3>Esta espécie ainda não tem ficha aprovada</h3>
        <p>É necessário criar ou importar uma ficha de 40 campos e aprová-la manualmente. Rascunhos não aparecem no calendário.</p>
        <button type="button" className="button button-primary" onClick={onOpenLibrary}><BookOpenText size={16}/> Revisar na biblioteca</button></div> :
      guide ? <>
        <section className="calendar-guide-summary">
          <div className="calendar-guide-top"><div><span className="eyebrow">FICHA TÉCNICA APROVADA</span><h2>{selectedSpecies?.popular_name || guide.content.nomePopular || 'Espécie cadastrada'}</h2>
            <em>{selectedSpecies?.scientific_name || guide.content.nomeCientifico || 'Identificação científica não registrada'}</em>
          </div><div className="calendar-guide-metadata"><CheckCircle2 size={17}/> Revisada em {formatApproved(guide.approved_at)}<span>{speciesLinkedCount} {speciesLinkedCount===1?'exemplar associado':'exemplares associados'}</span></div></div>
          <div className="calendar-summary-stats">
            <div><span>Meses com orientação</span><strong>{withGuidance}<small> / 12</small></strong></div>
            <div><span>Meses com evidência referenciada</span><strong>{withSources}<small> / 12</small></strong></div>
            <div><span>Meses sem orientação</span><strong>{12 - withGuidance}<small> / 12</small></strong></div>
          </div>
        </section>
        <section className="calendar-month-section" aria-label="Meses do ano">
          <div className="calendar-section-heading"><div><span className="eyebrow">JANEIRO — DEZEMBRO</span><h2>Selecione um mês</h2></div>
            <div className="calendar-month-jump"><button type="button" aria-label="Mês anterior" onClick={()=>setMonthIndex(i=>(i+11)%12)}><ChevronLeft size={18}/></button><button type="button" className="calendar-today" onClick={()=>setMonthIndex(new Date().getMonth())}>Mês atual</button><button type="button" aria-label="Próximo mês" onClick={()=>setMonthIndex(i=>(i+1)%12)}><ChevronRight size={18}/></button></div></div>
          <div className="calendar-month-grid">
            {MONTH_NAMES.map((month,index)=>{
              const field = months[index];
              return <button key={month} type="button" className={`calendar-month ${monthIndex===index?'calendar-month-active':''}`}
                aria-pressed={monthIndex===index} onClick={()=>setMonthIndex(index)}>
                <span className="calendar-month-number">{String(index+1).padStart(2,'0')}</span>
                <strong>{month}</strong>
                <span className={`calendar-mini-status ${field && field.orientacao.trim() && field.evidencia!=='Não Confirmado'?'calendar-mini-ready':''}`}>
                  {field && field.orientacao.trim() ? (field.evidencia==='Não Confirmado'?'Não confirmado':'Orientação disponível') : 'Sem orientação'}
                </span>
              </button>;
            })}
          </div>
        </section>
        {selectedMonth && <section className="calendar-detail" aria-live="polite">
          <div className="calendar-detail-heading"><div><span className="eyebrow">MÊS SELECIONADO</span><h2><CalendarDays size={25}/>{MONTH_NAMES[monthIndex]}</h2></div>
            <span className={`calendar-evidence ${evidenceClass(selectedMonth)}`}>{monthEvidenceLabel(selectedMonth)}</span></div>
          {selectedMonth.orientacao.trim() ? <>
            <div className="calendar-detail-section"><h3><Leaf size={17}/> Orientação de cultivo</h3><p>{selectedMonth.orientacao}</p></div>
            {selectedMonth.condicoes.trim() && <div className="calendar-detail-section"><h3><AlertCircle size={17}/> Condições e contraindicações</h3><p>{selectedMonth.condicoes}</p></div>}
            {selectedMonth.bh.trim() && <div className="calendar-detail-section"><h3><Info size={17}/> Adaptação a Belo Horizonte</h3><p>{selectedMonth.bh}</p></div>}
            <div className="calendar-detail-section"><h3><BookOpenText size={17}/> Fontes da ficha</h3><p>{selectedMonth.fontes.trim() || 'Não foram registradas fontes para este campo.'}</p></div>
          </> : <div className="calendar-not-confirmed"><Info size={19}/><p>Não há orientação registrada para este mês na versão aprovada. Consulte a Biblioteca técnica para revisar o campo {monthIndex + 23}.</p></div>}
        </section>}
        <p className="calendar-footer-notice"><Clock3 size={16}/> O calendário apresenta a última ficha aprovada para uma espécie; orientações de rascunhos não são publicadas. Para ver alterações aprovadas por outra pessoa, clique em <b>Atualizar</b>. Não são criados agendamentos, notificações ou registros de manejo automaticamente.</p>
      </> : null))}
    {mode==='plant' && !!effectivePlant?.species_id && !loadingSpecies && !speciesError && !!guide && !selectedSpecies &&
      <p className="calendar-footnote">O vínculo do exemplar aponta para uma espécie que não apareceu na lista atual. Confira a Biblioteca técnica.</p>}
    {mode==='plant' && !plants.length && linkedPlants.length===0 && <p className="calendar-footnote"><Info size={15}/> A visualização por exemplar depende dos cadastros da coleção.</p>}
  </div>;
}
