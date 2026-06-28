import { EditorialHero } from "@/components/shared/EditorialHero";
import { BoxForm } from "@/components/admin/planter-boxes/BoxForm";

export default function NewPlanterBoxPage() {
  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Planter Boxes"
        title="New Box"
        subtitle="A bed of flowers or herbs chefs harvest themselves"
        flower="rosemary"
        backHref="/admin/planter-boxes"
      />
      <div className="px-4 max-w-3xl mx-auto">
        <BoxForm />
      </div>
    </main>
  );
}
