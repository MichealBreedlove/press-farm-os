import { ChefNav } from "@/components/shared/ChefNav";
import { LiaisonNav } from "@/components/shared/LiaisonNav";
import { gateChefPortal } from "@/lib/chef-portal";

export default async function OrderLayout({ children }: { children: React.ReactNode }) {
  // Receivers and harvesters are sent to their own portal instead of a
  // "No restaurant found" dead end.
  const role = await gateChefPortal();
  return (
    <>
      {children}
      {role === "liaison" ? <LiaisonNav /> : <ChefNav />}
    </>
  );
}
