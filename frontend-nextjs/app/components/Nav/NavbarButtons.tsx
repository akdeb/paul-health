import { Button } from "@/components/ui/button";
import Link from "next/link";
import { NavbarDropdownMenu } from "./NavbarDropdownMenu";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { CalendarCheck } from "lucide-react";

interface NavbarButtonsProps {
    user: IUser | null;
    isHome: boolean;
}

const NavbarButtons: React.FC<NavbarButtonsProps> = ({
    user,
    isHome,
}) => {
    const isMobile = useMediaQuery("(max-width: 768px)");

    return (
        <div
            className={`flex flex-row items-center font-bold text-sm ${
                isHome ? "gap-2" : "sm:gap-2"
            }`}
        >
            {!isHome && !isMobile && (
                <Link href={"mailto:miguel@studiomorfar.com"} passHref tabIndex={-1}>
                    <Button
                        size="sm"
                        variant="secondary"
                        className="flex flex-row gap-2 items-center rounded-full bg-nav-bar focus:shadow-none focus-visible:shadow-none"
                    >
                        <CalendarCheck size={20} />
                        <span className="hidden sm:flex font-normal">
                            Book Demo
                        </span>
                    </Button>
                </Link>
            )}
            <NavbarDropdownMenu user={user} />
        </div>
    );
};

export default NavbarButtons;
