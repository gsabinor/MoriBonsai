import { supabase } from './supabase';
import { ZipStore } from './zipStore';

const PAGE_SIZE = 200;
// Limita memoria do navegador. Exportacoes maiores exigem backup admin/offline.
const MAX_PHOTO_BYTES = 160 * 1024 * 1024;
const UUID_PATH = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(?:webp|mp4|webm)$/i;

export type BackupProgress = { step: string; done: number; total: number };
type Table = 'collections'|'collection_members'|'plants'|'species'|'species_guides'|'plant_photos'|'care_logs'|'care_plans'|'wishlist_items';
type Row = Record<string, unknown>;
const tables: Table[] = ['collections','collection_members','plants','species','species_guides','plant_photos','care_logs','care_plans','wishlist_items'];

async function fetchAll(table: Table, collectionId: string): Promise<Row[]> {
  if (!supabase) throw new Error('O Supabase não está conectado.');
  const rows: Row[]=[];
  for(let start=0;start<100000;start+=PAGE_SIZE){
    const orderColumn = table === 'collection_members' ? 'user_id' : 'id';
    const {data,error}=await supabase.from(table).select('*').eq(table === 'collections'?'id':'collection_id',collectionId)
      .order(orderColumn,{ascending:true}).range(start,start+PAGE_SIZE-1);
    if(error) throw new Error(`Falha ao consultar ${table}: ${error.message}`);
    const page=(data ?? []) as Row[];
    rows.push(...page);
    if(page.length<PAGE_SIZE) return rows;
  }
  throw new Error(`Limite de registros excedido na tabela ${table}. Faça backup pelo Supabase CLI.`);
}

export async function exportBackup(collectionId: string, name: string, photos: boolean, report:(p: BackupProgress)=>void): Promise<{blob:Blob; filename:string; records:number; images:number}> {
  if(!supabase) throw new Error('Banco não conectado.');
  const data: Partial<Record<Table,Row[]>>={};
  for(let i=0;i<tables.length;i++){
    report({step:`Consultando ${tables[i]}...`,done:i,total:tables.length+1});
    data[tables[i]]=await fetchAll(tables[i],collectionId);
  }
  // Confere novamente os dados da coleção autorizada, após as consultas paginadas.
  if(data.collections?.length !== 1) throw new Error('Não foi possível confirmar acesso à coleção.');
  const photoRows=(data.plant_photos ?? []) as (Row & {storage_path?:unknown})[];
  const manifest = {
    format:'mori-bonsai-export',format_version:1,app_version:'1.2',
    exported_at:new Date().toISOString(),collection_id:collectionId,collection_name:name,
    includes_images:photos,counts:Object.fromEntries(tables.map(t=>[t,data[t]?.length ?? 0])),
    notes:'Exportação de dados acessíveis à conta autenticada. Não é um dump SQL nem inclui usuários, senhas, políticas RLS ou configuração do Supabase. Os arquivos excluídos permanentemente não são recuperáveis.'
  };
  const zip=new ZipStore();
  zip.addText('LEIA-ME.txt', [
    'MORI BONSAI — EXPORTAÇÃO PRIVADA',
    'Arquive este ZIP em local seguro, fora do computador principal.',
    'dados.json: registros e histórico (incluindo itens na lixeira que a conta consegue consultar).',
    photos?'fotos/: fotos e vídeos baixados do bucket privado mori-photos.':'Esta exportação não inclui os arquivos de fotos e vídeos.',
    'Não é um backup completo do servidor PostgreSQL, do Auth ou das políticas.',
    'Não existe importação automática neste aplicativo: restauração exige procedimento assistido.',
    'Nunca compartilhe este arquivo publicamente nem coloque-o no GitHub.',
  ].join('\n'));
  zip.addText('dados.json',JSON.stringify({manifest,tables:data},null,2));
  let photoBytes=0;
  if(photos){
    for(let i=0;i<photoRows.length;i++){
      const path=photoRows[i].storage_path;
      if(typeof path!=='string' || !UUID_PATH.test(path)) throw new Error('Metadados de fotografia com caminho inesperado. Backup interrompido para evitar arquivo incompleto.');
      report({step:`Baixando arquivo ${i+1} de ${photoRows.length}...`,done:i+1,total:photoRows.length});
      const {data:blob,error}=await supabase.storage.from('mori-photos').download(path);
      if(error || !blob) throw new Error(`Mídia não exportada (${i+1}/${photoRows.length}): ${error?.message ?? path}. O backup foi interrompido. Verifique as políticas de leitura e a migração 13.`);
      photoBytes+=blob.size;
      if(photoBytes>MAX_PHOTO_BYTES) throw new Error('Os arquivos de mídia passaram de 160 MB. Faça uma exportação somente dos dados e um backup maior com ferramentas administrativas do Supabase.');
      zip.addBytes(`fotos/${path}`,new Uint8Array(await blob.arrayBuffer()));
    }
  }
  report({step:'Finalizando arquivo...',done:1,total:1});
  const blob=zip.finish();
  const now=new Date();
  const stamp=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('')+'-'+String(now.getHours()).padStart(2,'0')+String(now.getMinutes()).padStart(2,'0');
  return {blob,filename:`mori-bonsai-backup-${stamp}.zip`,records:tables.reduce((sum,t)=>sum+(data[t]?.length ?? 0),0),images:photos?photoRows.length:0};
}

export function downloadBackup(blob:Blob,filename:string){
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
