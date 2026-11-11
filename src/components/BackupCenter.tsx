import { useState } from 'react';
import { AlertCircle, Archive, CheckCircle2, Database, Download, Image as ImageIcon, Info, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import { downloadBackup, exportBackup } from '../lib/backup';
import type { BackupProgress } from '../lib/backup';

type Props={collectionId:string;collectionName:string;email?:string};
export default function BackupCenter({collectionId,collectionName,email}:Props){
  const [loading,setLoading]=useState(false);
  const [includePhotos,setIncludePhotos]=useState(true);
  const [progress,setProgress]=useState<BackupProgress|null>(null);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  async function start(){
    if(loading) return;
    setLoading(true);setError('');setSuccess('');setProgress(null);
    try{
      const result=await exportBackup(collectionId,collectionName,includePhotos,setProgress);
      downloadBackup(result.blob,result.filename);
      setSuccess(`Arquivo preparado: ${result.records} registros e ${result.images} arquivos de mídia. Confira se o ZIP foi baixado e abra-o antes de considerá-lo um backup válido.`);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setLoading(false);setProgress(null);}
  }
  return <div className="page-enter">
    <div className="page-heading"><div><span className="eyebrow">SEGURANÇA E PORTABILIDADE</span><h1>Configurações e backups</h1><p>Exporte uma cópia dos dados privados da coleção para guardar fora do Supabase.</p></div></div>
    <div className="settings-grid">
      <div className="setting-tile"><ShieldCheck size={24}/><h3>Acesso privado</h3><p>{email??'Conta autenticada'} · Seus dados permanecem protegidos pelas políticas do Supabase.</p><span className="badge badge-leaf">Sessão autenticada</span></div>
      <div className="setting-tile"><Database size={24}/><h3>Coleção conectada</h3><p>{collectionName}. A exportação usa sua sessão e respeita as permissões RLS.</p><span className="badge badge-leaf">Supabase</span></div>
      <div className="setting-tile"><LockKeyhole size={24}/><h3>Versão do projeto</h3><p>Mori Bonsai Web 1.2 · A exportação é somente leitura; não restaura dados nem modifica tabelas.</p><span className="badge badge-warm">Backup manual</span></div>
    </div>
    <section className="section-card mori-backup-panel" aria-labelledby="backup-title">
      <div className="mori-backup-title"><Archive size={24}/><div><span className="eyebrow">CÓPIA DE SEGURANÇA</span><h2 id="backup-title">Exportar coleção</h2></div></div>
      <p>O arquivo ZIP inclui os registros dos exemplares, fichas técnicas (inclusive revisões), manejos, planejamentos, membros, listas de desejos e itens da Lixeira acessíveis à sua conta. As fotos e vídeos ficam em uma pasta separada dentro do ZIP se a opção abaixo estiver marcada.</p>
      <label className="mori-backup-check"><input type="checkbox" checked={includePhotos} disabled={loading} onChange={e=>setIncludePhotos(e.target.checked)}/><ImageIcon size={18}/><span>Incluir fotografias e vídeos privados (até 160 MB por exportação)</span></label>
      <button className="button button-primary" type="button" onClick={()=>void start()} disabled={loading}>{loading?<LoaderCircle className="spinning" size={17}/>:<Download size={17}/>} {loading?'Preparando backup...':'Gerar e baixar backup ZIP'}</button>
      {progress && <div className="mori-backup-progress" role="status"><LoaderCircle className="spinning" size={16}/>{progress.step}</div>}
      {error && <p className="live-message live-error" role="alert"><AlertCircle size={17}/>{error}</p>}
      {success && <p className="live-message live-success" role="status"><CheckCircle2 size={17}/>{success}</p>}
      <div className="mori-backup-caution"><Info size={18}/><p><strong>Importante:</strong> esta é uma exportação lógica dos registros acessíveis e fotos existentes, não um dump do PostgreSQL. Não inclui senhas, contas Auth, regras RLS nem fotos apagadas permanentemente. O aplicativo ainda não possui importação automática. Armazene o ZIP em local privado, nunca no GitHub. Para recuperação completa, mantenha também um backup administrativo com a Supabase CLI.</p></div>
    </section>
  </div>;
}
