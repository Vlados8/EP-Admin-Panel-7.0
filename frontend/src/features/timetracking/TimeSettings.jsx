import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const TimeSettings = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await api.get('/users');
            setUsers(res.data.data.users || []);
        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePin = async (e) => {
        e.preventDefault();
        try {
            await api.patch(`/users/${editingUser.id}`, { pin: editingUser.pin });
            setEditingUser(null);
            fetchUsers();
        } catch (err) {
            console.error('Error updating PIN:', err);
            alert('Fehler beim Aktualisieren des PINs');
        }
    };

    const filteredUsers = users.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-6">
            <div className="glass-panel p-6 rounded-3xl">
                <h2 className="text-xl font-bold uppercase tracking-widest text-white mb-2">PIN-Verwaltung</h2>
                <p className="text-sm text-gray-400 mb-6">Verwalten Sie hier рабочие PIN-коды для доступа к терминалу самообслуживания.</p>
                
                <div className="relative mb-6">
                    <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
                    <input
                        type="text"
                        placeholder="Mitarbeiter suchen..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {loading ? (
                        <div className="col-span-full py-12 text-center text-gray-500 italic">Laden...</div>
                    ) : filteredUsers.map(user => (
                        <div key={user.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/[0.08] transition-all group relative">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-white/10 flex items-center justify-center text-xs font-bold text-blue-400">
                                    {user.name.split(' ').map(n=>n[0]).join('')}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-white truncate">{user.name}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-md font-bold tracking-widest uppercase">
                                            PIN: {user.pin || '---'}
                                        </span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setEditingUser(user)}
                                    className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-gray-500 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <i className="fa-solid fa-key text-xs"></i>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Set PIN Modal */}
            {editingUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm shadow-2xl" onClick={() => setEditingUser(null)}></div>
                    <form onSubmit={handleUpdatePin} className="glass-panel w-full max-w-sm rounded-3xl p-8 relative animate-in fade-in zoom-in duration-300">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-xl font-bold uppercase tracking-[0.2em] text-white">PIN festlegen</h3>
                                <p className="text-xs text-gray-500 mt-1">{editingUser.name}</p>
                            </div>
                            <button type="button" onClick={() => setEditingUser(null)} className="text-gray-500 hover:text-white transition-colors">
                                <i className="fa-solid fa-xmark text-xl"></i>
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Neuer PIN (4-6 Stellen)</label>
                                <input
                                    type="text"
                                    maxLength="6"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-center text-2xl font-mono font-bold tracking-[0.5em] focus:outline-none focus:border-blue-500/50 transition-colors"
                                    placeholder="----"
                                    value={editingUser.pin || ''}
                                    onChange={(e) => setEditingUser({...editingUser, pin: e.target.value.replace(/\D/g, '')})}
                                />
                            </div>
                        </div>

                        <div className="mt-8 flex gap-4">
                            <button type="button" onClick={() => setEditingUser(null)} className="flex-1 px-6 py-3 rounded-xl border border-white/10 text-xs font-bold uppercase tracking-widest hover:bg-white/5 transition-all">Abbrechen</button>
                            <button type="submit" className="flex-1 px-6 py-3 rounded-xl bg-blue-500 shadow-lg shadow-blue-500/20 text-white text-xs font-bold uppercase tracking-widest hover:bg-blue-400 transition-all">Speichern</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default TimeSettings;
