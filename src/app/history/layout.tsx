import { ChefNav } from "@/components/shared/ChefNav";
import { PwaInstallPrompt } from "@/components/shared/PwaInstallPrompt";

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PwaInstallPrompt />
      <ChefNav />
    </>
  );
}
