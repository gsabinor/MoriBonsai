-- MORI BONSAI WEB v1.4 — Ambiente, idade, luz, anexos e videos.
-- Execute UMA vez no SQL Editor do MESMO projeto Supabase após a migração 15.
-- Faça backup antes. Não apaga fotos, manejos ou exemplares existentes.
BEGIN;

DO $$ BEGIN
  IF to_regclass('public.plants') IS NULL OR to_regclass('public.plant_photos') IS NULL
    OR to_regclass('public.care_logs') IS NULL THEN
    RAISE EXCEPTION 'Tabelas obrigatórias não encontradas; confira o projeto Supabase.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='mori-photos' AND public=false) THEN
    RAISE EXCEPTION 'Bucket privado mori-photos não encontrado ou está público. Interrompido.';
  END IF;
END $$;

ALTER TABLE public.plants
  ADD COLUMN IF NOT EXISTS estimated_age_years numeric(5,1),
  ADD COLUMN IF NOT EXISTS light_preference text NOT NULL DEFAULT 'Não confirmado';

ALTER TABLE public.plants DROP CONSTRAINT IF EXISTS plants_area_check;
ALTER TABLE public.plants ADD CONSTRAINT plants_area_check
  CHECK (area IN ('Jardim','Área protegida','Apartamento'));
ALTER TABLE public.plants DROP CONSTRAINT IF EXISTS mori_plants_age_range;
ALTER TABLE public.plants ADD CONSTRAINT mori_plants_age_range
  CHECK (estimated_age_years IS NULL OR estimated_age_years BETWEEN 0 AND 300);
ALTER TABLE public.plants DROP CONSTRAINT IF EXISTS mori_plants_light_preference;
ALTER TABLE public.plants ADD CONSTRAINT mori_plants_light_preference
  CHECK (light_preference IN ('Sol pleno','Meia-sombra','Sombra','Não confirmado'));
GRANT UPDATE (estimated_age_years, light_preference) ON public.plants TO authenticated;

ALTER TABLE public.plant_photos
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS care_log_id uuid REFERENCES public.care_logs(id) ON DELETE SET NULL;
ALTER TABLE public.plant_photos DROP CONSTRAINT IF EXISTS mori_media_type_valid;
ALTER TABLE public.plant_photos ADD CONSTRAINT mori_media_type_valid
  CHECK (media_type IN ('image','video'));
ALTER TABLE public.plant_photos DROP CONSTRAINT IF EXISTS mori_video_is_not_cover;
ALTER TABLE public.plant_photos ADD CONSTRAINT mori_video_is_not_cover
  CHECK (media_type = 'image' OR is_cover = false);
CREATE INDEX IF NOT EXISTS mori_media_by_care_log
  ON public.plant_photos (care_log_id) WHERE care_log_id IS NOT NULL;

-- Garante que a foto/video nao possa ser vinculada a um manejo de outro bonsai ou coleção.
CREATE OR REPLACE FUNCTION public.mori_validate_care_media()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.care_log_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.care_logs c
    WHERE c.id=NEW.care_log_id AND c.plant_id=NEW.plant_id
      AND c.collection_id=NEW.collection_id AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Manejo não encontrado, excluído ou de outro exemplar' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mori_validate_care_media_trigger ON public.plant_photos;
CREATE TRIGGER mori_validate_care_media_trigger
  BEFORE INSERT OR UPDATE OF care_log_id,plant_id,collection_id
  ON public.plant_photos FOR EACH ROW
  EXECUTE FUNCTION public.mori_validate_care_media();

-- Não mudar o bucket para público. Só amplia os MIME aceitos e o limite por arquivo.
UPDATE storage.buckets SET
  file_size_limit=20971520,
  allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm']::text[]
WHERE id='mori-photos' AND public=false;

-- A capa deve ser sempre uma imagem, nunca um vídeo.
CREATE OR REPLACE VIEW public.mori_plant_cover_photos
WITH (security_invoker = true) AS
SELECT DISTINCT ON (ph.plant_id)
  ph.plant_id, ph.collection_id, ph.id as photo_id,
  ph.storage_path, ph.captured_on, ph.created_at
FROM public.plant_photos ph
WHERE ph.media_type='image'
ORDER BY ph.plant_id,ph.is_cover DESC,
  ph.captured_on DESC NULLS LAST, ph.created_at DESC, ph.id DESC;

COMMIT;
-- Confira:
-- SELECT area,estimated_age_years,light_preference FROM public.plants LIMIT 5;
-- SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='mori-photos';
-- SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='plant_photos';
