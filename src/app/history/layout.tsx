import { ChefNav } from "@/components/shared/ChefNav";

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ChefNav />
    </>
  );
}
