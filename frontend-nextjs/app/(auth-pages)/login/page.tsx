import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { SubmitButton } from "./submit-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface LoginProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default async function Login({ searchParams }: LoginProps) {
  const signInOrSignUp = async (formData: FormData) => {
    "use server";

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const supabase = createClient();

    // Try to sign in first
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // If sign in succeeds, redirect to home
    if (!signInError) {
      return redirect("/home");
    }

    return redirect("/login?message=Paul is currently in beta. Please contact us to get access.");
  };

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2">
      <Card className="sm:bg-white bg-transparent rounded-3xl shadow-none">
        <CardHeader>
          <CardTitle className="flex flex-row gap-1 items-center text-2xl font-bold justify-center font-shipporiMinchoB1">
            Login to PAUL
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form className="flex-1 flex flex-col w-full justify-center gap-4">
            <Label className="text-md" htmlFor="email">
              Email
            </Label>
            <input
              className="rounded-md px-4 py-2 bg-inherit border"
              name="email"
              placeholder="you@example.com"
              required
            />
            <Label className="text-md" htmlFor="email">
              Password
            </Label>

            <input
              className="rounded-md px-4 py-2 bg-inherit border"
              type="password"
              name="password"
              placeholder="••••••••"
              required
            />

            <SubmitButton
              formAction={signInOrSignUp}
              className="text-sm font-medium bg-gray-100 hover:bg-gray-50 dark:text-stone-900 border-[0.1px] rounded-full px-4 py-2 text-foreground my-2"
              pendingText="Signing In..."
            >
              Continue with Email
            </SubmitButton>
            {searchParams?.message && (
              <p className="p-4 rounded-md border bg-green-50 border-green-400 text-gray-900 text-center text-sm">
                {searchParams.message}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
