import { ChefNav } from "@/components/shared/ChefNav";
import { gateChefPortal } from "@/lib/chef-portal";
import { PwaInstallPrompt } from "@/components/shared/PwaInstallPrompt";

export default async function HistoryLayout({ children }: { children: React.ReactNode }) {
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
