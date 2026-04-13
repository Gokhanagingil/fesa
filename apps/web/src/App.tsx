import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { AthletesPage } from './pages/AthletesPage';
import { GroupsPage } from './pages/GroupsPage';
import { TeamsPage } from './pages/TeamsPage';
import { FinancePage } from './pages/FinancePage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<AppShell />}>
        <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/app/dashboard" element={<DashboardPage />} />
        <Route path="/app/athletes" element={<AthletesPage />} />
        <Route path="/app/groups" element={<GroupsPage />} />
        <Route path="/app/teams" element={<TeamsPage />} />
        <Route path="/app/finance" element={<FinancePage />} />
        <Route path="/app/reports" element={<ReportsPage />} />
        <Route path="/app/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
