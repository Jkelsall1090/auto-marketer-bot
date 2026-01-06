import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { CampaignCard } from "@/components/dashboard/CampaignCard";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { AgentStatus } from "@/components/dashboard/AgentStatus";
import { NewCampaignModal } from "@/components/campaigns/NewCampaignModal";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { AnalyticsPanel } from "@/components/analytics/AnalyticsPanel";
import { ContentQueuePanel } from "@/components/content-queue/ContentQueuePanel";
import { useCampaigns, useCreateCampaign } from "@/hooks/useCampaigns";
import { 
  Users, 
  MousePointerClick, 
  MessageCircle, 
  TrendingUp,
  Rocket,
  Loader2
} from "lucide-react";

const mockCampaigns = [
  {
    name: "AirportBuddy Launch",
    product: "Mobile app providing real-time TSA wait times, flight status updates, and airport info for stress-free travel",
    status: "active" as const,
    channels: ["Twitter", "Reddit", "TikTok"],
    metrics: {
      impressions: 45200,
      clicks: 1840,
      engagements: 892,
      sentiment: 0.87,
    },
    nextRun: "In 2h 34m",
  },
  {
    name: "Q1 Growth Push",
    product: "SaaS productivity suite for remote teams",
    status: "active" as const,
    channels: ["Email", "LinkedIn", "YouTube"],
    metrics: {
      impressions: 28500,
      clicks: 920,
      engagements: 456,
      sentiment: 0.82,
    },
    nextRun: "In 4h 12m",
  },
  {
    name: "Product Hunt Launch",
    product: "Developer tools for API testing",
    status: "paused" as const,
    channels: ["Twitter", "Reddit"],
    metrics: {
      impressions: 12300,
      clicks: 567,
      engagements: 234,
      sentiment: 0.91,
    },
  },
];

export default function Index() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns();
  const createCampaign = useCreateCampaign();

  const handleNewCampaign = async (data: any) => {
    await createCampaign.mutateAsync({
      name: data.name,
      product: data.product,
      goals: data.goals,
      channels: data.channels,
      budget: data.budget,
      schedule_interval: data.schedule,
    });
    setIsNewCampaignOpen(false);
  };

  // Use database campaigns or fallback to mock for demo
  const displayCampaigns = campaigns?.length ? campaigns.map(c => ({
    name: c.name,
    product: c.product,
    status: c.status as "active" | "paused" | "completed",
    channels: (c.channels as string[]) || [],
    metrics: {
      impressions: 0,
      clicks: 0,
      engagements: 0,
      sentiment: 0.85,
    },
    nextRun: "Ready to run",
  })) : mockCampaigns;

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <div className="space-y-6">
            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Impressions"
                value="86.1K"
                change={18}
                trend="up"
                icon={Users}
              />
              <MetricCard
                title="Total Clicks"
                value="3,327"
                change={12}
                trend="up"
                icon={MousePointerClick}
              />
              <MetricCard
                title="Engagements"
                value="1,582"
                change={-5}
                trend="down"
                icon={MessageCircle}
              />
              <MetricCard
                title="Avg. Sentiment"
                value="87%"
                change={3}
                trend="up"
                icon={TrendingUp}
              />
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Chart & Status */}
              <div className="lg:col-span-2 space-y-6">
                <PerformanceChart />
                <AgentStatus
                  phase="engagement_execution"
                  isRunning={true}
                  lastRun="Today, 10:30 AM"
                  nextRun="Today, 4:30 PM"
                  opportunitiesQueued={12}
                />
              </div>

              {/* Right Column - Activity Feed */}
              <div className="lg:col-span-1">
                <ActivityFeed />
              </div>
            </div>
          </div>
        );

      case "campaigns":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Campaigns</h2>
                <p className="text-muted-foreground">Manage your marketing campaigns</p>
              </div>
            </div>

            {campaignsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {displayCampaigns.map((campaign, index) => (
                  <CampaignCard key={index} {...campaign} />
                ))}
                
                {/* Add Campaign Card */}
                <button
                  onClick={() => setIsNewCampaignOpen(true)}
                  className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-8 text-muted-foreground transition-all hover:border-primary hover:text-primary"
                >
                  <Rocket className="h-10 w-10" />
                  <span className="text-lg font-medium">Create New Campaign</span>
                </button>
              </div>
            )}
          </div>
        );

      case "content-queue":
        return <ContentQueuePanel />;

      case "activity":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Activity Log</h2>
              <p className="text-muted-foreground">Complete history of agent actions</p>
            </div>
            <ActivityFeed />
          </div>
        );

      case "analytics":
        return <AnalyticsPanel />;

      case "settings":
        return <SettingsPanel />;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="ml-64">
        <Header onNewCampaign={() => setIsNewCampaignOpen(true)} />
        
        <main className="p-6">
          {renderContent()}
        </main>
      </div>

      <NewCampaignModal
        isOpen={isNewCampaignOpen}
        onClose={() => setIsNewCampaignOpen(false)}
        onSubmit={handleNewCampaign}
      />
    </div>
  );
}
