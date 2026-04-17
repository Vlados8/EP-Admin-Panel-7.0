import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useMemo, useState, useEffect } from 'react';
import PhoneWidget from '../components/phone/PhoneWidget';
import InboundCallModal from '../features/communication/InboundCallModal';
import { useSelector } from 'react-redux';
import { useCompany } from '../context/CompanyContext';

const MainLayout = () => {
    const { companyData, getAssetUrl } = useCompany();
    const location = useLocation();
    const { breadcrumbOverride } = useSelector((state) => state.ui);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Default background if none is set
    const defaultBg = '/images/glass_bg.png';
    const bgUrl = companyData?.settings?.adminBackground 
        ? getAssetUrl(companyData.settings.adminBackground) 
        : defaultBg;

    const backgroundStyle = {
        backgroundImage: `linear-gradient(to bottom, rgba(10, 10, 12, 0.7), rgba(3, 3, 5, 0.8)), url('${bgUrl}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        transition: 'background-image 0.5s ease-in-out'
    };

    // Close sidebar on route change on mobile
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    const pageTitle = useMemo(() => {
        if (breadcrumbOverride && location.pathname.includes(breadcrumbOverride.path)) {
            return breadcrumbOverride.title;
        }

        const path = location.pathname.substring(1);
        if (!path) return 'Dashboard';

        // Handle nested paths like "projekte/:id"
        if (path.startsWith('projekte/')) {
            return 'Projekte';
        }

        if (path.startsWith('settings/')) {
            const sub = path.split('/')[1];
            if (sub === 'api-keys') return 'API-Schlüssel';
            if (sub === 'api-integration') return 'API Integration';
            if (sub === 'company') return 'Firmenangaben';
            return 'Einstellungen';
        }

        return path.charAt(0).toUpperCase() + path.slice(1);
    }, [location.pathname, breadcrumbOverride]);

    return (
        <div 
            style={backgroundStyle}
            className="h-screen w-screen overflow-hidden flex items-center justify-center md:p-4 lg:p-6 text-slate-50 font-sans relative z-10"
        >
            {/* Main App Container */}
            <div className="glass-panel w-full h-full max-w-[1600px] md:rounded-3xl flex overflow-hidden relative">

                {/* Sidebar */}
                <Sidebar 
                    isOpen={isSidebarOpen} 
                    onClose={() => setIsSidebarOpen(false)} 
                    currentPath={location.pathname} 
                />

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col overflow-hidden relative">

                    {/* Top Header */}
                    <Header 
                        title={pageTitle} 
                        onMenuClick={() => setIsSidebarOpen(true)} 
                    />

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 page-section active relative">
                        <Outlet />
                    </div>

                    {/* Global Phone Widget */}
                    <PhoneWidget />

                    {/* Inbound Call Signaling */}
                    <InboundCallModal />
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
