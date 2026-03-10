import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ScribeLayout } from './components/scribe-standalone/ScribeLayout';
import { ScribeAuthGuard } from './components/scribe-standalone/ScribeAuthGuard';
import { ScribeLoginPage } from './components/scribe-standalone/ScribeLoginPage';
import { ScribeRegisterPage } from './components/scribe-standalone/ScribeRegisterPage';
import { ScribeForgotPasswordPage } from './components/scribe-standalone/ScribeForgotPasswordPage';
import { ScribeResetPasswordPage } from './components/scribe-standalone/ScribeResetPasswordPage';
import { NoteBuilderPage } from './components/scribe-standalone/NoteBuilderPage';
import { ScribeRecordPage } from './components/scribe-standalone/ScribeRecordPage';
import { ScribeNotePage } from './components/scribe-standalone/ScribeNotePage';
import { ScribeDashboardPage } from './components/scribe-standalone/ScribeDashboardPage';
import { ScribeSettingsPage } from './components/scribe-standalone/ScribeSettingsPage';
import { ScribeAccountPage } from './components/scribe-standalone/ScribeAccountPage';
import { TemplatesPage } from './components/scribe-standalone/TemplatesPage';
import { ScribeFeedbackPage } from './components/scribe-standalone/ScribeFeedbackPage';
import { ScribeAdminFeedbackPage } from './components/scribe-standalone/ScribeAdminFeedbackPage';
import { ScribeAdminSignupsPage } from './components/scribe-standalone/ScribeAdminSignupsPage';
import ScribeLandingPage from './components/scribe-standalone/ScribeLandingPage';
import { ScribeTermsPage } from './components/scribe-standalone/ScribeTermsPage';
import { ScribePrivacyPage } from './components/scribe-standalone/ScribePrivacyPage';
import { install402Interceptor } from './utils/fetchInterceptor';

// Install once at app startup
install402Interceptor();

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ScribeLandingPage />} />
        <Route path="/scribe/login" element={<ScribeLoginPage />} />
        <Route path="/scribe/register" element={<ScribeRegisterPage />} />
        <Route path="/scribe/forgot-password" element={<ScribeForgotPasswordPage />} />
        <Route path="/scribe/reset-password" element={<ScribeResetPasswordPage />} />
        <Route path="/terms" element={<ScribeTermsPage />} />
        <Route path="/privacy" element={<ScribePrivacyPage />} />
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
          <Route path="note/new" element={<NoteBuilderPage />} />
          <Route path="note/:id/record" element={<ScribeRecordPage />} />
          <Route path="note/:id" element={<ScribeNotePage />} />
          <Route index element={<Navigate to="/scribe/dashboard" replace />} />
        </Route>
        <Route path="/account" element={<Navigate to="/scribe/account" replace />} />
        <Route path="/billing" element={<Navigate to="/scribe/account" replace />} />
        <Route path="*" element={<Navigate to="/scribe/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
