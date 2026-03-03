import { createClient } from "@/utils/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getUserById } from "@/db/users";
import {
  buildCompiledSystemPrompt,
  ConversationTarget,
} from "@/app/components/Realtime/lib/promptContext";

interface IPayload {
  user: IUser;
  supabase: SupabaseClient;
  timestamp: string;
}

const getChatHistory = async (
  supabase: SupabaseClient,
  userId: string,
  actionType: Extract<ActionType, "web_chat" | "device_chat">,
): Promise<string> => {
  try {
    const { data: actions, error: actionsError } = await supabase
      .from("actions")
      .select("action_id")
      .eq("user_id", userId)
      .eq("type", actionType)
      .order("created_at", { ascending: false })
      .limit(10);

    if (actionsError) throw actionsError;

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

    if (error) throw error;

    const messages = data.map((chat: IConversation) =>
      `${chat.role}: ${chat.content}`
    )
      .join("\n");

    return messages;
  } catch (error: any) {
    throw new Error(`Failed to get chat history: ${error.message}`);
  }
};

const createSystemPrompt = async (
  payload: IPayload,
  conversationTarget: ConversationTarget,
): Promise<string> => {
  const { user, supabase, timestamp } = payload;
  const chatHistory = await getChatHistory(
    supabase,
    user.user_id,
    "web_chat",
  );
  return buildCompiledSystemPrompt({
    characterPrompt: user.personality?.character_prompt ?? "",
    voicePrompt: user.personality?.voice_prompt ?? "",
    accent: user.personality?.accent ?? "",
    tone: user.personality?.tone ?? [],
    conversationTarget,
    languageName: user.language?.name,
    chatHistory,
    timestamp,
  });
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const conversationTargetParam = request.nextUrl.searchParams.get("conversationTarget");
  const conversationTarget: ConversationTarget =
    conversationTargetParam === "caregiver" ? "caregiver" : "patient";

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await getUserById(supabase, user.id);
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;
  const systemPrompt = await createSystemPrompt({
    user: dbUser,
    supabase,
    timestamp: new Date().toISOString(),
  }, conversationTarget);

  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini-realtime-preview-2024-12-17",
          instructions: systemPrompt,
          voice: dbUser.personality?.voice ?? "ballad",
        }),
      },
    );
    console.log(response);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in /session:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
