import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertCircle, BookOpenText, CheckCircle2, ChevronRight, FileJson, Leaf, LoaderCircle, Plus, RefreshCcw, Save, Search, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { blankGuide, EVIDENCE, FIELD_NAMES, filledCount, MODULES, validateGuide } from '../lib/guideModel';
import type { Evidence, GuideDocument, GuideField } from '../lib/guideModel';

type Species = { id:string; collection_id:string; popular_name:string; scientific_name:string|null; family:string|null; context:string|null; created_at:string };
type GuideRow = { id:string; species_id:string; collection_id:string; status:'draft'|'approved'; content:GuideDocument; created_at:string; approved_at:string|null; updated_at:string };
export type LibraryPlant = { id:string; name:string; scientific_name:string|null; species_id:string|null };
type Props = { collectionId:string; plants:LibraryPlant[]; onLinked:()=>Promise<void> };
const errorText = (error:unknown) => error instanceof Error ? error.message : String(error);
const dateText = (iso:string|null) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
const normalize = (text:string) => text.trim().toLocaleLowerCase('pt-BR');

export default function SpeciesLibrary({collectionId,plants,onLinked}:Props) {
  const [species,setSpecies] = useState<Species[]>([]);
  const [listLoading,setListLoading] = useState(true);
  const [selectedId,setSelectedId] = useState<string|null>(null);
  const [guides,setGuides] = useState<GuideRow[]>([]);
  const [guideLoading,setGuideLoading] = useState(false);
  const [showPublished,setShowPublished] = useState(false);
  const [selectedApprovedId,setSelectedApprovedId] = useState<string|null>(null);
  const [draftDoc,setDraftDoc] = useState<GuideDocument|null>(null);
  const [dirty,setDirty] = useState(false);
  const [moduleIndex,setModuleIndex] = useState(0);
  const [search,setSearch] = useState('');
  const [newOpen,setNewOpen] = useState(false);
  const [metaOpen,setMetaOpen] = useState(false);
  const [importOpen,setImportOpen] = useState(false);
  const [jsonInput,setJsonInput] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [meta,setMeta] = useState({popular_name:'',scientific_name:'',family:'',context:''});

  const selected = species.find(s=>s.id===selectedId) ?? null;
  const draft = guides.find(g=>g.status==='draft') ?? null;
  const latestPublished = guides.find(g=>g.status==='approved') ?? null;
  const published = guides.find(g=>g.status==='approved' && g.id===selectedApprovedId) ?? latestPublished;
  const currentGuide = showPublished || !draft ? published : draft;
  const displayDoc = currentGuide?.status==='draft' ? draftDoc : currentGuide?.content ?? null;
  const filtered = useMemo(()=>species.filter(s=>`${s.popular_name} ${s.scientific_name??''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))),[species,search]);

  const reloadSpecies = useCallback(async () => {
    if(!supabase) return;
    setListLoading(true);
    const {data,error:loadError} = await supabase.from('species').select('id,collection_id,popular_name,scientific_name,family,context,created_at')
      .eq('collection_id',collectionId).order('popular_name').limit(300);
    if(loadError) setError(`Não foi possível carregar a biblioteca: ${loadError.message}`);
    else setSpecies((data??[]) as Species[]);
    setListLoading(false);
  },[collectionId]);

  const reloadGuides = useCallback(async (id:string) => {
    if(!supabase) return;
    setGuideLoading(true);setError('');
    const {data,error:loadError} = await supabase.from('species_guides')
      .select('id,species_id,collection_id,status,content,created_at,updated_at,approved_at')
      .eq('species_id',id).eq('collection_id',collectionId).order('created_at',{ascending:false}).limit(40);
    if(loadError) setError(`Não foi possível carregar as fichas: ${loadError.message}`);
    else {
      const rows=(data??[]) as GuideRow[];
      rows.sort((a,b)=>a.status===b.status ? (b.approved_at??b.created_at).localeCompare(a.approved_at??a.created_at) : a.status==='draft'?-1:1);
      setGuides(rows);
      const draftRow=rows.find(g=>g.status==='draft');
      setDraftDoc(draftRow ? validateGuide(draftRow.content) : null);
      setDirty(false);setShowPublished(false);setSelectedApprovedId(null);
    }
    setGuideLoading(false);
  },[collectionId]);

  useEffect(()=>{void reloadSpecies();},[reloadSpecies]);
  useEffect(()=>{if(!selectedId){setGuides([]);setDraftDoc(null);return;}void reloadGuides(selectedId);},[selectedId,reloadGuides]);

  function chooseSpecies(id:string|null) {
    if(dirty && !window.confirm('Há alterações não salvas na ficha. Descartar e continuar?')) return;
    setSelectedId(id);setError('');setNotice('');setModuleIndex(0);setImportOpen(false);setMetaOpen(false);
  }
  function resetMeta(s?:Species) {
    setMeta({popular_name:s?.popular_name??'',scientific_name:s?.scientific_name??'',family:s?.family??'',context:s?.context??''});
  }
  async function saveSpecies(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(!supabase||!meta.popular_name.trim()||busy) return;
    setBusy(true);setError('');
    try {
      const payload={popular_name:meta.popular_name.trim(),scientific_name:meta.scientific_name.trim()||null,family:meta.family.trim()||null,context:meta.context.trim()||null};
      if(metaOpen && selected) {
        const {error:updateError}=await supabase.from('species').update(payload).eq('id',selected.id).eq('collection_id',collectionId);
        if(updateError) throw updateError;
        setMetaOpen(false);setNotice('Identificação da espécie atualizada. Fichas aprovadas permanecem imutáveis.');
      } else {
        const {data,error:insertError}=await supabase.from('species').insert({...payload,collection_id:collectionId})
          .select('id').single();
        if(insertError) throw insertError;
        setNewOpen(false);setSelectedId(data.id);setNotice('Espécie cadastrada. Crie o primeiro rascunho técnico.');
      }
      await reloadSpecies();
    } catch(e) { setError(errorText(e).includes('species_scientific_per_collection_idx')?'Este nome científico já está cadastrado na coleção.':errorText(e)); }
    finally {setBusy(false);}
  }
  async function createDraft() {
    if(!supabase||!selected||busy) return;
    setBusy(true);setError('');
    try {
      const content=latestPublished ? validateGuide(latestPublished.content) : blankGuide(selected.popular_name,selected.scientific_name??'',selected.family??'',selected.context??'');
      const {error:insertError}=await supabase.from('species_guides').insert({collection_id:collectionId,species_id:selected.id,content});
      if(insertError) throw insertError;
      await reloadGuides(selected.id);
      setNotice(latestPublished?'Novo rascunho criado a partir da última ficha aprovada.':'Rascunho vazio criado com os 40 campos.');
    } catch(e) {setError(errorText(e));}
    finally {setBusy(false);}
  }
  function changeField(number:number,key:keyof Omit<GuideField,'numero'>,value:string) {
    setDraftDoc(prev=>prev?{...prev,campos:prev.campos.map(f=>f.numero===number?{...f,[key]:value}:f)}:prev);
    setDirty(true);setNotice('');
  }
  function changeRoot(key:'nomePopular'|'nomeCientifico'|'familia'|'contexto',value:string) {
    setDraftDoc(prev=>prev?{...prev,[key]:value}:prev);setDirty(true);setNotice('');
  }
  async function saveDraft() {
    if(!supabase||!draft||!draftDoc||busy) return;
    setBusy(true);setError('');
    try {
      const payload=validateGuide(draftDoc);
      const {error:updateError}=await supabase.from('species_guides').update({content:payload})
        .eq('id',draft.id).eq('collection_id',collectionId).eq('status','draft');
      if(updateError) throw updateError;
      setGuides(old=>old.map(g=>g.id===draft.id?{...g,content:payload}:g));
      setDraftDoc(payload);setDirty(false);setNotice('Rascunho salvo no Supabase. Ainda não foi aprovado.');
    } catch(e) {setError(errorText(e));}
    finally {setBusy(false);}
  }
  async function approveDraft() {
    if(!supabase||!selected||!draft||!draftDoc||busy) return;
    if(dirty) {setError('Salve o rascunho antes de aprovar a ficha.');return;}
    if(!filledCount(draftDoc)){setError('Preencha pelo menos uma orientação para aprovar. Os demais campos podem permanecer Não Confirmado.');return;}
    if(!window.confirm('Aprovar esta versão da ficha técnica? Depois de aprovada, ela não poderá ser editada. Para alterações futuras será necessário criar uma nova revisão.')) return;
    setBusy(true);setError('');
    const {error:updateError}=await supabase.from('species_guides').update({status:'approved'}).eq('id',draft.id).eq('status','draft');
    if(updateError) setError(updateError.message);
    else {await reloadGuides(selected.id);setShowPublished(true);setNotice('Ficha técnica aprovada e preservada como versão imutável.');}
    setBusy(false);
  }
  async function importJson() {
    if(!draftDoc||!selected) return;
    try {
      const parsed=validateGuide(JSON.parse(jsonInput));
      if(selected.scientific_name && parsed.nomeCientifico && normalize(selected.scientific_name)!==normalize(parsed.nomeCientifico)) {
        throw new Error('O nome científico do JSON é diferente do cadastro selecionado. Confira a identificação antes de importar.');
      }
      if(!window.confirm(`Importar a ficha de ${parsed.nomePopular||'espécie sem nome'}? Os dados carregados substituirão os valores NÃO SALVOS no editor de rascunho.`)) return;
      setDraftDoc(parsed);setDirty(true);setImportOpen(false);setJsonInput('');setNotice('JSON validado. Revise a ficha e clique em Salvar rascunho; a importação ainda não foi gravada.');setError('');
    } catch(e) {setError(`Falha ao importar JSON: ${errorText(e)}`);}
  }
  async function linkPlant(plant:LibraryPlant) {
    if(!supabase||!selected||busy) return;
    const adding=plant.species_id!==selected.id;
    if(adding && plant.species_id && !window.confirm(`O exemplar "${plant.name}" já está vinculado a outra espécie. Substituir a associação manualmente?`)) return;
    setBusy(true);setError('');
    try {
      const {error:updateError}=await supabase.from('plants').update({species_id:adding?selected.id:null})
        .eq('id',plant.id).eq('collection_id',collectionId);
      if(updateError) throw updateError;
      await onLinked();
      setNotice(adding?`Exemplar "${plant.name}" vinculado à espécie.`:`Vínculo de "${plant.name}" removido.`);
    } catch(e) {setError(errorText(e));}
    finally {setBusy(false);}
  }

  const fieldStart=MODULES[moduleIndex].start;
  const fieldEnd=MODULES[moduleIndex].end;
  const moduleFields=displayDoc?.campos.slice(fieldStart-1,fieldEnd)??[];
  const isDraft = currentGuide?.status==='draft';
  return <div className="page-enter library-page">
    <div className="page-heading mori-interior-heading mori-library-heading"><div><span className="eyebrow">NOSSO CADERNO BOTÂNICO</span><h1>Biblioteca técnica</h1><p>Fichas por espécie, fontes e observações de cultivo. Tudo revisado por nós, no nosso tempo.</p><div className="mori-interior-metadata"><span><Leaf size={14}/> {species.length} espécie(s) cadastrada(s)</span><span><BookOpenText size={14}/> 6 módulos · 40 campos por ficha</span></div></div><button className="button button-primary" onClick={()=>{resetMeta();setNewOpen(true);setMetaOpen(false);}}><Plus size={17}/> Nova espécie</button></div>
    {error && <p className="live-message live-error" role="alert"><AlertCircle size={17}/>{error}<button className="message-close" onClick={()=>setError('')} aria-label="Dispensar erro"><X size={15}/></button></p>}
    {notice && <p className="live-message live-success" role="status"><CheckCircle2 size={17}/>{notice}<button className="message-close" onClick={()=>setNotice('')} aria-label="Dispensar aviso"><X size={15}/></button></p>}
    <div className="library-layout">
      <aside className="species-side">
        <div className="species-side-top"><h2>Espécies <span>{species.length}</span></h2><button type="button" className="icon-button" onClick={()=>void reloadSpecies()} title="Atualizar espécies"><RefreshCcw size={17}/></button></div>
        <label className="search-input species-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar espécie..." aria-label="Buscar espécies"/></label>
        {listLoading ? <p className="library-muted"><LoaderCircle size={16} className="spinning"/> Carregando...</p> : filtered.length ? <div className="species-items">
          {filtered.map(s=><button key={s.id} className={`species-choice ${selectedId===s.id?'species-choice-active':''}`} onClick={()=>chooseSpecies(s.id)}><span className="species-leaf"><Leaf size={19}/></span><span><strong>{s.popular_name}</strong><small>{s.scientific_name||'Identificação não confirmada'}</small></span><ChevronRight size={16}/></button>)}
        </div> : <div className="library-muted">{species.length?'Nenhum resultado para a busca.':'Nenhuma espécie cadastrada. Clique em “Nova espécie”.'}</div>}
      </aside>
      <section className="library-workspace">
        {!selected ? <div className="live-empty library-placeholder"><div><BookOpenText size={32}/></div><h3>Selecione uma espécie</h3><p>Cadastre uma espécie e crie um rascunho manual ou importe o JSON do modelo de 40 campos. Nada é preenchido automaticamente com recomendações de cultivo.</p></div> : <>
          <div className="library-species-heading"><div className="mori-species-identity"><span className="mori-species-seal" aria-hidden="true"><Leaf size={25}/></span><div><span className="eyebrow">FICHA POR ESPÉCIE</span><h2>{selected.popular_name}</h2><em>{selected.scientific_name||'Nome científico não confirmado'}</em><p>{selected.family ? `Família: ${selected.family}`:'Família não informada'}</p></div></div><button className="button button-outline" onClick={()=>{resetMeta(selected);setMetaOpen(true);setNewOpen(false);}} type="button">Editar identificação</button></div>
          {selected.context && <div className="library-context">{selected.context}</div>}
          <div className="library-linkbox"><div><ShieldCheck size={21}/><b>Vincular exemplares manualmente</b></div><p>Um único guia pode orientar diversos exemplares. O sistema não supõe equivalência botânica pelo nome popular.</p>
            {plants.length ? <div className="linked-list">{plants.map(p=><div key={p.id} className="linked-row"><span><strong>{p.name}</strong><small>{p.scientific_name||'Nome científico não informado'}</small></span><button type="button" className={`button ${p.species_id===selected.id?'button-outline':'button-primary'}`} disabled={busy} onClick={()=>void linkPlant(p)}>{p.species_id===selected.id?'Desvincular':'Vincular'}</button></div>)}</div> : <p className="library-muted">Cadastre um exemplar na coleção para poder vinculá-lo.</p>}
          </div>
          {guideLoading ? <p className="library-muted"><LoaderCircle size={17} className="spinning"/> Carregando versões...</p> : <>
            <div className="library-section-top"><div><h3>Ficha técnica</h3><p>{guides.length ? `${guides.filter(g=>g.status==='approved').length} versão(ões) aprovada(s) · ${draft?'1 rascunho em edição':'sem rascunho'}`:'Ainda não há ficha técnica desta espécie.'}</p></div>
              <div className="library-actions">{draft&&latestPublished && <button className="button button-outline" onClick={()=>{if(dirty&&!window.confirm('Alterações não salvas serão mantidas no editor, mas não aparecerão na versão publicada. Continuar?'))return;setShowPublished(v=>!v);}}>{showPublished?'Voltar ao rascunho':'Ver publicada'}</button>}
                {!draft && <button className="button button-primary" disabled={busy} onClick={()=>void createDraft()}><Plus size={15}/>{latestPublished?'Nova revisão':'Criar rascunho'}</button>}
              </div>
            </div>
            {!currentGuide||!displayDoc ? <div className="live-empty library-empty-guide"><div><BookOpenText size={28}/></div><h3>Sem ficha técnica</h3><p>Crie um rascunho com 40 campos em branco. Conteúdos sem fonte permanecerão “Não Confirmado”.</p></div> : <>
              {guides.filter(g=>g.status==='approved').length>1 && <label className="library-version-picker">Consultar versão aprovada
                <select value={selectedApprovedId??latestPublished?.id??''} onChange={e=>{if(dirty&&!window.confirm('Alterações não salvas continuarão no rascunho. Deseja alternar a versão publicada?'))return;setSelectedApprovedId(e.target.value);setShowPublished(true);}}>
                  {guides.filter(g=>g.status==='approved').map(g=><option key={g.id} value={g.id}>Aprovada em {dateText(g.approved_at)} · {g.id.slice(0,8)}</option>)}
                </select></label>}
              <div className="guide-status-row"><span className={`guide-status ${isDraft?'guide-draft':'guide-approved'}`}>{isDraft?'Rascunho — não aprovado':'Ficha aprovada'}</span><small>{isDraft?`Atualizado em ${dateText(currentGuide.updated_at)}`:`Aprovado em ${dateText(currentGuide.approved_at)}`}</small></div>
              <div className="mori-guide-progress" aria-label={`${filledCount(displayDoc)} de 40 campos com orientação`}><div className="mori-guide-progress-copy"><span>Campos com orientação</span><strong>{filledCount(displayDoc)} <small>/ 40</small></strong></div><div className="mori-guide-progress-track"><span style={{width:`${filledCount(displayDoc)/40*100}%`}}/></div></div>
              {isDraft && <div className="guide-actionbar"><button className="button button-outline" onClick={()=>setImportOpen(v=>!v)}><FileJson size={16}/> Importar JSON</button><button className="button button-outline" onClick={()=>void saveDraft()} disabled={busy||!dirty}><Save size={16}/> Salvar rascunho</button><button className="button button-primary" onClick={()=>void approveDraft()} disabled={busy||dirty||!filledCount(displayDoc)}><CheckCircle2 size={16}/> Aprovar versão</button></div>}
              {isDraft&&dirty&&<p className="library-unsaved" role="status">Existem alterações ainda não salvas no Supabase.</p>}
              {isDraft&&importOpen&&<div className="library-import"><h4>Importar ficha do modelo antigo</h4><p>Cole o JSON com 40 campos numerados. O conteúdo será validado localmente e só será enviado ao Supabase depois de clicar em Salvar rascunho.</p><textarea rows={6} placeholder='{"nomePopular":"...","nomeCientifico":"...","familia":"...","contexto":"...","campos":[...]}' value={jsonInput} onChange={e=>setJsonInput(e.target.value)}/><div className="live-actions"><button className="button button-outline" onClick={()=>setImportOpen(false)}>Cancelar</button><button className="button button-primary" disabled={!jsonInput.trim()} onClick={()=>void importJson()}>Validar e carregar JSON</button></div></div>}
              <div className="guide-metadata"><h4>Identificação na ficha técnica</h4><div className="guide-meta-grid">
                {(['nomePopular','nomeCientifico','familia'] as const).map((k)=><label key={k}>{k==='nomePopular'?'Nome popular':k==='nomeCientifico'?'Nome científico':'Família'}<input readOnly={!isDraft} maxLength={10000} value={displayDoc[k]} onChange={e=>changeRoot(k,e.target.value)}/></label>)}
              </div><label>Contexto botânico e de cultivo<textarea readOnly={!isDraft} rows={3} maxLength={10000} value={displayDoc.contexto} onChange={e=>changeRoot('contexto',e.target.value)}/></label></div>
              <div className="module-tabs" role="tablist" aria-label="Módulos da ficha técnica">{MODULES.map((m,i)=><button key={m.id} role="tab" aria-selected={moduleIndex===i} className={`module-tab ${moduleIndex===i?'module-tab-active':''}`} onClick={()=>setModuleIndex(i)}><b>{m.id}</b> {m.name}</button>)}</div>
              <div className="module-title"><h3>{MODULES[moduleIndex].name}</h3><p>{MODULES[moduleIndex].description} · Campos {fieldStart}–{fieldEnd}</p></div>
              <div className="guide-fields">{moduleFields.map(f=><div className="guide-field" key={f.numero}><div className="guide-field-title"><span>{String(f.numero).padStart(2,'0')}</span><h4>{FIELD_NAMES[f.numero-1]}</h4><span className={`evidence-chip ${f.evidencia==='Não Confirmado'?'evidence-unknown':'evidence-informed'}`}>{f.evidencia}</span></div>
                <div className="guide-field-grid"><label>Orientação<textarea rows={3} readOnly={!isDraft} maxLength={15000} value={f.orientacao} onChange={e=>changeField(f.numero,'orientacao',e.target.value)} placeholder={isDraft?'Não Confirmado — preencha somente se houver evidência.':''}/></label><label>Condições, riscos e exceções<textarea rows={3} readOnly={!isDraft} maxLength={15000} value={f.condicoes} onChange={e=>changeField(f.numero,'condicoes',e.target.value)}/></label><label>Adaptação para Belo Horizonte<textarea rows={3} readOnly={!isDraft} maxLength={15000} value={f.bh} onChange={e=>changeField(f.numero,'bh',e.target.value)}/></label><label>Fontes (uma por linha)<textarea rows={3} readOnly={!isDraft} maxLength={15000} value={f.fontes} onChange={e=>changeField(f.numero,'fontes',e.target.value)} placeholder={isDraft?'Título, instituição e link verificável — uma por linha':''}/></label><label className="guide-evidence-label">Grau de evidência<select disabled={!isDraft} value={f.evidencia} onChange={e=>changeField(f.numero,'evidencia',e.target.value as Evidence)}>{EVIDENCE.map(e=><option key={e} value={e}>{e}</option>)}</select></label></div>
              </div>)}</div>
              <div className="guide-footer">{isDraft ? 'Esta é uma ficha em rascunho. Dados não são publicados automaticamente.':'Esta é uma versão aprovada e imutável. Para revisá-la, crie um novo rascunho.'}</div>
            </>}
          </>}
        </>}
      </section>
    </div>
    {(newOpen||metaOpen)&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy){setNewOpen(false);setMetaOpen(false);}}}><section className="live-modal" role="dialog" aria-modal="true" aria-labelledby="species-modal-heading"><button type="button" className="modal-close" aria-label="Fechar" disabled={busy} onClick={()=>{setNewOpen(false);setMetaOpen(false);}}><X size={20}/></button><span className="eyebrow">BIBLIOTECA TÉCNICA</span><h2 id="species-modal-heading">{metaOpen?'Editar identificação':'Cadastrar espécie'}</h2><p>Cadastre a espécie de forma independente dos exemplares. Nenhuma identificação será inferida automaticamente.</p><form className="plant-form" onSubmit={saveSpecies}><label>Nome popular *<input required maxLength={160} value={meta.popular_name} onChange={e=>setMeta(m=>({...m,popular_name:e.target.value}))}/></label><label>Nome científico (se confirmado)<input maxLength={200} value={meta.scientific_name} onChange={e=>setMeta(m=>({...m,scientific_name:e.target.value}))}/></label><label>Família<input maxLength={160} value={meta.family} onChange={e=>setMeta(m=>({...m,family:e.target.value}))}/></label><label>Contexto e observações<textarea maxLength={10000} rows={3} value={meta.context} onChange={e=>setMeta(m=>({...m,context:e.target.value}))}/></label><div className="live-actions"><button type="button" className="button button-outline" disabled={busy} onClick={()=>{setNewOpen(false);setMetaOpen(false);}}>Cancelar</button><button className="button button-primary" type="submit" disabled={busy||!meta.popular_name.trim()}>{busy?<LoaderCircle size={17} className="spinning"/>:<CheckCircle2 size={17}/>} Salvar espécie</button></div></form></section></div>}
  </div>;
}
