import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { SidebarNav } from "../components/Nav/SidebarNavItems";
import { LayoutDashboard, ClipboardList, Settings, History, PersonStanding, User, Plus, Brain, SquareCheckBig } from "lucide-react";
import { Metadata } from "next";
import { getOpenGraphMetadata } from "@/lib/utils";
import { MobileNav } from "../components/Nav/MobileNav";
import { getUserById } from "@/db/users";

const ICON_SIZE = 20;

export const dynamic = "force-dynamic";
export const revalidate = 60;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
    title: "Caregiver Portal",
    ...getOpenGraphMetadata("Caregiver Portal"),
};

const sidebarNavItems: SidebarNavItem[] = [
    {
        title: "Home",
        href: "/home",
        icon: <LayoutDashboard size={ICON_SIZE} fill="currentColor" />,
    },
    {
        title: "Care Plan",
        href: "/home/care-plan",
        icon: <ClipboardList size={ICON_SIZE} />,
    },
{
    title: "History",
    href: "/home/actions",
    icon: <History size={ICON_SIZE} />,
},
    {
        title: "Settings",
        href: "/home/settings",
        icon: <Settings size={ICON_SIZE} />,
    },
];

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const dbUser = await getUserById(supabase, user.id);
    console.log("dbUser", dbUser);

    if (!dbUser) {
        redirect("/login");
    }

    return (
        <div className="mx-auto flex w-full min-w-0 max-w-screen-lg flex-1 flex-col gap-2 pb-2 md:flex-row">
            <aside className="w-full pt-2 sm:py-4 md:fixed md:h-screen md:w-[240px] md:overflow-y-auto">
                <SidebarNav items={sidebarNavItems} />
            </aside>
            <main className="flex min-w-0 flex-1 justify-center px-4 sm:py-4 md:ml-[240px]">
                <div className="w-full min-w-0 max-w-6xl">{children}</div>
            </main>
            <MobileNav items={sidebarNavItems} />
        </div>
    );
}
