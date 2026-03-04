import { MessageSquareText } from "lucide-react";
import { FeatureCard } from "@/components/feature-card";

type ConversationBarDatum = {
    dayLabel: string;
    fullLabel: string;
    webChats: number;
    deviceChats: number;
    total: number;
};

export default function HomeConversationChart({
    data,
}: {
    data: ConversationBarDatum[];
}) {
    const mobileData = data.slice(0, 4);
    const maxValue = Math.max(...data.map((item) => item.total), 1);

    const renderBars = (items: ConversationBarDatum[], compact = false) => (
        <div className={`flex h-52 items-end ${compact ? "gap-2" : "gap-3"}`}>
            {items.map((item) => {
                const webHeight = `${Math.max((item.webChats / maxValue) * 100, item.webChats > 0 ? 10 : 0)}%`;
                const deviceHeight = `${Math.max((item.deviceChats / maxValue) * 100, item.deviceChats > 0 ? 10 : 0)}%`;

                return (
                    <div
                        key={item.fullLabel}
                        className={`flex flex-col items-center gap-2 ${compact ? "w-[56px]" : "w-[64px]"} shrink-0`}
                    >
                        <div className="text-xs font-medium text-gray-500">
                            {item.total}
                        </div>
                        <div className={`flex h-40 w-full items-end justify-center gap-1 rounded-2xl bg-gray-50 ${compact ? "px-1.5" : "px-2"} py-3`}>
                            <div
                                className={`${compact ? "w-3" : "w-4"} rounded-full bg-blue-500 transition-all`}
                                style={{ height: webHeight }}
                                title={`${item.fullLabel}: ${item.webChats} web chats`}
                            />
                            <div
                                className={`${compact ? "w-3" : "w-4"} rounded-full bg-emerald-500 transition-all`}
                                style={{ height: deviceHeight }}
                                title={`${item.fullLabel}: ${item.deviceChats} device chats`}
                            />
                        </div>
                        <div className="text-sm font-medium text-gray-700">
                            {item.dayLabel}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return (
        <FeatureCard
            title="Conversation activity"
            icon={<MessageSquareText className="h-5 w-5" />}
            titleClassName="text-2xl"
            description="Chat sessions over the last 7 days across web and device."
            contentClassName="pt-2"
        >
            <div className="space-y-4">
                <div className="overflow-hidden sm:hidden">
                    {renderBars(mobileData, true)}
                </div>
                <div className="-mx-2 hidden overflow-x-auto px-2 pb-2 sm:block">
                    <div className="min-w-max">
                        {renderBars(data)}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-blue-500" />
                        Web chat
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-emerald-500" />
                        Device chat
                    </div>
                </div>
            </div>
        </FeatureCard>
    );
}
