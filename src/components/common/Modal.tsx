import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  actions?: ReactNode;
  footer?: ReactNode;
}

export default function Modal({ isOpen, open, onClose, title, children, size = 'md', actions, footer }: ModalProps) {
  const isVisible = isOpen ?? open ?? false;
  if (!isVisible) return null;

  const bottomActions = actions ?? footer;

  const sizeClass = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl ${sizeClass} animate-in`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h2 className="display-font text-xl font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {bottomActions && (
          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-5">{bottomActions}</div>
        )}
      </div>
    </div>
  );
}
