CREATE TABLE IF NOT EXISTS public.patients (
    patient_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    age integer DEFAULT 0 NOT NULL,
    gender text DEFAULT ''::text NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    jobs text[] DEFAULT '{}'::text[] NOT NULL,
    relations text[] DEFAULT '{}'::text[] NOT NULL,
    stories text[] DEFAULT '{}'::text[] NOT NULL,
    avoid text[] DEFAULT '{}'::text[] NOT NULL,
    caregiver_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    about text DEFAULT ''::text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS patients_caregiver_id_key ON public.patients(caregiver_id);

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS patient_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_patient_id_fkey'
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_patient_id_fkey
            FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE SET NULL;
    END IF;
END $$;
