'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { formatSGD } from '@/lib/format';

interface KamRow {
  name: string;
  role: string;
  commission: number;
}

export function DashboardCharts({
  earningsVsInFlight,
  perKamData,
  coBrokeData,
  stageData,
}: {
  earningsVsInFlight: { label: string; value: number }[];
  perKamData: KamRow[];
  coBrokeData: { label: string; value: number; color: string }[];
  stageData: { stage: string; count: number }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <ChartCard title="Earnings vs In-flight commission">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={earningsVsInFlight} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => formatSGD(Number(v), { compact: true })} />
            <Tooltip formatter={(v) => formatSGD(Number(v))} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {earningsVsInFlight.map((d, i) => (
                <Cell key={i} fill={i === 0 ? '#10b981' : '#f59e0b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 text-xs text-muted">
          Realised commission paid out vs probability-weighted commission still in pipeline.
        </div>
      </ChartCard>

      <ChartCard title="Co-broke vs Individual earnings">
        {coBrokeData.every((d) => d.value === 0) ? (
          <div className="h-60 flex items-center justify-center text-sm text-muted">
            No placements yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={coBrokeData}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={2}
                label={(entry: { name?: string; value?: number }) => `${entry.name}: ${formatSGD(Number(entry.value), { compact: true })}`}
              >
                {coBrokeData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatSGD(Number(v))} />
              <Legend verticalAlign="bottom" height={20} iconSize={10} />
            </PieChart>
          </ResponsiveContainer>
        )}
        <div className="mt-2 text-xs text-muted">
          How realised commission splits between solo placements and co-broke contributions.
        </div>
      </ChartCard>

      <ChartCard title="Commission earned per consultant">
        {perKamData.length === 0 ? (
          <div className="h-60 flex items-center justify-center text-sm text-muted">
            No placements yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={perKamData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 30, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => formatSGD(Number(v), { compact: true })} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} width={70} />
              <Tooltip formatter={(v) => formatSGD(Number(v))} />
              <Bar dataKey="commission" fill="#0d9488" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <div className="mt-2 text-xs text-muted">
          Each consultant&apos;s lifetime commission from their split share.
        </div>
      </ChartCard>

      <ChartCard title="Open pipeline by stage">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={stageData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-border rounded-xl p-5">
      <div className="font-medium text-slate-900 mb-3">{title}</div>
      {children}
    </div>
  );
}
