import * as React from "react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type FeatureCardProps = {
    title: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
    headerClassName?: string;
    titleClassName?: string;
    descriptionClassName?: string;
    contentClassName?: string;
};

export function FeatureCard({
    title,
    description,
    icon,
    children,
    className,
    headerClassName,
    titleClassName,
    descriptionClassName,
    contentClassName,
}: FeatureCardProps) {
    return (
        <Card className={cn(className, "rounded-3xl")}>
            <CardHeader className={headerClassName}>
                <CardTitle className={cn(icon ? "flex items-center gap-2" : undefined, titleClassName)}>
                    {icon}
                    {title}
                </CardTitle>
                {description ? (
                    <CardDescription className={descriptionClassName}>{description}</CardDescription>
                ) : null}
            </CardHeader>
            {children ? <CardContent className={contentClassName}>{children}</CardContent> : null}
        </Card>
    );
}
