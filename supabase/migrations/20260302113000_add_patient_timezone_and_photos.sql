ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';

CREATE TABLE IF NOT EXISTS public.photos (
    photo_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    url text NOT NULL,
    caption text NOT NULL DEFAULT '',
    type text NOT NULL DEFAULT 'album',
    patient_id uuid NOT NULL REFERENCES public.patients(patient_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS photos_patient_id_idx
ON public.photos(patient_id);
