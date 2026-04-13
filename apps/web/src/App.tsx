import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { AthletesPage } from './pages/AthletesPage';
import { AthleteFormPage } from './pages/AthleteFormPage';
import { AthleteDetailPage } from './pages/AthleteDetailPage';
import { GuardianFormPage } from './pages/GuardianFormPage';
import { GroupsPage } from './pages/GroupsPage';
import { TeamsPage } from './pages/TeamsPage';
import { FinanceHubPage } from './pages/FinanceHubPage';
import { ChargeItemsPage } from './pages/ChargeItemsPage';
import { AthleteChargesPage } from './pages/AthleteChargesPage';
import { TrainingSessionsPage } from './pages/TrainingSessionsPage';
import { TrainingSessionFormPage } from './pages/TrainingSessionFormPage';
import { TrainingSessionDetailPage } from './pages/TrainingSessionDetailPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<AppShell />}>
        <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/app/dashboard" element={<DashboardPage />} />
        <Route path="/app/athletes/new" element={<AthleteFormPage />} />
        <Route path="/app/athletes/:id/edit" element={<AthleteFormPage />} />
        <Route path="/app/athletes/:id" element={<AthleteDetailPage />} />
        <Route path="/app/athletes" element={<AthletesPage />} />
        <Route path="/app/guardians/new" element={<GuardianFormPage />} />
        <Route path="/app/groups" element={<GroupsPage />} />
        <Route path="/app/teams" element={<TeamsPage />} />
        <Route path="/app/training/new" element={<TrainingSessionFormPage />} />
        <Route path="/app/training/:id" element={<TrainingSessionDetailPage />} />
        <Route path="/app/training" element={<TrainingSessionsPage />} />
        <Route path="/app/finance/charge-items" element={<ChargeItemsPage />} />
        <Route path="/app/finance/athlete-charges" element={<AthleteChargesPage />} />
        <Route path="/app/finance" element={<FinanceHubPage />} />
        <Route path="/app/reports" element={<ReportsPage />} />
        <Route path="/app/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
