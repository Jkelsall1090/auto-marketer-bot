import { Bell, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  onNewCampaign: () => void;
}

export function Header({ onNewCampaign }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search campaigns, actions..."
          className="pl-10 bg-secondary border-border"
        />
      </div>

      <div className="flex items-center gap-4">
        <Button variant="glow" onClick={onNewCampaign}>
          <Plus className="h-4 w-4" />
          New Campaign
        </Button>
        
        <button className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
        </button>

        <div className="flex items-center gap-3 border-l border-border pl-4">
          <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-sm font-semibold text-primary-foreground">
            A
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-foreground">Admin</p>
            <p className="text-xs text-muted-foreground">Pro Plan</p>
          </div>
        </div>
      </div>
    </header>
  );
}
