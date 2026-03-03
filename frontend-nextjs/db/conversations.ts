import { SupabaseClient } from "@supabase/supabase-js";
import { TranscriptItem } from "@/app/components/Realtime/types";

export const dbInsertTranscriptItem = async (
    supabase: SupabaseClient,
    data: TranscriptItem,
    actionId: string,
    isDoctor: boolean
) => {
    const role = data.role == "user" ? isDoctor ? "doctor" : "user" : "assistant";

    const conversation: IConversation = {
        role: role,
        content: data.title ?? "",
        action_id: actionId,
        is_sensitive: false,
        metadata: null,
    };

    await dbInsertConversation(supabase, conversation);
};

export const dbInsertConversation = async (
    supabase: SupabaseClient,
    data: IConversation
) => {
    const { error } = await supabase.from("conversations").insert([data]);
    if (error) {
        throw error;
    }
};

export const dbGetConversationsByActionId = async (
    supabase: SupabaseClient,
    actionId: string
) => {
    const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("action_id", actionId)
        .order("created_at", { ascending: true });

    if (error) {
        throw error;
    }
    return data;
};

export const dbGetRecentMessages = async (
    supabase: SupabaseClient,
    userId: string,
    toyId: string,
    personalityId: string
) => {
    void toyId;
    void personalityId;

    const { data: actions, error: actionsError } = await supabase
        .from("actions")
        .select("action_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

    if (actionsError) {
        throw actionsError;
    }

    const actionIds = (actions ?? []).map((action) => action.action_id);
    if (actionIds.length === 0) {
        return [];
    }

    const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .in("action_id", actionIds)
        .order("created_at", { ascending: false })
        .limit(20);

    if (error) {
        throw error;
    }
    return data;
};
