import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../../services/api';
import usePermission from '../../hooks/usePermission';

const Subcontractors = () => {
    const { user: currentUser } = useSelector(state => state.auth);
    const [subcontractors, setSubcontractors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Custom select dropdown state hooks
    const [isStatusSelectOpen, setIsStatusSelectOpen] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        contact_person: '',
        trade: '',
        email: '',
        phone: '',
        address: '',
        zip_code: '',
        city: '',
        hourly_rate: '',
        status: 'active',
        notes: '',
        password: ''
    });

    const currentUserRole = currentUser?.role?.name || currentUser?.role;
    const canManageSubcontractors = usePermission('MANAGE_SUBCONTRACTORS');

    const fetchSubcontractors = async () => {
        try {
            const res = await api.get('/subcontractors');
            setSubcontractors(res.data.data.subcontractors);
        } catch (error) {
            console.error('Error fetching subcontractors:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubcontractors();
    }, []);

    const resetForm = () => {
        setFormData({
            name: '',
            contact_person: '',
            trade: '',
            email: '',
            phone: '',
            address: '',
            zip_code: '',
            city: '',
            hourly_rate: '',
            status: 'active',
            notes: '',
            password: ''
        });
        setIsStatusSelectOpen(false);
    };

    const handleOpenModal = (sub = null) => {
        if (sub && sub.id) {
            setIsEditing(true);
            setEditingId(sub.id);
            setFormData({
                name: sub.name || '',
                contact_person: sub.contact_person || '',
                trade: sub.trade || '',
                email: sub.email || '',
                phone: sub.phone || '',
                address: sub.address || '',
                zip_code: sub.zip_code || '',
                city: sub.city || '',
                hourly_rate: sub.hourly_rate || '',
                status: sub.status || 'active',
                notes: sub.notes || '',
                password: ''
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
                await api.patch(`/subcontractors/${editingId}`, formData);
            } else {
                await api.post('/subcontractors', formData);
            }
            fetchSubcontractors();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving subcontractor:', error);
            alert('Fehler beim Speichern des Subunternehmers');
        }
    };

    const deleteSubcontractor = async (id) => {
        if (!window.confirm('Möchten Sie diesen Subunternehmer wirklich löschen?')) return;
        try {
            await api.delete(`/subcontractors/${id}`);
            fetchSubcontractors();
        } catch (error) {
            console.error('Error deleting subcontractor:', error);
            alert('Fehler beim Löschen des Subunternehmers');
        }
    };

    const displayedSubcs = subcontractors.filter(sub => {
        if (searchQuery.trim() !== '') {
            const lowerQuery = searchQuery.toLowerCase();
            return (sub.name && sub.name.toLowerCase().includes(lowerQuery)) ||
                (sub.trade && sub.trade.toLowerCase().includes(lowerQuery)) ||
                (sub.contact_person && sub.contact_person.toLowerCase().includes(lowerQuery));
        }
        return true;
    });

    return (
        <div className="animate-[fadeIn_0.4s_ease-out_forwards]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Subunternehmer</h2>
                    <p className="text-gray-400 text-sm mt-1">Verwalten Sie hier alle externen Partner und Gewerke.</p>
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
                    {canManageSubcontractors && (
                        <button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)] flex items-center gap-2 text-sm whitespace-nowrap">
                            <i className="fa-solid fa-plus"></i> Neuer Subunternehmer
                        </button>
                    )}
                </div>
            </div>

            <div className="md:hidden space-y-4 mb-6">
                {loading ? (
                    <div className="text-center py-20 text-gray-400">Wird geladen...</div>
                ) : displayedSubcs.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 italic bg-white/5 rounded-2xl border border-white/10">Keine Subunternehmer gefunden.</div>
                ) : (
                    displayedSubcs.map((sub) => (
                        <div key={sub.id} className="glass-card p-5 rounded-2xl border border-white/10 relative group">
                            <div className="flex justify-between items-start mb-3">
                                <span className="px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30 uppercase tracking-wider">
                                    {sub.trade}
                                </span>
                                <div className="flex gap-2">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 ${sub.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                        <span className={`w-1 h-1 rounded-full ${sub.status === 'active' ? 'bg-green-400' : 'bg-red-400'}`}></span>
                                        {sub.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                                    </span>
                                    {canManageSubcontractors && (
                                        <div className="flex gap-2 ml-2">
                                            <button onClick={() => handleOpenModal(sub)} className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 text-gray-400 border border-white/10"><i className="fa-solid fa-pen text-[10px]"></i></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-1">{sub.name}</h3>
                            {sub.contact_person && (
                                <p className="text-sm text-gray-400 mb-4">{sub.contact_person}</p>
                            )}
                            <div className="grid grid-cols-1 gap-2 pt-3 border-t border-white/5">
                                {sub.email && (
                                    <div className="flex items-center gap-3 text-xs text-gray-400">
                                        <i className="fa-solid fa-envelope w-4 text-center text-blue-400/30"></i>
                                        <span className="truncate">{sub.email}</span>
                                    </div>
                                )}
                                {sub.phone && (
                                    <div className="flex items-center gap-3 text-xs text-gray-400">
                                        <i className="fa-solid fa-phone w-4 text-center text-blue-400/30"></i>
                                        <span>{sub.phone}</span>
                                    </div>
                                )}
                                {(sub.city || sub.zip_code) && (
                                    <div className="flex items-center gap-3 text-xs text-gray-400">
                                        <i className="fa-solid fa-location-dot w-4 text-center text-blue-400/30"></i>
                                        <span className="truncate">{sub.zip_code} {sub.city}</span>
                                    </div>
                                )}
                                {sub.hourly_rate && (
                                    <div className="flex items-center gap-3 text-xs text-blue-400 font-semibold mt-1">
                                        <i className="fa-solid fa-euro-sign w-4 text-center text-blue-400/30"></i>
                                        <span>{sub.hourly_rate} € / Std.</span>
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
                                <th className="p-4">Firma</th>
                                <th className="p-4">Ansprechpartner</th>
                                <th className="p-4">Gewerk</th>
                                <th className="p-4">Kontakt</th>
                                <th className="p-4">Status</th>
                                {canManageSubcontractors && <th className="p-4 text-right">Aktionen</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={canManageSubcontractors ? 6 : 5} className="p-4 text-center text-gray-400">Wird geladen...</td>
                                </tr>
                            ) : displayedSubcs.length === 0 ? (
                                <tr>
                                    <td colSpan={canManageSubcontractors ? 6 : 5} className="p-4 text-center text-gray-400">Keine Subunternehmer gefunden.</td>
                                </tr>
                            ) : (
                                displayedSubcs.map((sub) => (
                                    <tr key={sub.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4">
                                            <div className="font-semibold text-white">{sub.name}</div>
                                            {(sub.city || sub.zip_code) && (
                                                <div className="text-xs text-gray-400">{sub.zip_code} {sub.city}</div>
                                            )}
                                        </td>
                                        <td className="p-4 text-gray-300">
                                            {sub.contact_person || '-'}
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 text-xs font-medium border border-blue-500/30">
                                                {sub.trade}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1 text-xs text-gray-400">
                                                {sub.phone && <div><i className="fa-solid fa-phone w-4 text-center"></i> {sub.phone}</div>}
                                                {sub.email && <div><i className="fa-solid fa-envelope w-4 text-center"></i> {sub.email}</div>}
                                                {!sub.phone && !sub.email && <span>-</span>}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1.5 w-max ${sub.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                                <span className={`w-1.5 h-1.5 gap-2 rounded-full ${sub.status === 'active' ? 'bg-green-400' : 'bg-red-400'}`}></span>
                                                {sub.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                                            </span>
                                        </td>
                                        {canManageSubcontractors && (
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenModal(sub)}
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors"
                                                        title="Bearbeiten"
                                                    >
                                                        <i className="fa-solid fa-pen"></i>
                                                    </button>
                                                    <button
                                                        onClick={() => deleteSubcontractor(sub.id)}
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
                                {isEditing ? 'Subunternehmer bearbeiten' : 'Subunternehmer hinzufügen'}
                            </h2>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6">

                            {/* Firma - Full Width */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-200 mb-1">
                                    Firma *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                                />
                            </div>

                            {/* 2-Column Grid */}
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
                                <div>
                                    <label className="block text-sm font-medium text-gray-200 mb-1">Spezialisierung *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.trade}
                                        onChange={(e) => setFormData({ ...formData, trade: e.target.value })}
                                        placeholder="z.B. Elektriker, Schlosser"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all placeholder:text-gray-500"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-200 mb-1">Telefon</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Portal-Zugangsdaten */}
                            <div className="mb-4 border-t border-white/10 pt-4">
                                <h3 className="text-xs font-semibold text-blue-400 mb-3 uppercase tracking-wider">Portal-Zugangsdaten</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-200 mb-1">Portal E-Mail</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="partner@firma.de"
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all placeholder:text-gray-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-200 mb-1">
                                            {isEditing ? 'Passwort (leer lassen zum Beibehalten)' : 'Passwort'}
                                        </label>
                                        <input
                                            type="password"
                                            value={formData.password || ''}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            placeholder={isEditing ? '••••••••' : 'Passwort eingeben'}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all placeholder:text-gray-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Adresse - Full Width */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-200 mb-1">Adresse</label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                                />
                            </div>

                            {/* PLZ & Stadt Grid */}
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
                                    <label className="block text-sm font-medium text-gray-200 mb-1">Stundensatz (€)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.hourly_rate}
                                        onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-200 mb-1">Status</label>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setIsStatusSelectOpen(!isStatusSelectOpen)}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all text-left flex items-center justify-between"
                                        >
                                            <span>
                                                {formData.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                                            </span>
                                            <i className={`fa-solid fa-chevron-down text-gray-400 text-xs transition-transform duration-200 ${isStatusSelectOpen ? 'rotate-180' : ''}`}></i>
                                        </button>
                                        {isStatusSelectOpen && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setIsStatusSelectOpen(false)} />
                                                <div className="absolute left-0 right-0 mt-1 bg-[#121212]/95 border border-white/10 rounded-lg shadow-2xl z-50 py-1 backdrop-blur-md animate-[fadeIn_0.15s_ease-out] text-left">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setFormData({ ...formData, status: 'active' });
                                                            setIsStatusSelectOpen(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors ${formData.status === 'active' ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                    >
                                                        Aktiv
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setFormData({ ...formData, status: 'inactive' });
                                                            setIsStatusSelectOpen(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors ${formData.status === 'inactive' ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                    >
                                                        Inaktiv
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Notizen */}
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
        </div>
    );
};

export default Subcontractors;
