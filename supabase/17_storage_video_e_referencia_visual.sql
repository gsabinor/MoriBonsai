-- MORI BONSAI WEB v1.4.1
-- Corrige o bloqueio de vídeos no Storage e adiciona uma referência visual por exemplar.
-- Execute APÓS a migração 16 e faça backup antes.
-- Não altera o acesso ao bucket, não recria tabelas e não exclui arquivos existentes.
BEGIN;

DO $$ BEGIN
  IF to_regclass('public.plants') IS NULL OR to_regclass('public.collection_members') IS NULL
    OR to_regclass('public.plant_photos') IS NULL THEN
    RAISE EXCEPTION 'Tabelas do Mori Bonsai ausentes. Confira o Supabase antes de executar.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='mori-photos' AND public=false) THEN
    RAISE EXCEPTION 'O bucket mori-photos precisa existir e continuar privado.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='plant_photos' AND column_name='media_type'
  ) THEN
    RAISE EXCEPTION 'Execute primeiro a migração 16_colecao_manejos_midias.sql.';
  END IF;
END $$;

-- A função instalada pela migração 05 aceitava somente arquivos .webp.
-- O caminho continua estritamente limitado a UUIDs da coleção, do exemplar e do arquivo.
-- A permissão depende de auth.uid() e de participação na coleção, não da extensão apenas.
CREATE OR REPLACE FUNCTION public.can_access_mori_photo_path(_path text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    (SELECT auth.uid()) IS NOT NULL
    AND _path ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(webp|mp4|webm)$'
    AND EXISTS (
      SELECT 1 FROM public.plants p
      JOIN public.collection_members cm ON cm.collection_id = p.collection_id
      WHERE p.collection_id::text = split_part(_path, '/', 1)
        AND p.id::text = split_part(_path, '/', 2)
        AND p.deleted_at IS NULL
        AND cm.user_id = (SELECT auth.uid())
    );
$$;
REVOKE ALL ON FUNCTION public.can_access_mori_photo_path(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_mori_photo_path(text) TO authenticated;

-- Apenas uma fotografia de inspiração por exemplar. Não é mídia histórica,
-- não participa da comparação fotográfica e não pode ser usada como capa.
ALTER TABLE public.plant_photos
  ADD COLUMN IF NOT EXISTS is_reference boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reference_source text;

ALTER TABLE public.plant_photos DROP CONSTRAINT IF EXISTS mori_reference_is_separate;
ALTER TABLE public.plant_photos ADD CONSTRAINT mori_reference_is_separate
  CHECK (
    NOT is_reference OR
    (media_type = 'image' AND is_cover = false AND care_log_id IS NULL)
  );
ALTER TABLE public.plant_photos DROP CONSTRAINT IF EXISTS mori_reference_source_length;
ALTER TABLE public.plant_photos ADD CONSTRAINT mori_reference_source_length
  CHECK (reference_source IS NULL OR char_length(reference_source) <= 500);
CREATE UNIQUE INDEX IF NOT EXISTS mori_one_reference_per_plant
  ON public.plant_photos(collection_id,plant_id) WHERE is_reference = true;

-- Os membros já têm INSERT, SELECT e DELETE na tabela, com RLS de coleção.
-- Autoriza apenas a edição da fonte, respeitando a política UPDATE já existente.
GRANT UPDATE (reference_source) ON public.plant_photos TO authenticated;

-- A vista da capa também precisa ignorar referências, inclusive quando não há
-- nenhuma fotografia histórica cadastrada para o exemplar.
CREATE OR REPLACE VIEW public.mori_plant_cover_photos
WITH (security_invoker = true) AS
SELECT DISTINCT ON (ph.plant_id)
  ph.plant_id, ph.collection_id, ph.id AS photo_id,
  ph.storage_path, ph.captured_on, ph.created_at
FROM public.plant_photos ph
WHERE ph.media_type='image' AND ph.is_reference=false
ORDER BY ph.plant_id, ph.is_cover DESC,
  ph.captured_on DESC NULLS LAST, ph.created_at DESC, ph.id DESC;

COMMIT;

-- Diagnóstico opcional (leitura):
-- SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'mori-photos';
-- SELECT policyname, cmd FROM pg_policies WHERE schemaname='storage' AND tablename='objects';
-- SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='plant_photos' AND column_name IN ('is_reference','reference_source');
