import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { date: 'Mon', impressions: 2400, clicks: 400, engagements: 240 },
  { date: 'Tue', impressions: 1398, clicks: 300, engagements: 139 },
  { date: 'Wed', impressions: 9800, clicks: 1200, engagements: 980 },
  { date: 'Thu', impressions: 3908, clicks: 500, engagements: 390 },
  { date: 'Fri', impressions: 4800, clicks: 600, engagements: 480 },
  { date: 'Sat', impressions: 3800, clicks: 450, engagements: 380 },
  { date: 'Sun', impressions: 4300, clicks: 520, engagements: 430 },
];

export function PerformanceChart() {
  return (
    <div className="rounded-xl border border-border bg-gradient-card p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Performance Overview</h3>
          <p className="text-sm text-muted-foreground">Last 7 days engagement metrics</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Impressions</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-success" />
            <span className="text-xs text-muted-foreground">Clicks</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-warning" />
            <span className="text-xs text-muted-foreground">Engagements</span>
          </div>
        </div>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(174, 72%, 50%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(174, 72%, 50%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 72%, 45%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(142, 72%, 45%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorEngagements" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" />
            <XAxis 
              dataKey="date" 
              stroke="hsl(215, 20%, 55%)" 
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="hsl(215, 20%, 55%)" 
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value / 1000}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(222, 47%, 10%)',
                border: '1px solid hsl(222, 30%, 16%)',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              }}
              labelStyle={{ color: 'hsl(210, 40%, 98%)' }}
              itemStyle={{ color: 'hsl(215, 20%, 55%)' }}
            />
            <Area
              type="monotone"
              dataKey="impressions"
              stroke="hsl(174, 72%, 50%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorImpressions)"
            />
            <Area
              type="monotone"
              dataKey="clicks"
              stroke="hsl(142, 72%, 45%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorClicks)"
            />
            <Area
              type="monotone"
              dataKey="engagements"
              stroke="hsl(38, 92%, 50%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorEngagements)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
