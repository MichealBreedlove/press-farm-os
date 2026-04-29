import { FlowerSpinner } from "@/components/shared/FlowerSpinner";

export default function AdminLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <FlowerSpinner size={64} label="Loading…" />
    </div>
  );
}
