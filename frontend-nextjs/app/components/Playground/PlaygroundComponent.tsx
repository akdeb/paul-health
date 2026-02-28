"use client";

import React, { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { updateUser } from "@/db/users";
import _ from "lodash";
import HomePageSubtitles from "../HomePageSubtitles";
import PersonalityFilters from "./PersonalityFilters";
import App from "../Realtime/App";
import UserPersonalities from "./UserPersonalities";

interface PlaygroundProps {
    currentUser: IUser;
    allPersonalities: IPersonality[];
    myPersonalities: IPersonality[];
}

const Playground: React.FC<PlaygroundProps> = ({
    currentUser,
    allPersonalities,
    myPersonalities,
}) => {
    const isDoctor = currentUser.user_info.user_type === "doctor";

    const supabase = createClient();

    const [personalityIdState, setPersonalityIdState] = useState<string>(
        currentUser.personality!.personality_id ?? "" // Initial value from props
    );

    const [selectedFilters, setSelectedFilters] = useState<PersonalityFilter[]>(
        []
    );

    const onPersonalityPicked = async (personalityIdPicked: string) => {
        setPersonalityIdState(personalityIdPicked);
        await updateUser(
            supabase,
            {
                personality_id: personalityIdPicked,
            },
            currentUser.user_id
        );
    };

    return (
        <div className="flex flex-col">
            <div className="flex flex-col w-full gap-2">
                <div className="flex flex-row items-center gap-4 sm:gap-8 justify-between">
                    <div className="flex flex-row items-center gap-4 sm:gap-8">
                        <h1 className="text-3xl font-normal">
                            {"Playground"}
                        </h1>
                        <div className="flex flex-col gap-8 items-center justify-center">
        <App
            personalityIdState={personalityIdState}
            isDoctor={isDoctor}
            user={currentUser}
            usageLimitExceeded={false}
        />
                        </div>
                    </div>
                </div>

                <HomePageSubtitles
                    user={currentUser}
                    page="home"
                    languageCode={'en-US'}
                />
                    <div className="flex flex-col gap-2">
                        <PersonalityFilters
                            setSelectedFilters={setSelectedFilters}
                            selectedFilters={selectedFilters}
                            languageState={'en-US'}
                            currentUser={currentUser}
                        />
                        <UserPersonalities
                            selectedFilters={selectedFilters}
                            onPersonalityPicked={onPersonalityPicked}
                            personalityIdState={personalityIdState}
                            languageState={'en-US'}
                            disableButtons={false}
                            allPersonalities={isDoctor 
                                ? allPersonalities.filter(p => p.is_story || p.is_doctor)
                                : allPersonalities}                            
                            myPersonalities={myPersonalities}
                        />
                    </div>
            </div>
        </div>
    );
};

export default Playground;