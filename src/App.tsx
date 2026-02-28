import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ScribeLayout } from './components/scribe-standalone/ScribeLayout';
import { ScribeAuthGuard } from './components/scribe-standalone/ScribeAuthGuard';
import { ScribeLoginPage } from './components/scribe-standalone/ScribeLoginPage';
import { ScribeRegisterPage } from './components/scribe-standalone/ScribeRegisterPage';
import { NoteBuilderPage } from './components/scribe-standalone/NoteBuilderPage';
import { ScribeRecordPage } from './components/scribe-standalone/ScribeRecordPage';
import { ScribeNotePage } from './components/scribe-standalone/ScribeNotePage';
import { ScribeDashboardPage } from './components/scribe-standalone/ScribeDashboardPage';
import { ScribeSettingsPage } from './components/scribe-standalone/ScribeSettingsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/scribe/login" element={<ScribeLoginPage />} />
        <Route path="/scribe/register" element={<ScribeRegisterPage />} />
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
          <Route path="note/new" element={<NoteBuilderPage />} />
          <Route path="note/:id/record" element={<ScribeRecordPage />} />
          <Route path="note/:id" element={<ScribeNotePage />} />
          <Route index element={<Navigate to="/scribe/dashboard" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/scribe/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
