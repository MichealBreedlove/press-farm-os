import { ChefNav } from "@/components/shared/ChefNav";
import { TopBar } from "@/components/shared/TopBar";

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar href="/order" />
      {children}
      <ChefNav />
    </>
  );
}
