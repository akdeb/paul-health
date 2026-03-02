import BuildDashboard from "@/app/components/CreateCharacter/BuildDashboard";
import { getSettingsPageData } from "../lib";

export default async function AgentSettingsPage() {
  const { dbUser, allLanguages } = await getSettingsPageData();

  return <BuildDashboard selectedUser={dbUser} allLanguages={allLanguages} />;
}
