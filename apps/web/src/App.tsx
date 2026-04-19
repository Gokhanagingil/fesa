import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { AthletesPage } from './pages/AthletesPage';
import { AthleteFormPage } from './pages/AthleteFormPage';
import { AthleteDetailPage } from './pages/AthleteDetailPage';
import { GuardiansPage } from './pages/GuardiansPage';
import { GuardianFormPage } from './pages/GuardianFormPage';
import { GuardianDetailPage } from './pages/GuardianDetailPage';
import { GroupsPage } from './pages/GroupsPage';
import { TeamsPage } from './pages/TeamsPage';
import { FinanceHubPage } from './pages/FinanceHubPage';
import { ChargeItemsPage } from './pages/ChargeItemsPage';
import { AthleteChargesPage } from './pages/AthleteChargesPage';
import { TrainingSessionsPage } from './pages/TrainingSessionsPage';
import { TrainingSessionFormPage } from './pages/TrainingSessionFormPage';
import { TrainingSessionDetailPage } from './pages/TrainingSessionDetailPage';
import { CoachesPage } from './pages/CoachesPage';
import { PrivateLessonsPage } from './pages/PrivateLessonsPage';
import { CommunicationsPage } from './pages/CommunicationsPage';
import { ActionCenterPage } from './pages/ActionCenterPage';
import { ReportsPage } from './pages/ReportsPage';
import { ReportBuilderPage } from './pages/ReportBuilderPage';
import { SettingsPage } from './pages/SettingsPage';
import { InventoryPage } from './pages/InventoryPage';
import { ImportsPage } from './pages/ImportsPage';
import { PortalShell } from './components/layout/PortalShell';
import { GuardianPortalLoginPage } from './pages/GuardianPortalLoginPage';
import { GuardianPortalActivationPage } from './pages/GuardianPortalActivationPage';
import { GuardianPortalHomePage } from './pages/GuardianPortalHomePage';
import { GuardianPortalActionPage } from './pages/GuardianPortalActionPage';
import { StaffLoginPage } from './pages/StaffLoginPage';
import { RequireStaffAuth } from './components/auth/RequireStaffAuth';
import { RuntimeBuildBadge } from './components/ui/RuntimeBuildBadge';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<StaffLoginPage />} />
        <Route path="/portal/login" element={<GuardianPortalLoginPage />} />
        <Route path="/portal/activate" element={<GuardianPortalActivationPage />} />
        <Route element={<PortalShell />}>
          <Route path="/portal" element={<Navigate to="/portal/home" replace />} />
          <Route path="/portal/home" element={<GuardianPortalHomePage />} />
          <Route path="/portal/actions/:id" element={<GuardianPortalActionPage />} />
        </Route>
        <Route element={<RequireStaffAuth />}>
          <Route element={<AppShell />}>
            <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
            <Route path="/app/dashboard" element={<DashboardPage />} />
            <Route path="/app/athletes/new" element={<AthleteFormPage />} />
            <Route path="/app/athletes/:id/edit" element={<AthleteFormPage />} />
            <Route path="/app/athletes/:id" element={<AthleteDetailPage />} />
            <Route path="/app/athletes" element={<AthletesPage />} />
            <Route path="/app/guardians/:id/edit" element={<GuardianFormPage />} />
            <Route path="/app/guardians/:id" element={<GuardianDetailPage />} />
            <Route path="/app/guardians/new" element={<GuardianFormPage />} />
            <Route path="/app/guardians" element={<GuardiansPage />} />
            <Route path="/app/groups" element={<GroupsPage />} />
            <Route path="/app/teams" element={<TeamsPage />} />
            <Route path="/app/coaches" element={<CoachesPage />} />
            <Route path="/app/training/new" element={<TrainingSessionFormPage />} />
            <Route path="/app/training/:id" element={<TrainingSessionDetailPage />} />
            <Route path="/app/training" element={<TrainingSessionsPage />} />
            <Route path="/app/private-lessons" element={<PrivateLessonsPage />} />
            <Route path="/app/communications" element={<CommunicationsPage />} />
            <Route path="/app/action-center" element={<ActionCenterPage />} />
            <Route path="/app/finance/charge-items" element={<ChargeItemsPage />} />
            <Route path="/app/finance/athlete-charges" element={<AthleteChargesPage />} />
            <Route path="/app/finance" element={<FinanceHubPage />} />
            <Route path="/app/inventory" element={<InventoryPage />} />
            <Route path="/app/reports" element={<ReportsPage />} />
            <Route path="/app/report-builder" element={<ReportBuilderPage />} />
            <Route path="/app/imports" element={<ImportsPage />} />
            <Route path="/app/settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <RuntimeBuildBadge />
    </>
  );
}
