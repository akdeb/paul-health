import { redirect } from "next/navigation";

import { getAllLanguages } from "@/db/languages";
import { getUserById } from "@/db/users";
import { createClient } from "@/utils/supabase/server";

export async function getSettingsPageData() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [dbUser, allLanguages] = await Promise.all([
    getUserById(supabase, user.id),
    getAllLanguages(supabase),
  ]);

  if (!dbUser) {
    redirect("/login");
  }

  return {
    dbUser,
    allLanguages,
  };
}
