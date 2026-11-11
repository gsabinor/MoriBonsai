import { supabase } from './supabase';
import { createPhotoId } from './photoId';

const BUCKET = 'mori-photos';
const IMAGE_MAX_INPUT = 15 * 1024 * 1024;
const IMAGE_MAX_OUTPUT = 5 * 1024 * 1024;
const VIDEO_MAX_BYTES = 20 * 1024 * 1024;
const MAX_SIDE = 1600;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES: Record<string,string> = {'video/mp4': 'mp4', 'video/webm': 'webm'};

export type MediaKind = 'image' | 'video';
export type UploadMoriMediaOptions = {
  collectionId: string;
  plantId: string;
  file: File;
  caption?: string | null;
  capturedOn?: string | null;
  careLogId?: string | null;
  isReference?: boolean;
  referenceSource?: string | null;
  onStage?: (stage: string) => void;
};

async function optimizeImage(file: File): Promise<Blob> {
  if (file.size > IMAGE_MAX_INPUT) throw new Error('A fotografia original deve ter até 15 MB.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('O navegador não conseguiu abrir a fotografia.'); }
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível processar a fotografia.');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('Falha ao comprimir a imagem.')), 'image/webp', .82);
    });
    if (blob.size > IMAGE_MAX_OUTPUT) throw new Error('Fotografia otimizada excede 5 MB.');
    return blob;
  } finally { bitmap.close(); }
}

/** Envia a mídia para o bucket privado e registra seus metadados.
 * Caso o banco recuse o vínculo, tenta desfazer o upload. */
export async function uploadMoriMedia(options: UploadMoriMediaOptions): Promise<void> {
  if (!supabase) throw new Error('Supabase indisponível.');
  const {collectionId, plantId, file, caption, capturedOn, careLogId, isReference = false, referenceSource, onStage} = options;
  const isImage = IMAGE_TYPES.includes(file.type);
  const extension = isImage ? 'webp' : VIDEO_TYPES[file.type];
  if (!extension) throw new Error('Use fotos JPEG, PNG, WebP ou vídeos MP4/WebM.');
  const kind: MediaKind = isImage ? 'image' : 'video';
  if (isReference && !isImage) throw new Error('A referência visual deve ser uma fotografia.');
  if (isReference && careLogId) throw new Error('Uma referência visual não pode ser vinculada a um manejo.');
  if (!isImage && file.size > VIDEO_MAX_BYTES) throw new Error('O vídeo deve ter até 20 MB. Comprima ou recorte o vídeo antes de enviar.');
  onStage?.(isImage ? 'Otimizando fotografia...' : 'Preparando vídeo...');
  const bytes: Blob = isImage ? await optimizeImage(file) : file;
  const path = `${collectionId}/${plantId}/${createPhotoId()}.${extension}`;
  onStage?.(`Enviando ${isImage ? 'fotografia' : 'vídeo'} ao armazenamento privado...`);
  const {error: storageError} = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: isImage ? 'image/webp' : file.type, upsert: false, cacheControl: '3600',
  });
  if (storageError) throw new Error(`Falha no Storage: ${storageError.message}`);
  onStage?.('Registrando mídia na galeria...');
  const {error: insertError} = await supabase.from('plant_photos').insert({
    collection_id: collectionId, plant_id: plantId, storage_path: path,
    media_type: kind, captured_on: capturedOn || null,
    caption: caption?.trim().slice(0,500) || null, care_log_id: careLogId || null,
    is_reference: isReference, reference_source: isReference ? referenceSource?.trim().slice(0,500) || null : null,
  });
  if (insertError) {
    const {error: cleanupError} = await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(`Registro recusado pelo banco: ${insertError.message}${cleanupError ? '. O arquivo deverá ser removido manualmente do Storage.' : ''}`);
  }
}
