-- MORI BONSAI v1.4.3 — zoom, enquadramento e modo de foto inteira.
-- Executar DEPOIS da migracao 18. Nao remove nem modifica arquivos do Storage.
-- A alteracao afeta o banco conectado imediatamente; fazer backup antes.
BEGIN;
DO $$ BEGIN
  IF to_regclass('public.plant_photos') IS NULL OR to_regclass('public.mori_plant_cover_photos') IS NULL THEN
    RAISE EXCEPTION 'A migracao 18 deve ter sido aplicada antes da 19.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='plant_photos' AND column_name='cover_position_y') THEN
    RAISE EXCEPTION 'A migracao 18 deve ter sido aplicada antes da 19.';
  END IF;
END $$;

ALTER TABLE public.plant_photos
  ADD COLUMN IF NOT EXISTS cover_zoom_percent smallint NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS cover_fit_mode text NOT NULL DEFAULT 'cover';

ALTER TABLE public.plant_photos DROP CONSTRAINT IF EXISTS mori_cover_zoom_bounds;
ALTER TABLE public.plant_photos ADD CONSTRAINT mori_cover_zoom_bounds
  CHECK (cover_zoom_percent BETWEEN 100 AND 400);
ALTER TABLE public.plant_photos DROP CONSTRAINT IF EXISTS mori_cover_fit_mode_valid;
ALTER TABLE public.plant_photos ADD CONSTRAINT mori_cover_fit_mode_valid
  CHECK (cover_fit_mode IN ('cover','contain'));

-- Preserva a ordem das colunas existentes para CREATE OR REPLACE VIEW.
CREATE OR REPLACE VIEW public.mori_plant_cover_photos
WITH (security_invoker=true) AS
SELECT DISTINCT ON (ph.plant_id)
  ph.plant_id, ph.collection_id, ph.id AS photo_id,
  ph.storage_path, ph.captured_on, ph.created_at,
  ph.cover_position_x, ph.cover_position_y,
  ph.cover_zoom_percent, ph.cover_fit_mode
FROM public.plant_photos ph
WHERE ph.media_type='image' AND ph.is_reference=false
ORDER BY ph.plant_id, ph.is_cover DESC,
  ph.captured_on DESC NULLS LAST, ph.created_at DESC, ph.id DESC;
REVOKE ALL ON public.mori_plant_cover_photos FROM PUBLIC, anon;
GRANT SELECT ON public.mori_plant_cover_photos TO authenticated;

-- Nova RPC sem substituir a antiga, para manter compatibilidade com v1.4.2.
CREATE OR REPLACE FUNCTION public.set_mori_plant_cover_frame_v2(
  p_plant_id uuid, p_photo_id uuid, p_position_x smallint, p_position_y smallint,
  p_zoom_percent smallint, p_fit_mode text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_collection_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Autenticacao obrigatoria' USING ERRCODE='42501';
  END IF;
  IF p_position_x IS NULL OR p_position_y IS NULL
     OR p_position_x NOT BETWEEN 0 AND 100 OR p_position_y NOT BETWEEN 0 AND 100
     OR p_zoom_percent IS NULL OR p_zoom_percent NOT BETWEEN 100 AND 400
     OR p_fit_mode IS NULL OR p_fit_mode NOT IN ('cover','contain') THEN
    RAISE EXCEPTION 'Parametros de enquadramento invalidos' USING ERRCODE='22023';
  END IF;
  SELECT p.collection_id INTO v_collection_id
  FROM public.plants p
  JOIN public.collection_members cm ON cm.collection_id = p.collection_id
  WHERE p.id = p_plant_id AND p.deleted_at IS NULL
    AND cm.user_id = (SELECT auth.uid())
  FOR UPDATE OF p;
  IF v_collection_id IS NULL THEN
    RAISE EXCEPTION 'Exemplar inexistente ou acesso nao autorizado' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.plant_photos ph
    WHERE ph.id = p_photo_id AND ph.plant_id = p_plant_id
      AND ph.collection_id = v_collection_id
      AND ph.media_type = 'image' AND ph.is_reference = false
  ) THEN
    RAISE EXCEPTION 'A capa deve ser uma fotografia do exemplar' USING ERRCODE='42501';
  END IF;
  UPDATE public.plant_photos ph SET is_cover = false
  WHERE ph.plant_id = p_plant_id AND ph.collection_id = v_collection_id AND ph.is_cover;
  UPDATE public.plant_photos ph
  SET is_cover = true, cover_position_x = p_position_x, cover_position_y = p_position_y,
      cover_zoom_percent = CASE WHEN p_fit_mode = 'contain' THEN 100 ELSE p_zoom_percent END,
      cover_fit_mode = p_fit_mode
  WHERE ph.id = p_photo_id AND ph.plant_id = p_plant_id AND ph.collection_id = v_collection_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_mori_plant_cover_frame_v2(uuid,uuid,smallint,smallint,smallint,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_mori_plant_cover_frame_v2(uuid,uuid,smallint,smallint,smallint,text) TO authenticated;
COMMIT;

-- Conferencia opcional:
-- SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='plant_photos' AND column_name LIKE 'cover_%';
