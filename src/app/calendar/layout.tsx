import { ChefNav } from "@/components/shared/ChefNav";
import { PwaInstallPrompt } from "@/components/shared/PwaInstallPrompt";
import { gateChefPortal } from "@/lib/chef-portal";

export default async function CalendarLayout({ children }: { children: React.ReactNode }) {
  // Receivers and harvesters are sent to their own portal instead of a
  // "No restaurant found" dead end.
  await gateChefPortal();
  return (
    <>
      {children}
      <PwaInstallPrompt />
      <ChefNav />
    </>
  );
}
