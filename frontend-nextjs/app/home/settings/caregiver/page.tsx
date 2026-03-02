import CaregiverSettingsPanel from "@/app/components/Settings/CaregiverSettingsPanel";
import { getSettingsPageData } from "../lib";

export default async function CaregiverSettingsPage() {
  const { dbUser, allLanguages } = await getSettingsPageData();

  return <CaregiverSettingsPanel selectedUser={dbUser} allLanguages={allLanguages} />;
}
