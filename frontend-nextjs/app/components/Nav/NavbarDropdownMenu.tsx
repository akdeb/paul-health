import {
    Mail,
    Menu,
    LogIn,
    HomeIcon,
    Settings,
    ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { isPremiumUser } from "@/app/actions";
import { DropdownMenuLabel } from "@radix-ui/react-dropdown-menu";

interface NavbarMenuButtonProps {
    user: IUser | null;
}

const ICON_SIZE = 20;

export function NavbarDropdownMenu({ user }: NavbarMenuButtonProps) {
    const [premiumUser, setPremiumUser] = useState(false);

    useEffect(() => {
        const setUserPremium = async () => {
            if (user) {
                const isPremium = await isPremiumUser(user.user_id);
                setPremiumUser(isPremium ?? false);
            }
        };
        setUserPremium();
    }, [user]);

    return (
        <DropdownMenu
            onOpenChange={(open) => {
                if (!open) {
                    document.activeElement instanceof HTMLElement &&
                        document.activeElement.blur();
                }
            }}
        >
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="flex flex-row gap-2 items-center rounded-full focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                >
                    <Menu size={20} />
                    <span className="hidden sm:flex font-normal">
                        {user ? "Menu" : "Login"}
                    </span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="w-60 p-2 sm:mt-2 rounded-lg"
                side="bottom"
                align="end"
            >
                <DropdownMenuGroup>
                    {user ? (
                        <>
                            <DropdownMenuItem>
                                <Link href="/home" className="flex w-full flex-row gap-2">
                                    <HomeIcon size={ICON_SIZE} />
                                    <span>Dashboard</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Link href="/home/care-plan" className="flex w-full flex-row gap-2">
                                    <ClipboardList size={ICON_SIZE} />
                                    <span>Care Plan</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Link href="/home/settings/patient" className="flex w-full flex-row gap-2">
                                    <Settings size={ICON_SIZE} />
                                    <span>Patient</span>
                                </Link>
                            </DropdownMenuItem>
                        </>
                    ) : (
                        <DropdownMenuItem>
                            <Link href="/login" className="flex w-full flex-row gap-2">
                                <LogIn size={ICON_SIZE} />
                                <span>Login</span>
                            </Link>
                        </DropdownMenuItem>
                    )}
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuItem>
                    <Link href={"mailto:miguel@studiomorfar.com"} className="flex w-full flex-row gap-2">
                        <span>Book a Demo</span>
                    </Link>
                </DropdownMenuItem>

                <DropdownMenuItem>
                    <Link
                        href={"mailto:miguel@studiomorfar.com"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full flex-row items-center gap-2"
                    >
                        <Mail size={ICON_SIZE - 2} />
                        <span>Send feedback</span>
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
