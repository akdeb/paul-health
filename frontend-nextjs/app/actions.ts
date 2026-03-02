"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { addUserToDevice, dbCheckUserCode } from "@/db/devices";
import { getSimpleUserById } from "@/db/users";

export async function deleteUserApiKey(userId: string) {
    const supabase = await createClient();
    const { error } = await supabase.from("api_keys").delete().eq(
        "user_id",
        userId,
    );
    return error;
}

export const signInAction = async (formData: FormData) => {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return encodedRedirect("error", "/login", error.message);
    }

    return redirect("/home");
};

export const signOutAction = async () => {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return redirect("/login");
};

export const checkDoctorAction = async (authCode: string) => {
    return authCode === "kiwi-subtle-emu";
};

export const connectUserToDevice = async (
    userId: string,
    userDeviceCode: string,
) => {
    const supabase = await createClient();

    const isCodeValid = await dbCheckUserCode(supabase, userDeviceCode.trim());
    if (!isCodeValid) {
        return false;
    }

    // if user code is valid, add user to device
    const successfullyAdded = await addUserToDevice(
        supabase,
        userDeviceCode,
        userId,
    );
    return successfullyAdded;
};

export const fetchGithubStars = async (repo: string) => {
    try {
        const response = await fetch(`https://api.github.com/repos/${repo}`, {
            headers: {
                Accept: "application/vnd.github.v3+json",
            },
            next: {
                revalidate: 3600,
            },
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        const data = await response.json();
        return {
            stars: data.stargazers_count,
            error: null,
        };
    } catch (error) {
        console.error("Error fetching GitHub stats:", error);
        return {
            stars: null,
            error: "Failed to load GitHub stats",
        };
    }
};

export const isPremiumUser = async (userId: string) => {
    const supabase = await createClient();
    const dbUser = await getSimpleUserById(supabase, userId);
    return dbUser?.is_premium;
};
