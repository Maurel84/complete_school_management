import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  actions?: ReactNode;
}

export default function Modal({ isOpen, onClose, title, children, size = 'md', actions }: ModalProps) {
  if (!isOpen) return null;

  const sizeClass = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white/95 shadow-[0_40px_120px_-35px_rgba(15,23,42,0.45)] backdrop-blur ${sizeClass} animate-in`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h2 className="display-font text-xl font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-2xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {actions && (
          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-5">{actions}</div>
        )}
      </div>
    </div>
  );
}
