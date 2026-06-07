import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import StudentsPage from './pages/students/StudentsPage';
import ParentsPage from './pages/parents/ParentsPage';
import ClassesPage from './pages/classes/ClassesPage';
import FinancePage from './pages/finance/FinancePage';
import CashPage from './pages/cash/CashPage';
import AccountingPage from './pages/accounting/AccountingPage';
import TeachersPage from './pages/teachers/TeachersPage';
import HRPage from './pages/hr/HRPage';
import GradesPage from './pages/grades/GradesPage';
import AttendancePage from './pages/attendance/AttendancePage';
import SchedulePage from './pages/schedule/SchedulePage';
import MessagesPage from './pages/messages/MessagesPage';
import DocumentsPage from './pages/documents/DocumentsPage';
import SettingsPage from './pages/settings/SettingsPage';
import UsersPage from './pages/users/UsersPage';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { ModuleKey } from './lib/moduleAccess';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function ModuleRoute({ moduleKey, children }: { moduleKey: ModuleKey; children: React.ReactNode }) {
  const { loading, canAccessModule } = useAuth();

  if (loading) return null;
  if (canAccessModule(moduleKey)) return <>{children}</>;

  return (
    <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700">
        <AlertTriangle size={22} />
      </div>
      <h1 className="text-xl font-semibold text-slate-900">Acces limite</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Ce compte n'a pas acces a ce module. Un administrateur peut modifier les modules autorises depuis la page Utilisateurs.
      </p>
    </div>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/" element={<ModuleRoute moduleKey="dashboard"><DashboardPage /></ModuleRoute>} />
        <Route path="/students" element={<ModuleRoute moduleKey="students"><StudentsPage /></ModuleRoute>} />
        <Route path="/parents" element={<ModuleRoute moduleKey="parents"><ParentsPage /></ModuleRoute>} />
        <Route path="/classes" element={<ModuleRoute moduleKey="classes"><ClassesPage /></ModuleRoute>} />
        <Route path="/finance" element={<ModuleRoute moduleKey="finance"><FinancePage /></ModuleRoute>} />
        <Route path="/cash" element={<ModuleRoute moduleKey="cash"><CashPage /></ModuleRoute>} />
        <Route path="/accounting" element={<ModuleRoute moduleKey="accounting"><AccountingPage /></ModuleRoute>} />
        <Route path="/teachers" element={<ModuleRoute moduleKey="teachers"><TeachersPage /></ModuleRoute>} />
        <Route path="/hr" element={<ModuleRoute moduleKey="hr"><HRPage /></ModuleRoute>} />
        <Route path="/grades" element={<ModuleRoute moduleKey="grades"><GradesPage /></ModuleRoute>} />
        <Route path="/attendance" element={<ModuleRoute moduleKey="attendance"><AttendancePage /></ModuleRoute>} />
        <Route path="/schedule" element={<ModuleRoute moduleKey="schedule"><SchedulePage /></ModuleRoute>} />
        <Route path="/messages" element={<ModuleRoute moduleKey="messages"><MessagesPage /></ModuleRoute>} />
        <Route path="/documents" element={<ModuleRoute moduleKey="documents"><DocumentsPage /></ModuleRoute>} />
        <Route path="/users" element={<ModuleRoute moduleKey="users"><UsersPage /></ModuleRoute>} />
        <Route path="/settings" element={<ModuleRoute moduleKey="settings"><SettingsPage /></ModuleRoute>} />
      </Route>
    </Routes>
  );
}
