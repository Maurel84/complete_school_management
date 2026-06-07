import { Outlet } from 'react-router-dom';
import Header from './Header';

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="px-4 pb-8 pt-5 lg:px-6">
        <div className="mx-auto max-w-[1480px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
