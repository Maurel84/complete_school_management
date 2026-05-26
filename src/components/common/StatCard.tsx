import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  trend?: { value: number; up: boolean };
  color?: 'blue' | 'green' | 'amber' | 'red' | 'teal' | 'slate';
}

const colors = {
  blue: 'bg-blue-50 text-blue-600 border-blue-100',
  green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  amber: 'bg-amber-50 text-amber-600 border-amber-100',
  red: 'bg-red-50 text-red-600 border-red-100',
  teal: 'bg-teal-50 text-teal-600 border-teal-100',
  slate: 'bg-slate-50 text-slate-600 border-slate-100',
};

const iconColors = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-emerald-100 text-emerald-600',
  amber: 'bg-amber-100 text-amber-600',
  red: 'bg-red-100 text-red-600',
  teal: 'bg-teal-100 text-teal-600',
  slate: 'bg-slate-100 text-slate-600',
};

export default function StatCard({ icon, value, label, trend, color = 'blue' }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-lg ${iconColors[color]}`}>{icon}</div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend.up ? 'text-emerald-600' : 'text-red-600'}`}>
            {trend.up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {trend.value}%
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm mt-1 opacity-70">{label}</p>
      </div>
    </div>
  );
}
