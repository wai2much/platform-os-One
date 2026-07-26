import { cn } from '@/lib/cn';

function NavItem({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-full px-3 py-2 text-left text-sm transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      )}
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

export function Layout({ tenant, title, sections, activeKey, onNavigate, children }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card/60">
        <div className="flex items-center gap-2 px-5 py-5">
          <svg width="24" height="26" viewBox="0 0 40 44" aria-hidden>
            <path d="M20 2 36 11 36 33 20 42 4 33 4 11Z" fill="hsl(var(--primary))" />
          </svg>
          <span className="font-display text-xl">Platform OS</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {sections.map((section) => (
            <div key={section.title} className="mb-4">
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavItem
                    key={item.key}
                    item={item}
                    active={activeKey === item.key}
                    onClick={() => onNavigate(item.key)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border px-5 py-3">
          <div className="text-sm font-medium">{tenant.name}</div>
          <div className="text-xs capitalize text-muted-foreground">{tenant.vertical} · tenant</div>
        </div>
      </aside>

      {/* Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-border px-8 py-4">
          <h1 className="font-display text-2xl">{title}</h1>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-accent">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" /> Live · {tenant.name}
          </div>
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
