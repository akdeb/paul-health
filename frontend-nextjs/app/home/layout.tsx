import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { SidebarNav } from "../components/Nav/SidebarNavItems";
import { LayoutDashboard, ClipboardList, Settings, PersonStanding } from "lucide-react";
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
        title: "Dashboard",
        href: "/home",
        icon: <LayoutDashboard size={ICON_SIZE} fill="currentColor" />,
    },
    {
        title: "Care Plan",
        href: "/home/care-plan",
        icon: <ClipboardList size={ICON_SIZE} />,
    },
    {
        title: "Patient",
        href: "/home/settings",
        icon: <PersonStanding size={ICON_SIZE} />,
    },
];

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const dbUser = await getUserById(supabase, user.id);

    if (!dbUser) {
        redirect("/login");
    }

    return (
        <div className="mx-auto flex w-full max-w-screen-xl flex-1 flex-col gap-2 pb-2 md:flex-row">
            <aside className="w-full pt-2 sm:py-4 md:fixed md:h-screen md:w-[270px] md:overflow-y-auto">
                <SidebarNav items={sidebarNavItems} />
            </aside>
            <main className="flex flex-1 justify-center px-4 sm:py-4 md:ml-[270px]">
                <div className="w-full max-w-6xl">{children}</div>
            </main>
            <MobileNav items={sidebarNavItems} />
        </div>
    );
}
