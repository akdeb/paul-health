import { type SupabaseClient } from "@supabase/supabase-js";

export const getPhotosByPatientId = async (
    supabase: SupabaseClient,
    patientId: string,
): Promise<IPhoto[]> => {
    const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

    if (error) {
        console.log("error in getPhotosByPatientId", error);
        return [];
    }

    return data as IPhoto[];
};

export const createPhoto = async (
    supabase: SupabaseClient,
    photo: Omit<IPhoto, "photo_id">,
): Promise<IPhoto | null> => {
    const { data, error } = await supabase
        .from("photos")
        .insert(photo)
        .select()
        .single();

    if (error) {
        console.log("error in createPhoto", error);
        return null;
    }

    return data as IPhoto;
};

export const deletePhoto = async (
    supabase: SupabaseClient,
    photoId: string,
): Promise<boolean> => {
    const { error } = await supabase
        .from("photos")
        .delete()
        .eq("photo_id", photoId);

    if (error) {
        console.log("error in deletePhoto", error);
        return false;
    }

    return true;
};
