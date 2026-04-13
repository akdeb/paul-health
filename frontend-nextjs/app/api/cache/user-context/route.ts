import { NextResponse } from "next/server";

import { invalidateUserContextCache } from "@/lib/cache";
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

  const invalidated = await invalidateUserContextCache(user.email);

  return NextResponse.json({ invalidated });
}
