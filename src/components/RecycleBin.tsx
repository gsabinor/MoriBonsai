import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowDown, CheckCircle2, History, LoaderCircle, RefreshCcw, RotateCcw, Sprout, CalendarClock, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './recycle-bin.css';

type Kind = 'plants' | 'care_logs' | 'care_plans';
type DeletedItem = {
  id: string;
  plant_id?: string;
  name?: string;
  title?: string;
  category?: string;
  deleted_at: string;
  planned_for?: string;
  occurred_on?: string;
  status?: string;
  source_plan_id?: string | null;
};
type LinkedPlan = { status: string; deleted_at: string | null };

const PAGE_SIZE = 30;
const tabs: { id: Kind; label: string; icon: typeof Sprout }[] = [
  { id: 'plants', label: 'Exemplares', icon: Sprout },
  { id: 'care_logs', label: 'Histórico de manejos', icon: History },
  { id: 'care_plans', label: 'Planejamentos', icon: CalendarClock },
];
const formatDateTime = (date: string) => new Date(date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const formatDate = (date?: string) => date ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR') : '—';
const messageOf = (err: unknown) => err instanceof Error ? err.message : String(err);

export default function RecycleBin({ collectionId, onRestoredPlant }: {
  collectionId: string;
  onRestoredPlant: () => Promise<void>;
}) {
  const [kind, setKind] = useState<Kind>('plants');
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [plantsInTrash, setPlantsInTrash] = useState<Record<string, boolean>>({});
  const [linkedPlans, setLinkedPlans] = useState<Record<string, LinkedPlan>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const serial = useRef(0);

  const load = useCallback(async (offset: number, append: boolean) => {
    if (!supabase) return;
    const ticket = ++serial.current;
    if (append) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      const selection = kind === 'plants'
        ? 'id,name,deleted_at'
        : kind === 'care_logs'
          ? 'id,plant_id,title,category,occurred_on,deleted_at,source_plan_id'
          : 'id,plant_id,title,category,planned_for,status,deleted_at';
      let query = supabase.from(kind)
        .select(selection, { count: 'exact' })
        .eq('collection_id', collectionId)
        .not('deleted_at', 'is', null);
      const request = query.order('deleted_at', { ascending: false }).order('id', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      const lookup = kind === 'plants' ? null : supabase.from('plants')
        .select('id,name,deleted_at').eq('collection_id', collectionId).limit(1000);
      const [result, lookupResult] = await Promise.all([
        request,
        lookup ?? Promise.resolve(null),
      ]);
      if (result.error) throw result.error;
      if (lookupResult?.error) throw lookupResult.error;
      if (ticket !== serial.current) return;
      const next = (result.data ?? []) as unknown as DeletedItem[];
      // A lixeira tambem mostra os manejos automaticos. Consultamos o estado
      // de seus planejamentos para explicar quando a restauracao e permitida.
      const sourceIds = [...new Set(next.map(item => item.source_plan_id).filter((id): id is string => Boolean(id)))];
      let pagePlans: Record<string, LinkedPlan> = {};
      if (sourceIds.length) {
        const planResult = await supabase.from('care_plans')
          .select('id,status,deleted_at')
          .eq('collection_id', collectionId).in('id', sourceIds);
        if (planResult.error) throw planResult.error;
        pagePlans = Object.fromEntries((planResult.data ?? []).map(plan => [plan.id, {
          status: plan.status, deleted_at: plan.deleted_at,
        }]));
      }
      if (ticket !== serial.current) return;
      setLinkedPlans(old => append ? { ...old, ...pagePlans } : pagePlans);
      if (lookupResult?.data) {
        setNames(Object.fromEntries(lookupResult.data.map(p => [p.id as string, p.name as string])));
        setPlantsInTrash(Object.fromEntries(lookupResult.data.map(p => [p.id as string, p.deleted_at !== null])));
      }
      setItems(old => append ? [...old, ...next] : next);
      const count = result.count ?? offset + next.length;
      setTotal(count);
      setHasMore(offset + next.length < count);
    } catch (err) {
      if (ticket === serial.current) setError(`Não foi possível consultar a lixeira: ${messageOf(err)}`);
    } finally {
      if (ticket === serial.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [collectionId, kind]);

  useEffect(() => {
    setItems([]); setNotice('');
    void load(0, false);
    return () => { serial.current++; };
  }, [load]);

  async function restore(item: DeletedItem) {
    if (!supabase || restoring) return;
    const label = item.name || item.title || 'este registro';
    const isAuto = kind === 'care_logs' && Boolean(item.source_plan_id);
    if (!window.confirm(`Restaurar "${label}"?\n\nO registro voltará às telas normais. Somente membros da coleção podem restaurar.${isAuto ? '\n\nEste manejo foi criado a partir de um planejamento concluído. O vínculo original será mantido.' : ''}`)) return;
    setError(''); setNotice(''); setRestoring(item.id);
    try {
      const { error: restoreError } = await supabase.rpc('mori_restore_trash', {
        _kind: kind, _record_id: item.id, _collection_id: collectionId,
      });
      if (restoreError) throw restoreError;
      if (kind === 'plants') await onRestoredPlant();
      setNotice(`"${label}" restaurado com sucesso.`);
      await load(0, false);
    } catch (err) {
      setError(`Não foi possível restaurar: ${messageOf(err)}. Se o exemplar correspondente estiver excluído, restaure-o primeiro.`);
    } finally { setRestoring(null); }
  }

  return <div className="page-enter trash-view">
    <div className="page-heading"><div><span className="eyebrow">RECUPERAÇÃO</span><h1>Lixeira</h1><p>Recupere exemplares, manejos e planejamentos excluídos logicamente.</p></div>
      <button type="button" className="button button-outline" disabled={loading || loadingMore || !!restoring} onClick={() => void load(0, false)}><RefreshCcw size={17}/> Atualizar</button>
    </div>
    <div className="trash-explainer"><Trash2 size={20}/><p>Os registros desta tela continuam armazenados no Supabase. Restaurar um exemplar também permite voltar a acessar suas fotos <strong>que não foram apagadas do Storage</strong>. Fotografias excluídas permanentemente da galeria não podem ser recuperadas por aqui. Não há exclusão definitiva nem prazo automático de limpeza nesta versão.</p></div>
    {error && <p className="live-message live-error" role="alert"><AlertCircle size={17}/>{error}</p>}
    {notice && <p className="live-message live-success" role="status"><CheckCircle2 size={17}/>{notice}</p>}
    <div className="trash-tabs" role="tablist" aria-label="Tipo de registro excluído">
      {tabs.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={kind === tab.id} className={`trash-tab ${kind === tab.id ? 'trash-tab-active' : ''}`} onClick={() => setKind(tab.id)}><tab.icon size={17}/>{tab.label}</button>)}
    </div>
    <section className="section-card trash-card" aria-label="Registros na lixeira">
      <div className="trash-card-header"><strong>{tabs.find(t => t.id === kind)?.label}</strong><small>{loading ? 'Carregando…' : `${total} registro(s) na lixeira`}</small></div>
      {loading && !items.length ? <div className="trash-status"><LoaderCircle className="spinning" size={21}/> Consultando registros...</div> :
       !items.length ? <div className="trash-status"><CheckCircle2 size={28}/><b>Nenhum registro excluído nesta categoria</b><span>Os registros movidos para a lixeira aparecerão aqui.</span></div> :
       <div className="trash-list">{items.map(item => {
         const isAuto = kind === 'care_logs' && Boolean(item.source_plan_id);
         const plan = item.source_plan_id ? linkedPlans[item.source_plan_id] : undefined;
         const plantIsDeleted = kind !== 'plants' && Boolean(plantsInTrash[item.plant_id ?? '']);
         const planDeleted = isAuto && Boolean(plan?.deleted_at);
         const planNotCompleted = isAuto && (!plan || plan.status !== 'completed');
         const cannotRestore = plantIsDeleted || planDeleted || planNotCompleted;
         const explanation = plantIsDeleted ? 'Restaure o exemplar primeiro.'
           : planDeleted ? 'Restaure o planejamento na aba Planejamentos; o histórico automático retornará junto.'
           : planNotCompleted ? 'Este manejo é controlado por um planejamento não concluído. Conclua o planejamento novamente para gerar seu histórico.'
           : isAuto ? 'Manejo automático: o planejamento vinculado está concluído e permite restauração.'
           : '';
         return <div key={item.id} className="trash-record">
          <div className="trash-record-info"><div className="trash-record-name">{item.name || item.title}</div>
            {isAuto && <span className="trash-origin-tag">Do planejamento</span>}
            {kind !== 'plants' && <span>Exemplar: {names[item.plant_id ?? ''] || `ID ${item.plant_id?.slice(0, 8) ?? 'desconhecido'}`}</span>}
            {item.category && <span>{item.category} · {kind === 'care_logs' ? `Realizado em ${formatDate(item.occurred_on)}` : `Previsto para ${formatDate(item.planned_for)}`}</span>}
            <span>Excluído em {formatDateTime(item.deleted_at)}</span>
            {explanation && <span className="trash-explanation">{explanation}</span>}
          </div>
          <button type="button" className="button button-outline trash-restore" disabled={!!restoring || loading || cannotRestore} onClick={() => void restore(item)}>{restoring === item.id ? <LoaderCircle className="spinning" size={16}/> : <RotateCcw size={16}/>} Restaurar</button>
        </div>;
       })}</div>}
      {hasMore && <div className="trash-more"><button className="button button-outline" disabled={loadingMore || !!restoring} onClick={() => void load(items.length, true)}>{loadingMore ? <LoaderCircle className="spinning" size={16}/> : <ArrowDown size={16}/>} Carregar mais</button></div>}
    </section>
    <p className="trash-footnote">Manejos criados automaticamente podem ser restaurados individualmente somente se o planejamento original estiver ativo e concluído. Se o planejamento foi excluído, restaure-o na aba Planejamentos; se foi reaberto, conclua-o novamente. Quando o exemplar estiver excluído, restaure o exemplar primeiro.</p>
  </div>;
}
