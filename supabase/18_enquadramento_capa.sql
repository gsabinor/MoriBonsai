-- MORI BONSAI v1.4.2 — ajuste nao destrutivo de enquadramento da capa.
-- Executar DEPOIS das migracoes 16 e 17, de preferencia em ambiente de teste.
-- A foto original continua no bucket privado. Nenhuma linha ou imagem e removida.
BEGIN;

DO $$ BEGIN
  IF to_regclass('public.plants') IS NULL OR to_regclass('public.plant_photos') IS NULL
    OR to_regclass('public.collection_members') IS NULL THEN
    RAISE EXCEPTION 'Tabelas do Mori Bonsai nao encontradas; nao execute sem as migracoes anteriores.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='plant_photos' AND column_name='is_reference') THEN
    RAISE EXCEPTION 'A migracao 17 deve ser aplicada antes desta.';
  END IF;
END $$;

ALTER TABLE public.plant_photos
  ADD COLUMN IF NOT EXISTS cover_position_x smallint NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cover_position_y smallint NOT NULL DEFAULT 50;

ALTER TABLE public.plant_photos DROP CONSTRAINT IF EXISTS mori_cover_position_bounds;
ALTER TABLE public.plant_photos ADD CONSTRAINT mori_cover_position_bounds
  CHECK (cover_position_x BETWEEN 0 AND 100 AND cover_position_y BETWEEN 0 AND 100);

-- Append-only: preserva a ordem das colunas existentes da view v1.4.1.
CREATE OR REPLACE VIEW public.mori_plant_cover_photos
WITH (security_invoker=true) AS
SELECT DISTINCT ON (ph.plant_id)
  ph.plant_id, ph.collection_id, ph.id AS photo_id,
  ph.storage_path, ph.captured_on, ph.created_at,
  ph.cover_position_x, ph.cover_position_y
FROM public.plant_photos ph
WHERE ph.media_type='image' AND ph.is_reference=false
ORDER BY ph.plant_id, ph.is_cover DESC,
  ph.captured_on DESC NULLS LAST, ph.created_at DESC, ph.id DESC;
REVOKE ALL ON public.mori_plant_cover_photos FROM PUBLIC, anon;
GRANT SELECT ON public.mori_plant_cover_photos TO authenticated;

-- Define foto e enquadramento na mesma transacao, sob o mesmo bloqueio de exemplar.
-- A RLS segue ativa para leitura; a funcao verifica explicitamente a autorizacao
-- porque SECURITY DEFINER executa com privilegios do criador.
CREATE OR REPLACE FUNCTION public.set_mori_plant_cover_frame(
  p_plant_id uuid, p_photo_id uuid, p_position_x smallint, p_position_y smallint
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_collection_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Autenticacao obrigatoria' USING ERRCODE='42501';
  END IF;
  IF p_position_x IS NULL OR p_position_y IS NULL
     OR p_position_x NOT BETWEEN 0 AND 100 OR p_position_y NOT BETWEEN 0 AND 100 THEN
    RAISE EXCEPTION 'Posicao da capa fora dos limites de 0 a 100' USING ERRCODE='22023';
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
  SET is_cover = true, cover_position_x = p_position_x, cover_position_y = p_position_y
  WHERE ph.id = p_photo_id AND ph.plant_id = p_plant_id AND ph.collection_id = v_collection_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_mori_plant_cover_frame(uuid,uuid,smallint,smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_mori_plant_cover_frame(uuid,uuid,smallint,smallint) TO authenticated;
COMMIT;

-- Verificacao opcional:
-- SELECT cover_position_x,cover_position_y FROM public.plant_photos LIMIT 5;
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema='public' AND routine_name='set_mori_plant_cover_frame';
