import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ScribeLayout } from './components/scribe-standalone/ScribeLayout';
import { ScribeAuthGuard } from './components/scribe-standalone/ScribeAuthGuard';
import { ScribeLoginPage } from './components/scribe-standalone/ScribeLoginPage';
import { ScribeRegisterPage } from './components/scribe-standalone/ScribeRegisterPage';
import { ScribeForgotPasswordPage } from './components/scribe-standalone/ScribeForgotPasswordPage';
import { ScribeResetPasswordPage } from './components/scribe-standalone/ScribeResetPasswordPage';
import { NoteBuilderPage } from './components/scribe-standalone/NoteBuilderPage';
import { ChartCollectorPage } from './components/scribe-standalone/ChartCollectorPage';
import { ScribeRecordPage } from './components/scribe-standalone/ScribeRecordPage';
import { ScribeNotePage } from './components/scribe-standalone/ScribeNotePage';
import { ScribeDashboardPage } from './components/scribe-standalone/ScribeDashboardPage';
import { ScribeSettingsPage } from './components/scribe-standalone/ScribeSettingsPage';
import { ScribeAccountPage } from './components/scribe-standalone/ScribeAccountPage';
import { TemplatesPage } from './components/scribe-standalone/TemplatesPage';
import { ScribeFeedbackPage } from './components/scribe-standalone/ScribeFeedbackPage';
import { ScribeAdminFeedbackPage } from './components/scribe-standalone/ScribeAdminFeedbackPage';
import { ScribeAdminSignupsPage } from './components/scribe-standalone/ScribeAdminSignupsPage';
import { TeamsPage } from './components/scribe-standalone/TeamsPage';
import { TeamManagePage } from './components/scribe-standalone/TeamManagePage';
import { MetricsDashboardPage } from './components/scribe-standalone/MetricsDashboardPage';
import { PopulationDashboardPage } from './components/scribe-standalone/PopulationDashboardPage';
import ScribeLandingPage from './components/scribe-standalone/ScribeLandingPage';
import { PwaSplashGate } from './components/scribe-standalone/PwaSplashGate';
import { ScribeTermsPage } from './components/scribe-standalone/ScribeTermsPage';
import { ScribePrivacyPage } from './components/scribe-standalone/ScribePrivacyPage';
import ForPAsPage from './components/scribe-standalone/ForPAsPage';
import ForNPsPage from './components/scribe-standalone/ForNPsPage';
import ForResidentsPage from './components/scribe-standalone/ForResidentsPage';
import ForPracticesPage from './components/scribe-standalone/ForPracticesPage';
import SecurityPage from './components/scribe-standalone/SecurityPage';
import { CoderAuthGuard } from './components/coder/CoderAuthGuard';
import { CoderLayout } from './components/coder/CoderLayout';
import { CoderDashboard } from './components/coder/CoderDashboard';
import { CoderSessionDetail } from './components/coder/CoderSessionDetail';
import { CoderTeamManagement } from './components/coder/CoderTeamManagement';
import { install402Interceptor } from './utils/fetchInterceptor';

// Install once at app startup
install402Interceptor();

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PwaSplashGate><ScribeLandingPage /></PwaSplashGate>} />
        <Route path="/scribe/login" element={<ScribeLoginPage />} />
        <Route path="/scribe/register" element={<ScribeRegisterPage />} />
        <Route path="/scribe/forgot-password" element={<ScribeForgotPasswordPage />} />
        <Route path="/scribe/reset-password" element={<ScribeResetPasswordPage />} />
        <Route path="/terms" element={<ScribeTermsPage />} />
        <Route path="/privacy" element={<ScribePrivacyPage />} />
        <Route path="/for-pas" element={<ForPAsPage />} />
        <Route path="/for-nps" element={<ForNPsPage />} />
        <Route path="/for-residents" element={<ForResidentsPage />} />
        <Route path="/for-practices" element={<ForPracticesPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route
          path="/scribe/*"
          element={
            <ScribeAuthGuard>
              <ScribeLayout />
            </ScribeAuthGuard>
          }
        >
          <Route path="dashboard" element={<ScribeDashboardPage />} />
          <Route path="settings" element={<ScribeSettingsPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="billing" element={<Navigate to="/scribe/account" replace />} />
          <Route path="account" element={<ScribeAccountPage />} />
          <Route path="feedback" element={<ScribeFeedbackPage />} />
          <Route path="admin/feedback" element={<ScribeAdminFeedbackPage />} />
          <Route path="admin/signups" element={<ScribeAdminSignupsPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="teams/:teamId/manage" element={<TeamManagePage />} />
          <Route path="teams/:teamId/metrics" element={<MetricsDashboardPage />} />
          <Route path="teams/:teamId/registry" element={<PopulationDashboardPage />} />
          <Route path="note/new" element={<NoteBuilderPage />} />
          <Route path="chart-collector" element={<ChartCollectorPage />} />
          <Route path="note/:id/record" element={<ScribeRecordPage />} />
          <Route path="note/:id" element={<ScribeNotePage />} />
          <Route index element={<Navigate to="/scribe/dashboard" replace />} />
        </Route>
        <Route
          path="/coder/*"
          element={
            <CoderAuthGuard>
              <CoderLayout />
            </CoderAuthGuard>
          }
        >
          <Route path="dashboard" element={<CoderDashboard />} />
          <Route path="session/:id" element={<CoderSessionDetail />} />
          <Route path="team" element={<CoderTeamManagement />} />
          <Route index element={<Navigate to="/coder/dashboard" replace />} />
        </Route>
        <Route path="/account" element={<Navigate to="/scribe/account" replace />} />
        <Route path="/billing" element={<Navigate to="/scribe/account" replace />} />
        <Route path="*" element={<Navigate to="/scribe/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
