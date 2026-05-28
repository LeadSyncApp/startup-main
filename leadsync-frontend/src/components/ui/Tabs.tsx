interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTabId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTabId, onChange, className = "" }: TabsProps) {
  return (
    <div className={`flex items-center space-x-1 border-b border-app-border ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              relative px-4 py-2.5 text-sm font-medium transition-colors
              ${isActive ? "text-app-primary" : "text-app-muted hover:text-app-text hover:bg-app-bg"}
            `}
          >
            <div className="flex items-center gap-2">
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`
                    px-1.5 py-0.5 rounded-full text-xs
                    ${isActive ? "bg-app-primary/10 text-app-primary" : "bg-app-bg-soft text-app-muted"}
                  `}
                >
                  {tab.count}
                </span>
              )}
            </div>
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-app-primary rounded-t-sm" />
            )}
          </button>
        );
      })}
    </div>
  );
}
