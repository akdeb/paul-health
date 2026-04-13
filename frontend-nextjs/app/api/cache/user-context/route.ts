import { NextResponse } from "next/server";

import { setUserContextCache } from "@/lib/cache";
import { createClient } from "@/utils/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: dbUser, error: userContextError } = await supabase
    .from("users")
    .select(
      [
        "*",
        "language:languages(name)",
        "personality:personalities!users_personality_id_fkey(*)",
        "device:devices!users_device_id_fkey(*)",
        "patient:patients!users_patient_id_fkey(*)",
      ].join(","),
    )
    .eq("user_id", user.id)
    .single();

  if (userContextError || !dbUser) {
    return NextResponse.json(
      { error: "Failed to load fresh user context" },
      { status: 500 },
    );
  }

  const refreshed = await setUserContextCache(user.email, dbUser as unknown as IUser);

  return NextResponse.json({ refreshed });
}
