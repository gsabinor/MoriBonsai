import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  AlertCircle, CalendarDays, CheckCircle2, ClipboardList, Clock3, Edit3, Filter,
  Flower2, LoaderCircle, Plus, RefreshCcw, Search, Trash2, X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadMoriMedia } from '../lib/mediaUpload';

type PlantOption = { id: string; name: string };
export type CareLog = {
  id: string;
  collection_id: string;
  plant_id: string;
  category: CareType;
  occurred_on: string;
  title: string;
  notes: string | null;
  outcome: Outcome;
  outcome_notes: string | null;
  created_at: string;
  source_plan_id: string | null;
};

type CareType = typeof CARE_TYPES[number];
type Outcome = 'yes' | 'no' | 'not_tested';
type CarePayload = Pick<CareLog, 'plant_id' | 'category' | 'occurred_on' | 'title' | 'notes' | 'outcome' | 'outcome_notes'>;

const CARE_TYPES = [
  'Poda estrutural', 'Poda de manutenção', 'Transplante', 'Poda radicular',
  'Aramação', 'Retirada de arame', 'Desfolha', 'Adubação',
  'Tratamento fitossanitário', 'Rega excepcional', 'Observação', 'Outro',
] as const;
const outcomeLabels: Record<Outcome, string> = {
  yes: 'Sim', no: 'Não', not_tested: 'Ainda não foi feito teste',
};
const PAGE_SIZE = 50;
const localToday = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const showDate = (v: string) => new Date(`${v}T12:00:00`).toLocaleDateString('pt-BR');
const toError = (err: unknown) => err instanceof Error ? err.message : String(err);

function CareEditor({
  current, plants, selectedPlantId, busy, save, close, collectionId, afterMediaUpload,
}: {
  current: CareLog | null;
  plants: PlantOption[];
  selectedPlantId: string;
  busy: boolean;
  save: (payload: CarePayload, id: string | null) => Promise<string>;
  collectionId: string;
  afterMediaUpload: () => Promise<void>;
  close: () => void;
}) {
  const [plantId, setPlantId] = useState(current?.plant_id ?? selectedPlantId ?? plants[0]?.id ?? '');
  const [category, setCategory] = useState<CareType>(current?.category ?? 'Poda de manutenção');
  const [date, setDate] = useState(current?.occurred_on ?? localToday());
  const [title, setTitle] = useState(current?.title ?? '');
  const [notes, setNotes] = useState(current?.notes ?? '');
  const [outcome, setOutcome] = useState<Outcome>(current?.outcome ?? 'not_tested');
  const [outcomeNotes, setOutcomeNotes] = useState(current?.outcome_notes ?? '');
  const [error, setError] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!plants.some(p => p.id === plantId)) { setError('Selecione um exemplar ativo da coleção.'); return; }
    if (date > localToday()) { setError('O histórico registra manejos realizados. A data não pode ser futura.'); return; }
    if (!title.trim()) { setError('Informe uma descrição curta do manejo.'); return; }
    try {
      const logId = await save({
        plant_id: plantId,
        category,
        occurred_on: date,
        title: title.trim(),
        notes: notes.trim() || null,
        outcome,
        outcome_notes: outcomeNotes.trim() || null,
      }, current?.id ?? null);
      if (mediaFile) {
        setUploading(true);
        try {
          await uploadMoriMedia({
            collectionId, plantId, file: mediaFile, careLogId: logId, onStage: setUploadStatus,
            capturedOn: date, caption: `${category} — ${title.trim()}${notes.trim() ? ` · ${notes.trim().slice(0,250)}` : ''}`.slice(0,500),
          });
          await afterMediaUpload();
        } catch (err) {
          // O histórico já foi salvo. Não repetir o cadastro do manejo.
          window.alert(`O manejo foi salvo, mas a mídia não foi anexada: ${toError(err)}. Você poderá enviá-la depois pela galeria.`);
        } finally { setUploading(false); setUploadStatus(''); }
      }
      close();
    } catch (e) { setError(toError(e)); }
  }

  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy && !uploading) close(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="care-editor-heading" className="live-modal care-modal">
      <button className="modal-close" aria-label="Fechar" onClick={close} disabled={busy || uploading}><X size={20}/></button>
      <span className="eyebrow">DIÁRIO DE CULTIVO</span>
      <h2 id="care-editor-heading">{current ? 'Editar manejo' : 'Registrar manejo'}</h2>
      <p>Registre uma intervenção que já ocorreu. As duas contas autorizadas poderão consultar e editar o histórico.</p>
      <form onSubmit={e => void submit(e)} className="plant-form">
        <label>Exemplar *
          <select required value={plantId} disabled={busy || Boolean(current)} onChange={e => setPlantId(e.target.value)}>
            <option value="">Selecione um exemplar</option>
            {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <div className="form-two">
          <label>Tipo de manejo *
            <select value={category} disabled={busy} onChange={e => setCategory(e.target.value as CareType)}>
              {CARE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>Data em que ocorreu *
            <input type="date" value={date} required max={localToday()} disabled={busy} onChange={e => setDate(e.target.value)}/>
          </label>
        </div>
        <label>Descrição resumida *
          <input value={title} required maxLength={140} disabled={busy} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Poda de formação dos galhos inferiores"/>
        </label>
        <label>Detalhes e condições
          <textarea rows={4} maxLength={5000} disabled={busy} value={notes} onChange={e => setNotes(e.target.value)} placeholder="O que foi feito? Ferramentas, produto utilizado, condições do exemplar e cuidados posteriores..."/>
        </label>
        <label>Deu certo?
          <select value={outcome} disabled={busy} onChange={e => setOutcome(e.target.value as Outcome)}>
            <option value="not_tested">Ainda não foi feito teste</option>
            <option value="yes">Sim</option>
            <option value="no">Não</option>
          </select>
        </label>
        <label>Resultado observado / aprendizados
          <textarea rows={3} maxLength={5000} disabled={busy} value={outcomeNotes} onChange={e => setOutcomeNotes(e.target.value)} placeholder="Evolução depois do manejo; riscos percebidos ou mudanças recomendadas..."/>
        </label>
        <label>Anexar foto ou vídeo ao manejo (opcional)
          <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" disabled={busy || uploading} onChange={(event: ChangeEvent<HTMLInputElement>) => setMediaFile(event.target.files?.[0] ?? null)}/>
          <small>A mídia será salva na galeria do exemplar e vinculada a este manejo. Fotos até 15 MB, vídeos MP4/WebM até 20 MB. O manejo é salvo primeiro.</small>
        </label>
        {uploadStatus && <div className="live-message" role="status">{uploadStatus}</div>}
        {error && <div className="live-message live-error" role="alert"><AlertCircle size={17}/><span>{error}</span></div>}
        <div className="live-actions">
          <button type="button" className="button button-outline" onClick={close} disabled={busy || uploading}>Cancelar</button>
          <button type="submit" className="button button-primary" disabled={busy || uploading || !plantId || !title.trim()}>
            {busy ? <LoaderCircle className="spinning" size={17}/> : <CheckCircle2 size={17}/>} {busy ? 'Salvando...' : 'Salvar manejo'}
          </button>
        </div>
      </form>
    </section>
  </div>;
}

export default function CareHistory({
  collectionId, plants, initialPlantId = '',
}: {
  collectionId: string;
  plants: PlantOption[];
  initialPlantId?: string;
}) {
  const [rows, setRows] = useState<CareLog[]>([]);
  const [mediaByLog, setMediaByLog] = useState<Record<string, {url: string; kind: 'image' | 'video'; caption: string | null}[]>>({});
  const [loading, setLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [plantFilter, setPlantFilter] = useState(initialPlantId);
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [editor, setEditor] = useState<CareLog | null | 'new'>(null);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const plantNames = useMemo(() => new Map(plants.map(p => [p.id, p.name])), [plants]);

  const fetchRows = useCallback(async (start: number, append: boolean) => {
    if (!supabase) return;
    if (append) setMoreLoading(true); else setLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await supabase.from('care_logs')
        .select('id,collection_id,plant_id,category,occurred_on,title,notes,outcome,outcome_notes,created_at,source_plan_id')
        .eq('collection_id', collectionId)
        .is('deleted_at', null)
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(start, start + PAGE_SIZE - 1);
      if (fetchError) throw fetchError;
      const next = (data ?? []) as CareLog[];
      setRows(prev => append ? [...prev, ...next] : next);
      setHasMore(next.length === PAGE_SIZE);
      if (next.length) {
        // Busca anexos em lote para evitar uma consulta por manejo.
        const ids = next.map(row => row.id);
        const {data: attachments, error: attachmentError} = await supabase.from('plant_photos')
          .select('care_log_id,storage_path,media_type,caption')
          .eq('collection_id',collectionId).in('care_log_id',ids).limit(200);
        if (!attachmentError && attachments?.length) {
          const paths = attachments.map(a => a.storage_path as string);
          const {data: signed, error: signError} = await supabase.storage.from('mori-photos').createSignedUrls(paths,900);
          if (!signError) {
            const updates: Record<string, {url:string;kind:'image'|'video';caption:string|null}[]> = {};
            attachments.forEach((row,i)=>{
              const url = signed?.[i]?.signedUrl;
              const careLogId = row.care_log_id as string | null;
              if (!careLogId || !url) return;
              (updates[careLogId] ??= []).push({url,kind:row.media_type === 'video' ? 'video' : 'image',caption:row.caption as string|null});
            });
            setMediaByLog(prev => append ? {...prev,...updates} : updates);
          }
        } else if (!append) setMediaByLog({});
      } else if (!append) setMediaByLog({});
    } catch (e) { setError(`Não foi possível consultar o histórico: ${toError(e)}`); }
    finally { setLoading(false); setMoreLoading(false); }
  }, [collectionId]);

  useEffect(() => { void fetchRows(0, false); }, [fetchRows]);

  const filtered = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR');
    return rows.filter(r =>
      (!plantFilter || r.plant_id === plantFilter) &&
      (categoryFilter === 'Todos' || r.category === categoryFilter) &&
      (!normalized || `${r.title} ${r.notes ?? ''} ${r.outcome_notes ?? ''} ${plantNames.get(r.plant_id) ?? ''}`.toLocaleLowerCase('pt-BR').includes(normalized))
    );
  }, [rows, search, plantFilter, categoryFilter, plantNames]);

  async function save(payload: CarePayload, id: string | null): Promise<string> {
    if (!supabase) throw new Error('Conexão Supabase indisponível.');
    setSaving(true);
    let savedId = id;
    try {
      if (id) {
        // O vínculo entre um registro existente e o exemplar não pode ser modificado.
        const editable = {
          category: payload.category,
          occurred_on: payload.occurred_on,
          title: payload.title,
          notes: payload.notes,
          outcome: payload.outcome,
          outcome_notes: payload.outcome_notes,
        };
        const { data, error: updateError } = await supabase.from('care_logs').update(editable)
          .eq('id', id).eq('collection_id', collectionId).is('deleted_at', null)
          .select('id').single();
        if (updateError) throw updateError;
        if (!data) throw new Error('Registro não encontrado ou sem permissão.');
      } else {
        const { data, error: insertError } = await supabase.from('care_logs')
          .insert({ ...payload, collection_id: collectionId })
          .select('id').single();
        if (insertError) throw insertError;
        if (!data) throw new Error('O Supabase não confirmou o registro do manejo.');
        savedId = data.id;
      }
      setNotice(id ? 'Manejo atualizado no Supabase.' : 'Manejo registrado no Supabase.');
      await fetchRows(0, false);
      if (!savedId) throw new Error('Identificador do manejo não encontrado.');
      return savedId;
    } finally { setSaving(false); }
  }

  async function remove(item: CareLog) {
    if (!supabase) return;
    if (!window.confirm(`Mover o manejo “${item.title}” para exclusão lógica?\n\nO registro será ocultado, mas não apagado fisicamente do banco.`)) return;
    setError(''); setNotice(''); setRemovingId(item.id);
    try {
      // Não solicitar SELECT após a exclusão lógica: a policy SELECT
      // oculta registros com deleted_at preenchido imediatamente.
      const { count, error: removeError } = await supabase.from('care_logs')
        .update({ deleted_at: new Date().toISOString() }, { count: 'exact' })
        .eq('id', item.id).eq('collection_id', collectionId).is('deleted_at', null);
      if (removeError) throw removeError;
      if (count !== 1) throw new Error('Nenhum registro foi alterado. Confirme suas permissões.');
      setNotice('Manejo removido da visualização. O registro permanece no banco.');
      await fetchRows(0, false);
    } catch (e) { setError(`Não foi possível excluir o manejo: ${toError(e)}`); }
    finally { setRemovingId(null); }
  }

  return <div className="page-enter mori-care-page">
    <div className="page-heading mori-interior-heading mori-care-heading">
      <div><span className="eyebrow">NOSSO DIÁRIO DE CULTIVO</span><h1>Histórico de manejos</h1>
        <p>O que fizemos em cada árvore — datas, cuidados e o que aprendemos com o tempo.</p></div>
      <button className="button button-primary" onClick={() => { setEditor('new'); setNotice(''); }} disabled={!plants.length}>
        <Plus size={17}/> Registrar manejo
      </button>
    </div>
    {!plants.length && <div className="live-message live-error"><AlertCircle size={18}/><span>Cadastre primeiro um exemplar em Minha coleção para começar o histórico.</span></div>}
    {error && <div className="live-message live-error" role="alert"><AlertCircle size={18}/><span>{error}</span><button className="message-close" aria-label="Fechar erro" onClick={() => setError('')}><X size={15}/></button></div>}
    {notice && <div className="live-message live-success" role="status"><CheckCircle2 size={18}/><span>{notice}</span><button className="message-close" aria-label="Fechar aviso" onClick={() => setNotice('')}><X size={15}/></button></div>}
    <div className="care-summary">
      <div><ClipboardList size={20}/><span>Registros carregados</span><strong>{rows.length}</strong></div>
      <div><CheckCircle2 size={20}/><span>Resultados positivos</span><strong>{rows.filter(r => r.outcome === 'yes').length}</strong></div>
      <div><Clock3 size={20}/><span>Ainda não avaliados</span><strong>{rows.filter(r => r.outcome === 'not_tested').length}</strong></div>
    </div>
    <div className="care-toolbar">
      <label className="search-input care-search"><Search size={18}/><input aria-label="Buscar manejos" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar manejo ou observações..."/></label>
      <label className="care-filter"><Filter size={16}/><select aria-label="Filtrar por exemplar" value={plantFilter} onChange={e => setPlantFilter(e.target.value)}><option value="">Todos os exemplares</option>{plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="care-filter"><Flower2 size={16}/><select aria-label="Filtrar por tipo" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option>Todos</option>{CARE_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
      <button className="button button-outline" disabled={loading || moreLoading} onClick={() => void fetchRows(0, false)} title="Atualizar histórico"><RefreshCcw size={17} className={loading ? 'spinning' : ''}/></button>
    </div>
    <p className="care-caption">Exibindo {filtered.length} dos {rows.length} registros carregados. Os filtros e a pesquisa atuam nos registros já carregados.{hasMore ? ' Use “Carregar mais” para incluir registros antigos.' : ''}</p>
    {loading && <div className="photo-wait"><LoaderCircle size={18} className="spinning"/> Consultando o Supabase...</div>}
    {!loading && filtered.length === 0 && <div className="live-empty"><div><CalendarDays size={34}/></div><h3>{rows.length ? 'Nenhum manejo corresponde aos filtros' : 'Nenhum manejo registrado'}</h3><p>{rows.length ? 'Tente outro termo, exemplar ou tipo de intervenção.' : 'Registre uma poda, transplante ou outra intervenção já realizada em um exemplar.'}</p></div>}
    {!loading && filtered.length > 0 && <div className="care-list">
      {filtered.map(log => <article className="care-item" key={log.id}>
        <div className="care-timeline-dot" aria-hidden="true"/>
        <div className="care-item-head"><div className="care-tagrow"><span className="care-type">{log.category}</span>{log.source_plan_id && <span className="care-type" title="Criado ao concluir um planejamento">Do planejamento</span>}<span className={`care-outcome care-outcome-${log.outcome}`}>{outcomeLabels[log.outcome]}</span></div><span className="care-date"><CalendarDays size={14}/>{showDate(log.occurred_on)}</span></div>
        <h3>{log.title}</h3>
        <p className="care-plant">🌿 {plantNames.get(log.plant_id) ?? 'Exemplar não disponível'}</p>
        {log.notes && <p className="care-description">{log.notes}</p>}
        {log.outcome_notes && <div className="care-result"><b>Resultado / aprendizado:</b> {log.outcome_notes}</div>}
        {mediaByLog[log.id]?.length ? <div className="mori-care-media" aria-label="Mídias deste manejo">{mediaByLog[log.id].map((media,index) => media.kind === 'video' ? <video key={index} controls preload="none" playsInline src={media.url} aria-label={`Vídeo do manejo ${log.title}`}/> : <a key={index} href={media.url} target="_blank" rel="noreferrer"><img src={media.url} loading="lazy" alt={media.caption || `Foto do manejo ${log.title}`}/></a>)}</div> : null} 
        <div className="care-item-actions">
          <button className="button button-outline" onClick={() => setEditor(log)}><Edit3 size={15}/> Editar</button>
          <button className="button live-danger" disabled={Boolean(removingId)} onClick={() => void remove(log)}>{removingId === log.id ? <LoaderCircle className="spinning" size={15}/> : <Trash2 size={15}/>} Excluir</button>
        </div>
      </article>)}
    </div>}
    {!loading && hasMore && <div className="care-more"><button className="button button-outline" disabled={moreLoading} onClick={() => void fetchRows(rows.length, true)}>{moreLoading ? <LoaderCircle size={16} className="spinning"/> : <Plus size={16}/>} {moreLoading ? 'Carregando...' : 'Carregar mais registros'}</button></div>}
    <p className="care-footnote">Este histórico documenta intervenções realizadas. Ele não programa regas automáticas nem substitui a avaliação das condições de cada planta.</p>
    {editor && <CareEditor key={editor === 'new' ? 'care-new' : editor.id} current={editor === 'new' ? null : editor} selectedPlantId={plantFilter || initialPlantId || plants[0]?.id || ''} plants={plants} busy={saving} save={save} collectionId={collectionId} afterMediaUpload={async()=>{await fetchRows(0,false);}} close={() => setEditor(null)} />}
  </div>;
}
