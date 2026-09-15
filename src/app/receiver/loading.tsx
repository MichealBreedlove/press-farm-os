import { FlowerSpinner } from "@/components/shared/FlowerSpinner";

export default function Loading() {
  return (
    <div className="min-h-screen bg-farm-cream flex items-center justify-center">
      <FlowerSpinner size={64} label="Loading deliveries…" />
    </div>
  );
}
