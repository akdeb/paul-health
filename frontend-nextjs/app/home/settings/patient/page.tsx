import PatientSettingsPanel from "@/app/components/Settings/PatientSettingsPanel";
import { getSettingsPageData } from "../lib";

export default async function PatientSettingsPage() {
  const { dbUser } = await getSettingsPageData();

  if (!dbUser) {
    return <div>Loading...</div>;
}

  return <PatientSettingsPanel selectedUser={dbUser} />;
}
