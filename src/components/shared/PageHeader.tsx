import Image from "next/image";
import Link from "next/link";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  dashboardHref?: string;
}

export function PageHeader({ title, subtitle, children, dashboardHref = "/admin/dashboard" }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          {children ?? (
            <>
              <h1 className="page-title">{title}</h1>
              {subtitle && <p className="text-sm text-white/60 mt-0.5">{subtitle}</p>}
            </>
          )}
        </div>
        <Link href={dashboardHref} className="flex items-center gap-2 ml-3 flex-shrink-0 min-h-0 opacity-80 hover:opacity-100 transition-opacity">
          <span
            className="text-[10px] font-normal text-white/70 tracking-[0.15em] uppercase hidden sm:inline"
            style={{ fontFamily: "'BankGothic Lt BT', 'Bank Gothic', Arial, sans-serif" }}
          >
            PRESS FARM
          </span>
          <Image
            src="/icon-192.png"
            alt="Press Farm"
            width={24}
            height={24}
            className="rounded-full"
          />
        </Link>
      </div>
    </header>
  );
}
