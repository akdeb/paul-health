import { createServerClient } from "@supabase/ssr";
import type { SupabaseClientOptions } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const createClient = async (opts?: SupabaseClientOptions<"public">) => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...opts,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component where setting cookies is disallowed.
            // OK if you refresh sessions via proxy/middleware.
          }
        },
      },
    }
  );
};