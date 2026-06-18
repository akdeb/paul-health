import { NextResponse } from "next/server";

import { getUserById } from "@/db/users";
import { createDefaultOnboardingChecklist } from "@/lib/onboarding";
import { createClient } from "@/utils/supabase/server";

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await getUserById(supabase, user.id);
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("actions")
    .delete()
    .eq("user_id", dbUser.user_id);

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to clear action history" },
      { status: 500 },
    );
  }

  const patientId = dbUser.patient?.patient_id ?? dbUser.patient_id;
  if (patientId) {
    const { error: checklistError } = await supabase
      .from("patients")
      .update({ checklist: createDefaultOnboardingChecklist() })
      .eq("patient_id", patientId);

    if (checklistError) {
      return NextResponse.json(
        { error: checklistError.message ?? "Failed to reset onboarding checklist" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ success: true });
}
