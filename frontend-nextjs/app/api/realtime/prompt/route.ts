import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getUserById } from "@/db/users";
import {
  buildCompiledSystemPrompt,
  ConversationTarget,
} from "@/app/components/Realtime/lib/promptContext";

const getChatHistory = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) => {
  const { data: actions, error: actionsError } = await supabase
    .from("actions")
    .select("action_id")
    .eq("user_id", userId)
    .eq("type", "web_chat")
    .order("created_at", { ascending: false })
    .limit(10);

  if (actionsError) {
    throw actionsError;
  }

  const actionIds = (actions ?? []).map((action) => action.action_id);
  if (actionIds.length === 0) {
    return "";
  }

  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .in("action_id", actionIds)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((chat) => `${chat.role}: ${chat.content}`)
    .join("\n");
};

export async function GET(request: NextRequest) {
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

  const conversationTargetParam = request.nextUrl.searchParams.get("conversationTarget");
  const conversationTarget: ConversationTarget =
    conversationTargetParam === "caregiver" ? "caregiver" : "patient";

  const chatHistory = await getChatHistory(supabase, dbUser.user_id);
  const prompt = buildCompiledSystemPrompt({
    characterPrompt: dbUser.personality?.character_prompt ?? "",
    voicePrompt: dbUser.personality?.voice_prompt ?? "",
    accent: dbUser.personality?.accent ?? "",
    tone: dbUser.personality?.tone ?? [],
    conversationTarget,
    languageName: dbUser.language?.name,
    chatHistory,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ prompt });
}
