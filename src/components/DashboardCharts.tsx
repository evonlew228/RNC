'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';

export function DashboardCharts({
  stageData,
  consultantData,
  trendData,
}: {
  stageData: { stage: string; count: number }[];
  consultantData: { name: string; submissions: number }[];
  trendData: { day: string; count: number }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <ChartCard title="Pipeline by stage">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={stageData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="stage" tick={{ fontSize: 12, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#0d9488" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="BD activity (last 30 days)">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={consultantData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="submissions" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Submissions trend (last 30 days)" wide>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} interval={4} />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#0d9488" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  children,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`bg-white border border-border rounded-xl p-5 ${wide ? 'col-span-2' : ''}`}>
      <div className="font-medium text-slate-900 mb-3">{title}</div>
      {children}
    </div>
  );
}
