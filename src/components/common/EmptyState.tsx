import { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="surface-card flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-5 rounded-full bg-slate-100 p-4 text-slate-400">{icon}</div>
      <h3 className="display-font text-xl font-semibold text-slate-800">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
