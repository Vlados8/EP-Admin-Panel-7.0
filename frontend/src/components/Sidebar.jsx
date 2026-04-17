import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import socketService from '../services/socket';
import { useCompany } from '../context/CompanyContext';

const NavItem = ({ to, icon, label, isActive, badge }) => (
    <Link
        to={to}
        className={`nav-item px-6 py-3 flex items-center justify-between gap-4 text-sm ${isActive ? 'active' : ''}`}
    >
        <div className="flex items-center gap-4">
            <i className={`fa-solid ${icon} w-5 text-center`}></i> {label}
        </div>
        {badge && (
            <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-[1.25rem] text-center">
                {badge}
            </span>
        )}
    </Link>
);

import usePermission from '../hooks/usePermission';

const NavGroup = ({ label, items, currentPath, search }) => {
    const fullPath = search ? currentPath + search : currentPath;
    const isGroupActive = items.some(item => currentPath === item.path || fullPath === item.path);
    const [isOpen, setIsOpen] = useState(isGroupActive);

    if (items.length === 0) return null;

    return (
        <div className="mb-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-6 py-2 flex items-center justify-between text-xs font-semibold tracking-wider uppercase mb-1 transition-colors ${isGroupActive ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
                <span>{label}</span>
                <i className={`fa-solid fa-chevron-${isOpen ? 'down' : 'right'} w-4 text-center`}></i>
            </button>

            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="flex flex-col gap-1">
                    {items.map(route => (
                        <NavItem
                            key={route.path}
                            to={route.path}
                            icon={route.icon}
                            label={route.label}
                            badge={route.badge}
                            isActive={currentPath === route.path || fullPath === route.path}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

const Sidebar = ({ isOpen, onClose, currentPath }) => {
    const { user } = useSelector(state => state.auth);
    const { companyData, getAssetUrl } = useCompany();
    const location = useLocation();
    const [emailAccounts, setEmailAccounts] = useState([]);
    const [chatUnreadCount, setChatUnreadCount] = useState(0);

    const canViewUsers = usePermission('VIEW_USERS');
    const canViewSubcontractors = usePermission('VIEW_SUBCONTRACTORS');
    const canViewCustomers = usePermission('VIEW_CUSTOMERS');
    const canViewProjects = usePermission('VIEW_PROJECTS');
    const canViewCategories = usePermission('VIEW_CATEGORIES');
    const canViewInquiries = usePermission('VIEW_INQUIRIES');
    const canViewSupport = usePermission('VIEW_SUPPORT');
    const canViewEmails = usePermission('VIEW_EMAILS');
    const canManageEmails = usePermission('MANAGE_EMAIL_ACCOUNTS');
    const canManageApiKeys = usePermission('MANAGE_API_KEYS');
    const canViewNotes = usePermission('VIEW_NOTES');
    const canViewTasks = usePermission('VIEW_TASKS');

    const fetchAccounts = async () => {
        if (!canViewEmails) return;
        try {
            const res = await api.get('/emails');
            setEmailAccounts(res.data.data.accounts || []);
        } catch (err) {
            console.error('Error fetching email accounts for sidebar:', err);
        }
    };

    const fetchChatUnread = async () => {
        try {
            const res = await api.get('/chat/unread-count');
            setChatUnreadCount(res.data.data.count || 0);
        } catch (err) {
            console.error('Error fetching chat unread count for sidebar:', err);
        }
    };

    useEffect(() => {
        if (!user) return; // Don't fetch or listen if no user

        fetchAccounts();
        fetchChatUnread();

        // Listen for real-time email updates
        const handleNewEmail = () => {
            fetchAccounts();
        };

        // Listen for real-time chat updates
        const handleChatUpdate = () => {
            fetchChatUnread();
        };

        socketService.on('new_email', handleNewEmail);
        socketService.on('new_message', handleChatUpdate);
        socketService.on('messages_read', handleChatUpdate);

        return () => {
            socketService.off('new_email', handleNewEmail);
            socketService.off('new_message', handleChatUpdate);
            socketService.off('messages_read', handleChatUpdate);
        };
    }, [user, canViewEmails]); // Re-fetch/re-listen if user changes

    const baseMenu = [
        { path: '/dashboard', icon: 'fa-chart-line', label: 'Dashboard', show: true }, // Everyone sees Dashboard
        { path: '/notizen', icon: 'fa-note-sticky', label: 'Notizen', show: canViewNotes },
        { path: '/aufgaben', icon: 'fa-clipboard-list', label: 'Aufgaben', show: canViewTasks },
        { path: '/dateien', icon: 'fa-folder-open', label: 'Dateimanager', show: true },
        { path: '/benutzer', icon: 'fa-users-gear', label: 'Benutzer', show: canViewUsers },
        { path: '/subunternehmer', icon: 'fa-truck-fast', label: 'Subunternehmer', show: canViewSubcontractors },
        { path: '/kunden', icon: 'fa-users', label: 'Kunden', show: canViewCustomers },
        { path: '/projekte', icon: 'fa-building', label: 'Projekte', show: canViewProjects },
        { path: '/angebote', icon: 'fa-file-invoice-dollar', label: 'Angebote', show: true },
        { path: '/kategorien', icon: 'fa-tags', label: 'Kategorien', show: canViewCategories },
        { path: '/anfragen', icon: 'fa-inbox', label: 'Anfragen', show: canViewInquiries },
        { path: '/support', icon: 'fa-headset', label: 'Support', show: canViewSupport }
    ].filter(item => item.show);

    const communicationItems = [
        { path: '/chat', icon: 'fa-comments', label: 'Chat', show: true, badge: chatUnreadCount > 0 ? chatUnreadCount : null },
        { path: '/telefon', icon: 'fa-phone', label: 'Telefon', show: true },
        { path: '/telefon/verlauf', icon: 'fa-clock-rotate-left', label: 'Anrufverlauf', show: true },
        { path: '/telefon/globaler-verlauf', icon: 'fa-earth-europe', label: 'Globaler Verlauf', show: canManageApiKeys },
        { path: '/telefon/einstellungen', icon: 'fa-gears', label: 'Einstellungen', show: true }
    ].filter(item => item.show);

    const timeTrackingItems = [
        { path: '/zeiterfassung/terminal', icon: 'fa-clock', label: 'Terminal', show: true },
        { path: '/zeiterfassung/protokolle', icon: 'fa-clipboard-list', label: 'Protokolle', show: true },
        { path: '/settings/zeiterfassung', icon: 'fa-gears', label: 'Einstellungen', show: true }
    ].filter(item => item.show);

    let emailMenuItems = [];
    if (canViewEmails) {
        if (canManageEmails) {
            emailMenuItems.push({ path: '/settings/email-accounts', icon: 'fa-cogs', label: 'Einstellungen' });
        }
        emailMenuItems.push({
            path: '/email-messages',
            icon: 'fa-inbox',
            label: 'Alle Nachrichten',
            badge: emailAccounts.reduce((sum, acc) => sum + (acc.unread_count || 0), 0) || null
        });
        emailAccounts.forEach(acc => {
            emailMenuItems.push({
                path: `/email-messages?account=${encodeURIComponent(acc.email)}`,
                icon: 'fa-at',
                label: acc.email,
                badge: acc.unread_count > 0 ? acc.unread_count : null
            });
        });
    }

    const apiSettingsItems = [];
    if (canManageApiKeys) {
        apiSettingsItems.push({ path: '/settings/company', icon: 'fa-building-shield', label: 'Firmenangaben' });
        apiSettingsItems.push({ path: '/settings/storage', icon: 'fa-hard-drive', label: 'Speicherverwaltung' });
        apiSettingsItems.push({ path: '/settings/api-keys', icon: 'fa-key', label: 'API-Schlüssel' });
        apiSettingsItems.push({ path: '/settings/api-integration', icon: 'fa-code', label: 'API Integration' });
        apiSettingsItems.push({ path: '/settings/ip-system', icon: 'fa-network-wired', label: 'IP System' });
    }

    const sidebarItems = (
        <>
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0 overflow-hidden">
                        {companyData?.settings?.logoSmallWhite || companyData?.settings?.logoSmall ? (
                            <img 
                                src={getAssetUrl(companyData?.settings?.logoSmallWhite || companyData?.settings?.logoSmall)} 
                                alt="Logo" 
                                className="w-full h-full object-contain p-1" 
                            />
                        ) : (
                            <img src="/assets/Logo EP white.png" alt="Empire Premium Bau Logo" className="w-full h-full object-contain p-1" />
                        )}
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-lg font-bold tracking-widest uppercase text-white leading-tight">
                            {companyData?.settings?.logoUpperText || companyData?.name?.split(' ')[0] || 'Empire'}
                        </h1>
                        <span className="text-[10px] text-blue-400 tracking-widest uppercase font-semibold">
                            {companyData?.settings?.logoLowerText || companyData?.name?.split(' ').slice(1).join(' ') || 'Premium Bau'}
                        </span>
                    </div>
                </div>
                <button onClick={onClose} className="md:hidden text-gray-500 hover:text-white p-2">
                    <i className="fa-solid fa-xmark text-xl"></i>
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 flex flex-col scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {/* Main Menu */}
                <div className="px-6 py-2 text-xs font-semibold tracking-wider uppercase text-gray-500 mb-1">
                    Hauptmenü
                </div>
                <div className="flex flex-col gap-1 mb-4">
                    {baseMenu.map(route => (
                        <NavItem
                            key={route.path}
                            to={route.path}
                            icon={route.icon}
                            label={route.label}
                            isActive={currentPath === route.path}
                        />
                    ))}
                </div>

                {/* Kommunikation */}
                {communicationItems.length > 0 && (
                    <NavGroup
                        label="Kommunikation"
                        items={communicationItems}
                        currentPath={currentPath}
                    />
                )}

                {/* Zeiterfassung */}
                {timeTrackingItems.length > 0 && (
                    <NavGroup
                        label="Zeiterfassung"
                        items={timeTrackingItems}
                        currentPath={currentPath}
                    />
                )}

                {/* E-Mail System */}
                {canViewEmails && emailMenuItems.length > 0 && (
                    <NavGroup
                        label="E-Mail System"
                        items={emailMenuItems}
                        currentPath={currentPath}
                        search={location.search}
                    />
                )}

                {/* API Settings */}
                {canManageApiKeys && apiSettingsItems.length > 0 && (
                    <NavGroup
                        label="System & API"
                        items={apiSettingsItems}
                        currentPath={currentPath}
                    />
                )}
            </nav>

            <div className="p-4 border-t border-white/10">
                <div className="flex items-center gap-3 px-2">
                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=0D8ABC&color=fff`} alt="User" className="w-10 h-10 rounded-full border border-white/20" />
                    <div>
                        <p className="text-sm font-semibold truncate w-32">{user?.name || 'User'}</p>
                        <p className="text-xs text-gray-400">{user?.role?.name || user?.role || 'Mitarbeiter'}</p>
                    </div>
                </div>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile Backdrop */}
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            ></div>

            {/* Sidebar Content */}
            <aside className={`fixed md:relative inset-y-0 left-0 w-64 flex-shrink-0 border-r border-white/10 flex flex-col bg-[#0a0a0c] md:bg-transparent z-[70] transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                {sidebarItems}
            </aside>
        </>
    );
};

export default Sidebar;
