import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertCircle, Archive, Check, CheckCircle2, ExternalLink, Heart,
  Leaf, LoaderCircle, Pencil, Plus, RefreshCcw, RotateCcw, Search,
  ShoppingBasket, ShoppingCart, Sprout, Trash2, Wrench, X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import './wishlist.css';

type Category = 'species' | 'substrate' | 'item';
type Status = 'pending' | 'researching' | 'done';
type Priority = 'low' | 'medium' | 'high';
type WishItem = {
  id: string; collection_id: string; category: Category; title: string;
  scientific_name: string | null; priority: Priority; status: Status;
  quantity: number | null; unit: string | null; estimated_price: number | null;
  shop: string | null; item_url: string | null; notes: string | null;
  archived_at: string | null; completed_at: string | null; created_at: string;
};
type FormData = {
  title: string; scientific_name: string; priority: Priority; status: Status;
  quantity: string; unit: string; estimated_price: string; shop: string;
  item_url: string; notes: string;
};
type Editor = { category: Category; item: WishItem | null };
const CATEGORIES: Category[] = ['species', 'substrate', 'item'];
const CONFIG = {
  species: { title: 'Espécies desejadas', subtitle: 'Árvores que queremos cultivar um dia.', action: 'Adicionar espécie', Icon: Leaf, empty: 'Ainda não escolhemos nossa próxima espécie.' },
  substrate: { title: 'Compras de substratos', subtitle: 'Materiais para misturas e transplantes.', action: 'Adicionar material', Icon: ShoppingBasket, empty: 'Nenhum material nesta lista.' },
  item: { title: 'Ferramentas e itens salvos', subtitle: 'Links, vasos e acessórios para depois.', action: 'Salvar item', Icon: Wrench, empty: 'Nenhum item salvo por aqui.' },
};
const PRIORITY_LABEL: Record<Priority, string> = { high:'Alta', medium:'Média', low:'Baixa' };
const STATUS_LABEL: Record<Category, Record<Status,string>> = {
  species: { pending:'Desejada', researching:'Pesquisando', done:'Adquirida' },
  substrate: { pending:'Comprar', researching:'Pesquisando preços', done:'Comprado' },
  item: { pending:'Salvo para depois', researching:'Pesquisando', done:'Adquirido' },
};
const EMPTY_FORM: FormData = {
  title:'', scientific_name:'', priority:'medium', status:'pending', quantity:'', unit:'L',
  estimated_price:'', shop:'', item_url:'', notes:'',
};
const FIELDS = 'id,collection_id,category,title,scientific_name,priority,status,quantity,unit,estimated_price,shop,item_url,notes,archived_at,completed_at,created_at';
const money = (value: number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
const errText = (err: unknown) => err instanceof Error ? err.message : String(err);
function toForm(item: WishItem | null): FormData {
  return item ? {
    title:item.title, scientific_name:item.scientific_name ?? '', priority:item.priority, status:item.status,
    quantity:item.quantity == null ? '' : String(item.quantity).replace('.',','), unit:item.unit ?? 'L',
    estimated_price:item.estimated_price == null ? '' : String(item.estimated_price).replace('.',','),
    shop:item.shop ?? '', item_url:item.item_url ?? '', notes:item.notes ?? '',
  } : {...EMPTY_FORM};
}
function decimal(value:string):number|null {
  if(!value.trim()) return null;
  const normalized=value.trim().replace(',','.');
  const num=Number(normalized);
  if(!Number.isFinite(num) || num<0 || !/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) throw new Error('Use um número positivo com até duas casas decimais.');
  return num;
}
function validateLink(input:string):string|null {
  const text=input.trim();
  if(!text) return null;
  if(text.length>2048) throw new Error('O link ultrapassa 2.048 caracteres.');
  let url: URL;
  try { url=new URL(text); } catch { throw new Error('Informe um link completo, começando com https://'); }
  if(!['http:','https:'].includes(url.protocol)) throw new Error('O link precisa utilizar HTTP ou HTTPS.');
  return url.href;
}
function WishEditor({editor,onClose,onSave}:{editor:Editor;onClose:()=>void;onSave:(data:FormData,category:Category,id?:string)=>Promise<void>}){
  const [form,setForm]=useState<FormData>(()=>toForm(editor.item));
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  function update<K extends keyof FormData>(key:K,value:FormData[K]){setForm(old=>({...old,[key]:value}));}
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setSaving(true);setError('');
    try{await onSave(form,editor.category,editor.item?.id);onClose();}
    catch(err){setError(errText(err));}finally{setSaving(false);}
  }
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving) onClose();}}>
    <section className="live-modal wish-modal" role="dialog" aria-modal="true" aria-labelledby="wish-dialog-title">
      <button className="modal-close" aria-label="Fechar formulário" disabled={saving} onClick={onClose}><X size={20}/></button>
      <span className="eyebrow">PLANOS & DESEJOS · DUDA & GUI</span>
      <h2 id="wish-dialog-title">{editor.item?'Editar':'Adicionar'} · {CONFIG[editor.category].title}</h2>
      <p>As alterações serão compartilhadas entre as duas contas do Mori Bonsai.</p>
      <form className="wish-form" onSubmit={e=>void submit(e)}>
        <label>{editor.category==='species'?'Nome da espécie':editor.category==='substrate'?'Nome do material':'Nome do item'} *<input required maxLength={140} value={form.title} onChange={e=>update('title',e.target.value)} placeholder={editor.category==='species'?'Ex.: Acer palmatum':editor.category==='substrate'?'Ex.: Pedra-pomes':'Ex.: Alicate côncavo'}/></label>
        {editor.category==='species'&&<label>Nome científico (opcional)<input maxLength={160} value={form.scientific_name} onChange={e=>update('scientific_name',e.target.value)} placeholder="Ex.: Acer palmatum"/></label>}
        <div className="form-two">
          <label>Prioridade<select value={form.priority} onChange={e=>update('priority',e.target.value as Priority)}><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></select></label>
          {editor.item && <label>Situação<select value={form.status} onChange={e=>update('status',e.target.value as Status)}><option value="pending">{STATUS_LABEL[editor.category].pending}</option><option value="researching">{STATUS_LABEL[editor.category].researching}</option><option value="done">{STATUS_LABEL[editor.category].done}</option></select></label>}
          {editor.category!=='species'&&<label>Quantidade<input type="text" inputMode="decimal" maxLength={12} placeholder="Ex.: 3" value={form.quantity} onChange={e=>update('quantity',e.target.value)}/></label>}
          {editor.category==='substrate'&&<label>Unidade<input maxLength={30} value={form.unit} onChange={e=>update('unit',e.target.value)} placeholder="L, kg, saco..."/></label>}
          {editor.category!=='species'&&<label>Preço estimado (R$ / unidade)<input type="text" inputMode="decimal" maxLength={14} placeholder="Ex.: 29,90" value={form.estimated_price} onChange={e=>update('estimated_price',e.target.value)}/></label>}
        </div>
        <label>Loja / fornecedor (opcional)<input maxLength={120} value={form.shop} onChange={e=>update('shop',e.target.value)} placeholder="Ex.: viveiro, loja ou marketplace"/></label>
        <label>Link (opcional)<input type="url" maxLength={2048} value={form.item_url} onChange={e=>update('item_url',e.target.value)} placeholder="https://..."/></label>
        <label>Observações<textarea maxLength={3000} rows={3} value={form.notes} onChange={e=>update('notes',e.target.value)} placeholder="Por que queremos este item? Algo a pesquisar ou comparar?"/></label>
        {error&&<p className="live-message live-error" role="alert"><AlertCircle size={16}/>{error}</p>}
        <div className="live-actions"><button type="button" className="button button-outline" disabled={saving} onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary" disabled={saving||!form.title.trim()}>{saving?<LoaderCircle size={17} className="spinning"/>:<CheckCircle2 size={17}/>} {saving?'Salvando...':'Salvar'}</button></div>
      </form>
    </section>
  </div>;
}

export default function Wishlist({collectionId,onAddPlant}:{collectionId:string;onAddPlant:(name:string,scientificName:string)=>void}){
  const [items,setItems]=useState<WishItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [busyId,setBusyId]=useState<string|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [query,setQuery]=useState('');
  const [archived,setArchived]=useState(false);
  const [editor,setEditor]=useState<Editor|null>(null);
  const [limited,setLimited]=useState(false);
  const load=useCallback(async()=>{
    if(!supabase)return;
    setLoading(true);setError('');
    const {data,error:dbError}=await supabase.from('wishlist_items').select(FIELDS).eq('collection_id',collectionId).order('created_at',{ascending:false}).limit(500);
    if(dbError){setError(dbError.message.includes('schema cache')||dbError.message.includes('Could not find the table')?'As listas ainda não foram criadas no Supabase. Execute a migração 14_planos_desejos.sql.':dbError.message);}
    else{setItems((data??[]) as WishItem[]);setLimited((data??[]).length===500);}
    setLoading(false);
  },[collectionId]);
  useEffect(()=>{void load();},[load]);
  async function save(data:FormData,category:Category,id?:string){
    if(!supabase)throw new Error('Supabase indisponível.');
    if(!data.title.trim()||data.title.trim().length>140)throw new Error('Informe um nome com até 140 caracteres.');
    const quantity=category==='species'?null:decimal(data.quantity);
    if(quantity!==null && quantity<=0)throw new Error('A quantidade deve ser maior que zero.');
    const estimated_price=category==='species'?null:decimal(data.estimated_price);
    const payload={title:data.title.trim(),scientific_name:category==='species'?data.scientific_name.trim()||null:null,
      priority:data.priority,quantity,unit:category==='substrate'?data.unit.trim()||null:null,estimated_price,
      shop:data.shop.trim()||null,item_url:validateLink(data.item_url),notes:data.notes.trim()||null};
    const {error:dbError}=id
      ? await supabase.from('wishlist_items').update({...payload,status:data.status}).eq('id',id).eq('collection_id',collectionId)
      : await supabase.from('wishlist_items').insert({...payload,collection_id:collectionId,category,status:'pending'});
    if(dbError)throw new Error(dbError.message);
    setNotice(id?'Item atualizado.':'Item adicionado à lista compartilhada.');await load();
  }
  async function changeItem(item:WishItem,patch:Record<string,unknown>,success:string){
    if(!supabase)return;
    setBusyId(item.id);setError('');setNotice('');
    try{
      const {error:dbError}=await supabase.from('wishlist_items').update(patch).eq('id',item.id).eq('collection_id',collectionId);
      if(dbError)throw dbError;
      setNotice(success);await load();
    }catch(err){setError(errText(err));}finally{setBusyId(null);}
  }
  async function toggleArchive(item:WishItem){
    const restore=Boolean(item.archived_at);
    if(!restore&&!window.confirm(`Arquivar "${item.title}"?\n\nEle ficará na aba Arquivados e poderá ser recuperado depois.`))return;
    await changeItem(item,{archived_at:restore?null:new Date().toISOString()},restore?'Item recuperado.':'Item arquivado.');
  }
  const filtered=useMemo(()=>items.filter(x=>(Boolean(x.archived_at)===archived)&&[x.title,x.scientific_name,x.shop,x.notes].join(' ').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))),[items,archived,query]);
  const active=items.filter(x=>!x.archived_at);
  const totals=CATEGORIES.map(category=>({category,all:active.filter(x=>x.category===category).length,done:active.filter(x=>x.category===category&&x.status==='done').length}));
  return <div className="page-enter wish-page">
    <div className="wish-hero" style={{backgroundImage:`linear-gradient(97deg,rgba(12,48,33,.96),rgba(30,76,53,.8)),url(${import.meta.env.BASE_URL}assets/mori-forest-hero.webp)`}}><div><span className="eyebrow">NOSSA LISTA COMPARTILHADA</span><h1>Planos & desejos</h1><p>As árvores que queremos ter, os materiais que faltam e as ideias que vamos guardando juntos.</p></div><Heart size={72} strokeWidth={1} aria-hidden="true"/></div>
    <div className="wish-summary">{totals.map(({category,all,done})=>{const {Icon,title}=CONFIG[category];return <div className="wish-summary-tile" key={category}><Icon size={23}/><strong>{all}</strong><span>{title}</span><small>{done} {category==='species'?'adquirida(s)':'comprado(s)'}</small></div>;})}</div>
    <div className="wish-tools"><label className="search-input"><Search size={17}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar nas três listas..." aria-label="Pesquisar listas"/></label><div className="wish-tabs"><button type="button" className={!archived?'selected':''} onClick={()=>setArchived(false)}>Ativos</button><button type="button" className={archived?'selected':''} onClick={()=>setArchived(true)}><Archive size={15}/> Arquivados</button></div><button className="button button-outline" type="button" disabled={loading} onClick={()=>void load()}><RefreshCcw size={16} className={loading?'spinning':''}/> Atualizar</button></div>
    {error&&<p className="live-message live-error" role="alert"><AlertCircle size={17}/>{error}</p>}
    {notice&&<p className="live-message live-success" role="status"><CheckCircle2 size={17}/>{notice}<button className="message-close" onClick={()=>setNotice('')} aria-label="Fechar aviso"><X size={14}/></button></p>}
    {limited&&<p className="wish-hint">Esta tela mostra até 500 registros recentes. Arquive ou organize os mais antigos para manter a lista leve.</p>}
    <div className="wish-columns">{CATEGORIES.map(category=>{
      const config=CONFIG[category];const {Icon}=config;
      const progress=totals.find(item=>item.category===category);
      const entries=filtered.filter(item=>item.category===category).sort((a,b)=>{
        if(a.status==='done'&&b.status!=='done')return 1;
        if(b.status==='done'&&a.status!=='done')return -1;
        return ({high:0,medium:1,low:2}[a.priority]-{high:0,medium:1,low:2}[b.priority]);
      });
      return <section className="wish-column" key={category} aria-label={config.title}>
        <div className="wish-column-head"><div className="wish-column-heading"><Icon size={24}/><div><h2>{config.title}</h2><p>{config.subtitle}</p></div></div>{!archived&&<button className="wish-add" type="button" onClick={()=>setEditor({category,item:null})}><Plus size={16}/>{config.action}</button>}</div>
        <div className="wish-entries">{loading?<div className="wish-empty"><LoaderCircle className="spinning" size={22}/> Carregando...</div>:entries.length===0?<div className="wish-empty"><Sprout size={28}/><p>{query?'Nenhum item corresponde à pesquisa.':archived?'Nenhum item arquivado.':config.empty}</p>{!archived&&!query&&<button type="button" onClick={()=>setEditor({category,item:null})}>Adicionar primeiro item <Plus size={14}/></button>}</div>:entries.map(item=>
          <article key={item.id} className={`wish-item ${item.status==='done'?'wish-done':''}`}>
            <div className="wish-item-title"><div><h3>{item.title}</h3>{item.scientific_name&&<em>{item.scientific_name}</em>}</div><span className={`wish-priority wish-priority-${item.priority}`}>{PRIORITY_LABEL[item.priority]}</span></div>
            <div className="wish-detail-row"><span className={`wish-state ${item.status==='done'?'wish-state-done':''}`}>{item.status==='done'?<Check size={12}/>:null}{STATUS_LABEL[category][item.status]}</span>{item.quantity!=null&&<span>{new Intl.NumberFormat('pt-BR').format(item.quantity)} {item.unit??'un.'}</span>}{item.estimated_price!=null&&<span>{money(item.estimated_price)} / un.</span>}</div>
            {item.notes&&<p className="wish-item-note">{item.notes}</p>}
            {item.shop&&<small className="wish-shop">{item.shop}</small>}
            {item.item_url&&<a className="wish-item-link" href={item.item_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/> Abrir link salvo</a>}
            <div className="wish-actions">
              {!archived&&<><button title="Editar item" aria-label={`Editar ${item.title}`} disabled={busyId===item.id} onClick={()=>setEditor({category,item})}><Pencil size={15}/></button><button disabled={busyId===item.id} onClick={()=>void changeItem(item,{status:item.status==='done'?'pending':'done'},item.status==='done'?'Item voltou a ficar pendente.':'Item marcado como adquirido.')} title={item.status==='done'?'Reabrir':'Marcar adquirido'}><CheckCircle2 size={15}/> {item.status==='done'?'Reabrir':category==='species'?'Adquirida':'Comprado'}</button>
              {category==='species'&&item.status==='done'&&<button onClick={()=>onAddPlant(item.title,item.scientific_name??'')} title="Abrir cadastro de exemplar"><ShoppingCart size={15}/> Cadastrar exemplar</button>}</>}
              <button title={archived?'Recuperar item':'Arquivar item'} aria-label={`${archived?'Recuperar':'Arquivar'} ${item.title}`} disabled={busyId===item.id} onClick={()=>void toggleArchive(item)}>{archived?<RotateCcw size={15}/>:<Trash2 size={15}/>}</button>
            </div>
          </article>)}
        </div>
        {!archived&&<div className="wish-column-foot">
          <div className="wish-progress-copy"><span>Progresso da lista</span><strong>{progress?.done??0} de {progress?.all??0} {category==='species'?'adquiridas': 'concluídos'}</strong></div>
          <progress value={progress?.done??0} max={Math.max(progress?.all??0,1)} aria-label={`Progresso de ${config.title}`}/>
        </div>}
      </section>;
    })}</div>
    <p className="wish-hint"><Heart size={15}/> As listas são compartilhadas pelas duas contas. “Arquivar” não apaga o registro: você pode recuperá-lo na aba Arquivados. Links e valores são informados manualmente; não consultamos preços das lojas.</p>
    {editor&&<WishEditor key={editor.item?.id??editor.category} editor={editor} onClose={()=>setEditor(null)} onSave={save}/>}
  </div>;
}
