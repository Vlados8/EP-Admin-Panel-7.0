import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../../services/api';
import { usePhone } from '../../context/PhoneContext';
import usePermission from '../../hooks/usePermission';

const Users = () => {
    const { user: currentUser } = useSelector((state) => state.auth);
    const { makeCall } = usePhone();
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editUserId, setEditUserId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState('Alle');
    
    // Custom select dropdown state hooks
    const [isRoleSelectOpen, setIsRoleSelectOpen] = useState(false);
    const [isManagerSelectOpen, setIsManagerSelectOpen] = useState(false);
    const [isEditRoleSelectOpen, setIsEditRoleSelectOpen] = useState(false);
    const [isEditStatusSelectOpen, setIsEditStatusSelectOpen] = useState(false);
    const [isEditManagerSelectOpen, setIsEditManagerSelectOpen] = useState(false);
    
    // Telephony expansion
    const [activeTab, setActiveTab] = useState('details'); // 'details' or 'history'
    const [userHistory, setUserHistory] = useState([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role_id: '',
        manager_id: '',
        status: 'active',
        specialty: '',
        mobile_phone: '',
        extension_id: '',
        is_receiving_calls: false,
        sip_user: '',
        sip_password: '',
        sip_domain: '',
        wss_url: '',
        pin: '',
        rfid_tag: ''
    });

    const canManageUsers = usePermission('MANAGE_USERS');

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            password: '',
            role_id: '',
            manager_id: '',
            status: 'active',
            specialty: '',
            mobile_phone: '',
            extension_id: '',
            is_receiving_calls: false,
            sip_user: '',
            sip_password: '',
            sip_domain: '',
            wss_url: '',
            pin: '',
            rfid_tag: ''
        });
        setEditUserId(null);
        setActiveTab('details');
        setUserHistory([]);
        setIsRoleSelectOpen(false);
        setIsManagerSelectOpen(false);
        setIsEditRoleSelectOpen(false);
        setIsEditStatusSelectOpen(false);
        setIsEditManagerSelectOpen(false);
    };

    const getInitials = (name) => {
        if (!name) return '??';
        const parts = name.trim().split(' ');
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, []);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/users');
            setUsers(res.data.data.users);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchRoles = async () => {
        try {
            const res = await api.get('/roles');
            const roleOrder = ['Admin', 'Büро', 'Projektleiter', 'Gruppenleiter', 'Worker'];
            const sortedRoles = res.data.data.roles.sort((a, b) => {
                const indexA = roleOrder.indexOf(a.name);
                const indexB = roleOrder.indexOf(b.name);
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                return a.name.localeCompare(b.name);
            });
            setRoles(sortedRoles);
        } catch (error) {
            console.error('Error fetching roles:', error);
        }
    };
    
    const fetchUserHistory = async (userId) => {
        setIsHistoryLoading(true);
        try {
            const res = await api.get(`/phone/logs/user/${userId}`);
            setUserHistory(res.data.data.logs);
        } catch (error) {
            console.error('Error fetching user history:', error);
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const handleFilter = (roleName) => {
        setFilterRole(roleName);
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const company_id = users[0]?.company?.id;

            await api.post('/users', {
                ...formData,
                company_id
            });
            setIsAddModalOpen(false);
            resetForm();
            fetchUsers();
        } catch (error) {
            console.error('Error creating user:', error);
            alert('Fehler beim Erstellen des Benutzers');
        }
    };

    const handleEditClick = (user) => {
        setFormData({
            name: user.name,
            email: user.email,
            password: '',
            role_id: user.role?.id || '',
            manager_id: user.manager?.id || '',
            status: user.status || 'active',
            specialty: user.specialty || '',
            mobile_phone: user.mobile_phone || '',
            extension_id: user.extension_id || '',
            is_receiving_calls: user.is_receiving_calls || false,
            sip_user: user.sip_user || '',
            sip_password: user.sip_password || '',
            sip_domain: user.sip_domain || '',
            wss_url: user.wss_url || '',
            pin: user.pin || '',
            rfid_tag: user.rfid_tag || ''
        });
        setEditUserId(user.id);
        setIsEditModalOpen(true);
        setActiveTab('details');
        fetchUserHistory(user.id);
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: formData.name,
                email: formData.email,
                role_id: formData.role_id,
                manager_id: formData.manager_id,
                status: formData.status,
                specialty: formData.specialty,
                mobile_phone: formData.mobile_phone,
                extension_id: formData.extension_id,
                is_receiving_calls: formData.is_receiving_calls,
                sip_user: formData.sip_user,
                sip_password: formData.sip_password,
                sip_domain: formData.sip_domain,
                wss_url: formData.wss_url,
                pin: formData.pin,
                rfid_tag: formData.rfid_tag
            };

            if (formData.password) {
                payload.password = formData.password;
            }

            await api.patch(`/users/${editUserId}`, payload);
            setIsEditModalOpen(false);
            resetForm();
            fetchUsers();
        } catch (error) {
            console.error('Error updating user:', error);
            alert('Fehler beim Aktualisieren des Benutzers');
        }
    };

    const handleDeleteUser = async (id) => {
        if (window.confirm('Wollen Sie diesen Benutzer wirklich löschen?')) {
            try {
                await api.delete(`/users/${id}`);
                fetchUsers();
            } catch (error) {
                console.error('Error deleting user:', error);
                alert('Fehler beim Löschen');
            }
        }
    }

    const filteredUsers = users.filter(u => {
        const matchesRole = filterRole === 'Alle' || u.role?.name === filterRole;
        const query = searchQuery.toLowerCase();
        const matchesSearch = !query ||
            u.name.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query);
        return matchesRole && matchesSearch;
    });

    const getAvailableManagers = () => {
        const selectedRoleObj = roles.find(r => r.id === formData.role_id);
        if (!selectedRoleObj) return [];

        if (selectedRoleObj.name === 'Worker') {
            return users.filter(u => u.role?.name === 'Gruppenleiter' || u.role?.name === 'Projektleiter');
        } else if (selectedRoleObj.name === 'Gruppenleiter') {
            return users.filter(u => u.role?.name === 'Projektleiter');
        }
        return [];
    };

    const availableManagers = getAvailableManagers();

    return (
        <div className="animate-[fadeIn_0.4s_ease-out_forwards]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-xl font-semibold mb-1">
                        {canManageUsers ? 'Benutzerverwaltung' : 'Mitarbeiter & Kontakte'}
                    </h2>
                    {canManageUsers ? (
                        <p className="hidden md:block text-gray-400 text-sm">
                            Hierarchie: Worker <i className="fa-solid fa-arrow-right text-xs mx-1"></i> Gruppenleiter
                            <i className="fa-solid fa-arrow-right text-xs mx-1"></i> Projektleiter
                            <i className="fa-solid fa-arrow-right text-xs mx-1"></i> Büro / Admin
                        </p>
                    ) : (
                        <p className="text-gray-400 text-sm italic">
                            Alle Kontakte Ihres Unternehmens im Überblick.
                        </p>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative flex-grow">
                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                        <input
                            type="text"
                            placeholder="Benutzer suchen..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-black/20 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors w-full md:w-64 shadow-[0_4px_15px_rgba(0,0,0,0.1)]"
                        />
                    </div>
                    {canManageUsers && (
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm transition-colors shadow-[0_0_15px_rgba(59,130,246,0.5)] whitespace-nowrap"
                        >
                            <i className="fa-solid fa-user-plus mr-2"></i>Benutzer anlegen
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-6">
                <div
                    onClick={() => handleFilter('Alle')}
                    className={`glass-card py-2 rounded-lg text-xs text-center cursor-pointer transition-colors ${filterRole === 'Alle' ? 'bg-white/20 border-blue-400/50 border' : 'hover:bg-white/20'}`}
                >Alle</div>
                {['Admin', 'Büro', 'Projektleiter', 'Gruppenleiter', 'Worker'].map(role => (
                    <div
                        key={role}
                        onClick={() => handleFilter(role)}
                        className={`glass-card py-2 rounded-lg text-xs text-center cursor-pointer transition-colors ${filterRole === role ? 'bg-white/20 border-blue-400/50 border' : 'hover:bg-white/20'}`}
                    >{role}</div>
                ))}
            </div>

            <div className="md:hidden space-y-4 mb-6">
                {isLoading ? (
                    <div className="text-center py-20 text-gray-400">Lädt...</div>
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-20 text-gray-400 bg-white/5 rounded-2xl border border-white/10 italic text-sm">Keine Benutzer gefunden.</div>
                ) : (
                    filteredUsers.map(user => (
                        <div key={user.id} className="glass-card p-5 rounded-2xl border border-white/10 relative">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600/50 to-purple-600/50 p-[2px] flex-shrink-0">
                                    <div className="w-full h-full rounded-full border border-white/10 flex items-center justify-center text-sm font-bold text-white bg-[#1a1a1a]">
                                        {getInitials(user.name)}
                                    </div>
                                </div>
                                <div className="flex-grow min-w-0">
                                    <h3 className="text-white font-bold truncate">{user.name}</h3>
                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border mt-0.5 ${user.role?.name === 'Admin' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                                        user.role?.name === 'Büro' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                                            user.role?.name === 'Projektleiter' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                                                user.role?.name === 'Gruppenleiter' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                                                    'bg-gray-500/20 text-gray-300 border-gray-500/30'
                                        }`}>
                                        {user.role?.name || 'Gast'}
                                    </span>
                                </div>
                                {canManageUsers && (
                                    <div className="flex gap-1">
                                        <button onClick={() => handleEditClick(user)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-400 border border-blue-500/20"><i className="fa-solid fa-pen text-xs"></i></button>
                                        <button onClick={() => handleDeleteUser(user.id)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10 text-red-400 border border-red-500/20"><i className="fa-solid fa-trash text-xs"></i></button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2.5 pt-3 border-t border-white/5">
                                <div className="flex items-center gap-3 text-xs text-gray-400">
                                    <i className="fa-regular fa-envelope w-4 text-center text-blue-400/30"></i>
                                    <span className="truncate">{user.email}</span>
                                </div>
                                {user.mobile_phone && (
                                    <div className="flex items-center gap-3 text-xs text-gray-400">
                                        <i className="fa-solid fa-mobile-screen w-4 text-center text-blue-400/30"></i>
                                        <span>{user.mobile_phone}</span>
                                    </div>
                                )}
                                {user.manager && (
                                    <div className="flex items-center gap-3 text-xs text-gray-400">
                                        <i className="fa-solid fa-sitemap w-4 text-center text-orange-400/30"></i>
                                        <span className="text-gray-300">Vorgesetzter: {user.manager.name}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 text-xs">
                                    <i className="fa-solid fa-circle-check w-4 text-center text-green-400/30"></i>
                                    <span className={user.status === 'active' ? 'text-green-400' : 'text-red-400'}>
                                        Status: {user.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="hidden md:block glass-card rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
                <table className="w-full text-left text-sm border-collapse">
                    <thead>
                        <tr className="bg-white/[0.03] border-b border-white/10">
                            <th className="px-6 py-4 text-[10px] uppercase font-bold tracking-[0.2em] text-gray-400">Mitarbeiter</th>
                            <th className="px-6 py-4 text-[10px] uppercase font-bold tracking-[0.2em] text-gray-400">Rolle</th>
                            <th className="px-6 py-4 text-[10px] uppercase font-bold tracking-[0.2em] text-gray-400">Vorgesetzter</th>
                            <th className="px-6 py-4 text-[10px] uppercase font-bold tracking-[0.2em] text-gray-400">Kontakt</th>
                            <th className="px-6 py-4 text-[10px] uppercase font-bold tracking-[0.2em] text-gray-400">Telephonie</th>
                            <th className="px-6 py-4 text-[10px] uppercase font-bold tracking-[0.2em] text-gray-400">Status</th>
                            {canManageUsers && <th className="px-6 py-4 text-[10px] uppercase font-bold tracking-[0.2em] text-gray-400 text-right">Aktionen</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {isLoading ? (
                            <tr><td colSpan={canManageUsers ? "7" : "6"} className="p-20 text-center text-gray-500 italic">Lade Mitarbeiterdaten...</td></tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr><td colSpan={canManageUsers ? "7" : "6"} className="p-20 text-center text-gray-500 italic">Keine Benutzer gefunden</td></tr>
                        ) : (
                            filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-white/[0.04] transition-all duration-300 group">
                                    <td className="px-6 py-5 align-middle">
                                        <div className="flex items-center gap-4">
                                            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600/40 to-indigo-600/40 p-[1px] shadow-lg shadow-blue-500/10 group-hover:scale-105 transition-transform duration-300">
                                                <div className="w-full h-full rounded-full border border-white/10 flex items-center justify-center text-xs font-bold text-white bg-[#0f0f11]">
                                                    {getInitials(user.name)}
                                                </div>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-white tracking-wide">{user.name}</span>
                                                {user.specialty && (
                                                    <span className="text-[10px] text-blue-400/80 font-medium">
                                                        {user.specialty}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 align-middle">
                                        <div className={`px-2 py-1 rounded-lg text-[10px] font-bold tracking-wider border w-fit backdrop-blur-md transition-all duration-300 ${
                                            user.role?.name === 'Admin' ? 'bg-red-500/5 text-red-400 border-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.05)]' :
                                            user.role?.name === 'Büro' ? 'bg-purple-500/5 text-purple-300 border-purple-500/10 shadow-[0_0_10px_rgba(168,85,247,0.05)]' :
                                            user.role?.name === 'Projektleiter' ? 'bg-blue-500/5 text-blue-300 border-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.05)]' :
                                            user.role?.name === 'Gruppenleiter' ? 'bg-orange-500/5 text-orange-300 border-orange-500/10 shadow-[0_0_10px_rgba(249,115,22,0.05)]' :
                                            'bg-gray-500/5 text-gray-400 border-gray-500/10'
                                        }`}>
                                            {user.role ? user.role.name.toUpperCase() : 'GAST'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 align-middle">
                                        {user.manager ? (
                                            <div className="flex items-center gap-2 text-gray-300 bg-white/[0.03] border border-white/5 px-2.5 py-1.5 rounded-xl w-fit group-hover:bg-white/[0.06] transition-colors">
                                                <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-white/10 flex items-center justify-center text-[9px] font-bold text-indigo-300">
                                                    {getInitials(user.manager.name)}
                                                </div>
                                                <span className="text-xs font-medium">{user.manager.name}</span>
                                            </div>
                                        ) : <span className="text-slate-400/80 text-[10px] italic ml-2">Kein Vorgesetzter</span>}
                                    </td>
                                    <td className="px-6 py-5 align-middle">
                                        <div className="flex flex-col gap-1.5 min-w-[160px]">
                                            <div className="flex items-center gap-2 group/email text-gray-400 hover:text-blue-400 transition-colors cursor-pointer">
                                                <i className="fa-regular fa-envelope text-[10px] opacity-40"></i>
                                                <span className="text-xs transition-colors truncate">{user.email}</span>
                                            </div>
                                            {user.mobile_phone && (
                                                <div className="flex items-center justify-between gap-2 text-gray-400 group/phone hover:text-green-400 transition-colors cursor-pointer">
                                                    <div className="flex items-center gap-2">
                                                        <i className="fa-solid fa-mobile-screen-button text-[10px] opacity-40"></i>
                                                        <span className="text-[10px] font-mono tracking-tighter">{user.mobile_phone}</span>
                                                    </div>
                                                    <button 
                                                        onClick={() => makeCall(user.mobile_phone)}
                                                        className="w-6 h-6 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all flex items-center justify-center shadow-lg shadow-green-500/5 active:scale-95"
                                                        title="Anrufen"
                                                    >
                                                        <i className="fa-solid fa-phone text-[9px]"></i>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 align-middle">
                                        <div className="flex flex-col gap-2.5 min-w-[120px]">
                                            <div className="flex items-center gap-2 group/toggle">
                                                <div 
                                                    onClick={async () => {
                                                        try {
                                                            await api.patch(`/users/${user.id}`, { is_receiving_calls: !user.is_receiving_calls });
                                                            fetchUsers();
                                                        } catch (err) {
                                                            console.error('Toggle error:', err);
                                                        }
                                                    }}
                                                    className={`w-8 h-4 rounded-full relative cursor-pointer transition-all duration-300 ${user.is_receiving_calls ? 'bg-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 'bg-white/10'}`}
                                                >
                                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300 shadow-sm ${user.is_receiving_calls ? 'left-4.5 bg-green-400' : 'left-0.5 bg-slate-400'}`}></div>
                                                </div>
                                                <span className="text-[9px] text-slate-300 uppercase font-bold tracking-widest leading-none">Empfang</span>
                                            </div>
                                            {user.extension_id && (
                                                <div className="text-[10px] font-bold text-blue-400/90 bg-blue-500/10 border border-blue-500/10 px-2.5 py-1 rounded-md w-fit flex items-center gap-1.5">
                                                    <i className="fa-solid fa-hashtag text-[8px] opacity-40"></i>
                                                    <span>Ext: {user.extension_id}</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 align-middle">
                                        <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border w-fit ${user.status === 'active' ? 'bg-green-500/5 border-green-500/10 text-green-400' : 'bg-red-500/5 border-red-500/10 text-red-400'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor] animate-pulse ${user.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            <span className="text-[10px] font-bold uppercase tracking-wider">{user.status === 'active' ? 'Aktiv' : 'Inaktiv'}</span>
                                        </div>
                                    </td>
                                    {canManageUsers && (
                                        <td className="px-6 py-5 align-middle text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => handleEditClick(user)}
                                                    className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/20 transition-all duration-300 shadow-lg shadow-blue-500/5"
                                                    title="Bearbeiten"
                                                >
                                                    <i className="fa-solid fa-pencil text-xs"></i>
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteUser(user.id)} 
                                                    className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all duration-300 shadow-lg shadow-red-500/5"
                                                    title="Löschen"
                                                >
                                                    <i className="fa-solid fa-trash-can text-xs"></i>
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-md flex justify-center p-4">
                    <div className="glass-card w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl animate-[slideUp_0.3s_ease-out] my-auto">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 rounded-t-2xl">
                            <h2 className="text-xl font-semibold text-white flex items-center gap-3">
                                <i className="fa-solid fa-user-plus text-blue-400"></i> Neuer Mitarbeiter
                            </h2>
                            <button onClick={() => { setIsAddModalOpen(false); resetForm(); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-gray-400 hover:text-white hover:bg-white/20 transition-colors">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <form onSubmit={handleCreateUser} className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400 pl-1">Name</label>
                                    <div className="relative">
                                        <i className="fa-solid fa-user absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            placeholder="z.B. Max Mustermann"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400 pl-1">E-Mail</label>
                                    <div className="relative">
                                        <i className="fa-solid fa-envelope absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                        <input
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value.trim() })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            placeholder="max@beispiel.de"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400 pl-1">Mobile Nummer (Routing)</label>
                                    <div className="relative">
                                        <i className="fa-solid fa-mobile-screen absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                        <input
                                            type="tel"
                                            value={formData.mobile_phone}
                                            onChange={(e) => setFormData({ ...formData, mobile_phone: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            placeholder="+49 170..."
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400 pl-1">Extension (Zuständigkeit)</label>
                                    <div className="relative">
                                        <i className="fa-solid fa-hashtag absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                        <input
                                            type="text"
                                            value={formData.extension_id}
                                            onChange={(e) => setFormData({ ...formData, extension_id: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            placeholder="z.B. 101"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400 pl-1 uppercase tracking-wider">Passwort</label>
                                    <div className="relative">
                                        <i className="fa-solid fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                        <input
                                            type="password"
                                            required
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400 pl-1 uppercase tracking-wider">System-Rolle</label>
                                    <div className="relative">
                                        <i className="fa-solid fa-id-badge absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10"></i>
                                        <button
                                            type="button"
                                            onClick={() => setIsRoleSelectOpen(!isRoleSelectOpen)}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-left flex items-center justify-between"
                                        >
                                            <span className="truncate">
                                                {formData.role_id 
                                                    ? roles.find(r => String(r.id) === String(formData.role_id))?.name || 'Bitte wählen...' 
                                                    : 'Bitte wählen...'}
                                            </span>
                                            <i className={`fa-solid fa-chevron-down text-gray-500 text-xs transition-transform duration-200 ${isRoleSelectOpen ? 'rotate-180' : ''}`}></i>
                                        </button>
                                        {isRoleSelectOpen && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setIsRoleSelectOpen(false)} />
                                                <div className="absolute left-0 right-0 mt-1 bg-[#121212]/95 border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto py-1.5 backdrop-blur-md animate-[fadeIn_0.15s_ease-out] custom-scrollbar text-left">
                                                    {roles.map(r => (
                                                        <button
                                                            key={r.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setFormData({ ...formData, role_id: r.id, manager_id: '' });
                                                                setIsRoleSelectOpen(false);
                                                            }}
                                                            className={`w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors ${String(formData.role_id) === String(r.id) ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                        >
                                                            {r.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs font-medium text-gray-400 pl-1 uppercase tracking-wider">Fachrichtung (Specialty)</label>
                                    <div className="relative">
                                        <i className="fa-solid fa-briefcase absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                        <input
                                            type="text"
                                            value={formData.specialty}
                                            onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                            placeholder="z.B. Elektriker"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400 pl-1 uppercase tracking-wider">Zeiterfassung PIN</label>
                                    <div className="relative">
                                        <i className="fa-solid fa-key absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                        <input
                                            type="text"
                                            value={formData.pin}
                                            onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                            placeholder="z.B. 1234"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400 pl-1 uppercase tracking-wider">RFID Tag ID</label>
                                    <div className="relative">
                                        <i className="fa-solid fa-id-card absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                        <input
                                            type="text"
                                            value={formData.rfid_tag}
                                            onChange={(e) => setFormData({ ...formData, rfid_tag: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                            placeholder="RFID Chip ID"
                                        />
                                    </div>
                                </div>

                                {availableManagers.length > 0 && (
                                    <div className="col-span-2 animate-[fadeIn_0.3s_ease-out] space-y-1">
                                        <label className="text-xs font-medium text-gray-400 pl-1 uppercase tracking-wider">
                                            Zuständiger Vorgesetzter
                                        </label>
                                        <div className="relative">
                                            <i className="fa-solid fa-sitemap absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 z-10"></i>
                                            <button
                                                type="button"
                                                onClick={() => setIsManagerSelectOpen(!isManagerSelectOpen)}
                                                className="w-full bg-blue-500/10 border border-blue-500/30 rounded-xl pl-10 pr-10 py-2.5 text-blue-100 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all text-left flex items-center justify-between"
                                            >
                                                <span className="truncate">
                                                    {formData.manager_id 
                                                        ? (() => {
                                                            const mgr = availableManagers.find(m => String(m.id) === String(formData.manager_id));
                                                            return mgr ? `${mgr.name} (${mgr.role?.name})` : 'Vorgesetzten wählen...';
                                                          })()
                                                        : 'Vorgesetzten wählen...'}
                                                </span>
                                                <i className={`fa-solid fa-chevron-down text-blue-400 text-xs transition-transform duration-200 ${isManagerSelectOpen ? 'rotate-180' : ''}`}></i>
                                            </button>
                                            {isManagerSelectOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setIsManagerSelectOpen(false)} />
                                                    <div className="absolute left-0 right-0 mt-1 bg-[#121212]/95 border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto py-1.5 backdrop-blur-md animate-[fadeIn_0.15s_ease-out] custom-scrollbar text-left">
                                                        {availableManagers.map(mgr => (
                                                            <button
                                                                key={mgr.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setFormData({ ...formData, manager_id: mgr.id });
                                                                    setIsManagerSelectOpen(false);
                                                                }}
                                                                className={`w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors ${String(formData.manager_id) === String(mgr.id) ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                            >
                                                                {mgr.name} <span className="text-xs text-gray-400">({mgr.role?.name})</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={() => { setIsAddModalOpen(false); resetForm(); }}
                                    className="px-5 py-2.5 text-sm font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                                >
                                    Abbrechen
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:shadow-[0_4px_20px_rgba(59,130,246,0.5)] transform hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    Benutzer Speichern
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-md flex justify-center p-4">
                    <div className="glass-card w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl animate-[slideUp_0.3s_ease-out] my-auto">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 rounded-t-2xl">
                            <h2 className="text-xl font-semibold text-white flex items-center gap-3">
                                <i className="fa-solid fa-user-pen text-blue-400"></i> Mitarbeiter bearbeiten
                            </h2>
                            <button onClick={() => { setIsEditModalOpen(false); resetForm(); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-gray-400 hover:text-white hover:bg-white/20 transition-colors">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <div className="flex border-b border-white/10">
                            <button 
                                type="button"
                                onClick={() => setActiveTab('details')}
                                className={`flex-1 py-3 text-sm font-medium transition-all ${activeTab === 'details' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                <i className="fa-solid fa-info-circle mr-2"></i>Details
                            </button>
                            <button 
                                type="button"
                                onClick={() => setActiveTab('history')}
                                className={`flex-1 py-3 text-sm font-medium transition-all ${activeTab === 'history' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                <i className="fa-solid fa-clock-rotate-left mr-2"></i>Anrufverlauf
                            </button>
                        </div>

                        {activeTab === 'history' ? (
                            <div className="p-6 max-h-[500px] overflow-y-auto space-y-4">
                                {isHistoryLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
                                        <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                                        <p className="text-xs">Lade Anruferliste...</p>
                                    </div>
                                ) : userHistory.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-3">
                                        <i className="fa-solid fa-phone-slash text-2xl opacity-20"></i>
                                        <p className="text-xs">Keine Anrufe gefunden</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {userHistory.map(log => (
                                            <div key={log.id} className="glass-card p-3 rounded-xl border border-white/5 bg-white/5 flex items-center justify-between group hover:border-white/10 transition-all">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${log.direction === 'inbound' ? 'bg-green-500/20 text-green-500' : 'bg-blue-500/20 text-blue-500'}`}>
                                                        <i className={`fa-solid ${log.direction === 'inbound' ? 'fa-arrow-down-left' : 'fa-arrow-up-right'} text-[10px]`}></i>
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-white flex items-center gap-2">
                                                            {log.customer_name || log.remote_number}
                                                            {log.customer_name && <span className="text-[10px] text-slate-400 font-normal">{log.remote_number}</span>}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                                                            <span>{new Date(log.created_at).toLocaleString('de-DE')}</span>
                                                            <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                                            <span className="font-medium text-blue-300/90">{Math.floor((log.duration_seconds || 0) / 60)}:{((log.duration_seconds || 0) % 60).toString().padStart(2, '0')} min</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => makeCall(log.remote_number)}
                                                    className="w-8 h-8 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center opacity-0 group-hover:opacity-100 border border-green-500/20 hover:bg-green-500 hover:text-white transition-all shadow-lg shadow-green-500/20"
                                                    title="Rückruf"
                                                >
                                                    <i className="fa-solid fa-phone text-[10px]"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <form onSubmit={handleUpdateUser} className="p-6 space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-400 pl-1">Name</label>
                                        <div className="relative">
                                            <i className="fa-solid fa-user absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                            <input
                                                type="text"
                                                required
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-400 pl-1">E-Mail</label>
                                        <div className="relative">
                                            <i className="fa-solid fa-envelope absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                            <input
                                                type="email"
                                                required
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value.trim() })}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-400 pl-1">Neues Passwort</label>
                                        <div className="relative">
                                            <i className="fa-solid fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                            <input
                                                type="password"
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                                placeholder="Leer lassen für keine Änderung"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-400 pl-1">System-Rolle</label>
                                        <div className="relative">
                                            <i className="fa-solid fa-id-badge absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10"></i>
                                            <button
                                                type="button"
                                                onClick={() => setIsEditRoleSelectOpen(!isEditRoleSelectOpen)}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-left flex items-center justify-between"
                                            >
                                                <span className="truncate">
                                                    {formData.role_id 
                                                        ? roles.find(r => String(r.id) === String(formData.role_id))?.name || 'Bitte wählen...' 
                                                        : 'Bitte wählen...'}
                                                </span>
                                                <i className={`fa-solid fa-chevron-down text-gray-500 text-xs transition-transform duration-200 ${isEditRoleSelectOpen ? 'rotate-180' : ''}`}></i>
                                            </button>
                                            {isEditRoleSelectOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setIsEditRoleSelectOpen(false)} />
                                                    <div className="absolute left-0 right-0 mt-1 bg-[#121212]/95 border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto py-1.5 backdrop-blur-md animate-[fadeIn_0.15s_ease-out] custom-scrollbar text-left">
                                                        {roles.map(r => (
                                                            <button
                                                                key={r.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setFormData({ ...formData, role_id: r.id, manager_id: '' });
                                                                    setIsEditRoleSelectOpen(false);
                                                                }}
                                                                className={`w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors ${String(formData.role_id) === String(r.id) ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                            >
                                                                {r.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-1 col-span-2">
                                        <label className="text-xs font-medium text-gray-400 pl-1">Fachrichtung (Specialty)</label>
                                        <div className="relative">
                                            <i className="fa-solid fa-briefcase absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                            <input
                                                type="text"
                                                value={formData.specialty}
                                                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                                placeholder="z.B. Elektriker"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1 col-span-2 md:col-span-1">
                                        <label className="text-xs font-medium text-gray-400 pl-1">Status</label>
                                        <div className="relative">
                                            <i className="fa-solid fa-circle-check absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10"></i>
                                            <button
                                                type="button"
                                                onClick={() => setIsEditStatusSelectOpen(!isEditStatusSelectOpen)}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-left flex items-center justify-between"
                                            >
                                                <span className="truncate">
                                                    {formData.status === 'active' ? 'Aktiv' : 
                                                     formData.status === 'inactive' ? 'Inaktiv' : 
                                                     formData.status === 'suspended' ? 'Gesperrt' : formData.status}
                                                </span>
                                                <i className={`fa-solid fa-chevron-down text-gray-500 text-xs transition-transform duration-200 ${isEditStatusSelectOpen ? 'rotate-180' : ''}`}></i>
                                            </button>
                                            {isEditStatusSelectOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setIsEditStatusSelectOpen(false)} />
                                                    <div className="absolute left-0 right-0 mt-1 bg-[#121212]/95 border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto py-1.5 backdrop-blur-md animate-[fadeIn_0.15s_ease-out] custom-scrollbar text-left">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setFormData({ ...formData, status: 'active' });
                                                                setIsEditStatusSelectOpen(false);
                                                            }}
                                                            className={`w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors ${formData.status === 'active' ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                        >
                                                            Aktiv
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setFormData({ ...formData, status: 'inactive' });
                                                                setIsEditStatusSelectOpen(false);
                                                            }}
                                                            className={`w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors ${formData.status === 'inactive' ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                        >
                                                            Inaktiv
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setFormData({ ...formData, status: 'suspended' });
                                                                setIsEditStatusSelectOpen(false);
                                                            }}
                                                            className={`w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors ${formData.status === 'suspended' ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                        >
                                                            Gesperrt
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="col-span-2 mt-4 pt-4 border-t border-white/10">
                                        <h3 className="text-sm font-semibold text-orange-400 mb-4 flex items-center gap-2">
                                            <i className="fa-solid fa-clock"></i> Zeiterfassung-Einstellungen
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-400 pl-1">Stationäres PIN</label>
                                                <div className="relative">
                                                    <i className="fa-solid fa-key absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                                    <input
                                                        type="text"
                                                        value={formData.pin}
                                                        onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                                        placeholder="z.B. 1234"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-400 pl-1">RFID Tag ID</label>
                                                <div className="relative">
                                                    <i className="fa-solid fa-id-card absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                                    <input
                                                        type="text"
                                                        value={formData.rfid_tag}
                                                        onChange={(e) => setFormData({ ...formData, rfid_tag: e.target.value })}
                                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                                        placeholder="Чип ID"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-2 mt-4 pt-4 border-t border-white/10">
                                        <h3 className="text-sm font-semibold text-blue-400 mb-4 flex items-center gap-2">
                                            <i className="fa-solid fa-phone-volume"></i> Telephonie-Einstellungen
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-400 pl-1">Mobile Nummer (Routing)</label>
                                                <div className="relative">
                                                    <i className="fa-solid fa-mobile-screen absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                                    <input
                                                        type="tel"
                                                        value={formData.mobile_phone}
                                                        onChange={(e) => setFormData({ ...formData, mobile_phone: e.target.value })}
                                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                                        placeholder="+49 170..."
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-400 pl-1">Zuständigkeit (Extension)</label>
                                                <div className="relative">
                                                    <i className="fa-solid fa-hashtag absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                                    <input
                                                        type="text"
                                                        value={formData.extension_id}
                                                        onChange={(e) => setFormData({ ...formData, extension_id: e.target.value })}
                                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                                        placeholder="z.B. 101"
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="col-span-2 space-y-4 pt-4 border-t border-white/5 mt-2">
                                                <h4 className="text-[10px] uppercase font-bold tracking-widest text-gray-500">SIP Zugangsdaten</h4>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] text-gray-500">SIP User</label>
                                                        <input
                                                            type="text"
                                                            value={formData.sip_user}
                                                            onChange={(e) => setFormData({ ...formData, sip_user: e.target.value })}
                                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] text-gray-500">SIP Password</label>
                                                        <input
                                                            type="password"
                                                            value={formData.sip_password}
                                                            onChange={(e) => setFormData({ ...formData, sip_password: e.target.value })}
                                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] text-gray-500">SIP Domain</label>
                                                        <input
                                                            type="text"
                                                            value={formData.sip_domain}
                                                            onChange={(e) => setFormData({ ...formData, sip_domain: e.target.value })}
                                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] text-gray-500">WSS URL</label>
                                                        <input
                                                            type="text"
                                                            value={formData.wss_url}
                                                            onChange={(e) => setFormData({ ...formData, wss_url: e.target.value })}
                                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {availableManagers.length > 0 && (
                                        <div className="space-y-1 col-span-2 md:col-span-1 animate-[fadeIn_0.3s_ease-out]">
                                            <label className="text-xs font-medium text-gray-400 pl-1">
                                                Vorgesetzter
                                            </label>
                                            <div className="relative">
                                                <i className="fa-solid fa-sitemap absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 z-10"></i>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsEditManagerSelectOpen(!isEditManagerSelectOpen)}
                                                    className="w-full bg-blue-500/10 border border-blue-500/30 rounded-xl pl-10 pr-10 py-2.5 text-blue-100 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all text-left flex items-center justify-between"
                                                >
                                                    <span className="truncate">
                                                        {formData.manager_id 
                                                            ? availableManagers.find(m => String(m.id) === String(formData.manager_id))?.name || 'Wählen...' 
                                                            : 'Wählen...'}
                                                    </span>
                                                    <i className={`fa-solid fa-chevron-down text-blue-400 text-xs transition-transform duration-200 ${isEditManagerSelectOpen ? 'rotate-180' : ''}`}></i>
                                                </button>
                                                {isEditManagerSelectOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setIsEditManagerSelectOpen(false)} />
                                                        <div className="absolute left-0 right-0 mt-1 bg-[#121212]/95 border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto py-1.5 backdrop-blur-md animate-[fadeIn_0.15s_ease-out] custom-scrollbar text-left">
                                                            {availableManagers.map(mgr => (
                                                                <button
                                                                    key={mgr.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setFormData({ ...formData, manager_id: mgr.id });
                                                                        setIsEditManagerSelectOpen(false);
                                                                    }}
                                                                    className={`w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors ${String(formData.manager_id) === String(mgr.id) ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                                >
                                                                    {mgr.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 flex justify-end gap-3 border-t border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => { setIsEditModalOpen(false); resetForm(); }}
                                        className="px-5 py-2.5 text-sm font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                                    >
                                        Abbrechen
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2.5 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)] hover:shadow-[0_4px_20px_rgba(59,130,246,0.5)] transform hover:-translate-y-0.5 active:translate-y-0"
                                    >
                                        Änderungen Speichern
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div >
    );
};

export default Users;
