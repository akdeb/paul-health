import * as React from "react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type StatItem = {
    label: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: string;
};

type StatsProps = {
    items: StatItem[];
    className?: string;
};

export default function Stats({ items, className }: StatsProps) {
    return (
        <section className={className ?? "grid gap-4 md:grid-cols-2 xl:grid-cols-4"}>
            {items.map((item) => (
                <Card key={item.label} className="border-[#ffe2d4] bg-[#fffdf9]">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[#4a5f6b]">{item.label}</CardDescription>
                        <CardTitle className={`flex items-center gap-2 text-2xl ${item.tone}`}>
                            <item.icon className="h-5 w-5" />
                            {item.value}
                        </CardTitle>
                    </CardHeader>
                </Card>
            ))}
        </section>
    );
}
