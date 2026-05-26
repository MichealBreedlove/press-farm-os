import { ChefNav } from "@/components/shared/ChefNav";

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ChefNav />
    </>
  );
}
