import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  trend?: { value: number; up: boolean };
  color?: 'blue' | 'green' | 'amber' | 'red' | 'teal' | 'slate';
}

const colorMap = {
  blue: {
    line: 'from-sky-500 to-cyan-400',
    glow: 'bg-sky-200/60',
    icon: 'bg-sky-100 text-sky-700',
  },
  green: {
    line: 'from-emerald-500 to-lime-400',
    glow: 'bg-emerald-200/60',
    icon: 'bg-emerald-100 text-emerald-700',
  },
  amber: {
    line: 'from-amber-500 to-orange-400',
    glow: 'bg-amber-200/60',
    icon: 'bg-amber-100 text-amber-700',
  },
  red: {
    line: 'from-rose-500 to-orange-400',
    glow: 'bg-rose-200/60',
    icon: 'bg-rose-100 text-rose-700',
  },
  teal: {
    line: 'from-teal-500 to-emerald-400',
    glow: 'bg-teal-200/60',
    icon: 'bg-teal-100 text-teal-700',
  },
  slate: {
    line: 'from-slate-500 to-slate-400',
    glow: 'bg-slate-200/60',
    icon: 'bg-slate-100 text-slate-700',
  },
};

export default function StatCard({ icon, value, label, trend, color = 'blue' }: StatCardProps) {
  const palette = colorMap[color];

  return (
    <div className="relative overflow-hidden rounded-[26px] border border-white/70 bg-white/90 p-5 shadow-[0_28px_70px_-36px_rgba(15,23,42,0.35)] backdrop-blur">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${palette.line}`} />
      <div className={`absolute -right-10 -top-10 h-28 w-28 rounded-full ${palette.glow} blur-3xl`} />

      <div className="relative flex items-start justify-between">
        <div className={`rounded-2xl p-3 ${palette.icon}`}>{icon}</div>
        {trend && (
          <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            trend.up ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}>
            {trend.up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {trend.value}%
          </div>
        )}
      </div>

      <div className="relative mt-5">
        <p className="display-font text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
        <p className="mt-2 text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}
