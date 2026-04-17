import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../../services/api';
import usePermission from '../../hooks/usePermission';
import { usePhone } from '../../context/PhoneContext';
import CallHistoryModal from '../communication/CallHistoryModal';

const Customers = () => {
    const { user: currentUser } = useSelector(state => state.auth);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { makeCall, callState } = usePhone();
    const [historyNumber, setHistoryNumber] = useState(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        contact_person: '',
        email: '',
        phone: '',
        address: '',
        zip_code: '',
        city: '',
        type: 'company',
        status: 'active',
        notes: ''
    });

    const currentUserRole = currentUser?.role?.name || currentUser?.role;
    const canManageCustomers = usePermission('MANAGE_CUSTOMERS');

    const fetchClients = async () => {
        try {
            const res = await api.get('/clients');
            setCustomers(res.data.data.clients);
        } catch (error) {
            console.error('Error fetching clients:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClients();
    }, []);

    const resetForm = () => {
        setFormData({
            name: '',
            contact_person: '',
            email: '',
            phone: '',
            address: '',
            zip_code: '',
            city: '',
            type: 'company',
            status: 'active',
            notes: ''
        });
    };

    const handleOpenModal = (client = null) => {
        if (client && client.id) {
            setIsEditing(true);
            setEditingId(client.id);
            setFormData({
                name: client.name || '',
                contact_person: client.contact_person || '',
                email: client.email || '',
                phone: client.phone || '',
                address: client.address || '',
                zip_code: client.zip_code || '',
                city: client.city || '',
                type: client.type || 'company',
                status: client.status || 'active',
                notes: client.notes || ''
            });
        } else {
            setIsEditing(false);
            setEditingId(null);
            resetForm();
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await api.patch(`/clients/${editingId}`, formData);
            } else {
                await api.post('/clients', { ...formData, source: 'admin_panel' });
            }
            fetchClients();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving client:', error);
            alert('Fehler beim Speichern des Kunden');
        }
    };

    const deleteClient = async (id) => {
        if (!window.confirm('Möchten Sie diesen Kunden wirklich löschen?')) return;
        try {
            await api.delete(`/clients/${id}`);
            fetchClients();
        } catch (error) {
            console.error('Error deleting client:', error);
            alert('Fehler beim Löschen des Kunden');
        }
    };

    const displayedClients = customers.filter(c => {
        if (searchQuery.trim() !== '') {
            const lowerQuery = searchQuery.toLowerCase();
            return (c.name && c.name.toLowerCase().includes(lowerQuery)) ||
                (c.contact_person && c.contact_person.toLowerCase().includes(lowerQuery)) ||
                (c.email && c.email.toLowerCase().includes(lowerQuery));
        }
        return true;
    });

    const getStatusBadge = (status) => {
        switch (status) {
            case 'active':
                return (
                    <span className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1.5 w-max bg-green-500/10 text-green-400 border border-green-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span> Aktiv
                    </span>
                );
            case 'inactive':
                return (
                    <span className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1.5 w-max bg-red-500/10 text-red-400 border border-red-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span> Inaktiv
                    </span>
                );
            case 'lead':
                return (
                    <span className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1.5 w-max bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Interessent
                    </span>
                );
            default:
                return (
                    <span className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1.5 w-max bg-gray-500/10 text-gray-400 border border-gray-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span> Unbekannt
                    </span>
                );
        }
    };

    const getTypeIcon = (type) => {
        return type === 'private' ? (
            <div className="flex items-center gap-2 text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md text-xs w-max border border-purple-500/20">
                <i className="fa-solid fa-user"></i> Privat
            </div>
        ) : (
            <div className="flex items-center gap-2 text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md text-xs w-max border border-blue-500/20">
                <i className="fa-solid fa-building"></i> Firma
            </div>
        );
    };

    return (
        <div className="animate-[fadeIn_0.4s_ease-out_forwards]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Kunden</h2>
                    <p className="text-gray-400 text-sm mt-1">Geben Sie hier Ihre Kundendaten und Leads ein.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input
                            type="text"
                            placeholder="Suchen..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-black/20 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors w-full md:w-64"
                        />
                    </div>
                    {canManageCustomers && (
                        <button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)] flex items-center gap-2 text-sm whitespace-nowrap">
                            <i className="fa-solid fa-plus"></i> Neuer Kunde
                        </button>
                    )}
                </div>
            </div>

            <div className="md:hidden space-y-4 mb-6">
                {loading ? (
                    <div className="text-center py-20 text-gray-400">Wird geladen...</div>
                ) : displayedClients.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 italic bg-white/5 rounded-2xl border border-white/10">Keine Kunden gefunden.</div>
                ) : (
                    displayedClients.map((client) => (
                        <div key={client.id} className="glass-card p-5 rounded-2xl border border-white/10 relative group">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                    {getTypeIcon(client.type)}
                                    {getStatusBadge(client.status)}
                                </div>
                                {canManageCustomers && (
                                    <div className="flex gap-2">
                                        <button onClick={() => handleOpenModal(client)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-400 border border-blue-500/20"><i className="fa-solid fa-pen text-xs"></i></button>
                                        <button onClick={() => deleteClient(client.id)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10 text-red-400 border border-red-500/20"><i className="fa-solid fa-trash-can text-xs"></i></button>
                                    </div>
                                )}
                            </div>
                            <h3 className="text-lg font-bold text-white mb-1">{client.name}</h3>
                            {client.contact_person && (
                                <p className="text-sm text-gray-300 mb-3 flex items-center gap-2">
                                    <i className="fa-solid fa-user-tie text-blue-400/50"></i> {client.contact_person}
                                </p>
                            )}
                            <div className="space-y-2 pt-3 border-t border-white/5">
                                {client.email && (
                                    <div className="flex items-center gap-3 text-xs text-gray-400">
                                        <i className="fa-solid fa-envelope w-4 text-center text-blue-400/30"></i>
                                        <span className="truncate">{client.email}</span>
                                    </div>
                                )}
                                {client.phone && (
                                    <div className="flex items-center gap-3 text-xs text-gray-400">
                                        <i className="fa-solid fa-phone w-4 text-center text-blue-400/30"></i>
                                        <span>{client.phone}</span>
                                    </div>
                                )}
                                {(client.address || client.city) && (
                                    <div className="flex items-center gap-3 text-xs text-gray-400">
                                        <i className="fa-solid fa-location-dot w-4 text-center text-blue-400/30"></i>
                                        <span className="truncate">{client.address}, {client.zip_code} {client.city}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="hidden md:block glass-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-white/5 border-b border-white/10">
                            <tr>
                                <th className="p-4">Kunde / Firma</th>
                                <th className="p-4">Ansprechpartner</th>
                                <th className="p-4">Kontakt</th>
                                <th className="p-4">Status</th>
                                {canManageCustomers && <th className="p-4 text-right">Aktionen</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={canManageCustomers ? 5 : 4} className="p-4 text-center text-gray-400">Wird geladen...</td>
                                </tr>
                            ) : displayedClients.length === 0 ? (
                                <tr>
                                    <td colSpan={canManageCustomers ? 5 : 4} className="p-4 text-center text-gray-400">Keine Kunden gefunden.</td>
                                </tr>
                            ) : (
                                displayedClients.map((client) => (
                                    <tr key={client.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                {getTypeIcon(client.type)}
                                            </div>
                                            <div className="font-semibold text-white">{client.name}</div>
                                            {(client.city || client.zip_code || client.address) && (
                                                <div className="text-xs text-gray-400">
                                                    {client.address && <span>{client.address}, </span>}
                                                    {client.zip_code} {client.city}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-gray-300">
                                            {client.contact_person || '-'}
                                        </td>
                                         <td className="p-4">
                                             <div className="flex flex-col gap-1 text-xs text-gray-400">
                                                 {client.phone && (
                                                     <div className="flex items-center gap-2">
                                                         <i className="fa-solid fa-phone w-4 text-center"></i> 
                                                         <span>{client.phone}</span>
                                                         <div className="flex justify-center gap-2">
                                                            <button 
                                                                onClick={() => makeCall(client.phone)}
                                                                disabled={callState !== 'idle' || !client.phone}
                                                                className={`p-2 rounded-lg transition-all ${
                                                                    callState !== 'idle' ? 'bg-gray-500/10 text-gray-500 cursor-not-allowed' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white'
                                                                }`}
                                                                title="Anrufen"
                                                            >
                                                                <i className="fa-solid fa-phone"></i>
                                                            </button>
                                                            <button 
                                                                onClick={() => {
                                                                    setHistoryNumber(client.phone);
                                                                    setIsHistoryOpen(true);
                                                                }}
                                                                className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                                                                title="Anrufverlauf"
                                                            >
                                                                <i className="fa-solid fa-clock-rotate-left"></i>
                                                            </button>
                                                        </div>
                                                     </div>
                                                 )}
                                                 {client.email && <div><i className="fa-solid fa-envelope w-4 text-center"></i> {client.email}</div>}
                                                 {!client.phone && !client.email && <span>-</span>}
                                             </div>
                                         </td>
                                        <td className="p-4">
                                            {getStatusBadge(client.status)}
                                        </td>
                                        {canManageCustomers && (
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenModal(client)}
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors"
                                                        title="Bearbeiten"
                                                    >
                                                        <i className="fa-solid fa-pen"></i>
                                                    </button>
                                                    <button
                                                        onClick={() => deleteClient(client.id)}
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                                                        title="Löschen"
                                                    >
                                                        <i className="fa-solid fa-trash-can"></i>
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
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-md flex justify-center p-4">
                    <div className="glass-card w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl animate-[slideUp_0.3s_ease-out] my-auto">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 rounded-t-2xl">
                            <h2 className="text-xl font-semibold text-white">
                                {isEditing ? 'Kunden bearbeiten' : 'Kunden hinzufügen'}
                            </h2>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div className="mb-4 md:mb-0">
                                    <label className="block text-sm font-medium text-gray-200 mb-1">
                                        Firma / Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-200 mb-1">Kundentyp</label>
                                    <div className="relative">
                                        <select
                                            value={formData.type}
                                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all appearance-none [&>option]:bg-gray-800"
                                        >
                                            <option value="company">Firma</option>
                                            <option value="private">Privatperson</option>
                                        </select>
                                        <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-200 mb-1">Ansprechpartner</label>
                                    <input
                                        type="text"
                                        value={formData.contact_person}
                                        onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                                    />
                                </div>
                                <div className="hidden md:block"></div> {/* Spacer to keep Ansprechpartner top left if needed, but let's align E-Mail next for a tighter layout */}

                                <div>
                                    <label className="block text-sm font-medium text-gray-200 mb-1">E-Mail</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-200 mb-1">Telefon</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Adresse */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-200 mb-1">Adresse</label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-200 mb-1">PLZ</label>
                                    <input
                                        type="text"
                                        value={formData.zip_code}
                                        onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-200 mb-1">Stadt</label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-200 mb-1">Status</label>
                                    <div className="relative">
                                        <select
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all appearance-none [&>option]:bg-gray-800"
                                        >
                                            <option value="active">Aktiv</option>
                                            <option value="lead">Interessent (Lead)</option>
                                            <option value="inactive">Inaktiv</option>
                                        </select>
                                        <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-200 mb-1">Notizen</label>
                                <textarea
                                    rows="3"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all resize-y min-h-[80px]"
                                ></textarea>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10">
                                    Abbrechen
                                </button>
                                <button type="submit" className="px-6 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-[0_4px_15px_rgba(37,99,235,0.3)]">
                                    Speichern
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <CallHistoryModal 
                isOpen={isHistoryOpen} 
                onClose={() => setIsHistoryOpen(false)} 
                number={historyNumber} 
            />
        </div>
    );
};

export default Customers;
