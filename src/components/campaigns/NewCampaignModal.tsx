import { useState } from "react";
import { X, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface NewCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CampaignFormData) => void;
}

interface CampaignFormData {
  name: string;
  product: string;
  goals: string[];
  budget: number;
  channels: string[];
  schedule: string;
}

const availableChannels = [
  { id: "twitter", name: "Twitter/X", icon: "𝕏", autoPost: true },
  { id: "craigslist", name: "Craigslist", icon: "📋", autoPost: false },
  { id: "nextdoor", name: "Nextdoor", icon: "🏘️", autoPost: false },
  { id: "reddit", name: "Reddit", icon: "🔥", autoPost: false },
  { id: "linkedin", name: "LinkedIn", icon: "in", autoPost: false },
  { id: "facebook", name: "Facebook", icon: "📘", autoPost: false },
];

const scheduleOptions = [
  { value: "1h", label: "Every hour" },
  { value: "6h", label: "Every 6 hours" },
  { value: "12h", label: "Every 12 hours" },
  { value: "24h", label: "Daily" },
];

export function NewCampaignModal({ isOpen, onClose, onSubmit }: NewCampaignModalProps) {
  const [formData, setFormData] = useState<CampaignFormData>({
    name: "",
    product: "",
    goals: [""],
    budget: 0,
    channels: [],
    schedule: "6h",
  });

  if (!isOpen) return null;

  const addGoal = () => {
    setFormData((prev) => ({ ...prev, goals: [...prev.goals, ""] }));
  };

  const removeGoal = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.filter((_, i) => i !== index),
    }));
  };

  const updateGoal = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.map((g, i) => (i === index ? value : g)),
    }));
  };

  const toggleChannel = (channelId: string) => {
    setFormData((prev) => ({
      ...prev,
      channels: prev.channels.includes(channelId)
        ? prev.channels.filter((c) => c !== channelId)
        : [...prev.channels, channelId],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl animate-slide-up">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card p-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Create New Campaign</h2>
            <p className="text-sm text-muted-foreground">Configure your autonomous marketing campaign</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Campaign Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              placeholder="e.g., Q1 Product Launch"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-secondary border-border"
            />
          </div>

          {/* Product Description */}
          <div className="space-y-2">
            <Label htmlFor="product">Product/Company Description</Label>
            <Textarea
              id="product"
              placeholder="Describe your product or company in detail. Include key features, target audience, and unique selling points..."
              value={formData.product}
              onChange={(e) => setFormData({ ...formData, product: e.target.value })}
              className="min-h-[100px] bg-secondary border-border"
            />
          </div>

          {/* Goals */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Campaign Goals</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addGoal}
                className="gap-1 text-primary"
              >
                <Plus className="h-4 w-4" />
                Add Goal
              </Button>
            </div>
            {formData.goals.map((goal, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="e.g., Increase downloads by 20%"
                  value={goal}
                  onChange={(e) => updateGoal(index, e.target.value)}
                  className="bg-secondary border-border"
                />
                {formData.goals.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeGoal(index)}
                    className="shrink-0 text-destructive hover:text-destructive"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Budget */}
          <div className="space-y-2">
            <Label htmlFor="budget">Daily Budget (optional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="budget"
                type="number"
                min="0"
                placeholder="0"
                value={formData.budget || ""}
                onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
                className="bg-secondary border-border pl-7"
              />
            </div>
            <p className="text-xs text-muted-foreground">Leave at 0 for organic-only campaigns</p>
          </div>

          {/* Channels */}
          <div className="space-y-3">
            <Label>Marketing Channels</Label>
            <div className="grid grid-cols-3 gap-3">
              {availableChannels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => toggleChannel(channel.id)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all",
                    formData.channels.includes(channel.id)
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-secondary hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{channel.icon}</span>
                    <span className="text-sm font-medium">{channel.name}</span>
                  </div>
                  <span className={cn(
                    "text-xs",
                    channel.autoPost ? "text-green-500" : "text-muted-foreground"
                  )}>
                    {channel.autoPost ? "Auto-post" : "Manual post"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-3">
            <Label>Run Schedule</Label>
            <div className="grid grid-cols-4 gap-3">
              {scheduleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, schedule: option.value })}
                  className={cn(
                    "rounded-lg border p-3 text-center text-sm font-medium transition-all",
                    formData.schedule === option.value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-secondary hover:border-primary/50"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="glow" className="flex-1">
              Create Campaign
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
