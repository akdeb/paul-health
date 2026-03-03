
export const userFormPersonaLabel =
    "Briefly describe yourself and your interests, personality, and learning style";
export const userFormPersonaPlaceholder =
    "Don't get me started on the guitar...I love to shred it like Hendrix. I also like a good challenge. Challenge me to be better and I'll rise to the occasion.";
export const userFormAgeLabel = "Your Age";
export const userFormAgeDescription =
    "Users under 13 years old must have a parent or guardian to setup Elato.";
export const userFormNameLabel = "Your Name";

export const INITIAL_CREDITS = 50;
export const SECONDS_PER_CREDIT = (30 * 60) / INITIAL_CREDITS; // 30 minutes equals 50 credits

export const DEVICE_COST = 55;
export const ORIGINAL_COST = 111;
export const SUBSCRIPTION_COST = 10;

export const openaiVoices: VoiceType[] = [
    {
        id: "alloy",
        name: "Alloy",
        description: "Neutral and balanced",
        color: "bg-blue-100",
        emoji: "🧑",
        provider: "openai",
    },
    {
        id: "echo",
        name: "Echo",
        description: "Warm and melodic",
        color: "bg-purple-100",
        emoji: "👩‍🎤",
        provider: "openai",
    },
    {
        id: "shimmer",
        name: "Shimmer",
        description: "Clear and bright",
        color: "bg-cyan-100",
        emoji: "👱‍♀️",
        provider: "openai",
    },
    {
        id: "ash",
        name: "Ash",
        description: "Soft and thoughtful",
        color: "bg-gray-100",
        emoji: "🧔",
        provider: "openai",
    },
    {
        id: "ballad",
        name: "Ballad",
        description: "Melodic and emotive",
        color: "bg-indigo-100",
        emoji: "🎭",
        provider: "openai",
    },
    {
        id: "coral",
        name: "Coral",
        description: "Warm and friendly",
        color: "bg-orange-100",
        emoji: "👩",
        provider: "openai",
    },
    {
        id: "sage",
        name: "Sage",
        description: "Wise and measured",
        color: "bg-green-100",
        emoji: "🧓",
        provider: "openai",
    },
    {
        id: "verse",
        name: "Verse",
        description: "Poetic and expressive",
        color: "bg-rose-100",
        emoji: "👨‍🎨",
        provider: "openai",
    },
];

export const grokVoices: VoiceType[] = [
    {
        id: "Ara",
        name: "Ara",
        description: "Bright",
        color: "bg-yellow-100",
        provider: "grok",
    },
    {
        id: "Eve",
        name: "Eve",
        description: "Upbeat",
        color: "bg-orange-100",
        provider: "grok",
    },
    {
        id: "Leo",
        name: "Leo",
        description: "Confident",
        color: "bg-blue-100",
        provider: "grok",
    },
    {
        id: "Rex",
        name: "Rex",
        description: "Direct",
        color: "bg-gray-100",
        provider: "grok",
    },
    {
        id: "Sal",
        name: "Sal",
        description: "Warm",
        color: "bg-green-100",
        provider: "grok",
    }
];

export const geminiVoices: VoiceType[] = [
    {
        id: "Zephyr",
        name: "Zephyr",
        description: "Bright",
        color: "bg-yellow-100",
        provider: "gemini",
    },
    {
        id: "Puck",
        name: "Puck",
        description: "Upbeat",
        color: "bg-orange-100",
        provider: "gemini",
    },
    {
        id: "Sadachbia",
        name: "Sadachbia",
        description: "Lively",
        color: "bg-red-100",
        provider: "gemini",
    },
    {
        id: "Charon",
        name: "Charon",
        description: "Informative",
        color: "bg-blue-100",
        provider: "gemini",
    },
    {
        id: "Kore",
        name: "Kore",
        description: "Firm",
        color: "bg-gray-100",
        provider: "gemini",
    },
    {
        id: "Fenrir",
        name: "Fenrir",
        description: "Excitable",
        color: "bg-red-100",
        provider: "gemini",
    },
    {
        id: "Leda",
        name: "Leda",
        description: "Youthful",
        color: "bg-pink-100",
        provider: "gemini",
    },
    {
        id: "Orus",
        name: "Orus",
        description: "Firm",
        color: "bg-slate-100",
        provider: "gemini",
    },
    {
        id: "Aoede",
        name: "Aoede",
        description: "Breezy",
        color: "bg-sky-100",
        provider: "gemini",
    },
    {
        id: "Callirrhoe",
        name: "Callirrhoe",
        description: "Easy-going",
        color: "bg-green-100",
        provider: "gemini",
    },
    {
        id: "Autonoe",
        name: "Autonoe",
        description: "Bright",
        color: "bg-amber-100",
        provider: "gemini",
    },
    {
        id: "Enceladus",
        name: "Enceladus",
        description: "Breathy",
        color: "bg-cyan-100",
        provider: "gemini",
    },
    {
        id: "Iapetus",
        name: "Iapetus",
        description: "Clear",
        color: "bg-white",
        provider: "gemini",
    },
    {
        id: "Umbriel",
        name: "Umbriel",
        description: "Easy-going",
        color: "bg-emerald-100",
        provider: "gemini",
    },
    {
        id: "Algieba",
        name: "Algieba",
        description: "Smooth",
        color: "bg-violet-100",
        provider: "gemini",
    },
    {
        id: "Despina",
        name: "Despina",
        description: "Smooth",
        color: "bg-purple-100",
        provider: "gemini",
    },
    {
        id: "Erinome",
        name: "Erinome",
        description: "Clear",
        color: "bg-neutral-100",
        provider: "gemini",
    },
    {
        id: "Algenib",
        name: "Algenib",
        description: "Gravelly",
        color: "bg-stone-100",
        provider: "gemini",
    },
    {
        id: "Rasalgethi",
        name: "Rasalgethi",
        description: "Informative",
        color: "bg-indigo-100",
        provider: "gemini",
    },
    {
        id: "Laomedeia",
        name: "Laomedeia",
        description: "Upbeat",
        color: "bg-lime-100",
        provider: "gemini",
    },
    {
        id: "Achernar",
        name: "Achernar",
        description: "Soft",
        color: "bg-rose-100",
        provider: "gemini",
    },
    {
        id: "Alnilam",
        name: "Alnilam",
        description: "Firm",
        color: "bg-zinc-100",
        provider: "gemini",
    },
    {
        id: "Schedar",
        name: "Schedar",
        description: "Even",
        color: "bg-teal-100",
        provider: "gemini",
    },
    {
        id: "Gacrux",
        name: "Gacrux",
        description: "Mature",
        color: "bg-brown-100",
        provider: "gemini",
    },
    {
        id: "Pulcherrima",
        name: "Pulcherrima",
        description: "Forward",
        color: "bg-fuchsia-100",
        provider: "gemini",
    },
    {
        id: "Achird",
        name: "Achird",
        description: "Friendly",
        color: "bg-yellow-100",
        provider: "gemini",
    },
    {
        id: "Zubenelgenubi",
        name: "Zubenelgenubi",
        description: "Casual",
        color: "bg-orange-100",
        provider: "gemini",
    },
    {
        id: "Vindemiatrix",
        name: "Vindemiatrix",
        description: "Gentle",
        color: "bg-green-100",
        provider: "gemini",
    },
    {
        id: "Sadaltager",
        name: "Sadaltager",
        description: "Knowledgeable",
        color: "bg-blue-100",
        provider: "gemini",
    },
    {
        id: "Sulafat",
        name: "Sulafat",
        description: "Warm",
        color: "bg-orange-100",
        provider: "gemini",
    },
];

export const emotionOptions = [
    { value: "neutral", label: "Neutral", icon: "😐", color: "bg-red-100" },
    {
        value: "cheerful",
        label: "Cheerful",
        icon: "😊",
        color: "bg-yellow-100",
    },
    { value: "serious", label: "Serious", icon: "🧐", color: "bg-blue-100" },
    { value: "calm", label: "Calm", icon: "😌", color: "bg-teal-100" },
    { value: "excited", label: "Excited", icon: "😃", color: "bg-orange-100" },
    {
        value: "professional",
        label: "Professional",
        icon: "👔",
        color: "bg-green-100",
    },
];
