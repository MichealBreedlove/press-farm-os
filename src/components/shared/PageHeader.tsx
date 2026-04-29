interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  /** Reserved for future deep-link from header — currently the brand mark is rendered by CSS .page-header::after */
  dashboardHref?: string;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="flex-1 min-w-0">
        {children ?? (
          <>
            <h1 className="page-title">{title}</h1>
            {subtitle && <p className="text-sm text-white/60 mt-0.5">{subtitle}</p>}
          </>
        )}
      </div>
      {/*
        The "PRESS FARM" wordmark + marigold flower mark are rendered
        as CSS pseudo-elements (.page-header::before / ::after in
        globals.css) so they appear on every page-header, including
        ones that don't use this React component.
      */}
    </header>
  );
}
