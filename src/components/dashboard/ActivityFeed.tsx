import { cn } from "@/lib/utils";
import { 
  Twitter, 
  MessageSquare, 
  Linkedin, 
  Mail, 
  CheckCircle2, 
  Clock,
  AlertCircle
} from "lucide-react";

interface Activity {
  id: string;
  platform: string;
  action: string;
  content: string;
  timestamp: string;
  status: "completed" | "pending" | "failed";
  relevanceScore?: number;
}

const mockActivities: Activity[] = [
  {
    id: "1",
    platform: "Twitter",
    action: "Posted Tweet",
    content: "Excited to share how our AI-powered task manager helps teams save 5+ hours/week...",
    timestamp: "2 min ago",
    status: "completed",
    relevanceScore: 9,
  },
  {
    id: "2",
    platform: "Reddit",
    action: "Commented",
    content: "Great question! Our tool integrates seamlessly with existing workflows...",
    timestamp: "15 min ago",
    status: "completed",
    relevanceScore: 8,
  },
  {
    id: "3",
    platform: "LinkedIn",
    action: "Published Article",
    content: "5 Ways AI is Transforming Task Management in 2026",
    timestamp: "1 hour ago",
    status: "completed",
    relevanceScore: 9,
  },
  {
    id: "4",
    platform: "Email",
    action: "Newsletter Sent",
    content: "Weekly digest sent to 2,450 subscribers",
    timestamp: "3 hours ago",
    status: "completed",
  },
  {
    id: "5",
    platform: "Twitter",
    action: "Engagement Reply",
    content: "Pending response to trending thread about productivity...",
    timestamp: "Queued",
    status: "pending",
  },
];

const platformIcons: Record<string, typeof Twitter> = {
  Twitter: Twitter,
  Reddit: MessageSquare,
  LinkedIn: Linkedin,
  Email: Mail,
};

const statusConfig = {
  completed: { icon: CheckCircle2, className: "text-success" },
  pending: { icon: Clock, className: "text-warning" },
  failed: { icon: AlertCircle, className: "text-destructive" },
};

export function ActivityFeed() {
  return (
    <div className="rounded-xl border border-border bg-gradient-card">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
        <button className="text-sm font-medium text-primary hover:underline">
          View All
        </button>
      </div>

      <div className="divide-y divide-border">
        {mockActivities.map((activity) => {
          const PlatformIcon = platformIcons[activity.platform] || MessageSquare;
          const StatusInfo = statusConfig[activity.status];
          const StatusIcon = StatusInfo.icon;

          return (
            <div
              key={activity.id}
              className="flex items-start gap-4 p-4 transition-colors hover:bg-secondary/30"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <PlatformIcon className="h-5 w-5 text-primary" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {activity.action}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    on {activity.platform}
                  </span>
                  {activity.relevanceScore && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Score: {activity.relevanceScore}/10
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {activity.content}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusIcon className={cn("h-4 w-4", StatusInfo.className)} />
                <span className="text-xs text-muted-foreground">
                  {activity.timestamp}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
