import { useState } from "react";
import { 
  Key, 
  Database, 
  Bell, 
  Shield, 
  Webhook,
  Save,
  Eye,
  EyeOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function SettingsPanel() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [settings, setSettings] = useState({
    stateStore: "supabase://project/history.json",
    webhookUrl: "",
    slackWebhook: "",
    emailNotifications: true,
    slackNotifications: false,
    errorAlerts: true,
    dailySummary: true,
    apiKey: "sk-auto-****************************",
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Settings</h2>
        <p className="text-muted-foreground">Configure your agent's integrations and preferences</p>
      </div>

      {/* API Configuration */}
      <div className="rounded-xl border border-border bg-gradient-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">API Configuration</h3>
            <p className="text-sm text-muted-foreground">Manage your API keys and integrations</p>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-border">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? "text" : "password"}
                value={settings.apiKey}
                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                className="bg-secondary border-border pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* State Storage */}
      <div className="rounded-xl border border-border bg-gradient-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">State Storage</h3>
            <p className="text-sm text-muted-foreground">Configure persistent storage for agent state</p>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-border">
          <div className="space-y-2">
            <Label htmlFor="stateStore">State Store URL</Label>
            <Input
              id="stateStore"
              placeholder="supabase://project/history.json"
              value={settings.stateStore}
              onChange={(e) => setSettings({ ...settings, stateStore: e.target.value })}
              className="bg-secondary border-border font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Supported: Supabase, Firebase, S3, Redis
            </p>
          </div>
        </div>
      </div>

      {/* Webhooks */}
      <div className="rounded-xl border border-border bg-gradient-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Webhook className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Webhooks</h3>
            <p className="text-sm text-muted-foreground">External trigger endpoints</p>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-border">
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook URL (n8n, Zapier, etc.)</Label>
            <Input
              id="webhookUrl"
              placeholder="https://n8n.example.com/webhook/..."
              value={settings.webhookUrl}
              onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
              className="bg-secondary border-border"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="slackWebhook">Slack Webhook URL</Label>
            <Input
              id="slackWebhook"
              placeholder="https://hooks.slack.com/services/..."
              value={settings.slackWebhook}
              onChange={(e) => setSettings({ ...settings, slackWebhook: e.target.value })}
              className="bg-secondary border-border"
            />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-xl border border-border bg-gradient-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Notifications</h3>
            <p className="text-sm text-muted-foreground">Configure alert preferences</p>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Email Notifications</p>
              <p className="text-sm text-muted-foreground">Receive updates via email</p>
            </div>
            <Switch
              checked={settings.emailNotifications}
              onCheckedChange={(checked) => setSettings({ ...settings, emailNotifications: checked })}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Slack Notifications</p>
              <p className="text-sm text-muted-foreground">Send updates to Slack channel</p>
            </div>
            <Switch
              checked={settings.slackNotifications}
              onCheckedChange={(checked) => setSettings({ ...settings, slackNotifications: checked })}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Error Alerts</p>
              <p className="text-sm text-muted-foreground">Get notified on critical errors</p>
            </div>
            <Switch
              checked={settings.errorAlerts}
              onCheckedChange={(checked) => setSettings({ ...settings, errorAlerts: checked })}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Daily Summary</p>
              <p className="text-sm text-muted-foreground">Receive daily performance reports</p>
            </div>
            <Switch
              checked={settings.dailySummary}
              onCheckedChange={(checked) => setSettings({ ...settings, dailySummary: checked })}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <Button variant="glow" size="lg" className="w-full gap-2">
        <Save className="h-4 w-4" />
        Save Settings
      </Button>
    </div>
  );
}
