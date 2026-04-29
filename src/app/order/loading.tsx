import { FlowerSpinner } from "@/components/shared/FlowerSpinner";

export default function OrderLoading() {
  return (
    <div className="min-h-screen bg-farm-cream flex items-center justify-center">
      <FlowerSpinner size={72} label="Loading order form…" />
    </div>
  );
}
