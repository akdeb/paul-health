import { SupabaseClient } from "@supabase/supabase-js";

declare global {
    type Role = "user" | "assistant";

    interface IConversation {
        conversation_id: string;
        user_id?: string;
        role: Role;
        content: string;
        is_sensitive: boolean;
        action_id: string;
        metadata: any;
    }

    type ActionType =
        | "device_event"
        | "web_chat"
        | "device_chat"

    interface ActionMetadata {
        [key: string]: any;
        text?: string;
        ai_summary?: string;
    }

    interface IAction {
        action_id: string;
        user_id: string;
        type: ActionType;
        metadata: ActionMetadata;
        session_time: number;
        job_id: string | null;
        created_at?: string;
    }


    interface IPayload {
        user: IUser;
        supabase: SupabaseClient;
        timestamp: string;
        patientPhotos?: string[];
    }

    interface IDevice {
        device_id: string;
        volume: number;
        is_ota: boolean;
        is_reset: boolean;
        mac_address: string;
        user_code: string;
    }

    type ModelProvider = "openai" | "gemini" | "elevenlabs" | "hume" | "grok";

    type GrokVoice = 
        | "Ara"
        | "Eve"
        | "Leo"
        | "Rex"
        | "Sal"

    type GeminiVoice =
        | "Zephyr"
        | "Puck"
        | "Charon"
        | "Kore"
        | "Fenrir"
        | "Leda"
        | "Orus"
        | "Aoede"
        | "Callirrhoe"
        | "Autonoe"
        | "Enceladus"
        | "Iapetus"
        | "Umbriel"
        | "Algieba"
        | "Despina"
        | "Erinome"
        | "Algenib"
        | "Rasalgethi"
        | "Laomedeia"
        | "Achernar"
        | "Alnilam"
        | "Schedar"
        | "Gacrux"
        | "Pulcherrima"
        | "Achird"
        | "Zubenelgenubi"
        | "Vindemiatrix"
        | "Sadachbia"
        | "Sadaltager"
        | "Sulafat";

    type OaiVoice =
        | "ash"
        | "alloy"
        | "echo"
        | "shimmer"
        | "ballad"
        | "coral"
        | "sage"
        | "verse";

    /**
     * Note: voice is essentially the name of the voice. 
     * the naming here sucks, please change it
     */
    interface IPersonality {
        personality_id: string;
        key: string;
        voice: string;
        provider: ModelProvider;
        voice_description: string;
        title: string;
        subtitle: string;
        short_description: string;
        character_prompt: string;
        voice_prompt: string;
        accent: string;
        tone: string[];
        creator_id: string | null;
        pitch_factor: number;
        first_message_prompt: string;
    }

    interface ILanguage {
        language_id: string;
        code: string;
        name: string;
        flag: string;
    }

    interface IDoctorMetadata {
        doctor_name: string;
        specialization: string;
        hospital_name: string;
        favorite_phrases: string;
    }

    interface IUserMetadata {}
    interface IBusinessMetadata {}

    type UserInfo =
        | {
            user_type: "user";
            user_metadata: IUserMetadata;
        }
        | {
            user_type: "doctor";
            user_metadata: IDoctorMetadata;
        }
        | {
            user_type: "business";
            user_metadata: IBusinessMetadata;
        };

    interface IUser {
        user_id: string;
        avatar_url: string;
        is_premium: boolean;
        email: string;
        name: string;
        user_info: UserInfo;

        // personality
        personality_id: string;
        personality?: IPersonality;

        // language
        language?: ILanguage;
        language_code: string;

        // device
        device?: IDevice;
        device_id: string | null;

        // patient
        patient_id: string;
        patient?: IPatient;
    }

    interface IPatient {
        patient_id: string;
        name: string;
        age: number;
        about: string;
        gender: "male" | "female" | "non-binary";
        address: string;
        jobs: string[];
        relations: string[];
        stories: string[];
        avoid: string[];
        caregiver_id: string;
        timezone: string;
    }

    interface IPhoto {
        photo_id: string;
        url: string;
        caption: string;
        type: "profile" | "album";
        patient_id: string;
    }

    type CareActivityType =
        | "guess_flag"
        | "guess_capital"
        | "conversation_news"
        | "medication_reminder"
        | "memory_prompt";

    interface IJob {
        job_id: string;
        name: string;
        type: CareActivityType;
        cron: string;
        enabled: boolean;
        instructions: string;
        patient_id: string;
    }

    interface ProviderArgs {
        ws: WebSocket;
        payload: IPayload;
        connectionPcmFile: Deno.FsFile | null;
        firstMessage: string;
        systemPrompt: string;
        actionId: string;
        closeHandler: () => Promise<void>;
    }
}
