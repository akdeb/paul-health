import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { decryptSecret } from "./utils.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_KEY")!;

if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL or SUPABASE_KEY is not set");
}

export function getSupabaseClient(userJwt: string) {
    return createClient(supabaseUrl, supabaseKey, {
        global: {
            headers: {
                Authorization: `Bearer ${userJwt}`,
            },
        },
    });
}

export const getUserByEmail = async (
    supabase: SupabaseClient,
    email: string,
): Promise<IUser> => {
    const { data, error } = await supabase.from("users").select(
        "*, language:languages(name), personality:personalities!users_personality_id_fkey(*), device:device_id(is_reset, is_ota, volume, mac_address), patient:patients!users_patient_id_fkey(*)",
    ).eq("email", email);

    console.log("data", data, error);

    if (error) {
        throw new Error("Failed to authenticate user");
    }
    return data[0] as IUser;
};

export const getPatientPhotos = async (
    supabase: SupabaseClient,
    patientId: string | null | undefined,
): Promise<IPhoto[]> => {
    if (!patientId) {
        return [];
    }

    const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Failed to fetch patient photos:", error);
        return [];
    }

    return (data ?? []) as IPhoto[];
};

export const getDeviceInfo = async (
    supabase: SupabaseClient,
    userId: string,
): Promise<IDevice | null> => {
    const { data, error } = await supabase.from("devices").select("*").eq(
        "user_id",
        userId,
    )
        .single();
    if (error) return null;
    return data as IDevice;
};

export const composeChatHistory = (data: IConversation[]) => {
    const messages = data.map((chat: IConversation) =>
        `${chat.role} [${
            new Date(chat.created_at).toISOString()
        }]: ${chat.content}`
    ).join("\n");

    return messages;
};

export const getChatHistory = async (
    supabase: SupabaseClient,
    userId: string,
    actionType: Extract<ActionType, "web_chat" | "device_chat">,
    isDoctor: boolean,
): Promise<IConversation[]> => {
    try {
        const { data: actions, error: actionsError } = await supabase
            .from("actions")
            .select("action_id")
            .eq("user_id", userId)
            .eq("type", actionType)
            .order("created_at", { ascending: false })
            .limit(20);

        if (actionsError) {
            throw actionsError;
        }

        const actionIds = (actions ?? []).map((action) => action.action_id);
        if (actionIds.length === 0) {
            return [];
        }

        let query = supabase
            .from("conversations")
            .select("*")
            .in("action_id", actionIds)
            .order("created_at", { ascending: false })
            .limit(20);

        // If isDoctor is true, only fetch conversations from the last 2 hours
        if (isDoctor) {
            // Calculate timestamp from 2 hours ago
            const twoHoursAgo = new Date();
            twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

            // Add timestamp filter to query
            query = query.gte("created_at", twoHoursAgo.toISOString());
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    } catch (_e: any) {
        return [];
    }
};

const UserPromptTemplate = (user: IUser) => `
YOU ARE TALKING TO someone with a personality described as: ${user.personality?.title}.

Do not ask for personal information.
Your physical form is in the form of a physical object or a toy.
A person interacts with you by pressing a button, sends you instructions and you must respond in a concise conversational style.
`;

const formatList = (items: string[] | undefined, fallback = "None provided") => {
    if (!items || items.length === 0) {
        return fallback;
    }

    return items.join("; ");
};

const getPatientContextTemplate = (
    patient: IPatient | undefined,
    photos: IPhoto[] | undefined,
) => {
    if (!patient) {
        return "PATIENT CONTEXT:\nNo patient record is attached to this user yet.";
    }

    const photoCaptions = (photos ?? [])
        .filter((photo) => photo.caption?.trim())
        .map((photo) => photo.caption.trim());

    return `
PATIENT CONTEXT:
Name: ${patient.name}
Age: ${patient.age}
Gender: ${patient.gender}
Address: ${patient.address || "Unknown"}
About: ${patient.about || "No additional background provided"}
Past jobs: ${formatList(patient.jobs)}
Relations: ${formatList(patient.relations)}
Stories: ${formatList(patient.stories)}
Topics to avoid: ${formatList(patient.avoid)}
Photo captions: ${formatList(photoCaptions, "No photo captions available")}
`;
};

const getCommonPromptTemplate = (
    chatHistory: string,
    payload: IPayload,
    timestamp: string,
) => `
Your Voice Description: ${[
    payload.user.personality?.voice_prompt?.trim() ?? "",
    payload.user.personality?.accent ? `Accent: ${payload.user.personality.accent}` : "",
    payload.user.personality?.tone?.length ? `Tone: ${payload.user.personality.tone.join(", ")}` : "",
].filter(Boolean).join("\n")}

Your Character Description: ${payload.user.personality?.character_prompt}

${getPatientContextTemplate(payload.user.patient, payload.patientPhotos)}

The default language is: ${payload.user.language.name} but you must switch to any other language if the user asks for it.

The current time is: ${timestamp}

This is the chat history.
${chatHistory}
`;

export const createFirstMessage = (
    payload: IPayload,
): string => {
    const { timestamp, user } = payload;

    const firstMessagePrompt = user.personality?.first_message_prompt
        ? `Always start the conversation following these instructions from the user: ${user.personality?.first_message_prompt}`
        : "Say hello to the user";

    return firstMessagePrompt;
};

export const createSystemPrompt = (
    chatHistory: IConversation[],
    payload: IPayload,
): string => {
    const { user, timestamp } = payload;
    const chatHistoryString = composeChatHistory(chatHistory);
    console.log("chatHistoryString", chatHistoryString);
    const commonPrompt = getCommonPromptTemplate(
        chatHistoryString,
        payload,
        timestamp,
    );

    let systemPrompt: string;
    switch (user.user_info.user_type) {
        case "user":
            systemPrompt = UserPromptTemplate(user);
            break;
        default:
            throw new Error("Invalid user type");
    }
    return commonPrompt + systemPrompt;
};

export const addConversation = async (
    supabase: SupabaseClient,
    speaker: "user" | "assistant",
    content: string,
    actionId: string,
): Promise<void> => {
    const { error } = await supabase.from("conversations").insert({
        role: speaker,
        content,
        action_id: actionId,
        is_sensitive: false,
    });

    if (error) {
        throw new Error("Failed to add conversation");
    }
};

export const createAction = async (
    supabase: SupabaseClient,
    {
        userId,
        type,
        metadata = {},
        sessionTime = 0,
        jobId = null,
    }: {
        userId: string;
        type: Extract<ActionType, "web_chat" | "device_chat">;
        metadata?: ActionMetadata;
        sessionTime?: number;
        jobId?: string | null;
    },
): Promise<IAction | null> => {
    const { data, error } = await supabase
        .from("actions")
        .insert({
            user_id: userId,
            type,
            metadata,
            session_time: sessionTime,
            job_id: jobId,
        })
        .select()
        .single();

    if (error) {
        console.log("error in createAction", error);
        return null;
    }

    return data as IAction;
};

export const updateActionSessionTime = async (
    supabase: SupabaseClient,
    actionId: string,
    sessionTime: number,
): Promise<boolean> => {
    const { error } = await supabase
        .from("actions")
        .update({ session_time: sessionTime })
        .eq("action_id", actionId);

    if (error) {
        console.log("error in updateActionSessionTime", error);
        return false;
    }

    return true;
};

/**
 * Get the OpenAI API Key for the user
 * @param supabase - The Supabase client
 * @param userId - The user's ID
 * @returns The OpenAI API Key
 *
 * Tip: You can use the `getOpenAiApiKey` function to get the OpenAI API Key for the user.
 * Or you can store your own OpenAI API Key in the environment variable `OPENAI_API_KEY`.
 */
export const getOpenAiApiKey = async (
    supabase: SupabaseClient,
    userId: string,
): Promise<string> => {
    const { data, error } = await supabase
        .from("api_keys")
        .select("encrypted_key, iv")
        .eq("user_id", userId)
        .single();

    if (error) throw error;

    const { encrypted_key, iv } = data;
    const masterKey = Deno.env.get("ENCRYPTION_KEY")!;

    const decryptedKey = decryptSecret(encrypted_key, iv, masterKey);

    return decryptedKey;
};
