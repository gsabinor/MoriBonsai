import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const BUCKET = 'mori-photos';
const URL_LIFETIME = 900;
const RENEW_INTERVAL = 12 * 60 * 1000;

type CoverRow = { plant_id: string; storage_path: string };

type CoverState = { urls: Record<string, string>; loading: boolean; error: string };

/** Uma consulta de capas para a colecao + uma chamada agrupada de URLs privadas.
 * Evita uma requisicao por card e so roda enquanto a colecao esta visivel. */
export function usePlantCovers(collectionId: string | undefined, enabled: boolean, revision = 0): CoverState {
  const [state, setState] = useState<CoverState>({ urls: {}, loading: false, error: '' });

  useEffect(() => {
    if (!supabase || !collectionId || !enabled) {
      setState({ urls: {}, loading: false, error: '' });
      return;
    }
    const client = supabase;
    let active = true;

    const load = async () => {
      if (active) setState(previous => ({ ...previous, loading: true, error: '' }));
      try {
        const { data, error } = await client.from('mori_plant_cover_photos')
          .select('plant_id, storage_path').eq('collection_id', collectionId).limit(250);
        if (error) throw error;
        const rows = (data ?? []) as CoverRow[];
        if (!rows.length) {
          if (active) setState({ urls: {}, loading: false, error: '' });
          return;
        }
        const { data: signed, error: signError } = await client.storage.from(BUCKET)
          .createSignedUrls(rows.map(photo => photo.storage_path), URL_LIFETIME);
        if (signError) throw signError;
        const urls: Record<string, string> = {};
        rows.forEach((photo, i) => {
          if (signed?.[i]?.signedUrl) urls[photo.plant_id] = signed[i].signedUrl;
        });
        if (active) setState({ urls, loading: false, error: '' });
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
