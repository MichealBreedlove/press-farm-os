import { ChefNav } from "@/components/shared/ChefNav";

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ChefNav />
    </>
  );
}
