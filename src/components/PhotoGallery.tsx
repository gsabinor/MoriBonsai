import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  AlertCircle, CalendarDays, Camera, CheckCircle2, CheckSquare2,
  ImagePlus, LoaderCircle, Pencil, RefreshCcw, Save, Star, Trash2, X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createPhotoId } from '../lib/photoId';

const BUCKET = 'mori-photos';
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_SIDE = 1600;
const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const URL_LIFETIME = 900;
const URL_REFRESH_MS = 12 * 60 * 1000;

type PhotoRow = {
  id: string;
  plant_id: string;
  collection_id: string;
  storage_path: string;
  created_at: string;
  captured_on: string | null;
  caption: string | null;
  is_cover: boolean;
};
export type GalleryPlant = { id: string; collection_id: string; name: string };
type DisplayPhoto = PhotoRow & { signedUrl: string };

const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const localDate = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const photoDate = (photo: PhotoRow) => photo.captured_on || photo.created_at.slice(0, 10);
const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR');

async function compressPhoto(file: File): Promise<Blob> {
  if (!MIME_TYPES.includes(file.type)) throw new Error('Formato não aceito. Utilize JPEG, PNG ou WebP.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('O arquivo original deve ter no máximo 15 MB.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Não foi possível abrir a imagem. Escolha outra fotografia JPEG, PNG ou WebP.');
  }
  try {
    const ratio = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Este navegador não conseguiu processar a imagem.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('Falha ao otimizar a foto.')), 'image/webp', 0.82);
    });
    if (blob.size > MAX_OUTPUT_BYTES) throw new Error('A foto otimizada ainda excede 5 MB. Tente outra imagem.');
    return blob;
  } finally {
    bitmap.close();
  }
}

export default function PhotoGallery({ plant, onClose, onChanged }: {
  plant: GalleryPlant;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [photos, setPhotos] = useState<DisplayPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [capturedOn, setCapturedOn] = useState(localDate());
  const [caption, setCaption] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [comparing, setComparing] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!supabase) return false;
    setLoading(true);
    setError('');
    try {
      const { data, error: listError } = await supabase.from('plant_photos')
        .select('id, plant_id, collection_id, storage_path, created_at, captured_on, caption, is_cover')
        .eq('plant_id', plant.id).eq('collection_id', plant.collection_id)
        .order('created_at', { ascending: false }).limit(100);
      if (listError) throw listError;
      const rows = (data ?? []) as PhotoRow[];
      if (!rows.length) { setPhotos([]); return true; }
      const { data: signed, error: signError } = await supabase.storage.from(BUCKET)
        .createSignedUrls(rows.map(row => row.storage_path), URL_LIFETIME);
      if (signError) throw signError;
      const list = rows.map((row, index) => ({ ...row, signedUrl: signed?.[index]?.signedUrl ?? '' }));
      if (list.some(photo => !photo.signedUrl)) throw new Error('Uma ou mais imagens não puderam ser abertas. Atualize a galeria.');
      setPhotos(list);
      return true;
    } catch (cause) {
      setError(`Não foi possível carregar as fotografias: ${message(cause)}`);
      return false;
    } finally { setLoading(false); }
  }, [plant.id, plant.collection_id]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, URL_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const ordered = useMemo(() => [...photos].sort((a, b) => {
    const dateOrder = photoDate(a).localeCompare(photoDate(b)) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
    return sort === 'newest' ? -dateOrder : dateOrder;
  }), [photos, sort]);

  const chosen = compareIds.map(id => photos.find(p => p.id === id)).filter((p): p is DisplayPhoto => Boolean(p));
  const activeCover = photos.find(photo => photo.is_cover) ?? [...photos].sort((a,b) => photoDate(b).localeCompare(photoDate(a)) || b.created_at.localeCompare(a.created_at))[0];

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || !supabase) return;
    setBusy(true); setError(''); setStatus('Otimizando fotografia...');
    let stage = 'processamento da imagem';
    try {
      const optimized = await compressPhoto(file);
      const path = `${plant.collection_id}/${plant.id}/${createPhotoId()}.webp`;
      stage = 'envio ao Supabase Storage';
      setStatus('Enviando fotografia ao armazenamento privado...');
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, optimized, {
        cacheControl: '3600', contentType: 'image/webp', upsert: false,
      });
      if (uploadError) throw uploadError;
      stage = 'registro na tabela plant_photos';
      setStatus('Registrando a fotografia na coleção...');
      const { error: insertError } = await supabase.from('plant_photos').insert({
        collection_id: plant.collection_id, plant_id: plant.id, storage_path: path,
        captured_on: capturedOn || null, caption: caption.trim() || null,
      });
      if (insertError) {
        const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([path]);
        throw new Error(`${message(insertError)}${cleanupError ? ' O arquivo enviado precisa ser removido manualmente do Storage.' : ''}`);
      }
      stage = 'atualização da galeria';
      const displayed = await refresh();
      setCaption('');
      onChanged?.();
      setStatus(displayed ? 'Fotografia enviada e registrada com sucesso.' : 'Fotografia salva. Atualize a galeria para visualizá-la.');
    } catch (cause) {
      setStatus('');
      setError(`Falha na etapa de ${stage}: ${message(cause)}`);
      console.error(`[Mori Bonsai] Falha na etapa de ${stage}`, cause);
    } finally { setBusy(false); }
  }

  async function setCover(photo: DisplayPhoto) {
    if (!supabase || busy) return;
    setBusy(true); setError(''); setStatus('Salvando capa...');
    try {
      const { error: coverError } = await supabase.rpc('set_mori_plant_cover', {
        p_plant_id: plant.id, p_photo_id: photo.id,
      });
      if (coverError) throw coverError;
      const displayed = await refresh();
      onChanged?.();
      setStatus(displayed ? 'Foto de capa atualizada.' : 'Capa salva. Atualize a galeria para visualizar.');
    } catch (cause) { setError(`Não foi possível definir a capa: ${message(cause)}`); setStatus(''); }
    finally { setBusy(false); }
  }

  function beginEdit(photo: DisplayPhoto) {
    setEditingId(photo.id); setEditDate(photo.captured_on ?? photo.created_at.slice(0, 10)); setEditCaption(photo.caption ?? '');
    setError(''); setStatus('');
  }

  async function saveDetails(photo: DisplayPhoto) {
    if (!supabase || busy) return;
    if (editCaption.length > 500) { setError('A observação deve ter no máximo 500 caracteres.'); return; }
    setBusy(true); setError(''); setStatus('Salvando detalhes...');
    try {
      const { data, error: updateError } = await supabase.from('plant_photos')
        .update({ captured_on: editDate || null, caption: editCaption.trim() || null })
        .eq('id', photo.id).eq('plant_id', plant.id).eq('collection_id', plant.collection_id)
        .select('id');
      if (updateError) throw updateError;
      if (!data?.length) throw new Error('Nenhuma fotografia foi atualizada. Confira as permissões.');
      setEditingId(null);
      const displayed = await refresh();
      onChanged?.();
      setStatus(displayed ? 'Data e observação atualizadas.' : 'Alterações salvas. Atualize a galeria.');
    } catch (cause) { setError(`Não foi possível salvar os detalhes: ${message(cause)}`); setStatus(''); }
    finally { setBusy(false); }
  }

  async function deletePhoto(photo: DisplayPhoto) {
    if (!supabase || busy) return;
    if (!window.confirm('Excluir esta fotografia permanentemente? Esta ação não pode ser desfeita.')) return;
    setBusy(true); setStatus('Excluindo fotografia...'); setError('');
    try {
      const { error: removeError } = await supabase.storage.from(BUCKET).remove([photo.storage_path]);
      if (removeError) throw removeError;
      const { data: deleted, error: deleteError } = await supabase.from('plant_photos')
        .delete().eq('id', photo.id).eq('plant_id', plant.id).eq('collection_id', plant.collection_id).select('id');
      if (deleteError) throw deleteError;
      if (!deleted?.length) throw new Error('O arquivo foi excluído do Storage, mas seu registro não foi removido. Atualize a galeria.');
      setPhotos(old => old.filter(p => p.id !== photo.id));
      setCompareIds(old => old.filter(id => id !== photo.id));
      onChanged?.();
      setStatus('Fotografia excluída. A capa do exemplar será atualizada automaticamente, se necessário.');
    } catch (cause) {
      setError(`Não foi possível concluir a exclusão: ${message(cause)}. Se necessário, atualize a galeria.`);
      setStatus('');
    } finally { setBusy(false); }
  }

  function toggleCompare(id: string) {
    setCompareIds(old => old.includes(id) ? old.filter(item => item !== id) : old.length < 2 ? [...old, id] : old);
  }

  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <section className="live-modal photo-modal mori-photo-modal" role="dialog" aria-modal="true" aria-labelledby="photos-title">
      <button className="modal-close" aria-label="Fechar galeria" type="button" onClick={onClose} disabled={busy}><X size={20}/></button>
      <header className="mori-photo-heading">
        <span className="eyebrow">NOSSO ÁLBUM DE CULTIVO · GALERIA PRIVADA</span>
        <h2 id="photos-title">Fotos de {plant.name}</h2>
        <p>Um registro visual de cada fase do nosso bonsai.</p>
        <span className="mori-photo-private"><Camera size={14}/> Somente os membros da coleção podem acessar as fotos</span>
      </header>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="Selecionar fotografia" onChange={e => void chooseFile(e)}/>
      <div className="photo-upload-panel">
        <div className="mori-photo-upload-heading"><span><ImagePlus size={18}/> Adicionar ao álbum</span><small>Data e observação são opcionais</small></div>
        <div className="photo-upload-fields">
          <label>Data da fotografia <input type="date" max="9999-12-31" value={capturedOn} onChange={e=>setCapturedOn(e.target.value)}/></label>
          <label>Observação (opcional) <input maxLength={500} value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Ex.: antes da poda estrutural"/></label>
        </div>
        <div className="photo-toolbar">
          <button className="button button-primary" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <LoaderCircle className="spinning" size={17}/> : <ImagePlus size={17}/>} Adicionar foto
          </button>
          <button className="button button-outline" type="button" disabled={busy || loading} onClick={() => void refresh()}><RefreshCcw size={17}/> Atualizar</button>
        </div>
        <p className="photo-help">JPEG, PNG ou WebP; até 15 MB. A imagem é reduzida para WebP de até 1.600 px e 5 MB.</p>
      </div>
      {error && <p className="live-message live-error" role="alert"><AlertCircle size={16}/><span>{error}</span></p>}
      {status && <p className="live-message live-success" role="status"><CheckCircle2 size={16}/><span>{status}</span></p>}
      {loading ? <p className="photo-wait"><LoaderCircle className="spinning" size={19}/> Carregando galeria...</p> :
        photos.length ? <>
          <div className="photo-list-controls">
            <span>{photos.length} fotografia{photos.length === 1 ? '' : 's'} · Capa: {activeCover ? formatDate(photoDate(activeCover)) : 'nenhuma'}</span>
            <label>Ordenar <select aria-label="Ordenar fotografias" value={sort} onChange={e=>setSort(e.target.value as typeof sort)}>
              <option value="newest">Mais recentes</option><option value="oldest">Mais antigas</option>
            </select></label>
            <button className="button button-outline" type="button" disabled={busy} onClick={() => {setComparing(old => !old);setCompareIds([]);}}>
              <CheckSquare2 size={16}/> {comparing ? 'Fechar comparação' : 'Comparar duas fotos'}
            </button>
          </div>
          {comparing && <p className="photo-compare-help" role="status">Selecione duas fotografias para visualizar o antes e o depois lado a lado. {compareIds.length}/2 selecionadas.</p>}
          <div className="photo-grid">{ordered.map(photo => <figure key={photo.id} className={`photo-figure ${compareIds.includes(photo.id) ? 'photo-selected' : ''}`}>
            <a href={photo.signedUrl} target="_blank" rel="noreferrer" aria-label={`Abrir fotografia de ${formatDate(photoDate(photo))}`}><img src={photo.signedUrl} loading="lazy" decoding="async" alt={`Foto do exemplar ${plant.name} em ${formatDate(photoDate(photo))}`}/></a>
            <figcaption className="photo-figcaption">
              <div><b><CalendarDays size={13}/> {formatDate(photoDate(photo))}</b>{photo.caption && <span>{photo.caption}</span>}</div>
              <div className="photo-figure-actions">
                {comparing && <button type="button" className="photo-icon-button" disabled={busy || (compareIds.length >= 2 && !compareIds.includes(photo.id))} onClick={()=>toggleCompare(photo.id)} aria-label={`${compareIds.includes(photo.id) ? 'Desmarcar' : 'Selecionar'} fotografia para comparar`} title="Selecionar para comparação"><CheckSquare2 size={16}/></button>}
                <button type="button" className={`photo-icon-button ${photo.is_cover ? 'photo-is-cover' : ''}`} disabled={busy || photo.is_cover} onClick={() => void setCover(photo)} aria-label={photo.is_cover ? 'Foto de capa' : 'Definir como capa'} title={photo.is_cover ? 'Foto de capa' : 'Definir como capa'}><Star size={16} fill={photo.is_cover ? 'currentColor' : 'none'}/></button>
                <button type="button" className="photo-icon-button" disabled={busy} onClick={()=>beginEdit(photo)} aria-label="Editar data e observação" title="Editar dados"><Pencil size={16}/></button>
                <button className="photo-delete" type="button" disabled={busy} onClick={() => void deletePhoto(photo)} aria-label="Excluir fotografia" title="Excluir permanentemente"><Trash2 size={16}/></button>
              </div>
            </figcaption>
            {editingId === photo.id && <div className="photo-inline-edit">
              <label>Data <input type="date" value={editDate} onChange={e=>setEditDate(e.target.value)}/></label>
              <label>Observação <textarea rows={2} maxLength={500} value={editCaption} onChange={e=>setEditCaption(e.target.value)}/></label>
              <div><button type="button" className="button button-outline" onClick={()=>setEditingId(null)} disabled={busy}>Cancelar</button><button type="button" className="button button-primary" onClick={()=>void saveDetails(photo)} disabled={busy}><Save size={15}/> Salvar</button></div>
            </div>}
          </figure>)}</div>
          {comparing && chosen.length === 2 && <section className="photo-comparison" aria-label="Comparação de evolução">
            <h3>Comparação de evolução</h3>
            <div>{chosen.map((photo, index) => <div key={photo.id}><span className="photo-comparison-label">{index === 0 ? 'FOTO A' : 'FOTO B'} · {formatDate(photoDate(photo))}</span><img src={photo.signedUrl} alt={`${index === 0 ? 'Primeira' : 'Segunda'} imagem da comparação`}/><small>{photo.caption || 'Sem observação'}</small></div>)}</div>
            <p>Imagens lado a lado, sem modificar os arquivos originais.</p>
          </section>}
        </> : <div className="photo-empty"><Camera size={32}/><strong>Nenhuma fotografia ainda</strong><span>Use “Adicionar foto” para começar o registro visual do exemplar.</span></div>}
      <p className="photo-help">Os links privados expiram em 15 minutos e são renovados automaticamente enquanto a galeria estiver aberta. Também é possível clicar em Atualizar.</p>
    </section>
  </div>;
}
