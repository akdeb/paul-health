import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOpenGraphMetadata } from "@/lib/utils";
import { getUserById } from "@/db/users";
import { createClient } from "@/utils/supabase/server";
import HomePageSubtitles from "@/app/components/HomePageSubtitles";
import { getActionsByUserId } from "@/db/actions";
import ActionsFeed from "@/app/components/Actions/ActionsFeed";
import ClearHistoryButton from "@/app/components/Actions/ClearHistoryButton";

export const metadata: Metadata = {
    title: "Actions",
    ...getOpenGraphMetadata("Actions"),
};

export default async function Home() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const dbUser = await getUserById(supabase, user.id);
    if (!dbUser) {
        redirect("/login");
    }

    const initialActions = await getActionsByUserId(supabase, dbUser.user_id, {
        limit: 20,
        offset: 0,
    });

    return (
        <div className="flex flex-col gap-6">
            <div className="flex gap-3 flex-row justify-between">
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-normal">Actions</h1>
                <HomePageSubtitles user={dbUser} page="actions" />
              </div>
              <ClearHistoryButton />
            </div>
            <ActionsFeed initialActions={initialActions} />
        </div>
    );
}
