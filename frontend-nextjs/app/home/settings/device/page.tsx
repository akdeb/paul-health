import DeviceSettingsPanel from "@/app/components/Settings/DeviceSettingsPanel";
import { getSettingsPageData } from "../lib";

export default async function DeviceSettingsPage() {
  const { dbUser } = await getSettingsPageData();

  return <DeviceSettingsPanel selectedUser={dbUser} />;
}
