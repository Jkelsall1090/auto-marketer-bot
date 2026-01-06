import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Rocket, 
  Activity, 
  Settings, 
  BarChart3,
  Zap,
  Target,
  ListTodo
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "campaigns", label: "Campaigns", icon: Rocket },
  { id: "content-queue", label: "Content Queue", icon: ListTodo },
  { id: "activity", label: "Activity Log", icon: Activity },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-sidebar">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">AutoMarketer</h1>
            <p className="text-xs text-muted-foreground">AI-Powered Growth</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary shadow-glow"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Agent Status */}
        <div className="border-t border-border p-4">
          <div className="rounded-lg bg-gradient-card p-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Target className="h-5 w-5 text-primary" />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-success animate-pulse" />
              </div>
              <span className="text-sm font-medium text-foreground">Agent Active</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Next run in 2h 34m
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
