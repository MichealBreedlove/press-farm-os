import { ChefNav } from "@/components/shared/ChefNav";
import { gateChefPortal } from "@/lib/chef-portal";

export default async function EventsLayout({ children }: { children: React.ReactNode }) {
  // Receivers and harvesters are sent to their own portal instead of a
  // "No restaurant found" dead end.
  await gateChefPortal();
  return (
    <>
      {children}
      <ChefNav />
    </>
  );
}
