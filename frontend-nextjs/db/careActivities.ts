import { type SupabaseClient } from "@supabase/supabase-js";

export const getCareActivitiesByPatientId = async (
    supabase: SupabaseClient,
    patientId: string,
): Promise<ICareActivity[]> => {
    const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: true });

    if (error) {
        console.log("error in getCareActivitiesByPatientId", error);
        return [];
    }

    return data as ICareActivity[];
};

export const createCareActivity = async (
    supabase: SupabaseClient,
    activity: Omit<ICareActivity, "job_id" | "created_at">,
): Promise<ICareActivity | null> => {
    const { data, error } = await supabase
        .from("jobs")
        .insert(activity)
        .select()
        .single();

    if (error) {
        console.log("error in createCareActivity", error);
        return null;
    }

    return data as ICareActivity;
};

export const updateCareActivity = async (
    supabase: SupabaseClient,
    jobId: string,
    activity: Partial<ICareActivity>,
): Promise<ICareActivity | null> => {
    const { data, error } = await supabase
        .from("jobs")
        .update({
            ...activity,
        })
        .eq("job_id", jobId)
        .select()
        .single();

    if (error) {
        console.log("error in updateCareActivity", error);
        return null;
    }

    return data as ICareActivity;
};

export const deleteCareActivity = async (
    supabase: SupabaseClient,
    jobId: string,
): Promise<boolean> => {
    const { error } = await supabase
        .from("jobs")
        .delete()
        .eq("job_id", jobId);

    if (error) {
        console.log("error in deleteCareActivity", error);
        return false;
    }

    return true;
};
