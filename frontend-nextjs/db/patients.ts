import { type SupabaseClient } from "@supabase/supabase-js";

export const getPatientById = async (
    supabase: SupabaseClient,
    patientId: string,
): Promise<IPatient | null> => {
    const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("patient_id", patientId)
        .single();

    if (error) {
        console.log("error in getPatientById", error);
        return null;
    }

    return data as IPatient;
};

export const getPatientByCaregiverId = async (
    supabase: SupabaseClient,
    caregiverId: string,
): Promise<IPatient | null> => {
    const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("caregiver_id", caregiverId)
        .single();

    if (error) {
        return null;
    }

    return data as IPatient;
};

export const createPatient = async (
    supabase: SupabaseClient,
    patient: Partial<IPatient> & { caregiver_id: string },
): Promise<IPatient | null> => {
    const { data, error } = await supabase
        .from("patients")
        .insert({
            name: patient.name ?? "",
            age: patient.age ?? 0,
            gender: patient.gender ?? "",
            address: patient.address ?? "",
            jobs: patient.jobs ?? [],
            relations: patient.relations ?? [],
            stories: patient.stories ?? [],
            avoid: patient.avoid ?? [],
            about: patient.about ?? "",
            timezone: patient.timezone ?? "UTC",
            caregiver_id: patient.caregiver_id,
        })
        .select()
        .single();

    if (error) {
        console.log("error in createPatient", error);
        return null;
    }

    return data as IPatient;
};

export const updatePatient = async (
    supabase: SupabaseClient,
    patientId: string,
    patient: Partial<IPatient>,
): Promise<IPatient | null> => {
    const { data, error } = await supabase
        .from("patients")
        .update(patient)
        .eq("patient_id", patientId)
        .select()
        .single();

    if (error) {
        console.log("error in updatePatient", error);
        return null;
    }

    return data as IPatient;
};

export const ensurePatientForCaregiver = async (
    supabase: SupabaseClient,
    caregiverId: string,
    caregiverName: string,
    patientId?: string | null,
): Promise<IPatient | null> => {
    if (patientId) {
        const existingById = await getPatientById(supabase, patientId);
        if (existingById) {
            return existingById;
        }
    }

    const existingByCaregiver = await getPatientByCaregiverId(
        supabase,
        caregiverId,
    );
    if (existingByCaregiver) {
        await supabase
            .from("users")
            .update({ patient_id: existingByCaregiver.patient_id })
            .eq("user_id", caregiverId);
        return existingByCaregiver;
    }

    const createdPatient = await createPatient(supabase, {
        caregiver_id: caregiverId,
        name: "",
        age: 0,
        gender: "non-binary",
        address: "",
        jobs: [],
        relations: [],
        stories: [],
        avoid: [],
        about: "",
        timezone: "UTC",
    });

    if (!createdPatient) {
        return null;
    }

    await supabase
        .from("users")
        .update({ patient_id: createdPatient.patient_id, name: caregiverName })
        .eq("user_id", caregiverId);

    return createdPatient;
};
