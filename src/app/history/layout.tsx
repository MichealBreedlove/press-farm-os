import { ChefNav } from "@/components/shared/ChefNav";
import { LiaisonNav } from "@/components/shared/LiaisonNav";
import { gateChefPortal } from "@/lib/chef-portal";
import { PwaInstallPrompt } from "@/components/shared/PwaInstallPrompt";

export default async function HistoryLayout({ children }: { children: React.ReactNode }) {
  // Receivers and harvesters are sent to their own portal instead of a
  // "No restaurant found" dead end.
  const role = await gateChefPortal();
  return (
    <>
      {children}
      <PwaInstallPrompt />
      {role === "liaison" ? <LiaisonNav /> : <ChefNav />}
    </>
  );
}
