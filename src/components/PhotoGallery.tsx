import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  AlertCircle, CalendarDays, Camera, CheckCircle2, CheckSquare2,
  BookOpen, Crop, ImagePlus, Video, LoaderCircle, Pencil, RefreshCcw, Save, Star, Trash2, X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadMoriMedia } from '../lib/mediaUpload';
import CoverPositionEditor from './CoverPositionEditor';
import type { CoverFitMode } from '../lib/coverFrame';

const BUCKET = 'mori-photos';
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
  media_type: 'image' | 'video';
  care_log_id: string | null;
  is_reference: boolean;
  reference_source: string | null;
  cover_position_x: number;
  cover_position_y: number;
  cover_zoom_percent: number;
  cover_fit_mode: CoverFitMode;
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
  const [referenceCaption, setReferenceCaption] = useState('');
  const [referenceSource, setReferenceSource] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [comparing, setComparing] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editSource, setEditSource] = useState('');
  const [cropPhoto, setCropPhoto] = useState<DisplayPhoto | null>(null);
  const [cropError, setCropError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!supabase) return false;
    setLoading(true);
    setError('');
    try {
      const { data, error: listError } = await supabase.from('plant_photos')
        .select('id, plant_id, collection_id, storage_path, created_at, captured_on, caption, is_cover, media_type, care_log_id, is_reference, reference_source, cover_position_x, cover_position_y, cover_zoom_percent, cover_fit_mode')
        .eq('plant_id', plant.id).eq('collection_id', plant.collection_id)
        .order('is_reference', { ascending: false }).order('created_at', { ascending: false }).limit(100);
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
      setError(`Não foi possível carregar a galeria: ${message(cause)}`);
      return false;
    } finally { setLoading(false); }
  }, [plant.id, plant.collection_id]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, URL_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const album = useMemo(() => photos.filter(p => !p.is_reference), [photos]);
  const referencePhoto = photos.find(p => p.is_reference && p.media_type === 'image');
  const ordered = useMemo(() => [...album].sort((a, b) => {
    const dateOrder = photoDate(a).localeCompare(photoDate(b)) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
    return sort === 'newest' ? -dateOrder : dateOrder;
  }), [album, sort]);

  const chosen = compareIds.map(id => photos.find(p => p.id === id)).filter((p): p is DisplayPhoto => Boolean(p));
  const activeCover = album.find(photo => photo.media_type === 'image' && photo.is_cover) ?? [...album].filter(photo => photo.media_type === 'image').sort((a,b) => photoDate(b).localeCompare(photoDate(a)) || b.created_at.localeCompare(a.created_at))[0];

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setBusy(true); setError(''); setStatus('Preparando arquivo...');
    try {
      await uploadMoriMedia({
        file, plantId: plant.id, collectionId: plant.collection_id,
        capturedOn, caption, onStage: setStatus,
      });
      const displayed = await refresh();
      setCaption(''); onChanged?.();
      setStatus(displayed ? 'Mídia adicionada à galeria.' : 'Arquivo salvo. Atualize a galeria para visualizá-lo.');
    } catch (cause) { setStatus('');setError(`Falha ao enviar arquivo: ${message(cause)}`); }
    finally {setBusy(false);}
  }


  async function chooseReferenceFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (referencePhoto) { setError('Já existe uma referência visual. Exclua-a antes de enviar outra.'); return; }
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      setError('A referência precisa ser uma imagem JPEG, PNG ou WebP.'); return;
    }
    setBusy(true); setError(''); setStatus('Preparando referência visual...');
    try {
      await uploadMoriMedia({
        file, plantId: plant.id, collectionId: plant.collection_id,
        isReference: true, caption: referenceCaption, referenceSource, onStage: setStatus,
      });
      const displayed = await refresh();
      setReferenceCaption(''); setReferenceSource('');
      setStatus(displayed ? 'Referência visual adicionada.' : 'Referência salva. Atualize a galeria para visualizá-la.');
    } catch (cause) { setStatus(''); setError(`Falha ao enviar referência: ${message(cause)}`); }
    finally { setBusy(false); }
  }

  function beginCoverEdit(photo: DisplayPhoto) {
    if (busy || photo.media_type !== 'image' || photo.is_reference) return;
    setCropError(''); setError(''); setStatus(''); setCropPhoto(photo);
  }

  async function saveCoverFrame(x: number, y: number, zoom: number, fit: CoverFitMode) {
    if (!supabase || busy || !cropPhoto) return;
    setBusy(true); setCropError(''); setStatus('Salvando enquadramento da capa...');
    try {
      const { error: coverError } = await supabase.rpc('set_mori_plant_cover_frame_v2', {
        p_plant_id: plant.id, p_photo_id: cropPhoto.id,
        p_position_x: x, p_position_y: y, p_zoom_percent: zoom, p_fit_mode: fit,
      });
      if (coverError) throw coverError;
      setCropPhoto(null);
      const displayed = await refresh();
      onChanged?.();
      setStatus(displayed ? 'Capa e enquadramento atualizados.' : 'Capa salva. Atualize a galeria para visualizar.');
    } catch (cause) {
      setCropError(`Não foi possível salvar o enquadramento: ${message(cause)}`);
      setStatus('');
    } finally { setBusy(false); }
  }

  function beginEdit(photo: DisplayPhoto) {
    setEditingId(photo.id); setEditDate(photo.captured_on ?? photo.created_at.slice(0, 10));
    setEditCaption(photo.caption ?? ''); setEditSource(photo.reference_source ?? '');
    setError(''); setStatus('');
  }

  async function saveDetails(photo: DisplayPhoto) {
    if (!supabase || busy) return;
    if (editCaption.length > 500 || editSource.length > 500) { setError('A observação e a fonte devem ter no máximo 500 caracteres.'); return; }
    setBusy(true); setError(''); setStatus('Salvando detalhes...');
    try {
      const { data, error: updateError } = await supabase.from('plant_photos')
        .update(photo.is_reference
          ? { caption: editCaption.trim() || null, reference_source: editSource.trim() || null }
          : { captured_on: editDate || null, caption: editCaption.trim() || null })
        .eq('id', photo.id).eq('plant_id', plant.id).eq('collection_id', plant.collection_id)
        .select('id');
      if (updateError) throw updateError;
      if (!data?.length) throw new Error('Nenhuma fotografia foi atualizada. Confira as permissões.');
      setEditingId(null);
      const displayed = await refresh();
      onChanged?.();
      setStatus(displayed ? 'Informações atualizadas.' : 'Alterações salvas. Atualize a galeria.');
    } catch (cause) { setError(`Não foi possível salvar os detalhes: ${message(cause)}`); setStatus(''); }
    finally { setBusy(false); }
  }

  async function deletePhoto(photo: DisplayPhoto) {
    if (!supabase || busy) return;
    if (!window.confirm(photo.is_reference ? 'Excluir a imagem de referência permanentemente? Esta ação não pode ser desfeita.' : 'Excluir este arquivo permanentemente? Esta ação não pode ser desfeita.')) return;
    setBusy(true); setStatus('Excluindo arquivo...'); setError('');
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
      setStatus(photo.is_reference ? 'Referência visual excluída.' : 'Arquivo excluído. A capa do exemplar será atualizada automaticamente, se necessário.');
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
        <h2 id="photos-title">Galeria de {plant.name}</h2>
        <p>Fotos e vídeos da evolução do exemplar, além de uma inspiração para sua formação.</p>
        <span className="mori-photo-private"><Camera size={14}/> Somente os membros da coleção podem acessar fotos e vídeos</span>
      </header>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" hidden aria-label="Selecionar foto ou vídeo" onChange={e => void chooseFile(e)}/>
      <input ref={referenceInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="Selecionar fotografia de referência" onChange={e => void chooseReferenceFile(e)}/>
      <div className="photo-upload-panel">
        <div className="mori-photo-upload-heading"><span><ImagePlus size={18}/> Adicionar ao álbum</span><small>Data e observação são opcionais</small></div>
        <div className="photo-upload-fields">
          <label>Data do registro visual <input type="date" max="9999-12-31" value={capturedOn} onChange={e=>setCapturedOn(e.target.value)}/></label>
          <label>Observação (opcional) <input maxLength={500} value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Ex.: antes da poda estrutural"/></label>
        </div>
        <div className="photo-toolbar">
          <button className="button button-primary" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <LoaderCircle className="spinning" size={17}/> : <ImagePlus size={17}/>} Adicionar foto ou vídeo
          </button>
          <button className="button button-outline" type="button" disabled={busy || loading} onClick={() => void refresh()}><RefreshCcw size={17}/> Atualizar</button>
        </div>
        <p className="photo-help">Fotos JPEG/PNG/WebP até 15 MB (otimizadas). Vídeos MP4/WebM até 20 MB, sem compressão automática. Prefira vídeos curtos.</p>
      </div>
      {error && <p className="live-message live-error" role="alert"><AlertCircle size={16}/><span>{error}</span></p>}
      {status && <p className="live-message live-success" role="status"><CheckCircle2 size={16}/><span>{status}</span></p>}

      {!loading && <section className="mori-reference-section" aria-labelledby="mori-reference-title">
        <div className="mori-reference-header">
          <span className="mori-reference-tag"><BookOpen size={15}/> INSPIRAÇÃO PARA A FORMAÇÃO</span>
          <h3 id="mori-reference-title">Referência visual</h3>
          <p>Uma fotografia de outro bonsai da mesma espécie para orientar o estilo desejado. Ela não faz parte da evolução do nosso exemplar.</p>
        </div>
        {referencePhoto ? <div className="mori-reference-content">
          <a className="mori-reference-image" href={referencePhoto.signedUrl} target="_blank" rel="noreferrer" aria-label="Abrir imagem de referência em tamanho maior">
            <img src={referencePhoto.signedUrl} loading="lazy" decoding="async" alt={`Bonsai de referência visual para ${plant.name}`}/>
          </a>
          <div className="mori-reference-details">
            <strong>Nosso modelo de inspiração</strong>
            <p>{referencePhoto.caption || 'Inspiração para a modelagem e desenvolvimento do exemplar.'}</p>
            {referencePhoto.reference_source && <p className="mori-reference-credit"><b>Fonte / créditos:</b> {referencePhoto.reference_source}</p>}
            <div className="mori-reference-actions">
              <button type="button" className="button button-outline" disabled={busy} onClick={()=>beginEdit(referencePhoto)}><Pencil size={15}/> Editar detalhes</button>
              <button type="button" className="button button-outline" disabled={busy} onClick={()=>void deletePhoto(referencePhoto)}><Trash2 size={15}/> Excluir referência</button>
            </div>
            {editingId === referencePhoto.id && <div className="photo-inline-edit mori-reference-edit">
              <label>O que queremos usar como inspiração? <textarea rows={3} maxLength={500} value={editCaption} onChange={e=>setEditCaption(e.target.value)}/></label>
              <label>Fonte, autor ou link de origem <input maxLength={500} value={editSource} onChange={e=>setEditSource(e.target.value)}/></label>
              <div><button type="button" className="button button-outline" disabled={busy} onClick={()=>setEditingId(null)}>Cancelar</button><button type="button" className="button button-primary" disabled={busy} onClick={()=>void saveDetails(referencePhoto)}><Save size={15}/> Salvar</button></div>
            </div>}
          </div>
        </div> : <div className="mori-reference-add">
          <div className="mori-reference-empty">Nenhuma fotografia de referência selecionada. Adicione uma imagem do bonsai que vocês pretendem usar como modelo.</div>
          <div className="mori-reference-fields">
            <label>O que queremos reproduzir? (opcional)
              <textarea rows={2} maxLength={500} placeholder="Ex.: inclinação do tronco, formato da copa, distribuição dos galhos..." value={referenceCaption} onChange={e=>setReferenceCaption(e.target.value)}/>
            </label>
            <label>Fonte / autor / link da imagem (opcional)
              <input maxLength={500} placeholder="Ex.: foto própria ou endereço original" value={referenceSource} onChange={e=>setReferenceSource(e.target.value)}/>
            </label>
          </div>
          <button type="button" className="button button-outline" disabled={busy} onClick={()=>referenceInputRef.current?.click()}>
            <ImagePlus size={16}/> {busy ? 'Enviando...' : 'Adicionar fotografia de referência'}
          </button>
          <p className="photo-help">Use apenas imagens que vocês têm permissão para guardar; registre a fonte sempre que possível. A referência fica privada.</p>
        </div>}
      </section>}
      <div className="mori-gallery-timeline-heading">
        <h3>Registro de evolução</h3>
        <p>Fotografias e vídeos do próprio exemplar, organizados por data.</p>
      </div>
      {loading ? <p className="photo-wait"><LoaderCircle className="spinning" size={19}/> Carregando galeria...</p> :
        album.length ? <>
          <div className="photo-list-controls">
            <span>{album.length} arquivo{album.length === 1 ? '' : 's'} · Capa: {activeCover ? formatDate(photoDate(activeCover)) : 'nenhuma'}</span>
            <label>Ordenar <select aria-label="Ordenar fotografias" value={sort} onChange={e=>setSort(e.target.value as typeof sort)}>
              <option value="newest">Mais recentes</option><option value="oldest">Mais antigas</option>
            </select></label>
            {activeCover && <button className="button button-outline" type="button" disabled={busy} onClick={() => beginCoverEdit(activeCover)}><Crop size={16}/> Ajustar capa</button>}
            <button className="button button-outline" type="button" disabled={busy} onClick={() => {setComparing(old => !old);setCompareIds([]);}}>
              <CheckSquare2 size={16}/> {comparing ? 'Fechar comparação' : 'Comparar duas fotos'}
            </button>
          </div>
          {comparing && <p className="photo-compare-help" role="status">Selecione duas fotografias (não vídeos) para visualizar lado a lado. {compareIds.length}/2 selecionadas.</p>}
          <div className="photo-grid">{ordered.map(photo => <figure key={photo.id} className={`photo-figure ${compareIds.includes(photo.id) ? 'photo-selected' : ''}`}>
            {photo.media_type === 'video' ? <video controls preload="none" playsInline src={photo.signedUrl} aria-label={`Vídeo do exemplar ${plant.name} em ${formatDate(photoDate(photo))}`}/> : <a href={photo.signedUrl} target="_blank" rel="noreferrer" aria-label={`Abrir fotografia de ${formatDate(photoDate(photo))}`}><img src={photo.signedUrl} loading="lazy" decoding="async" alt={`Foto do exemplar ${plant.name} em ${formatDate(photoDate(photo))}`}/></a>}
            <figcaption className="photo-figcaption">
              <div><b><CalendarDays size={13}/> {formatDate(photoDate(photo))}</b>{photo.media_type === 'video' && <span><Video size={13}/> Vídeo</span>}{photo.care_log_id && <span>Vinculado a um manejo</span>}{photo.caption && <span>{photo.caption}</span>}</div>
              <div className="photo-figure-actions">
                {comparing && photo.media_type === 'image' && <button type="button" className="photo-icon-button" disabled={busy || (compareIds.length >= 2 && !compareIds.includes(photo.id))} onClick={()=>toggleCompare(photo.id)} aria-label={`${compareIds.includes(photo.id) ? 'Desmarcar' : 'Selecionar'} fotografia para comparar`} title="Selecionar para comparação"><CheckSquare2 size={16}/></button>}
                <button type="button" className={`photo-icon-button ${photo.is_cover ? 'photo-is-cover' : ''}`} disabled={busy || photo.media_type === 'video'} onClick={() => beginCoverEdit(photo)} aria-label={photo.is_cover ? 'Ajustar enquadramento da capa' : 'Definir foto e ajustar capa'} title={photo.is_cover ? 'Ajustar enquadramento da capa' : 'Escolher e ajustar como capa'}><Star size={16} fill={photo.is_cover ? 'currentColor' : 'none'}/></button>
                <button type="button" className="photo-icon-button" disabled={busy} onClick={()=>beginEdit(photo)} aria-label="Editar data e observação" title="Editar dados"><Pencil size={16}/></button>
                <button className="photo-delete" type="button" disabled={busy} onClick={() => void deletePhoto(photo)} aria-label="Excluir arquivo" title="Excluir arquivo permanentemente"><Trash2 size={16}/></button>
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
        </> : <div className="photo-empty"><Camera size={32}/><strong>Nenhum registro de evolução ainda</strong><span>Use “Adicionar foto ou vídeo” para documentar o desenvolvimento do próprio exemplar.</span></div>}
      <p className="photo-help">Os links privados para fotos e vídeos expiram em 15 minutos e são renovados automaticamente enquanto a galeria estiver aberta. Também é possível clicar em Atualizar.</p>
    </section>
    {cropPhoto && <div className="mori-cover-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setCropPhoto(null); }}>
      <CoverPositionEditor key={cropPhoto.id} imageUrl={cropPhoto.signedUrl} plantName={plant.name}
        initialX={cropPhoto.cover_position_x ?? 50} initialY={cropPhoto.cover_position_y ?? 50}
        initialZoom={cropPhoto.cover_zoom_percent ?? 100} initialFit={cropPhoto.cover_fit_mode ?? 'cover'}
        saving={busy} error={cropError}
        onCancel={() => { if (!busy) setCropPhoto(null); }} onSave={(x, y, zoom, fit) => void saveCoverFrame(x, y, zoom, fit)}/>
    </div>}
  </div>;
}
