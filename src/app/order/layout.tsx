import { ChefNav } from "@/components/shared/ChefNav";

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ChefNav />
    </>
  );
}
