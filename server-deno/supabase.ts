import { Buffer } from "node:buffer";
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
): Promise<IPatientPhotoContext[]> => {
    if (!patientId) {
        return [];
    }

    const { data, error } = await supabase
        .from("photos")
        .select("url")
        .eq("patient_id", patientId)
        .eq("type", "album")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Failed to fetch patient photos:", error);
        return [];
    }

    const photoUrls = (data ?? [])
        .map((photo) => photo.url?.trim())
        .filter((url): url is string => Boolean(url))
        .slice(0, 4);

    const photos = await Promise.all(
        photoUrls.map(async (url) => {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    return null;
                }

                const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim();
                if (!mimeType || !mimeType.startsWith("image/")) {
                    return null;
                }

                const arrayBuffer = await response.arrayBuffer();
                if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > 4 * 1024 * 1024) {
                    return null;
                }

                return {
                    mimeType,
                    data: Buffer.from(arrayBuffer).toString("base64"),
                } satisfies IPatientPhotoContext;
            } catch (error) {
                console.error("Failed to fetch patient photo asset:", error);
                return null;
            }
        }),
    );

    return photos.filter((photo): photo is IPatientPhotoContext => photo !== null);
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
            .limit(30);

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
            .limit(30);

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

const buildPersonalityContext = (personality?: IPersonality) => {
    if (!personality) {
        return null;
    }

    return {
        personality_id: personality.personality_id,
        key: personality.key,
        voice: personality.voice,
        provider: personality.provider,
        voice_description: personality.voice_description,
        title: personality.title,
        subtitle: personality.subtitle,
        short_description: personality.short_description,
        character_prompt: personality.character_prompt,
        voice_prompt: personality.voice_prompt,
        accent: personality.accent,
        tone: personality.tone,
        creator_id: personality.creator_id,
        pitch_factor: personality.pitch_factor,
        first_message_prompt: personality.first_message_prompt,
    };
};

const buildPatientContext = (patient?: IPatient) => {
    if (!patient) {
        return null;
    }

    return {
        patient_id: patient.patient_id,
        name: patient.name,
        age: patient.age,
        about: patient.about,
        gender: patient.gender,
        address: patient.address,
        jobs: patient.jobs,
        relations: patient.relations,
        stories: patient.stories,
        avoid: patient.avoid,
        caregiver_id: patient.caregiver_id,
        timezone: patient.timezone,
    };
};

const buildCaregiverContext = (user: IUser) => ({
    user_id: user.user_id,
    avatar_url: user.avatar_url,
    is_premium: user.is_premium,
    email: user.email,
    name: user.name,
    user_info: user.user_info,
    personality_id: user.personality_id,
    language_code: user.language_code,
    language: user.language ?? null,
    device_id: user.device_id,
    device: user.device ?? null,
    patient_id: user.patient_id,
});

const buildPromptContextPayload = (
    payload: IPayload,
    chatHistory: string,
) => ({
    personality: buildPersonalityContext(payload.user.personality),
    patient: buildPatientContext(payload.user.patient),
    caregiver: buildCaregiverContext(payload.user),
    device_chat_history: chatHistory,
});

const buildVoiceContext = (payload: IPayload) => ({
    voice_prompt: payload.user.personality?.voice_prompt ?? "",
    voice_description: payload.user.personality?.voice_description ?? "",
    voice: payload.user.personality?.voice ?? "",
    provider: payload.user.personality?.provider ?? "",
    accent: payload.user.personality?.accent ?? "",
    tone: payload.user.personality?.tone ?? [],
    pitch_factor: payload.user.personality?.pitch_factor ?? 1,
});

const formatContextBlock = (title: string, value: unknown) => {
    return `${title}\n${JSON.stringify(value, null, 2)}`;
};

export const createFirstMessage = (
    payload: IPayload,
): string => {
    return payload.user.personality?.first_message_prompt ?? "";
};

export const createSystemPrompt = (
    chatHistory: IConversation[],
    payload: IPayload,
): string => {
    const chatHistoryString = composeChatHistory(chatHistory);
    const contextPayload = buildPromptContextPayload(
        payload,
        chatHistoryString,
    );
    const voiceContext = buildVoiceContext(payload);

    return [
        formatContextBlock("YOU ARE (PERSONALITY CONTEXT):", contextPayload.personality),
        formatContextBlock("YOUR VOICE (VOICE DETAILS):", voiceContext),
        formatContextBlock("YOU ARE TALKING TO (PATIENT DETAILS):", contextPayload.patient),
        formatContextBlock("THE PATIENT'S CAREGIVER (USER DETAILS):", contextPayload.caregiver),
        `THIS IS THE DEVICE CHAT HISTORY (LAST 30 MESSAGES):\n${contextPayload.device_chat_history || "No device chat history yet."}`,
    ].join("\n\n");
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
