interface HomePageSubtitlesProps {
    user: IUser;
    page: "home" | "settings" | "care-plan" | "actions";
    languageCode?: string;
}

const HomePageSubtitles: React.FC<HomePageSubtitlesProps> = ({
    user,
    page,
    languageCode = "en-US",
}) => {
    if (page === "home") {
        if (user.user_info.user_type === "doctor") {
            return (
                <p className="text-sm text-gray-600">
                    {"Use this playground or your device to engage your patients"}
                </p>
            );
        } else {
            return (
                <p className="text-sm text-gray-600">
                    {"Talk to any AI character below"}
                </p>
            );
        }
    } else if (page === "settings") {
        return (
            <p className="text-sm text-gray-600">
                {"You can update your settings below"}
            </p>
        );
    } else if (page === "actions") {
        return (
            <p className="text-sm text-gray-600">
                {"Logs all actions taken for patient"}
            </p>
        );
    } else if (page === "care-plan") {
        return (
            <p className="text-sm text-gray-600">
                {"Set patient's activities and routines"}
            </p>
        );
    }

    // if they are a regular user
    // return <CreditsRemaining user={user} languageCode={languageCode} />;
};

export default HomePageSubtitles;
