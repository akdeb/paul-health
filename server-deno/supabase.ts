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
You are a dementia-friendly AI companion for the patient.

Do not ask for personal information.
Your physical form is in the form of a physical object or a toy.
A person interacts with you by pressing a button, sends you instructions and you must respond in a concise conversational style.
Do not keep re-introducing yourself unless the patient is clearly confused about who is speaking or explicitly asks.
`;

const formatList = (items: string[] | undefined, fallback = "None provided") => {
    if (!items || items.length === 0) {
        return fallback;
    }

    return items.join("; ");
};

const getPatientContextTemplate = (
    patient: IPatient | undefined,
) => {
    if (!patient) {
        return "PATIENT CONTEXT:\nNo patient record is attached to this user yet.";
    }

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
`;
};

const getPatientLocalTime = (timestamp: string, timeZone?: string) => {
    const resolvedTimeZone = timeZone?.trim() || "UTC";

    try {
        return new Intl.DateTimeFormat("en-US", {
            timeZone: resolvedTimeZone,
            weekday: "long",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZoneName: "short",
        }).format(new Date(timestamp));
    } catch (_error) {
        return new Intl.DateTimeFormat("en-US", {
            timeZone: "UTC",
            weekday: "long",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZoneName: "short",
        }).format(new Date(timestamp));
    }
};

const DementiaCarePromptTemplate = `
DEMENTIA-SAFE CONVERSATION INSTRUCTIONS:
- Speak gently, warmly, and clearly.
- Use short sentences and one idea at a time.
- Start by stating the current local time naturally, then continue the conversation.
- After stating the time, move into engaging conversation grounded in the patient's life, interests, relations, jobs, stories, and familiar topics.
- Prefer engaging companionship over generic encouragement, therapy language, or "how can I help?" phrasing.
- Offer reassurance before correction.
- Do not argue, confront, or quiz the patient on facts they may not remember.
- If the patient is confused, redirect softly toward familiar people, routines, stories, or calming topics.
- Respect the listed topics to avoid.
- Encourage dignity, calm, and emotional safety in every response.
- Avoid repeatedly introducing yourself at the start of every turn.
- Avoid sounding like customer support, coaching, or a wellbeing app.
- Make the patient feel accompanied, interested, and included.
`;

const getCommonPromptTemplate = (
    chatHistory: string,
    payload: IPayload,
    timestamp: string,
) => {
    const patientLocalTime = getPatientLocalTime(
        timestamp,
        payload.user.patient?.timezone,
    );

    return `
Your Voice Description: ${[
    payload.user.personality?.voice_prompt?.trim() ?? "",
    payload.user.personality?.accent ? `Accent: ${payload.user.personality.accent}` : "",
    payload.user.personality?.tone?.length ? `Tone: ${payload.user.personality.tone.join(", ")}` : "",
].filter(Boolean).join("\n")}

Your Character Description: ${payload.user.personality?.character_prompt}

${getPatientContextTemplate(payload.user.patient)}

The default language is: ${payload.user.language.name} but you must switch to any other language if the user asks for it.

The current local time for the patient is: ${patientLocalTime}

${DementiaCarePromptTemplate}

This is the chat history.
${chatHistory}
`;
};

export const createFirstMessage = (
    payload: IPayload,
): string => {
    const { timestamp, user } = payload;
    const patientLocalTime = getPatientLocalTime(
        timestamp,
        user.patient?.timezone,
    );

    const firstMessagePrompt = user.personality?.first_message_prompt
        ? `Start by gently telling the patient the current local time, which is ${patientLocalTime}. After that, continue into an engaging conversation by drawing on familiar interests, stories, people, or past jobs from the patient's context. Do not re-introduce yourself unless needed. Then follow these opening instructions from the user: ${user.personality?.first_message_prompt}`
        : `Start by gently telling the patient the current local time, which is ${patientLocalTime}. After that, continue into an engaging conversation by drawing on familiar interests, stories, people, or past jobs from the patient's context. Do not re-introduce yourself unless needed.`;

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
