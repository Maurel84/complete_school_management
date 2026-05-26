import { Outlet } from 'react-router-dom';
import Header from './Header';

export default function MainLayout() {
  return (
    <div className="min-h-screen">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-12%] top-[-8%] h-72 w-72 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="absolute right-[-6%] top-[8%] h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[18%] h-96 w-96 rounded-full bg-sky-200/25 blur-3xl" />
      </div>

      <Header />

      <main className="relative px-4 pb-8 pt-6 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
