export function cropInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function buildTrayLabel(cropName: string, sowDate: Date, sequence: number): string {
  const mm = pad2(sowDate.getUTCMonth() + 1);
  const dd = pad2(sowDate.getUTCDate());
  return `${cropInitials(cropName)}-${mm}${dd}-${pad2(sequence)}`;
}
