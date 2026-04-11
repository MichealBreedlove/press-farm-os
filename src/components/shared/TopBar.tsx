import Image from "next/image";
import Link from "next/link";

interface TopBarProps {
  href?: string;
}

export function TopBar({ href = "/" }: TopBarProps) {
  return (
    <Link href={href} className="bg-farm-green px-4 py-2.5 flex items-center gap-2.5 min-h-0">
      <Image
        src="/icon-192.png"
        alt="Press Farm"
        width={28}
        height={28}
        className="rounded-full"
      />
      <span
        className="text-sm font-normal text-white tracking-[0.2em] uppercase"
        style={{ fontFamily: "'BankGothic Lt BT', 'Bank Gothic', Arial, sans-serif" }}
      >
        PRESS FARM
      </span>
    </Link>
  );
}
