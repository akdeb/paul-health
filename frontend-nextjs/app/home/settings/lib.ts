import { redirect } from "next/navigation";

import { getAllLanguages } from "@/db/languages";
import { ensurePatientForCaregiver } from "@/db/patients";
import { getUserById } from "@/db/users";
import { createClient } from "@/utils/supabase/server";

export async function getSettingsPageData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [initialUser, allLanguages] = await Promise.all([
    getUserById(supabase, user.id),
    getAllLanguages(supabase),
  ]);

  if (!initialUser) {
    redirect("/login");
  }

  let dbUser = initialUser;

  if (!dbUser.patient) {
    const patient = await ensurePatientForCaregiver(
      supabase,
      dbUser.user_id,
      dbUser.name,
      dbUser.patient_id ?? null,
    );

    if (patient) {
      const refreshedUser = await getUserById(supabase, user.id);
      if (refreshedUser) {
        dbUser = refreshedUser;
      } else {
        dbUser = {
          ...dbUser,
          patient_id: patient.patient_id,
          patient,
        };
      }
    }
  }

  return {
    dbUser,
    allLanguages,
  };
}
