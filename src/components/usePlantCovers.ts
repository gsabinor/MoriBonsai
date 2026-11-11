import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CoverFrame } from '../lib/coverFrame';

const BUCKET = 'mori-photos';
const URL_LIFETIME = 900;
const RENEW_INTERVAL = 12 * 60 * 1000;

type CoverRow = { plant_id: string; storage_path: string; cover_position_x: number; cover_position_y: number; cover_zoom_percent: number; cover_fit_mode: CoverFrame['fit'] };
export type CoverPosition = CoverFrame;

type CoverState = { urls: Record<string, string>; positions: Record<string, CoverPosition>; loading: boolean; error: string };

/** Uma consulta de capas para a colecao + uma chamada agrupada de URLs privadas.
 * Evita uma requisicao por card e so roda enquanto a colecao esta visivel. */
export function usePlantCovers(collectionId: string | undefined, enabled: boolean, revision = 0): CoverState {
  const [state, setState] = useState<CoverState>({ urls: {}, positions: {}, loading: false, error: '' });

  useEffect(() => {
    if (!supabase || !collectionId || !enabled) {
      setState({ urls: {}, positions: {}, loading: false, error: '' });
      return;
    }
    const client = supabase;
    let active = true;

    const load = async () => {
      if (active) setState(previous => ({ ...previous, loading: true, error: '' }));
      try {
        const { data, error } = await client.from('mori_plant_cover_photos')
          .select('plant_id, storage_path, cover_position_x, cover_position_y, cover_zoom_percent, cover_fit_mode').eq('collection_id', collectionId).limit(250);
        if (error) throw error;
        const rows = (data ?? []) as CoverRow[];
        if (!rows.length) {
          if (active) setState({ urls: {}, positions: {}, loading: false, error: '' });
          return;
        }
        const { data: signed, error: signError } = await client.storage.from(BUCKET)
          .createSignedUrls(rows.map(photo => photo.storage_path), URL_LIFETIME);
        if (signError) throw signError;
        const urls: Record<string, string> = {};
        const positions: Record<string, CoverPosition> = {};
        rows.forEach((photo, i) => {
          if (signed?.[i]?.signedUrl) {
            urls[photo.plant_id] = signed[i].signedUrl;
            positions[photo.plant_id] = { x: photo.cover_position_x ?? 50, y: photo.cover_position_y ?? 50, zoom: photo.cover_zoom_percent ?? 100, fit: photo.cover_fit_mode === 'contain' ? 'contain' : 'cover' };
          }
        });
        if (active) setState({ urls, positions, loading: false, error: '' });
      } catch (cause) {
        if (active) setState(prev => ({ ...prev, loading: false, error: cause instanceof Error ? cause.message : String(cause) }));
      }
    };

    void load();
    const timer = window.setInterval(() => { void load(); }, RENEW_INTERVAL);
    return () => { active = false; window.clearInterval(timer); };
  }, [collectionId, enabled, revision]);

  return state;
}
