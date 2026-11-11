import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BookOpenText, CalendarClock, CalendarDays, ChevronRight,
  CircleCheck, Clock3, Database, Flower2, GalleryHorizontal, Heart, History, Info,
  LayoutDashboard, Leaf, LockKeyhole, MapPin, Menu, Search, Settings2,
  ShieldCheck, SlidersHorizontal, Sprout, Trees, X,
} from 'lucide-react';
import { careLogs, plants, uniqueSpecies } from './data/demo';
import WeatherBH from './components/WeatherBH';
import type { Plant } from './data/demo';

type Page = 'dashboard' | 'collection' | 'library' | 'history' | 'calendar' | 'planner' | 'gallery' | 'wishlist' | 'settings';
type NavItem = { page: Page; label: string; icon: typeof LayoutDashboard };
const navigation: NavItem[] = [
  { page: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { page: 'collection', label: 'Minha coleção', icon: Trees },
  { page: 'library', label: 'Biblioteca técnica', icon: BookOpenText },
  { page: 'history', label: 'Histórico de manejos', icon: History },
  { page: 'calendar', label: 'Calendário consultivo', icon: CalendarDays },
  { page: 'planner', label: 'Planejamento manual', icon: CalendarClock },
  { page: 'gallery', label: 'Galeria', icon: GalleryHorizontal },
  { page: 'wishlist', label: 'Planos & desejos', icon: Heart },
];
const titles: Record<Page, string> = {
  dashboard: 'Visão geral', collection: 'Minha coleção', library: 'Biblioteca técnica',
  history: 'Histórico de manejos', calendar: 'Calendário consultivo', planner: 'Planejamento manual', gallery: 'Galeria', wishlist: 'Planos & desejos', settings: 'Configurações',
};

function Label({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}
function Badge({ children, tone = 'leaf' }: { children: ReactNode; tone?: 'leaf' | 'warm' | 'neutral' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
function PlantArt({ plant, size = 'normal' }: { plant: Plant; size?: 'normal' | 'small' | 'large' }) {
  return <div className={`plant-art plant-art-${plant.tint} plant-art-${size}`} aria-hidden="true"><span>{plant.emoji}</span><span className="art-ring" /></div>;
}
function PlantCard({ plant, onClick }: { plant: Plant; onClick: () => void }) {
  return (
    <button className="plant-card" onClick={onClick} aria-label={`Ver detalhes de ${plant.name}`}>
      <PlantArt plant={plant} />
      <div className="plant-card-body">
        <div className="plant-card-top"><span className="plant-id">{plant.id}</span><ChevronRight size={17} /></div>
        <h3>{plant.name}</h3>
        <p className="scientific">{plant.scientific}</p>
        <span className="plant-place"><MapPin size={13} />{plant.area}</span>
      </div>
    </button>
  );
}
function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <div className="section-title"><div>{eyebrow && <Label>{eyebrow}</Label>}<h2>{title}</h2></div>{action}</div>;
}

function Dashboard({ goTo, openPlant }: { goTo: (p: Page) => void; openPlant: (p: Plant) => void }) {
  return (
    <div className="page-enter">
      <div className="hero mori-demo-hero" style={{backgroundImage:`linear-gradient(90deg,rgba(7,33,23,.88) 0%,rgba(13,48,33,.7) 44%,rgba(13,48,33,0) 95%),url(${import.meta.env.BASE_URL}assets/mori-forest-hero.webp)`}}>
        <div className="hero-copy">
          <span className="hero-kicker"><Leaf size={14} />MORI BONSAI · DUDA & GUI</span>
          <h1>Nossa pequena<br/><em>floresta.</em></h1>
          <p>Uma prévia do nosso espaço para acompanhar cada bonsai. Os dados abaixo são demonstrativos.</p>
          <button className="button button-light" onClick={() => goTo('collection')}>Explorar coleção <ArrowUpRight size={16}/></button>
        </div>

      </div>
      <div className="mori-stats mori-stats--illustrated mori-demo-stats">
        <div className="mori-stat mori-stat--bonsai"><span className="mori-stat-icon"><Trees size={25}/></span><div><strong>{plants.length}</strong><span>Bonsais na coleção (demonstração)</span></div></div>
        <div className="mori-stat mori-stat--species"><span className="mori-stat-icon"><Leaf size={25}/></span><div><strong>{uniqueSpecies.length}</strong><span>Espécies identificadas</span></div></div>
        <div className="mori-stat mori-stat--care"><span className="mori-stat-icon"><History size={25}/></span><div><strong>{careLogs.length}</strong><span>Manejos ilustrativos</span></div></div>
        <div className="mori-stat mori-stat--plans"><span className="mori-stat-icon"><CalendarClock size={25}/></span><div><strong>0</strong><span>Planejamentos pendentes</span></div></div>
        <div className="mori-weather-card"><WeatherBH/></div>
      </div>
      <div className="home-grid">
        <section className="section-card specimens-section">
          <SectionTitle eyebrow="SUA COLEÇÃO" title="Em destaque" action={<button className="link-button" onClick={() => goTo('collection')}>Ver todos <ArrowRight size={15}/></button>}/>
          <div className="highlight-grid">{plants.slice(0, 3).map((p) => <PlantCard key={p.id} plant={p} onClick={() => openPlant(p)}/>)}</div>
        </section>
        <section className="section-card activity-section">
          <SectionTitle eyebrow="DIÁRIO" title="Atividade recente" action={<button className="icon-button" aria-label="Abrir histórico" onClick={() => goTo('history')}><ArrowUpRight size={18}/></button>}/>
          <div className="activity-list">{careLogs.slice(0, 4).map((entry) => {
            const p = plants.find((plant) => plant.id === entry.plantId)!;
            return <div key={entry.id} className="activity-item"><div className="activity-dot"><Sprout size={17}/></div><div className="activity-copy"><b>{entry.kind}</b><span>{p.name}</span></div><small>{entry.date.slice(0, 5)}</small></div>;
          })}</div>
          <div className="activity-foot"><CircleCheck size={16}/> Registros de demonstração</div>
        </section>
      </div>
    </div>
  );
}

function Collection({ openPlant }: { openPlant: (p: Plant) => void }) {
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('Todas');
  const filtered = useMemo(() => plants.filter((p) => {
    const matchesQuery = `${p.id} ${p.name} ${p.scientific}`.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'));
    return matchesQuery && (area === 'Todas' || p.area === area);
  }), [query, area]);
  return <div className="page-enter">
    <div className="page-heading"><div><Label>INVENTÁRIO</Label><h1>Minha coleção</h1><p>Cada exemplar tem uma história para acompanhar.</p></div><Badge tone="leaf">{plants.length} exemplares demonstrativos</Badge></div>
    <div className="toolbar">
      <label className="search-input"><Search size={19}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar pelo nome, espécie ou código..." aria-label="Buscar exemplares"/></label>
      <label className="filter-select"><SlidersHorizontal size={17}/><select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filtrar por ambiente"><option>Todas</option><option>Jardim</option><option>Área protegida</option></select></label>
    </div>
    <div className="result-count">Mostrando <b>{filtered.length}</b> de {plants.length} exemplares</div>
    {filtered.length ? <div className="collection-grid">{filtered.map((p) => <PlantCard plant={p} key={p.id} onClick={() => openPlant(p)}/>)}</div> : <div className="empty-state"><Search size={28}/><h3>Nenhum exemplar encontrado</h3><p>Experimente outro nome ou remova o filtro aplicado.</p><button className="button button-outline" onClick={() => {setQuery(''); setArea('Todas');}}>Limpar filtros</button></div>}
  </div>;
}
function Library() {
  return <div className="page-enter"><div className="page-heading"><div><Label>CONHECIMENTO</Label><h1>Biblioteca técnica</h1><p>Uma ficha técnica por espécie, compartilhada entre exemplares.</p></div><Badge tone="warm">Estrutura demonstrativa</Badge></div>
    <div className="insight-strip"><BookOpenText size={23}/><div><b>Uma biblioteca confiável, construída por você.</b><span>No modo conectado, cada espécie pode ter uma ficha de 40 campos com fontes, revisão e marcação “Não Confirmado”.</span></div></div>
    <div className="library-list">{uniqueSpecies.map((name, index) => {
      const linked = plants.filter((p) => p.scientific === name).length;
      return <div key={name} className="library-row"><div className={`species-icon species-${index % 4}`}><Flower2 size={22}/></div><div><h3>{name}</h3><p>{linked} {linked === 1 ? 'exemplar vinculado' : 'exemplares vinculados'}</p></div><Badge tone="neutral">Ficha pendente</Badge></div>;
    })}</div>
  </div>;
}
function HistoryPage() {
  return <div className="page-enter"><div className="page-heading"><div><Label>REGISTROS DE CULTIVO</Label><h1>Histórico de manejos</h1><p>Uma linha do tempo para acompanhar cada decisão.</p></div><Badge tone="warm">Dados ilustrativos</Badge></div>
    <div className="timeline">{careLogs.map((item) => {
      const p = plants.find((plant) => plant.id === item.plantId)!;
      return <article className="timeline-row" key={item.id}><div className="timeline-symbol"><Leaf size={18}/></div><div className="timeline-content"><div className="timeline-top"><b>{item.kind}</b><time>{item.date}</time></div><h3>{p.name}</h3><p>{item.note}</p></div></article>;
    })}</div>
  </div>;
}
function PlanPage() {
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return <div className="page-enter calendar-page"><div className="page-heading"><div><Label>CULTIVO EM BELO HORIZONTE</Label><h1>Calendário consultivo</h1><p>Uma visão dos 12 meses, alimentada pelas fichas técnicas aprovadas da coleção.</p></div><Badge tone="warm">Modo demonstração</Badge></div>
    <div className="calendar-safety"><ShieldCheck size={21}/><p><b>Orientações dependem de evidências.</b> O calendário da versão conectada apresenta os campos 23 a 34 das fichas aprovadas e nunca cria agendamento automático de rega.</p></div>
    <div className="calendar-month-section"><div className="calendar-section-heading"><div><Label>EXEMPLO DA INTERFACE</Label><h2>Meses do ano</h2></div></div><div className="calendar-month-grid">{months.map((month, index)=><div key={month} className="calendar-month calendar-demo-month"><span className="calendar-month-number">{String(index+1).padStart(2,'0')}</span><strong>{month}</strong><span className="calendar-mini-status">Sem ficha conectada</span></div>)}</div></div>
    <div className="soft-notice"><Info size={17}/> Para consultar orientações reais, configure o Supabase, cadastre uma espécie e aprove a ficha de 40 campos na Biblioteca técnica. Não há recomendações fictícias neste modo.</div>
  </div>;
}
function PlannerDemo() {
  return <div className="page-enter"><div className="page-heading"><div><Label>ATIVIDADES FUTURAS</Label><h1>Planejamento manual</h1><p>Organize tarefas futuras por exemplar. O modo demonstração não salva alterações.</p></div><Badge tone="warm">Modo demonstração</Badge></div>
    <div className="planner-advice"><CalendarClock size={20}/><span>Os dois usuários poderão criar, editar, concluir e cancelar planejamentos no modo conectado ao Supabase. Sem alertas automáticos ou agenda de regas.</span></div>
    <div className="live-empty planner-empty"><CalendarClock size={32}/><h3>Planejamento disponível após conectar o Supabase</h3><p>Configure o projeto e aplique o script 09 para gerenciar os planos. Nenhuma tarefa fictícia será enviada ao banco.</p></div>
  </div>;
}
function Gallery() {
  return <div className="page-enter"><div className="page-heading"><div><Label>MEMÓRIAS VISUAIS</Label><h1>Galeria</h1><p>O crescimento de cada árvore visto ao longo do tempo.</p></div><Badge tone="warm">Fotos demonstrativas</Badge></div>
    <div className="gallery-grid">{plants.slice(0, 6).map((plant) => <div key={plant.id} className="gallery-item"><PlantArt plant={plant} size="large"/><div><b>{plant.name}</b><small>{plant.id} · Ilustração provisória</small></div></div>)}</div>
    <div className="soft-notice"><Info size={17}/> No modo conectado, as fotografias reais ficam em um bucket privado do Supabase.</div></div>;
}
function Settings() {
  return <div className="page-enter"><div className="page-heading"><div><Label>PREFERÊNCIAS</Label><h1>Configurações</h1><p>Informações sobre esta primeira versão do aplicativo.</p></div></div>
    <div className="settings-grid">
      <div className="setting-tile"><Database size={24}/><h3>Banco de dados</h3><p>Supabase ainda não conectado. Nenhum dado exibido nesta versão foi salvo online.</p><Badge tone="warm">Aguardando integração</Badge></div>
      <div className="setting-tile"><LockKeyhole size={24}/><h3>Acesso privado</h3><p>O modo conectado utiliza contas autorizadas e políticas de segurança (RLS).</p><Badge tone="neutral">Planejado</Badge></div>
      <div className="setting-tile"><ShieldCheck size={24}/><h3>Integridade dos dados</h3><p>O protótipo não se conecta às planilhas, ao Drive nem ao banco do Mori Bonsai anterior.</p><Badge tone="leaf">Isolado</Badge></div>
    </div>
  </div>;
}

function PlantDetails({ plant, close }: { plant: Plant; close: () => void }) {
  return <div className="modal-backdrop" onMouseDown={(e) => {if (e.currentTarget === e.target) close();}}>
    <section className="plant-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button className="modal-close" onClick={close} aria-label="Fechar detalhes"><X size={20}/></button>
      <PlantArt plant={plant} size="large"/>
      <div className="modal-body"><Badge>{plant.id}</Badge><h2 id="modal-title">{plant.name}</h2><i>{plant.scientific}</i>
        <div className="modal-facts"><div><MapPin size={16}/><span>Local</span><strong>{plant.area}</strong></div><div><CalendarDays size={16}/><span>Na coleção desde</span><strong>{plant.since}</strong></div><div><Clock3 size={16}/><span>Último registro</span><strong>{plant.lastCare}</strong></div></div>
        <h3>Observações</h3><p>{plant.note}</p><div className="soft-notice"><Info size={15}/> Dados ilustrativos. Cadastro e edição serão adicionados após a conexão com o Supabase.</div>
        <button className="button button-primary modal-done" onClick={close}>Voltar para coleção <ArrowLeft size={16}/></button>
      </div>
    </section>
  </div>;
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const goTo = (next: Page) => { setPage(next); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <button type="button" className="brand mori-brand" onClick={()=>goTo('dashboard')} aria-label="Mori Bonsai: voltar ao início"><img className="brand-dragon" src={`${import.meta.env.BASE_URL}assets/mori-dragon-logo.webp`} alt=""/><strong>MORI BONSAI</strong><small>森 · Nosso cantinho verde</small></button>
      <div className="sidebar-label">DEMONSTRAÇÃO</div>
      <nav aria-label="Menu principal" className="side-nav">
        {navigation.map(({ page: item, label, icon: Icon }) => <button key={item} className={`nav-link ${page === item ? 'nav-link-active' : ''}`} onClick={() => goTo(item)} aria-current={page === item ? 'page' : undefined}><Icon size={19} strokeWidth={1.8}/>{label}{page === item && <span className="nav-active-dot"/>}</button>)}
      </nav>
      <div className="sidebar-bottom"><div className="mori-sidebar-decoration" aria-hidden="true"><span>森</span></div><button className={`nav-link ${page === 'settings' ? 'nav-link-active' : ''}`} onClick={() => goTo('settings')}><Settings2 size={19}/> Configurações</button><div className="sidebar-foot">Feito com carinho por<br/><strong>Duda & Gui ♡</strong></div></div>
    </aside>
    {menuOpen && <button className="mobile-backdrop" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"/>}
    <div className="main-column"><header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu size={23}/></button><span className="breadcrumb">Mori Bonsai</span><ChevronRight size={15}/><strong>{titles[page]}</strong></div><div className="topbar-right"><span className="demo-pill"><span/> Modo demonstração</span><div className="avatar" title="Conta demonstrativa">MB</div></div></header>
      <main className="main-content">{page === 'dashboard' && <Dashboard goTo={goTo} openPlant={setSelectedPlant}/>}{page === 'collection' && <Collection openPlant={setSelectedPlant}/>}{page === 'library' && <Library/>}{page === 'history' && <HistoryPage/>}{page === 'calendar' && <PlanPage/>}{page === 'planner' && <PlannerDemo/>}{page === 'gallery' && <Gallery/>}{page === 'wishlist' && <div className="page-enter mori-wishlist-preview"><div className="mori-preview-hero"><span className="eyebrow">MODO DEMONSTRAÇÃO</span><h1>Planos & desejos</h1><p>As três listas são privadas e compartilhadas na versão conectada ao Supabase.</p></div><div className="mori-preview-grid"><div className="mori-preview-card"><Leaf size={25}/><h2>Espécies desejadas</h2><p>Nosso próximo bonsai e as espécies que queremos pesquisar.</p></div><div className="mori-preview-card"><Trees size={25}/><h2>Compras de substratos</h2><p>Materiais, quantidades e prioridades dos próximos replantes.</p></div><div className="mori-preview-card"><Heart size={25}/><h2>Ferramentas e links salvos</h2><p>Links que guardamos para consultar em outro momento.</p></div></div><p className="mori-preview-notice">Este modo não grava informações. Configure o Supabase para utilizar as listas compartilhadas.</p></div>}{page === 'settings' && <Settings/>}
        <footer className="footer mori-footer"><span>Feito com carinho por Duda & Gui ♡</span><span>v1.2 · Modo demonstração · Nenhum dado salvo</span></footer>
      </main></div>
    {selectedPlant && <PlantDetails plant={selectedPlant} close={() => setSelectedPlant(null)}/>}
  </div>;
}
