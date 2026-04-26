import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import MainLayout from './layouts/MainLayout';
import Dashboard from './features/dashboard/Dashboard';
import Notes from './features/notes/Notes';
import Tasks from './features/tasks/Tasks';
import Users from './features/users/Users';
import Projects from './features/projects/Projects';
import Support from './features/support/Support';
import Login from './features/auth/Login';
import Subcontractors from './features/subcontractors/Subcontractors';
import Customers from './features/customers/Customers';
import Categories from './features/categories/Categories';
import Inquiries from './features/inquiries/Inquiries';
import ProjectDetails from './features/projects/ProjectDetails';
import ApiKeys from './pages/Settings/ApiKeys';
import ApiIntegration from './pages/Settings/ApiIntegration';
import CompanySettings from './features/system/CompanySettings';
import Emails from './features/emails/Emails';
import StorageManagement from './features/system/StorageManagement';
import EmailMessages from './features/emails/EmailMessages';
import EmailApi from './features/emails/EmailApi';
import SharedFolderView from './features/shared/SharedFolderView';
import Chat from './features/chat/Chat';
import Offers from './features/offers/Offers';
import OfferCreate from './features/offers/OfferCreate';
import Reonic from './features/offers/Reonic';
import FileManager from './features/files/FileManager';
import TimeTerminal from './features/timetracking/TimeTerminal';
import TimeLogs from './features/timetracking/TimeLogs';
import TimeSettings from './features/timetracking/TimeSettings';

import { useEffect } from 'react';
import socketService from './services/socket';

// Protect Routes with actual auth state
const RequireAuth = ({ children }) => {
    const { isAuthenticated, user } = useSelector((state) => state.auth);

    useEffect(() => {
        if (isAuthenticated && user) {
            socketService.connect(user.company_id, user.id);
        } else {
            socketService.disconnect();
        }
        return () => socketService.disconnect();
    }, [isAuthenticated, user]);

    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return children;
};

import { CompanyProvider } from './context/CompanyContext';
import { PhoneProvider } from './context/PhoneContext';
import PhonePage from './features/communication/PhonePage';
import CallHistoryPage from './features/communication/CallHistoryPage';
import AdminCallHistoryPage from './features/communication/AdminCallHistoryPage';
import PhoneSettingsPage from './features/communication/PhoneSettingsPage';
import TelephonyInstructionsPage from './features/communication/TelephonyInstructionsPage';

function App() {
    return (
        <CompanyProvider>
            <PhoneProvider>
                <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/shared/:token" element={<SharedFolderView />} />

                    <Route path="/" element={
                        <RequireAuth>
                            <MainLayout />
                        </RequireAuth>
                    }>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="notizen" element={<Notes />} />
                    <Route path="aufgaben" element={<Tasks />} />
                    <Route path="benutzer" element={<Users />} />
                    <Route path="subunternehmer" element={<Subcontractors />} />
                    <Route path="kunden" element={<Customers />} />
                    <Route path="projekte" element={<Projects />} />
                    <Route path="projekte/:id" element={<ProjectDetails />} />
                    <Route path="kategorien" element={<Categories />} />
                    <Route path="anfragen" element={<Inquiries />} />
                    <Route path="support" element={<Support />} />
                    <Route path="chat" element={<Chat />} />
                    <Route path="angebote" element={<Offers />} />
                    <Route path="angebote/neu" element={<OfferCreate />} />
                    <Route path="angebote/reonic" element={<Reonic />} />
                    <Route path="dateien" element={<FileManager />} />
                    <Route path="telefon" element={<PhonePage />} />
                    <Route path="telefon/verlauf" element={<CallHistoryPage />} />
                    <Route path="telefon/globaler-verlauf" element={<AdminCallHistoryPage />} />
                    <Route path="telefon/einstellungen" element={<PhoneSettingsPage />} />
                    <Route path="settings/ip-system" element={<TelephonyInstructionsPage />} />
                    <Route path="email-messages" element={<EmailMessages />} />
                    <Route path="settings">
                        <Route path="email-accounts" element={<Emails />} />
                        <Route path="storage" element={<StorageManagement />} />
                        <Route path="email-api" element={<EmailApi />} />
                        <Route path="api-keys" element={<ApiKeys />} />
                        <Route path="api-integration" element={<ApiIntegration />} />
                        <Route path="company" element={<CompanySettings />} />
                        <Route path="zeiterfassung" element={<TimeSettings />} />
                    </Route>
                    <Route path="zeiterfassung">
                        <Route path="terminal" element={<TimeTerminal />} />
                        <Route path="protokolle" element={<TimeLogs />} />
                    </Route>
                </Route>
            </Routes>
        </BrowserRouter>
            </PhoneProvider>
        </CompanyProvider>
    );
}

export default App;
