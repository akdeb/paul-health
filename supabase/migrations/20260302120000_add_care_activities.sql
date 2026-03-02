CREATE TABLE IF NOT EXISTS public.care_activities (
    activity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    caregiver_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    patient_id uuid NOT NULL REFERENCES public.patients(patient_id) ON DELETE CASCADE,
    type text NOT NULL,
    title text NOT NULL,
    instructions text NOT NULL DEFAULT '',
    cron text NOT NULL,
    timezone text NOT NULL DEFAULT 'UTC',
    enabled boolean NOT NULL DEFAULT true,
    starts_at timestamptz,
    ends_at timestamptz,
    CONSTRAINT care_activities_type_check CHECK (
        type IN (
            'guess_flag',
            'guess_capital',
            'conversation_news',
            'medication_reminder',
            'memory_prompt'
        )
    )
);

CREATE INDEX IF NOT EXISTS care_activities_caregiver_id_idx
ON public.care_activities(caregiver_id);

CREATE INDEX IF NOT EXISTS care_activities_patient_id_idx
ON public.care_activities(patient_id);
