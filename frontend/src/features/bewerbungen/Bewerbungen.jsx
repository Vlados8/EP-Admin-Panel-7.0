import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const STATUS_OPTIONS = [
    { id: 'Neu', title: 'Neu', icon: 'fa-star', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    { id: 'In Kontakt', title: 'In Kontakt', icon: 'fa-phone', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    { id: 'Angenommen', title: 'Angenommen', icon: 'fa-check', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    { id: 'Abgelehnt', title: 'Abgelehnt', icon: 'fa-xmark', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' }
];

const Bewerbungen = () => {
    const navigate = useNavigate();
    const { user: currentUser } = useSelector(state => state.auth);

    useEffect(() => {
        if (currentUser) {
            const role = currentUser.role?.name || currentUser.role;
            if (role !== 'Admin' && role !== 'Büro') {
                navigate('/dashboard');
            }
        }
    }, [currentUser, navigate]);

    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatusTab, setSelectedStatusTab] = useState('All');
    const [selectedApplication, setSelectedApplication] = useState(null);
    const [updatingId, setUpdatingId] = useState(null);

    const fetchApplications = async () => {
        try {
            setLoading(true);
            const res = await api.get('/bewerbungen');
            setApplications(res.data.data.bewerbungen || []);
        } catch (error) {
            console.error('Error fetching job applications:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApplications();
    }, []);

    const handleStatusChange = async (id, newStatus) => {
        try {
            setUpdatingId(id);
            setApplications(prev => prev.map(app => app.id === id ? { ...app, status: newStatus } : app));
            await api.patch(`/bewerbungen/${id}/status`, { status: newStatus });
            if (selectedApplication && selectedApplication.id === id) {
                setSelectedApplication(prev => ({ ...prev, status: newStatus }));
            }
        } catch (error) {
            console.error('Error updating status:', error);
            fetchApplications();
        } finally {
            setUpdatingId(null);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Möchten Sie diese Bewerbung wirklich löschen?')) return;
        try {
            await api.delete(`/bewerbungen/${id}`);
            setApplications(prev => prev.filter(app => app.id !== id));
            if (selectedApplication && selectedApplication.id === id) {
                setSelectedApplication(null);
            }
        } catch (error) {
            console.error('Error deleting application:', error);
        }
    };

    // Calculate status counts
    const stats = useMemo(() => {
        const counts = { total: applications.length, Neu: 0, 'In Kontakt': 0, Angenommen: 0, Abgelehnt: 0 };
        applications.forEach(app => {
            if (counts[app.status] !== undefined) {
                counts[app.status]++;
            }
        });
        return counts;
    }, [applications]);

    // Filter and search
    const filteredApplications = useMemo(() => {
        return applications.filter(app => {
            const matchesStatus = selectedStatusTab === 'All' || app.status === selectedStatusTab;
            const matchesSearch = 
                app.stelle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                app.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                app.telefon?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesStatus && matchesSearch;
        });
    }, [applications, selectedStatusTab, searchQuery]);

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const d = new Date(dateString);
        return d.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="flex flex-col gap-6 h-full min-h-0">
            {/* Header section with Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div 
                    onClick={() => setSelectedStatusTab('All')}
                    className={`glass-card p-4 rounded-2xl cursor-pointer border hover:border-blue-500/40 transition-all ${selectedStatusTab === 'All' ? 'bg-blue-500/10 border-blue-500/40' : 'border-white/5'}`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Gesamt</span>
                        <i className="fa-solid fa-list-check text-blue-400 text-lg"></i>
                    </div>
                    <div className="text-2xl font-bold mt-2">{stats.total}</div>
                </div>

                {STATUS_OPTIONS.map(opt => (
                    <div 
                        key={opt.id}
                        onClick={() => setSelectedStatusTab(opt.id)}
                        className={`glass-card p-4 rounded-2xl cursor-pointer border hover:border-white/20 transition-all ${selectedStatusTab === opt.id ? `${opt.bg} ${opt.border}` : 'border-white/5'}`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{opt.title}</span>
                            <i className={`fa-solid ${opt.icon} ${opt.color} text-lg`}></i>
                        </div>
                        <div className="text-2xl font-bold mt-2">{stats[opt.id]}</div>
                    </div>
                ))}
            </div>

            {/* Filter and Search Bar */}
            <div className="glass-card p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-80">
                    <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
                    <input
                        type="text"
                        placeholder="Name, E-Mail, Telefon oder Stelle..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-blue-500/50 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                        >
                            <i className="fa-solid fa-circle-xmark"></i>
                        </button>
                    )}
                </div>

                <div className="flex gap-2 self-stretch md:self-auto overflow-x-auto">
                    <button 
                        onClick={() => setSelectedStatusTab('All')}
                        className={`px-4 py-1.5 rounded-xl text-xs font-semibold border transition-all ${selectedStatusTab === 'All' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:text-white'}`}
                    >
                        Alle
                    </button>
                    {STATUS_OPTIONS.map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setSelectedStatusTab(opt.id)}
                            className={`px-4 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${selectedStatusTab === opt.id ? `${opt.bg} ${opt.color} ${opt.border}` : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:text-white'}`}
                        >
                            <i className={`fa-solid ${opt.icon}`}></i>
                            {opt.title}
                        </button>
                    ))}
                </div>
            </div>

            {/* Application List/Grid */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {loading ? (
                    <div className="h-48 flex items-center justify-center">
                        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-blue-400"></i>
                    </div>
                ) : filteredApplications.length === 0 ? (
                    <div className="glass-card p-12 rounded-2xl border border-white/5 text-center">
                        <i className="fa-solid fa-id-card text-5xl text-gray-600 mb-4 block"></i>
                        <h3 className="text-lg font-bold mb-1">Keine Bewerbungen gefunden</h3>
                        <p className="text-gray-400 text-sm">Es liegen aktuell keine Bewerbungen für diese Auswahl vor.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredApplications.map(app => {
                            const currentOpt = STATUS_OPTIONS.find(o => o.id === app.status) || STATUS_OPTIONS[0];
                            return (
                                <div 
                                    key={app.id}
                                    onClick={() => setSelectedApplication(app)}
                                    className="glass-card p-5 rounded-2xl border border-white/5 hover:border-white/10 transition-all cursor-pointer flex flex-col justify-between group"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                            <div className="font-semibold text-base group-hover:text-blue-400 transition-colors truncate">
                                                {app.stelle}
                                            </div>
                                            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 shrink-0 ${currentOpt.bg} ${currentOpt.color} ${currentOpt.border}`}>
                                                <i className={`fa-solid ${currentOpt.icon}`}></i>
                                                {app.title}
                                            </span>
                                        </div>

                                        <div className="flex flex-col gap-2 text-sm text-gray-400 mb-4">
                                            <div className="flex items-center gap-2">
                                                <i className="fa-solid fa-envelope w-4 text-center text-gray-500"></i>
                                                <span className="truncate">{app.email}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <i className="fa-solid fa-phone w-4 text-center text-gray-500"></i>
                                                <span>{app.telefon}</span>
                                            </div>
                                            {app.source_website && (
                                                <div className="flex items-center gap-2 text-xs text-blue-400/80">
                                                    <i className="fa-solid fa-globe w-4 text-center text-blue-400/60"></i>
                                                    <span className="truncate">{app.source_website}</span>
                                                </div>
                                            )}
                                            <div className="flex items-start gap-2 mt-1">
                                                <i className="fa-solid fa-briefcase w-4 text-center text-gray-500 mt-1 shrink-0"></i>
                                                <p className="line-clamp-2 text-xs leading-normal">
                                                    {app.erfahrung}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-white/5 pt-3 flex items-center justify-between text-xs text-gray-500">
                                        <span>{formatDate(app.createdAt)}</span>
                                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                            {/* Action quick buttons */}
                                            <button 
                                                onClick={() => handleDelete(app.id)}
                                                className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 flex items-center justify-center transition-colors"
                                                title="Löschen"
                                            >
                                                <i className="fa-solid fa-trash-can text-xs"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Detailed Application Modal */}
            {selectedApplication && (() => {
                const currentOpt = STATUS_OPTIONS.find(o => o.id === selectedApplication.status) || STATUS_OPTIONS[0];
                return (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div 
                            className="glass-card w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl border border-white/10 flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-blue-400 tracking-wider font-semibold uppercase">Kurzbewerbung</span>
                                    <h3 className="text-xl font-bold text-white mt-1">{selectedApplication.stelle}</h3>
                                </div>
                                <button 
                                    onClick={() => setSelectedApplication(null)}
                                    className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-all"
                                >
                                    <i className="fa-solid fa-xmark text-lg"></i>
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 overflow-y-auto flex flex-col gap-6 scrollbar-thin">
                                {/* Contacts */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                                            <i className="fa-solid fa-envelope text-blue-400"></i>
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[10px] text-gray-500 block">E-Mail Adresse</span>
                                            <a href={`mailto:${selectedApplication.email}`} className="text-sm font-semibold text-white hover:text-blue-400 hover:underline truncate block">
                                                {selectedApplication.email}
                                            </a>
                                        </div>
                                    </div>

                                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                                            <i className="fa-solid fa-phone text-amber-400"></i>
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[10px] text-gray-500 block">Telefonnummer</span>
                                            <a href={`tel:${selectedApplication.telefon}`} className="text-sm font-semibold text-white hover:text-amber-400 hover:underline truncate block">
                                                {selectedApplication.telefon}
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                {/* Status & Date */}
                                <div className="flex flex-wrap items-center justify-between gap-4 bg-white/5 border border-white/5 rounded-2xl p-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400">Status:</span>
                                        <div className="relative">
                                            <select
                                                value={selectedApplication.status}
                                                disabled={updatingId !== null}
                                                onChange={(e) => handleStatusChange(selectedApplication.id, e.target.value)}
                                                className="appearance-none bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 focus:border-blue-500/50 rounded-xl pl-4 pr-10 py-1.5 text-xs text-white focus:outline-none transition-all cursor-pointer font-semibold"
                                            >
                                                {STATUS_OPTIONS.map(opt => (
                                                    <option key={opt.id} value={opt.id} className="bg-[#121214] text-white">
                                                        {opt.title}
                                                    </option>
                                                ))}
                                            </select>
                                            <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] pointer-events-none"></i>
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-400 text-right">
                                        <div>Eingegangen am: <span className="text-white font-semibold">{formatDate(selectedApplication.createdAt)}</span></div>
                                        {selectedApplication.source_website && (
                                            <div className="mt-1">Quelle: <span className="text-blue-400 font-semibold">{selectedApplication.source_website}</span></div>
                                        )}
                                    </div>
                                </div>

                                {/* Experience Detail */}
                                <div>
                                    <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                        <i className="fa-solid fa-briefcase text-blue-400"></i>
                                        Berufserfahrung / Qualifikationen
                                    </h4>
                                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-sm text-gray-300 whitespace-pre-line leading-relaxed">
                                        {selectedApplication.erfahrung}
                                    </div>
                                </div>

                                {/* Nachricht Detail */}
                                {selectedApplication.nachricht && (
                                    <div>
                                        <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                            <i className="fa-solid fa-envelope-open-text text-amber-400"></i>
                                            Nachricht / Anschreiben
                                        </h4>
                                        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-sm text-gray-300 whitespace-pre-line leading-relaxed">
                                            {selectedApplication.nachricht}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-white/5 flex items-center justify-between bg-white/[0.02] shrink-0">
                                <button 
                                    onClick={() => handleDelete(selectedApplication.id)}
                                    className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                                >
                                    <i className="fa-solid fa-trash-can"></i>
                                    Bewerbung löschen
                                </button>
                                <button 
                                    onClick={() => setSelectedApplication(null)}
                                    className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-5 py-2.5 rounded-xl text-xs font-bold transition-all"
                                >
                                    Schließen
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default Bewerbungen;
