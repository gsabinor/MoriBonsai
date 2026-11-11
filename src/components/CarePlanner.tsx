import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertCircle, CalendarClock, CheckCircle2, Clock3, Edit3, Filter,
  Leaf, LoaderCircle, Plus, RefreshCcw, RotateCcw, Search, Trash2, X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type PlantOption = { id: string; name: string };
type Status = 'pending' | 'completed' | 'cancelled';
type Category = typeof CATEGORIES[number];
type Plan = {
  id: string; collection_id: string; plant_id: string;
  category: Category; title: string; planned_for: string;
  notes: string | null; status: Status; completed_on: string | null;
  created_at: string;
};
type PlanInput = Pick<Plan, 'plant_id' | 'category' | 'title' | 'planned_for' | 'notes'>;

const CATEGORIES = [
  'Poda estrutural', 'Poda de manutenção', 'Transplante', 'Poda radicular',
  'Aramação', 'Retirada de arame', 'Desfolha', 'Adubação',
  'Tratamento fitossanitário', 'Observação', 'Outro',
] as const;
const STATUS_LABELS: Record<Status, string> = {
  pending: 'Pendente', completed: 'Concluído', cancelled: 'Cancelado',
};
const PAGE_SIZE = 30;
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const displayDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR');
const errorText = (e: unknown) => e instanceof Error ? e.message : String(e);

function PlannerEditor({
  current, plants, initialPlant, saving, onSave, onClose,
}: {
  current: Plan | null; plants: PlantOption[]; initialPlant: string;
  saving: boolean;
  onSave: (payload: PlanInput, id: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [plantId, setPlantId] = useState(current?.plant_id ?? initialPlant ?? plants[0]?.id ?? '');
  const [category, setCategory] = useState<Category>(current?.category ?? 'Poda de manutenção');
  const [plannedFor, setPlannedFor] = useState(current?.planned_for ?? localToday());
  const [title, setTitle] = useState(current?.title ?? '');
  const [notes, setNotes] = useState(current?.notes ?? '');
  const [error, setError] = useState('');

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError('');
    if (!plants.some(p => p.id === plantId)) { setError('Selecione um exemplar da coleção.'); return; }
    if (!plannedFor || !/^\d{4}-\d{2}-\d{2}$/.test(plannedFor)) { setError('Informe uma data válida.'); return; }
    if (!title.trim()) { setError('Informe o nome do manejo planejado.'); return; }
    try {
      await onSave({ plant_id: plantId, category, title: title.trim(), planned_for: plannedFor, notes: notes.trim() || null }, current?.id ?? null);
      onClose();
    } catch (e) { setError(errorText(e)); }
  };

  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="plan-editor-heading" className="live-modal planner-modal">
      <button className="modal-close" onClick={onClose} disabled={saving} aria-label="Fechar"><X size={20}/></button>
      <span className="eyebrow">PLANEJAMENTO MANUAL</span>
      <h2 id="plan-editor-heading">{current ? 'Editar planejamento' : 'Planejar manejo'}</h2>
      <p>Esta é uma anotação de uma atividade futura, não um registro de manejo realizado e não gera alertas automáticos.</p>
      <form className="plant-form" onSubmit={e => void submit(e)}>
        <label>Exemplar *
          <select value={plantId} required disabled={saving || Boolean(current)} onChange={e => setPlantId(e.target.value)}>
            <option value="">Selecione um exemplar</option>
            {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <div className="form-two">
          <label>Tipo de manejo *
            <select value={category} disabled={saving} onChange={e => setCategory(e.target.value as Category)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>Data prevista *
            <input type="date" value={plannedFor} required disabled={saving} onChange={e => setPlannedFor(e.target.value)}/>
          </label>
        </div>
        <label>Título do planejamento *
          <input value={title} required maxLength={140} disabled={saving} placeholder="Ex.: Verificar necessidade de transplante" onChange={e => setTitle(e.target.value)}/>
        </label>
        <label>Observações e condições
          <textarea rows={4} maxLength={5000} disabled={saving} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex.: Realizar apenas se a planta estiver vigorosa; conferir clima e desenvolvimento radicular."/>
        </label>
        {error && <div className="live-message live-error" role="alert"><AlertCircle size={17}/><span>{error}</span></div>}
        <div className="live-actions"><button className="button button-outline" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="button button-primary" type="submit" disabled={saving || !title.trim() || !plantId}>
            {saving ? <LoaderCircle className="spinning" size={17}/> : <CheckCircle2 size={17}/>} {saving ? 'Salvando...' : 'Salvar planejamento'}
          </button>
        </div>
      </form>
    </section>
  </div>;
}

export default function CarePlanner({
  collectionId, plants, initialPlantId = '',
}: {
  collectionId: string; plants: PlantOption[]; initialPlantId?: string;
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('pending');
  const [plantFilter, setPlantFilter] = useState(initialPlantId);
  const [searchText, setSearchText] = useState('');
  const [searched, setSearched] = useState('');
  const [editor, setEditor] = useState<Plan | 'new' | null>(null);
  const requestNumber = useRef(0);
  const plantNames = useMemo(() => new Map(plants.map(p => [p.id, p.name])), [plants]);
  const today = localToday();

  const load = useCallback(async (offset: number, append: boolean) => {
    if (!supabase) return;
    const request = ++requestNumber.current;
    if (append) setLoadingMore(true); else setBusy(true);
    setError('');
    try {
      let q = supabase.from('care_plans')
        .select('id,collection_id,plant_id,category,title,planned_for,notes,status,completed_on,created_at')
        .eq('collection_id', collectionId).is('deleted_at', null);
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      if (plantFilter) q = q.eq('plant_id', plantFilter);
      if (searched.trim()) q = q.ilike('title', `%${searched.trim().replace(/[%_\\]/g, '')}%`);
      const { data, error: fetchError } = await q.order('planned_for', { ascending: true })
        .order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
      if (fetchError) throw fetchError;
      if (request !== requestNumber.current) return;
      const next = (data ?? []) as Plan[];
      setPlans(prev => append ? [...prev, ...next] : next);
      setMore(next.length === PAGE_SIZE);
    } catch (e) {
      if (request === requestNumber.current) setError(`Erro ao consultar o planejamento: ${errorText(e)}`);
    } finally {
      if (request === requestNumber.current) { setBusy(false); setLoadingMore(false); }
    }
  }, [collectionId, plantFilter, statusFilter, searched]);

  useEffect(() => { void load(0, false); }, [load]);

  async function save(payload: PlanInput, id: string | null) {
    if (!supabase) throw new Error('Supabase indisponível.');
    setSaving(true);
    try {
      if (id) {
        const { data, error: updateError } = await supabase.from('care_plans')
          .update({ category: payload.category, title: payload.title, planned_for: payload.planned_for, notes: payload.notes })
          .eq('id', id).eq('collection_id', collectionId).is('deleted_at', null).select('id').single();
        if (updateError) throw updateError;
        if (!data) throw new Error('Planejamento não encontrado ou sem permissão.');
      } else {
        const { data, error: insertError } = await supabase.from('care_plans')
          .insert({ ...payload, collection_id: collectionId, status: 'pending' })
          .select('id').single();
        if (insertError) throw insertError;
        if (!data) throw new Error('O servidor não confirmou o planejamento.');
      }
      setNotice(id ? 'Planejamento atualizado.' : 'Planejamento salvo e compartilhado com os dois usuários.');
      await load(0, false);
    } finally { setSaving(false); }
  }

  async function changeStatus(plan: Plan, status: Status) {
    if (!supabase) return;
    if (status === 'completed' && !window.confirm(
      `Concluir “${plan.title}”?\n\nUm manejo será criado automaticamente no Histórico, com a data de hoje e resultado “Ainda não foi feito teste”. Você poderá editar a data e avaliar o resultado no Histórico.`
    )) return;
    if (status === 'pending' && plan.status === 'completed' && !window.confirm(
      `Reabrir “${plan.title}”?\n\nO manejo criado automaticamente no Histórico será ocultado (exclusão lógica), inclusive suas eventuais edições. Registros cadastrados manualmente não serão afetados.`
    )) return;
    setError(''); setNotice(''); setProcessing(plan.id);
    try {
      const { data, error: updateError } = await supabase.from('care_plans').update({
        status, completed_on: status === 'completed' ? localToday() : null,
      }).eq('id', plan.id).eq('collection_id', collectionId).is('deleted_at', null).select('id').single();
      if (updateError) throw updateError;
      if (!data) throw new Error('Nenhum planejamento foi atualizado. Confira as permissões.');
      setNotice(status === 'completed' ? 'Planejamento concluído e manejo registrado automaticamente no Histórico.' :
        status === 'cancelled' ? 'Planejamento cancelado (sem registro no Histórico).' :
        plan.status === 'completed' ? 'Planejamento reaberto. O registro automático foi ocultado do Histórico.' : 'Planejamento reaberto como pendente.');
      await load(0, false);
    } catch (e) { setError(`Erro ao alterar o status: ${errorText(e)}`); }
    finally { setProcessing(null); }
  }

  async function remove(plan: Plan) {
    if (!supabase) return;
    if (!window.confirm(`Excluir o planejamento “${plan.title}”?\n\nEle será ocultado, mas preservado no banco para futura recuperação.`)) return;
    setError(''); setNotice(''); setProcessing(plan.id);
    try {
      const { count, error: removeError } = await supabase.from('care_plans')
        .update({ deleted_at: new Date().toISOString() }, { count: 'exact' })
        .eq('id', plan.id).eq('collection_id', collectionId).is('deleted_at', null);
      if (removeError) throw removeError;
      if (count !== 1) throw new Error('Nenhum planejamento foi alterado.');
      setNotice('Planejamento removido da listagem (exclusão lógica).');
      await load(0, false);
    } catch (e) { setError(`Erro ao excluir: ${errorText(e)}`); }
    finally { setProcessing(null); }
  }

  return <div className="page-enter mori-planner-page">
    <div className="page-heading mori-interior-heading mori-planner-heading"><div><span className="eyebrow">NOSSOS PRÓXIMOS CUIDADOS</span><h1>Planejamento de manejos</h1>
      <p>Os próximos cuidados da nossa coleção, no tempo de cada árvore.</p><div className="mori-interior-metadata"><span><CalendarClock size={15}/> Planejamento compartilhado</span><span><Leaf size={15}/> Sem regas automáticas</span></div></div>
      <button className="button button-primary" disabled={!plants.length} onClick={() => { setEditor('new'); setNotice(''); }}><Plus size={17}/> Novo planejamento</button>
    </div>
    <div className="planner-advice"><Leaf size={20}/><span>Datas são referências pessoais. Antes de executar, confira as condições reais da planta, a ficha técnica e o clima. Ao concluir, um manejo é registrado automaticamente no Histórico (com resultado inicial “Ainda não foi feito teste”).</span></div>
    {error && <div className="live-message live-error" role="alert"><AlertCircle size={17}/><span>{error}</span><button className="message-close" onClick={() => setError('')} aria-label="Fechar erro"><X size={15}/></button></div>}
    {notice && <div className="live-message live-success" role="status"><CheckCircle2 size={17}/><span>{notice}</span><button className="message-close" onClick={() => setNotice('')} aria-label="Fechar aviso"><X size={15}/></button></div>}
    <div className="planner-filters">
      <label className="planner-filter"><Filter size={16}/><span>Status</span><select value={statusFilter} onChange={e => setStatusFilter(e.target.value as Status | 'all')}>
        <option value="pending">Pendentes</option><option value="completed">Concluídos</option><option value="cancelled">Cancelados</option><option value="all">Todos</option>
      </select></label>
      <label className="planner-filter"><span>Exemplar</span><select value={plantFilter} onChange={e => setPlantFilter(e.target.value)}>
        <option value="">Todos</option>{plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
      <form className="planner-search" onSubmit={e => { e.preventDefault(); setSearched(searchText); }}>
        <Search size={16}/><input aria-label="Buscar título de planejamento" value={searchText} placeholder="Buscar pelo título..." onChange={e => setSearchText(e.target.value)}/>
        <button className="button button-outline" type="submit">Buscar</button>
      </form>
      <button className="button button-outline planner-refresh" aria-label="Atualizar planejamentos" disabled={busy || loadingMore} onClick={() => void load(0, false)}><RefreshCcw size={17} className={busy ? 'spinning' : ''}/></button>
    </div>
    <div className="planner-summary"><CalendarClock size={17}/> Exibindo {plans.length} {statusFilter === 'pending' ? 'planejamentos pendentes' : 'planejamentos'}{more ? ' (há mais resultados)' : ''}. <span>Use os filtros para encontrar atividades específicas.</span></div>
    {busy ? <div className="photo-wait"><LoaderCircle className="spinning" size={20}/> Carregando planejamentos...</div> :
      plans.length === 0 ? <div className="live-empty planner-empty"><CalendarClock size={32}/><h3>Nenhum planejamento encontrado</h3><p>Crie um planejamento ou altere os filtros. Os registros já salvos no Supabase continuarão disponíveis.</p></div> :
      <div className="planner-list">{plans.map(plan => {
        const overdue = plan.status === 'pending' && plan.planned_for < today;
        const acting = processing === plan.id;
        return <article className="planner-item" key={plan.id}>
          <div className="planner-date"><CalendarClock size={17}/><strong>{displayDate(plan.planned_for)}</strong>{overdue && <span className="planner-overdue">Data ultrapassada</span>}</div>
          <div className="planner-main"><div className="planner-item-top"><span className={`planner-state planner-state-${plan.status}`}>{STATUS_LABELS[plan.status]}</span><span className="planner-category">{plan.category}</span></div>
            <h3>{plan.title}</h3><p className="planner-plant">{plantNames.get(plan.plant_id) ?? 'Exemplar não encontrado'}</p>
            {plan.notes && <p className="planner-notes">{plan.notes}</p>}
            {plan.completed_on && <p className="planner-completion"><CheckCircle2 size={14}/> Concluído em {displayDate(plan.completed_on)}</p>}
          </div>
          <div className="planner-actions">
            {plan.status === 'pending' ? <>
              <button className="button button-outline" disabled={acting} onClick={() => setEditor(plan)}><Edit3 size={15}/> Editar</button>
              <button className="button button-primary" disabled={acting} onClick={() => void changeStatus(plan, 'completed')}><CheckCircle2 size={15}/> Concluir</button>
              <button className="button button-outline" disabled={acting} onClick={() => void changeStatus(plan, 'cancelled')}><X size={15}/> Cancelar</button>
            </> : <button className="button button-outline" disabled={acting} onClick={() => void changeStatus(plan, 'pending')}><RotateCcw size={15}/> Reabrir</button>}
            <button className="button live-danger" disabled={acting} onClick={() => void remove(plan)}><Trash2 size={15}/> Excluir</button>
            {acting && <LoaderCircle size={16} className="spinning"/>}
          </div>
        </article>;
      })}</div>}
    {more && <div className="planner-load-more"><button className="button button-outline" disabled={busy || loadingMore} onClick={() => void load(plans.length, true)}>
      {loadingMore ? <LoaderCircle className="spinning" size={16}/> : <Clock3 size={16}/>} {loadingMore ? 'Carregando...' : 'Carregar mais planejamentos'}
    </button></div>}
    {editor && <PlannerEditor key={editor === 'new' ? 'new' : editor.id} current={editor === 'new' ? null : editor}
      plants={plants} initialPlant={plantFilter || plants[0]?.id || ''} saving={saving} onSave={save} onClose={() => setEditor(null)}/>}
  </div>;
}
