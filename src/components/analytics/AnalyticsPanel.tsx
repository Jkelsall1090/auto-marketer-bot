import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell 
} from 'recharts';
import { TrendingUp, Target, Users, Zap } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";

const channelData = [
  { name: 'Twitter', engagements: 1245, clicks: 432, color: 'hsl(174, 72%, 50%)' },
  { name: 'Reddit', engagements: 892, clicks: 321, color: 'hsl(38, 92%, 50%)' },
  { name: 'LinkedIn', engagements: 567, clicks: 234, color: 'hsl(222, 70%, 55%)' },
  { name: 'Email', engagements: 1890, clicks: 567, color: 'hsl(142, 72%, 45%)' },
];

const sentimentData = [
  { name: 'Positive', value: 72, color: 'hsl(142, 72%, 45%)' },
  { name: 'Neutral', value: 20, color: 'hsl(38, 92%, 50%)' },
  { name: 'Negative', value: 8, color: 'hsl(0, 72%, 55%)' },
];

const weeklyData = [
  { week: 'Week 1', actions: 45, conversions: 12 },
  { week: 'Week 2', actions: 62, conversions: 18 },
  { week: 'Week 3', actions: 78, conversions: 24 },
  { week: 'Week 4', actions: 95, conversions: 32 },
];

export function AnalyticsPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Analytics</h2>
        <p className="text-muted-foreground">Deep dive into your campaign performance</p>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Reach"
          value="124.5K"
          change={23}
          trend="up"
          icon={Users}
        />
        <MetricCard
          title="Conversion Rate"
          value="4.8%"
          change={12}
          trend="up"
          icon={Target}
        />
        <MetricCard
          title="Actions Taken"
          value="2,847"
          change={-3}
          trend="down"
          icon={Zap}
        />
        <MetricCard
          title="ROI"
          value="312%"
          change={45}
          trend="up"
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Performance */}
        <div className="rounded-xl border border-border bg-gradient-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Channel Performance</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" horizontal={false} />
                <XAxis type="number" stroke="hsl(215, 20%, 55%)" fontSize={12} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  stroke="hsl(215, 20%, 55%)" 
                  fontSize={12}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(222, 47%, 10%)',
                    border: '1px solid hsl(222, 30%, 16%)',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="engagements" fill="hsl(174, 72%, 50%)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="clicks" fill="hsl(142, 72%, 45%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sentiment Analysis */}
        <div className="rounded-xl border border-border bg-gradient-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Sentiment Analysis</h3>
          <div className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {sentimentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(222, 47%, 10%)',
                    border: '1px solid hsl(222, 30%, 16%)',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {sentimentData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span 
                  className="h-3 w-3 rounded-full" 
                  style={{ backgroundColor: item.color }} 
                />
                <span className="text-sm text-muted-foreground">
                  {item.name}: {item.value}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly Progress */}
      <div className="rounded-xl border border-border bg-gradient-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Weekly Progress</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" />
              <XAxis dataKey="week" stroke="hsl(215, 20%, 55%)" fontSize={12} />
              <YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(222, 47%, 10%)',
                  border: '1px solid hsl(222, 30%, 16%)',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="actions" fill="hsl(174, 72%, 50%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="conversions" fill="hsl(142, 72%, 45%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
