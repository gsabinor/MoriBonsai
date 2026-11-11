import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, CheckCheck, ChevronRight, Heart, History, Leaf, Sprout, Trees, PlusCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { coverFrameStyle } from '../lib/coverFrame';
import WeatherBH from './WeatherBH';
import type { CoverPosition } from './usePlantCovers';

type Plant = { id: string; name: string; scientific_name: string | null; area: string; acquired_on: string | null };
type Log = { id: string; category: string; occurred_on: string };
type Plan = { id: string; plant_id: string; title: string; category: string; planned_for: string };
type Group = 'Poda' | 'Adubação' | 'Transplante' | 'Outros';
const GROUPS: Group[] = ['Poda', 'Adubação', 'Transplante', 'Outros'];
const categories: Record<Group, string> = { Poda: '#315d3f', Adubação: '#70935c', Transplante: '#b8c99a', Outros: '#d7bd84' };
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
const isoDay = (date: Date) => `${dateKey(date)}-${String(date.getDate()).padStart(2,'0')}`;
const monthLabel = (date: Date) => new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(date).replace('.','');
const dayLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.','');
function groupCategory(category: string): Group {
  if (category.startsWith('Poda')) return 'Poda';
  if (category === 'Adubação') return 'Adubação';
  if (category === 'Transplante') return 'Transplante';
  return 'Outros';
}

function CareChart({ logs, loading, truncated }: { logs: Log[]; loading: boolean; truncated: boolean }) {
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const when = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = dateKey(when);
      const counts: Record<Group, number> = { Poda: 0, Adubação: 0, Transplante: 0, Outros: 0 };
      logs.filter(log=>log.occurred_on.startsWith(key)).forEach(log => counts[groupCategory(log.category)]++);
      return { key, label: monthLabel(when), counts, total: Object.values(counts).reduce((a,b)=>a+b,0) };
    });
  }, [logs]);
  const max = Math.max(1,...months.map(m=>m.total));
  const overall = months.reduce((sum,m)=>sum+m.total,0);
  return <section className="mori-panel dashboard-chart-panel">
    <div className="mori-panel-head"><div><span className="mori-panel-kicker">DIÁRIO DE CULTIVO</span><h2><History size={20}/> Manejos por mês</h2></div><span className="mori-panel-caption">Últimos 6 meses</span></div>
    {loading ? <p className="mori-soft-empty">Consultando os manejos...</p> : overall === 0 ? <div className="mori-chart-empty"><Sprout size={30}/><p>Nenhum manejo registrado nos últimos seis meses.</p><small>Quando vocês registrarem podas, adubações e outros cuidados, o gráfico aparecerá aqui.</small></div> : <>
      <div className="mori-chart" role="img" aria-label={`Gráfico de manejos nos últimos seis meses: ${months.map(m=>`${m.label}: ${m.total}`).join(', ')}`}>
        <div className="mori-chart-grid"><span>{max}</span><span>{Math.ceil(max/2)}</span><span>0</span></div>
        <div className="mori-chart-bars">{months.map(m=><div className="mori-chart-month" key={m.key} title={`${m.label}: ${m.total} manejo(s)`}>
          <div className="mori-bar-track"><div className="mori-stacked-bar" style={{height:`${100*m.total/max}%`}}>{GROUPS.map(g=>m.counts[g]>0?<span key={g} style={{background:categories[g],height:`${100*m.counts[g]/m.total}%`}} title={`${g}: ${m.counts[g]}`}/>:null)}</div></div>
          <span className="mori-month-label">{m.label}</span>
        </div>)}</div>
      </div>
      <div className="mori-chart-legend">{GROUPS.map(g=><span key={g}><i style={{background:categories[g]}}/>{g}</span>)}</div>
      {truncated && <p className="mori-data-note">Exibindo até 1.000 registros recentes; a contagem pode estar incompleta.</p>}
    </>}
  </section>;
}

export default function MoriDashboard({ collectionId, plants, covers, coverPositions, onCollection, onHistory, onPlanner, onWishlist }:{
  collectionId: string;
  plants: Plant[];
  covers: Record<string,string>;
  coverPositions: Record<string,CoverPosition>;
  onCollection: ()=>void;
  onHistory: ()=>void;
  onPlanner: ()=>void;
  onWishlist: ()=>void;
}) {
  const [logs,setLogs] = useState<Log[]>([]);
  const [plans,setPlans] = useState<Plan[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [wishCounts,setWishCounts] = useState<Record<'species'|'substrate'|'item',number>|null>(null);
  const [wishError,setWishError] = useState(false);
  useEffect(()=>{
    if (!supabase) return;
    const client = supabase;
    let active = true;
    const from = new Date(); from.setDate(1); from.setMonth(from.getMonth()-5);
    async function load(){
      setLoading(true); setError('');
      const [history, upcoming] = await Promise.all([
        client.from('care_logs').select('id,category,occurred_on').eq('collection_id',collectionId).is('deleted_at',null).gte('occurred_on',isoDay(from)).order('occurred_on',{ascending:false}).limit(1000),
        client.from('care_plans').select('id,plant_id,title,category,planned_for').eq('collection_id',collectionId).is('deleted_at',null).eq('status','pending').order('planned_for',{ascending:true}).limit(6)
      ]);
      if (!active) return;
      setLogs((history.data??[]) as Log[]); setPlans((upcoming.data??[]) as Plan[]);
      if (history.error || upcoming.error) setError('Não foi possível carregar todos os resumos. Os cadastros continuam disponíveis nas outras telas.');
      setLoading(false);
    }
    void load();
    return ()=>{active=false;};
  },[collectionId]);
  useEffect(()=>{
    if(!supabase)return;
    const client=supabase;
    let active=true;
    void client.from('wishlist_items').select('category').eq('collection_id',collectionId).is('archived_at',null).limit(500)
      .then(({data,error:queryError})=>{
        if(!active)return;
        if(queryError){setWishError(true);setWishCounts(null);return;}
        const counts={species:0,substrate:0,item:0};
        for(const row of data??[]){if(row.category in counts)counts[row.category as keyof typeof counts]++;}
        setWishCounts(counts);setWishError(false);
      });
    return ()=>{active=false;};
  },[collectionId]);
  const activeNames = useMemo(()=>new Set(plants.map(p=>p.scientific_name?.trim().toLocaleLowerCase('pt-BR')).filter(Boolean)).size,[plants]);
  const recent = plants.slice(0,2);
  const today = isoDay(new Date());
  return <div className="mori-dashboard page-enter">
    <section className="mori-hero" style={{backgroundImage:`linear-gradient(90deg,rgba(7,33,23,.91) 0%,rgba(13,48,33,.79) 34%,rgba(13,48,33,.04) 76%),url(${import.meta.env.BASE_URL}assets/mori-forest-hero.webp)`}}>
      <div className="mori-hero-copy"><span className="mori-hero-eyebrow">MORI BONSAI · DUDA & GUI</span><h1>Nossa pequena<br/><em>floresta.</em></h1><p>Um lugar para acompanhar nossos bonsais, registrar os cuidados e planejar os próximos passos.</p><button className="mori-hero-button" onClick={onCollection}>Explorar nossa coleção <ArrowRight size={17}/></button></div>
    </section>
    <div className="mori-stats mori-stats--illustrated">
      <div className="mori-stat mori-stat--bonsai"><span className="mori-stat-icon"><Trees size={25}/></span><div><strong>{plants.length}</strong><span>Bonsais na coleção</span></div></div>
      <div className="mori-stat mori-stat--species"><span className="mori-stat-icon"><Leaf size={25}/></span><div><strong>{activeNames}</strong><span>Espécies identificadas</span></div></div>
      <div className="mori-stat mori-stat--care"><span className="mori-stat-icon"><CheckCheck size={25}/></span><div><strong>{logs.length}</strong><span>Manejos em 6 meses</span></div></div>
      <div className="mori-stat mori-stat--plans"><span className="mori-stat-icon"><CalendarClock size={25}/></span><div><strong>{plans.length===6?'6+':plans.length}</strong><span>Planejamentos pendentes</span></div></div>
      <div className="mori-weather-card"><WeatherBH/></div>
    </div>
    {error && <p className="mori-dashboard-warning">{error}</p>}
    <div className="mori-panels-row"><CareChart logs={logs} loading={loading} truncated={logs.length === 1000}/>
      <section className="mori-panel mori-upcoming"><div className="mori-panel-head"><div><span className="mori-panel-kicker">AGENDA COMPARTILHADA</span><h2><CalendarClock size={20}/> Próximos manejos</h2></div><button className="mori-panel-link" onClick={onPlanner}>Ver todos <ArrowRight size={15}/></button></div>
      {loading ? <p className="mori-soft-empty">Buscando planejamentos...</p> : plans.length ? <div className="mori-upcoming-list">{plans.slice(0,4).map(plan=>{
        const plant=plants.find(p=>p.id===plan.plant_id);
        return <button className="mori-upcoming-item" onClick={onPlanner} key={plan.id}>
          <span className="mori-upcoming-icon"><Sprout size={20}/></span><span className="mori-upcoming-copy"><b>{plant?.name??'Exemplar'}</b><small>{plan.title}</small></span><time className={plan.planned_for<today?'mori-past-due':''} dateTime={plan.planned_for}>{dayLabel(plan.planned_for)}</time>
        </button>;
      })}</div> : <div className="mori-soft-empty">Nenhum manejo pendente no momento.<br/><button onClick={onPlanner}>Criar planejamento <PlusCircle size={14}/></button></div>}
      </section>
    </div>
    <div className="mori-panels-row lower-row"><section className="mori-panel mori-featured"><div className="mori-panel-head"><div><span className="mori-panel-kicker">NOSSO JARDIM</span><h2><Trees size={20}/> Em destaque na coleção</h2></div><button className="mori-panel-link" onClick={onCollection}>Abrir coleção <ArrowRight size={15}/></button></div>
      {recent.length ? <div className="mori-featured-grid">{recent.map(p=><button className="mori-feature" key={p.id} onClick={onCollection}><div className="mori-feature-photo">{covers[p.id]?<img src={covers[p.id]} alt={`Bonsai ${p.name}`} loading="lazy" style={coverFrameStyle(coverPositions[p.id])}/>:<Sprout size={52}/>}</div><div className="mori-feature-copy"><b>{p.name}</b><i>{p.scientific_name??'Identificação pendente'}</i><small>{p.area}</small><span>Ver na coleção <ChevronRight size={14}/></span></div></button>)}</div> : <div className="mori-soft-empty">Ainda não há bonsais cadastrados.<br/><button onClick={onCollection}>Adicionar primeiro exemplar <PlusCircle size={14}/></button></div>}
      </section>
      <section className="mori-panel mori-wishlist"><div className="mori-panel-head"><div><span className="mori-panel-kicker">IDEIAS PARA O FUTURO</span><h2><Heart size={20}/> Planos & desejos</h2></div><button className="mori-panel-link" onClick={onWishlist}>Conhecer <ArrowRight size={15}/></button></div>
        <p className="mori-wishlist-note">Três listas para guardar nossas espécies desejadas, compras de substratos e links de ferramentas.</p>
        <div className="mori-wishlist-list"><div><Leaf size={21}/><span>Espécies desejadas{wishCounts ? ` · ${wishCounts.species}`:''}</span></div><div><Trees size={21}/><span>Substratos para comprar{wishCounts ? ` · ${wishCounts.substrate}`:''}</span></div><div><Heart size={21}/><span>Ferramentas e links salvos{wishCounts ? ` · ${wishCounts.item}`:''}</span></div></div>
        {wishError && <p className="mori-data-note">Para ativar as listas, execute a migração 14 no Supabase.</p>}
        <button className="mori-wishlist-next" onClick={onWishlist}>Abrir nossas listas <ArrowRight size={15}/></button>
      </section></div>
    <button type="button" onClick={onHistory} className="mori-history-shortcut">Consultar o histórico completo <ArrowRight size={15}/></button>
  </div>;
}
