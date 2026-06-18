import Link from "next/link";
import { ArrowLeft, Bot, ClockIcon, MessageSquareText } from "lucide-react";

const formatTimestamp = (timestamp?: string) => {
  if (!timestamp) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
};

const formatSessionTime = (seconds: number) => {
  if (seconds <= 0) {
    return "<1 min";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
};

const getActionTitle = (type: ActionType) => {
  switch (type) {
    case "web_chat":
      return "Web chat transcript";
    case "device_chat":
      return "Device chat transcript";
    default:
      return "Action transcript";
  }
};

export default function ActionTranscriptView({
  action,
  conversations,
}: {
  action: IAction;
  conversations: IConversation[];
}) {
  const icon = action.type === "device_chat" ? (
    <Bot className="h-5 w-5" />
  ) : (
    <MessageSquareText className="h-5 w-5" />
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/home/actions"
          className="inline-flex items-center gap-2 text-sm text-gray-500 transition hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to chat history
        </Link>
        <div className="rounded-3xl bg-white px-6 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl bg-gray-100 p-2 text-gray-700">
              {icon}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-950">
                {getActionTitle(action.type)}
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                {formatTimestamp(action.created_at)} · <ClockIcon className="h-4 w-4" /> {formatSessionTime(action.session_time)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-10 text-sm text-gray-500">
          No transcript was stored for this action.
        </div>
      ) : (
        <div className="rounded-[32px] bg-white p-4">
          <div className="flex flex-col gap-4">
            {conversations.map((conversation) => {
              const isUser = conversation.role === "user" || conversation.role === "doctor";

              return (
                <div
                  key={conversation.conversation_id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-[24px] border-2 px-5 py-4 shadow-sm ${
                      isUser
                        ? "border-blue-500 bg-blue-400 text-white"
                        : "border-yellow-200 bg-yellow-100 text-gray-900"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-lg font-medium leading-9">
                      {conversation.content}
                    </p>
                    <p className="mt-2 text-right text-xs opacity-70">
                      {formatTimestamp(conversation.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
