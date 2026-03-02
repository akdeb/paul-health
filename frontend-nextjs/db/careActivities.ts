import { type SupabaseClient } from "@supabase/supabase-js";

export const getCareActivitiesByPatientId = async (
    supabase: SupabaseClient,
    patientId: string,
): Promise<ICareActivity[]> => {
    const { data, error } = await supabase
        .from("care_activities")
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
    activity: Omit<ICareActivity, "activity_id" | "created_at" | "updated_at">,
): Promise<ICareActivity | null> => {
    const { data, error } = await supabase
        .from("care_activities")
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
    activityId: string,
    activity: Partial<ICareActivity>,
): Promise<ICareActivity | null> => {
    const { data, error } = await supabase
        .from("care_activities")
        .update({
            ...activity,
            updated_at: new Date().toISOString(),
        })
        .eq("activity_id", activityId)
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
    activityId: string,
): Promise<boolean> => {
    const { error } = await supabase
        .from("care_activities")
        .delete()
        .eq("activity_id", activityId);

    if (error) {
        console.log("error in deleteCareActivity", error);
        return false;
    }

    return true;
};
