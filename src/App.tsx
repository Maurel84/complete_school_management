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
import { Loader2 } from 'lucide-react';

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
        <Route path="/" element={<DashboardPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/parents" element={<ParentsPage />} />
        <Route path="/classes" element={<ClassesPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/cash" element={<CashPage />} />
        <Route path="/accounting" element={<AccountingPage />} />
        <Route path="/teachers" element={<TeachersPage />} />
        <Route path="/hr" element={<HRPage />} />
        <Route path="/grades" element={<GradesPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
