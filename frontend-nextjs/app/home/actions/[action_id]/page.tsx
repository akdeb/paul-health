import { notFound, redirect } from "next/navigation";
import { Metadata } from "next";
import { getOpenGraphMetadata } from "@/lib/utils";
import { createClient } from "@/utils/supabase/server";
import { getUserById } from "@/db/users";
import { getActionById } from "@/db/actions";
import { dbGetConversationsByActionId } from "@/db/conversations";
import ActionTranscriptView from "@/app/components/Actions/ActionTranscriptView";

export const metadata: Metadata = {
  title: "Action Transcript",
  ...getOpenGraphMetadata("Action Transcript"),
};

export default async function ActionTranscriptPage({
  params,
}: {
  params: { action_id: string };
}) {
  const { action_id } = params;
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

  const action = await getActionById(supabase, action_id, dbUser.user_id);
  if (!action) {
    notFound();
  }

  if (action.type !== "web_chat" && action.type !== "device_chat") {
    notFound();
  }

  const conversations = await dbGetConversationsByActionId(supabase, action.action_id);

  return <ActionTranscriptView action={action} conversations={conversations} />;
}
