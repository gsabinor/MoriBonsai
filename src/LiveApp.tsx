import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  AlertCircle, BookOpenText, CalendarDays, CalendarClock, Camera, CheckCircle2, ChevronRight,
  Flower2, Heart, History, LayoutDashboard, LoaderCircle,
  LockKeyhole, LogOut, MapPin, Menu, Pencil, Plus, RefreshCcw, Search,
  Settings2, ShieldCheck, Trash2, Trees, X,
} from 'lucide-react';
import MoriDashboard from './components/MoriDashboard';
import { usePlantCovers } from './components/usePlantCovers';
import { supabase } from './lib/supabase';

// Cada módulo é carregado somente quando o usuário abre sua tela.
const PhotoGallery = lazy(() => import('./components/PhotoGallery'));
const SpeciesLibrary = lazy(() => import('./components/SpeciesLibrary'));
const CareHistory = lazy(() => import('./components/CareHistory'));
const CultivationCalendar = lazy(() => import('./components/CultivationCalendar'));
const CarePlanner = lazy(() => import('./components/CarePlanner'));
const RecycleBin = lazy(() => import('./components/RecycleBin'));
const Wishlist = lazy(() => import('./components/Wishlist'));
const BackupCenter = lazy(() => import('./components/BackupCenter'));
function ModuleLoading() {
  return <div className="photo-wait" role="status"><LoaderCircle className="spinning" size={21}/> Abrindo módulo...</div>;
}

function SharedCoupleAvatar({ email }: { email?: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  return <div className="avatar mori-shared-avatar" title={email || 'Mori Bonsai'}>
    {imageFailed
      ? <span>{(email?.slice(0, 2) || 'MB').toUpperCase()}</span>
      : <img
          src={`${import.meta.env.BASE_URL}assets/avatar-duda-gui.webp`}
          alt="Duda e Gui"
          width={44}
          height={44}
          onError={() => setImageFailed(true)}
        />}
  </div>;
}


type Page = 'dashboard' | 'collection' | 'library' | 'history' | 'calendar' | 'planner' | 'wishlist' | 'trash' | 'settings';
type CollectionRow = { id: string; name: string };
type PlantRow = {
  id: string;
  collection_id: string;
  name: string;
  scientific_name: string | null;
  species_id: string | null;
  area: 'Jardim' | 'Área protegida';
  acquired_on: string | null;
  notes: string | null;
  created_at: string;
};
type PlantInput = Pick<PlantRow, 'name' | 'scientific_name' | 'area' | 'acquired_on' | 'notes'>;
const links: { id: Page; title: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', title: 'Visão geral', icon: LayoutDashboard },
  { id: 'collection', title: 'Minha coleção', icon: Trees },
  { id: 'library', title: 'Biblioteca técnica', icon: BookOpenText },
  { id: 'history', title: 'Histórico de manejos', icon: History },
  { id: 'calendar', title: 'Calendário consultivo', icon: CalendarDays },
  { id: 'planner', title: 'Planejamento manual', icon: CalendarClock },
  { id: 'wishlist', title: 'Planos & desejos', icon: Heart },
  { id: 'trash', title: 'Lixeira', icon: Trash2 },
];
const heading: Record<Page, string> = {
  dashboard: 'Visão geral', collection: 'Minha coleção', library: 'Biblioteca técnica',
  history: 'Histórico de manejos', calendar: 'Calendário consultivo', planner: 'Planejamento manual', wishlist: 'Planos & desejos', trash: 'Lixeira', settings: 'Configurações',
};
const formatDate = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Não informado';
const formatError = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('Invalid login credentials')) return 'E-mail ou senha inválidos.';
  if (raw.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (raw.includes('Failed to fetch')) return 'Falha de conexão. Verifique a internet e o endereço do Supabase.';
  if (raw.includes('Could not find the table')) return 'Tabelas não encontradas. Execute o SQL de configuração do projeto.';
  return raw;
};

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSubmitting(true); setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) setError(formatError(authError));
    setSubmitting(false);
  }
  return <div className="auth-screen mori-auth-screen">
    <div className="auth-promo mori-auth-promo" style={{ backgroundImage: `linear-gradient(90deg,rgba(9,34,25,.8),rgba(9,34,25,.25)),url(${import.meta.env.BASE_URL}assets/mori-forest-hero.webp)` }}>
      <div className="brand auth-brand mori-auth-brand"><img className="brand-dragon" src={`${import.meta.env.BASE_URL}assets/mori-dragon-logo.webp`} alt="Símbolo de dragão e bonsai do Mori Bonsai"/><div><strong>MORI BONSAI</strong><small>森 · Nossa pequena floresta</small></div></div>
      <div className="auth-promo-body"><span className="eyebrow">DUDA & GUI</span><h1>Nossa pequena<br/><em>floresta.</em></h1><p>Um lugar só nosso para acompanhar cada bonsai, registrar os cuidados e guardar as lembranças da coleção.</p></div>
      <p className="mori-auth-signature">Feito com carinho por Duda & Gui ♡</p>
    </div>
    <div className="auth-card-wrap"><form className="auth-card" onSubmit={submit}>
      <div className="auth-icon"><LockKeyhole size={23}/></div><span className="eyebrow">NOSSO ESPAÇO</span><h2>Bem-vindos de volta</h2><p>Entre para acessar nossa coleção compartilhada.</p>
      <label>E-mail<input type="email" required autoComplete="username" placeholder="seu@email.com" value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label>Senha<input type="password" required autoComplete="current-password" placeholder="Sua senha" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      {error && <p className="live-message live-error" role="alert"><AlertCircle size={16}/>{error}</p>}
      <button className="button button-primary live-wide" type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="spinning" size={17}/> : <LockKeyhole size={17}/>} {submitting ? 'Entrando...' : 'Entrar'}</button>
      <div className="login-hint"><ShieldCheck size={16}/> Acesso privado para as contas autorizadas.</div>
    </form></div>
  </div>;
}

function PlantEditor({ plant, prefill, onClose, onSave }: { plant: PlantRow | null; prefill?: { name:string; scientificName:string }; onClose: () => void; onSave: (payload: PlantInput, id?: string) => Promise<void> }) {
  const [name, setName] = useState(plant?.name ?? prefill?.name ?? '');
  const [scientific, setScientific] = useState(plant?.scientific_name ?? prefill?.scientificName ?? '');
  const [area, setArea] = useState<'Jardim' | 'Área protegida'>(plant?.area ?? 'Jardim');
  const [date, setDate] = useState(plant?.acquired_on ?? '');
  const [notes, setNotes] = useState(plant?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError('');
    try { await onSave({ name: name.trim(), scientific_name: scientific.trim() || null, area, acquired_on: date || null, notes: notes.trim() || null }, plant?.id); onClose(); }
    catch (err) { setError(formatError(err)); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" onMouseDown={e => { if(e.target===e.currentTarget && !saving) onClose(); }}>
    <section className="live-modal" role="dialog" aria-modal="true" aria-labelledby="editor-heading">
      <button className="modal-close" type="button" disabled={saving} onClick={onClose} aria-label="Fechar"><X size={20}/></button>
      <span className="eyebrow">MINHA COLEÇÃO</span><h2 id="editor-heading">{plant ? 'Editar exemplar' : 'Novo exemplar'}</h2><p>As informações serão compartilhadas com os usuários autorizados da coleção.</p>
      <form onSubmit={submit} className="plant-form">
        <label>Nome do exemplar *<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Jabuticabeira 01"/></label>
        <label>Nome científico<input maxLength={160} value={scientific} onChange={e => setScientific(e.target.value)} placeholder="Ex.: Plinia sp."/></label>
        <div className="form-two"><label>Ambiente<select value={area} onChange={e => setArea(e.target.value as PlantInput['area'])}><option>Jardim</option><option>Área protegida</option></select></label><label>Data de aquisição<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label></div>
        <label>Observações<textarea maxLength={5000} rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Informações específicas do exemplar..."/></label>
        {error && <p className="live-message live-error" role="alert"><AlertCircle size={16}/>{error}</p>}
        <div className="live-actions"><button type="button" className="button button-outline" onClick={onClose} disabled={saving}>Cancelar</button><button className="button button-primary" disabled={saving || !name.trim()} type="submit">{saving ? <LoaderCircle className="spinning" size={17}/> : <CheckCircle2 size={17}/>} {saving ? 'Salvando...' : 'Salvar exemplar'}</button></div>
      </form>
    </section>
  </div>;
}

function PlantTile({ plant, coverUrl, onEdit, onDelete, onPhotos, onCare, onCalendar, onPlan }: { plant: PlantRow; coverUrl?: string; onEdit: () => void; onDelete: () => void; onPhotos: () => void; onCare: () => void; onCalendar: () => void; onPlan: () => void }) {
  return <article className="live-plant-tile">
    <div className="live-tile-art">{coverUrl ? <img className="live-cover-image" src={coverUrl} alt={`Foto de capa de ${plant.name}`} loading="lazy" decoding="async"/> : <span className="mori-cover-placeholder" aria-label="Exemplar sem foto de capa"><Trees size={52} strokeWidth={1.2}/><small>Sem foto de capa</small></span>}</div>
    <div className="live-tile-content"><small className="live-plant-code">MB-{plant.id.slice(0, 6).toUpperCase()}</small><h3>{plant.name}</h3><i>{plant.scientific_name || 'Identificação pendente'}</i>{plant.species_id && <div className="live-species-tag"><BookOpenText size={13}/> Ficha técnica vinculada</div>}<p><MapPin size={14}/>{plant.area}</p><p><CalendarDays size={14}/>Aquisição: {formatDate(plant.acquired_on)}</p>
      {plant.notes && <div className="live-note">{plant.notes}</div>}
      <div className="tile-actions"><button className="button photo-open" onClick={onPhotos}><Camera size={15}/> Fotos</button><button className="button button-outline care-tile-button" onClick={onCare}><History size={15}/> Manejos</button><button className="button button-outline" onClick={onCalendar}><CalendarDays size={15}/> Calendário</button><button className="button button-outline" onClick={onPlan}><CalendarClock size={15}/> Planejar</button><button className="button button-outline" onClick={onEdit}><Pencil size={15}/> Editar</button><button className="button live-danger" onClick={onDelete}><Trash2 size={15}/> Excluir</button></div>
    </div>
  </article>;
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return <div className="live-empty"><div><Flower2 size={34}/></div><h3>{title}</h3><p>{body}</p></div>;
}

export default function LiveApp() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [collection, setCollection] = useState<CollectionRow | null>(null);
  const [plants, setPlants] = useState<PlantRow[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState<Page>('dashboard');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [query, setQuery] = useState('');
  const [areaFilter, setAreaFilter] = useState('Todos');
  const [editor, setEditor] = useState<{plant: PlantRow | null; prefill?: {name:string;scientificName:string}} | null>(null);
  const [galleryPlant, setGalleryPlant] = useState<PlantRow | null>(null);
  const [coverRevision, setCoverRevision] = useState(0);
  const { urls: coverUrls, loading: coversLoading, error: coverError } = usePlantCovers(collection?.id, page === 'collection' || page === 'dashboard', coverRevision);
  const [historyPlantId, setHistoryPlantId] = useState<string | null>(null);
  const [calendarPlantId, setCalendarPlantId] = useState<string | null>(null);
  const [plannerPlantId, setPlannerPlantId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setChecking(false);
    });
    void supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!mounted) return;
      if (authError) { setUser(null); setError(formatError(authError)); }
      else setUser(data.user);
      setChecking(false);
    }).catch((err: unknown) => { if (mounted) { setUser(null); setError(formatError(err)); setChecking(false); } });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const reload = useCallback(async (collectionId: string) => {
    if (!supabase) return;
    setFetching(true); setError('');
    const { data, error: fetchError } = await supabase.from('plants')
      .select('id, collection_id, name, scientific_name, species_id, area, acquired_on, notes, created_at')
      .eq('collection_id', collectionId).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(250);
    if (fetchError) setError(formatError(fetchError));
    else setPlants((data ?? []) as PlantRow[]);
    setFetching(false);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    if (!user) { setCollection(null); setPlants([]); return; }
    let cancelled = false;
    setFetching(true); setError(''); setPlants([]); setCollection(null);
    void supabase.from('collections').select('id,name').order('created_at', { ascending: true }).limit(1).then(({data, error: queryError}) => {
      if (cancelled) return;
      if (queryError) { setError(formatError(queryError)); setFetching(false); return; }
      const found = (data?.[0] ?? null) as CollectionRow | null;
      setCollection(found);
      if (found) void reload(found.id);
      else setFetching(false);
    });
    return () => { cancelled = true; };
  }, [user?.id, reload]);

  const visible = useMemo(() => plants.filter(p => {
    const text = `${p.name} ${p.scientific_name ?? ''} MB-${p.id.slice(0, 6)}`.toLocaleLowerCase('pt-BR');
    return text.includes(query.trim().toLocaleLowerCase('pt-BR')) && (areaFilter === 'Todos' || p.area === areaFilter);
  }), [plants, query, areaFilter]);

  async function savePlant(payload: PlantInput, id?: string) {
    if (!supabase || !collection || !user) throw new Error('A coleção não está disponível.');
    if (!payload.name || payload.name.length > 100) throw new Error('Digite um nome válido para o exemplar.');
    if (id) {
      const { data, error: updateError } = await supabase.from('plants').update(payload).eq('id', id).eq('collection_id', collection.id)
        .select('id, collection_id, name, scientific_name, species_id, area, acquired_on, notes, created_at').single();
      if (updateError) throw updateError;
      setPlants(old => old.map(p => p.id === id ? (data as PlantRow) : p));
      setNotice('Exemplar atualizado com sucesso.');
    } else {
      const { data, error: insertError } = await supabase.from('plants').insert({ ...payload, collection_id: collection.id })
        .select('id, collection_id, name, scientific_name, species_id, area, acquired_on, notes, created_at').single();
      if (insertError) throw insertError;
      setPlants(old => [data as PlantRow, ...old]);
      setNotice('Exemplar cadastrado e salvo no Supabase.');
      setPage('collection');
    }
  }
  async function removePlant(plant: PlantRow) {
    if (!supabase || !collection) return;
    if (!window.confirm(`Excluir o exemplar "${plant.name}"?\n\nEle deixará de aparecer na coleção. O registro permanece no banco para possível recuperação futura.`)) return;
    setError(''); setNotice('');
    const { error: removeError } = await supabase.from('plants').update({ deleted_at: new Date().toISOString() }).eq('id', plant.id).eq('collection_id', collection.id);
    if (removeError) { setError(formatError(removeError)); return; }
    setPlants(old => old.filter(p => p.id !== plant.id));
    setNotice('Exemplar movido para a Lixeira. Você pode restaurá-lo pelo menu lateral.');
  }
  async function logOut() {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(formatError(signOutError));
    else { setUser(null); setCollection(null); setPlants([]); setEditor(null); setGalleryPlant(null); setNotice(''); }
  }
  function goTo(next: Page) { setHistoryPlantId(null); setCalendarPlantId(null); setPlannerPlantId(null); setPage(next); setMobileMenu(false); setNotice(''); window.scrollTo({top:0,behavior:'smooth'}); }

  if (checking) return <div className="live-loading"><LoaderCircle className="spinning" size={30}/><p>Verificando acesso...</p></div>;
  if (!user) return <Login />;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <button className="brand mori-brand" type="button" onClick={()=>goTo('dashboard')} aria-label="Mori Bonsai: voltar ao painel principal">
        <img className="brand-dragon" src={`${import.meta.env.BASE_URL}assets/mori-dragon-logo.webp`} alt=""/>
        <strong>MORI BONSAI</strong><small>森 · Nosso cantinho verde</small>
      </button>
      <div className="sidebar-label">NOSSA COLEÇÃO</div>
      <nav aria-label="Menu principal" className="side-nav">{links.map(({id, title, icon: Icon}) => <button className={`nav-link ${page === id ? 'nav-link-active' : ''}`} key={id} onClick={() => goTo(id)}><Icon size={19}/>{title}</button>)}</nav>
      <div className="sidebar-bottom"><div className="mori-sidebar-decoration" aria-hidden="true"><span>森</span></div>
        <button className={`nav-link ${page === 'settings' ? 'nav-link-active' : ''}`} onClick={() => goTo('settings')}><Settings2 size={19}/> Configurações</button>
        <button className="nav-link" onClick={() => void logOut()}><LogOut size={19}/> Sair da conta</button>
        <div className="sidebar-foot">Feito com carinho por<br/><strong>Duda & Gui ♡</strong></div>
      </div>
    </aside>
    {mobileMenu && <button className="mobile-backdrop" aria-label="Fechar menu" onClick={()=>setMobileMenu(false)}/>}
    <div className="main-column"><header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" aria-label="Abrir menu" onClick={()=>setMobileMenu(true)}><Menu size={23}/></button><span className="breadcrumb">Mori Bonsai</span><ChevronRight size={15}/><strong>{heading[page]}</strong></div><div className="topbar-right"><span className="demo-pill"><span/> Dados sincronizados</span><SharedCoupleAvatar email={user.email}/></div></header>
      <main className="main-content">
        {error && <div className="live-message live-error" role="alert"><AlertCircle size={18}/><span>{error}</span><button className="message-close" aria-label="Fechar erro" onClick={()=>setError('')}><X size={15}/></button></div>}
        {notice && <div className="live-message live-success" role="status"><CheckCircle2 size={18}/><span>{notice}</span><button className="message-close" aria-label="Fechar aviso" onClick={()=>setNotice('')}><X size={15}/></button></div>}
        {!collection && !fetching ? <div className="live-empty live-no-collection"><ShieldCheck size={38}/><h2>Nenhuma coleção autorizada encontrada</h2><p>Seu login existe, mas ainda precisa ser associado à coleção pelo SQL de inicialização. Confira o arquivo README.md e execute o passo de autorização no SQL Editor do Supabase.</p><button onClick={() => void logOut()} className="button button-outline">Sair</button></div> :
        page === 'dashboard' ? (collection ? <MoriDashboard collectionId={collection.id} plants={plants} covers={coverUrls} onCollection={()=>goTo('collection')} onHistory={()=>goTo('history')} onPlanner={()=>goTo('planner')} onWishlist={()=>goTo('wishlist')}/> : <EmptyPanel title="Carregando coleção" body="Estamos buscando os exemplares da coleção."/>) :
                page === 'collection' ? <div className="page-enter mori-collection-page"><div className="page-heading mori-interior-heading mori-collection-heading"><div><span className="eyebrow">AS ÁRVORES QUE CUIDAMOS</span><h1>Minha coleção</h1><p>Fotos, história e cuidados de cada exemplar da nossa pequena floresta.</p></div><button className="button button-primary" onClick={()=>setEditor({plant:null})}><Plus size={17}/> Novo exemplar</button></div>
          <div className="toolbar"><label className="search-input"><Search size={18}/><input placeholder="Buscar nome ou espécie..." aria-label="Buscar exemplares" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="filter-select"><MapPin size={17}/><select aria-label="Filtrar por ambiente" value={areaFilter} onChange={e=>setAreaFilter(e.target.value)}><option>Todos</option><option>Jardim</option><option>Área protegida</option></select></label><button className="button button-outline" disabled={fetching} onClick={()=>collection && void reload(collection.id)} aria-label="Atualizar lista"><RefreshCcw size={17} className={fetching ? 'spinning' : ''}/></button></div>
          <p className="result-count">Exibindo {visible.length} de {plants.length} exemplares {fetching ? '· atualizando...' : coversLoading ? '· carregando capas...' : ''}</p>
          {coverError && <p className="live-message live-error" role="alert"><AlertCircle size={16}/><span>As fotos de capa não puderam ser carregadas: {coverError}. Confira a migração 08 no Supabase.</span></p>}
          {visible.length ? <div className="live-collection-grid">{visible.map(p => <PlantTile key={p.id} plant={p} coverUrl={coverUrls[p.id]} onEdit={()=>setEditor({plant:p})} onDelete={()=>void removePlant(p)} onPhotos={()=>setGalleryPlant(p)} onCare={()=>{setHistoryPlantId(p.id); setPage('history'); setNotice(''); window.scrollTo({top:0, behavior:'smooth'});}} onCalendar={()=>{setCalendarPlantId(p.id); setPage('calendar'); setNotice(''); window.scrollTo({top:0, behavior:'smooth'});}} onPlan={()=>{setPlannerPlantId(p.id); setPage('planner'); setNotice(''); window.scrollTo({top:0, behavior:'smooth'});}}/>)}</div> : <EmptyPanel title={plants.length?'Nenhum exemplar corresponde à pesquisa':'Nenhum exemplar cadastrado'} body={plants.length?'Tente outra busca ou remova os filtros.':'Clique em “Novo exemplar” para salvar o primeiro bonsai no banco de dados.'}/>}
        </div> :
        page === 'library' ? (collection ? <Suspense fallback={<ModuleLoading/>}><SpeciesLibrary collectionId={collection.id} plants={plants} onLinked={async()=>{await reload(collection.id);}} /></Suspense> : <EmptyPanel title="Carregando coleção" body="Aguarde a verificação de acesso antes de abrir a biblioteca."/>) :
        page === 'history' ? (collection ? <Suspense fallback={<ModuleLoading/>}><CareHistory key={historyPlantId ?? 'all'} collectionId={collection.id} plants={plants} initialPlantId={historyPlantId ?? ''}/></Suspense> : <EmptyPanel title="Carregando coleção" body="Aguarde a verificação do acesso à coleção."/>) :
        page === 'calendar' ? (collection ? <Suspense fallback={<ModuleLoading/>}><CultivationCalendar key={calendarPlantId ?? 'all'} collectionId={collection.id} plants={plants} initialPlantId={calendarPlantId ?? undefined} onOpenLibrary={()=>goTo('library')}/></Suspense> : <EmptyPanel title="Carregando coleção" body="Aguarde a verificação do acesso à coleção."/>) :
        page === 'planner' ? (collection ? <Suspense fallback={<ModuleLoading/>}><CarePlanner key={plannerPlantId ?? 'all'} collectionId={collection.id} plants={plants} initialPlantId={plannerPlantId ?? ''}/></Suspense> : <EmptyPanel title="Carregando coleção" body="Aguarde a verificação de acesso antes de abrir o planejamento."/>) :
        page === 'wishlist' ? (collection ? <Suspense fallback={<ModuleLoading/>}><Wishlist collectionId={collection.id} onAddPlant={(name,scientificName)=>setEditor({plant:null,prefill:{name,scientificName}})}/></Suspense> : <EmptyPanel title="Carregando coleção" body="Aguarde a conexão para consultar as listas compartilhadas."/>) :
                page === 'trash' ? (collection ? <Suspense fallback={<ModuleLoading/>}><RecycleBin collectionId={collection.id} onRestoredPlant={async()=>{await reload(collection.id); setCoverRevision(n=>n+1);}} /></Suspense> : <EmptyPanel title="Carregando coleção" body="Aguarde a verificação do acesso à coleção."/>) :
        (collection ? <Suspense fallback={<ModuleLoading/>}><BackupCenter collectionId={collection.id} collectionName={collection.name} email={user.email}/></Suspense> : <EmptyPanel title="Carregando coleção" body="Aguarde a conexão para exportar seus dados." />)}

        <footer className="footer mori-footer"><span><Heart size={15}/> Feito com carinho por Duda & Gui ♡</span><span>Mori Bonsai · Nossa pequena floresta · v1.3</span></footer>
      </main></div>
    {editor && <PlantEditor key={editor.plant?.id ?? editor.prefill?.name ?? 'new'} plant={editor.plant} prefill={editor.prefill} onClose={()=>setEditor(null)} onSave={savePlant}/>}
    {galleryPlant && <Suspense fallback={<div className="modal-backdrop"><ModuleLoading/></div>}><PhotoGallery key={galleryPlant.id} plant={galleryPlant} onClose={()=>setGalleryPlant(null)} onChanged={()=>setCoverRevision(n=>n+1)}/></Suspense>}
  </div>;
}
