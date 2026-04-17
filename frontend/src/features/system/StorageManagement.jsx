import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    HardDrive, 
    Users, 
    Edit2, 
    Save, 
    X, 
    Search, 
    Loader2, 
    AlertCircle,
    Info
} from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

const StorageManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingUser, setEditingUser] = useState(null);
    const [newLimit, setNewLimit] = useState('');

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await api.get('/users');
            setUsers(res.data.data.users);
        } catch (err) {
            console.error('Error fetching users:', err);
            toast.error('Fehler beim Laden der Benutzerdaten');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleUpdateLimit = async (userId) => {
        if (!newLimit || isNaN(newLimit)) {
            toast.error('Geben Sie einen gültigen Wert ein');
            return;
        }

        try {
            await api.patch(`/users/${userId}`, { storage_limit_gb: parseFloat(newLimit) });
            toast.success('Speicherlimit aktualisiert');
            setEditingUser(null);
            fetchUsers();
        } catch (err) {
            console.error('Update error:', err);
            toast.error('Fehler beim Aktualisieren');
        }
    };

    const filteredUsers = users.filter(u => 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen bg-transparent">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <HardDrive className="text-blue-500" /> Speicherverwaltung
                    </h1>
                    <p className="text-white/50">Überwachen und verwalten Sie die Speicherkontingente Ihrer Mitarbeiter.</p>
                </div>

                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input 
                        type="text"
                        placeholder="Benutzer suchen..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-6 mb-8 flex gap-4 items-start backdrop-blur-md">
                <Info className="w-6 h-6 text-blue-400 shrink-0 mt-1" />
                <div>
                    <h3 className="text-blue-400 font-semibold mb-1">Hinweis zur Speicherberechnung</h3>
                    <p className="text-blue-300/60 text-sm">
                        Die Speichernutzung wird in Echtzeit berechnet. Wenn ein Benutzer sein Limit erreicht, 
                        kann er keine weiteren Dateien mehr in den allgemeinen Dateimanager hochladen. 
                        Projektdateien sind von diesen persönlichen Quotas derzeit nicht betroffen.
                    </p>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
                {loading ? (
                    <div className="p-20 flex justify-center">
                        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-widest">Benutzer</th>
                                <th className="px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-widest">Nutzung</th>
                                <th className="px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-widest">Limit (GB)</th>
                                <th className="px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-white/50 uppercase tracking-widest text-right">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user) => {
                                const usedGb = (user.storage_used_bytes || 0) / (1024 * 1024 * 1024);
                                const limitGb = user.storage_limit_gb || 2.0;
                                const percent = Math.min(100, (usedGb / limitGb) * 100);

                                return (
                                    <tr key={user.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                                                    {user.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="text-white font-medium">{user.name}</div>
                                                    <div className="text-white/30 text-xs">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="w-48">
                                                <div className="flex justify-between text-[10px] text-white/40 mb-1.5 font-mono">
                                                    <span>{formatSize(user.storage_used_bytes || 0)}</span>
                                                    <span>{percent.toFixed(1)}%</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                                    <motion.div 
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${percent}%` }}
                                                        className={`h-full ${percent > 90 ? 'bg-red-500' : 'bg-blue-500'}`} 
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            {editingUser === user.id ? (
                                                <input 
                                                    type="number" 
                                                    value={newLimit}
                                                    onChange={(e) => setNewLimit(e.target.value)}
                                                    className="w-20 bg-white/10 border border-blue-500/50 rounded-lg px-2 py-1 text-white focus:outline-none"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className="text-white font-mono">{limitGb.toFixed(1)} GB</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5">
                                            {percent >= 100 ? (
                                                <span className="px-2 py-1 bg-red-500/20 text-red-500 text-[10px] font-bold rounded-md flex items-center gap-1 w-fit border border-red-500/30">
                                                    <AlertCircle className="w-3 h-3" /> VOLL
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 bg-emerald-500/20 text-emerald-500 text-[10px] font-bold rounded-md border border-emerald-500/30">
                                                    AKTIV
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            {editingUser === user.id ? (
                                                <div className="flex justify-end gap-2">
                                                    <button 
                                                        onClick={() => handleUpdateLimit(user.id)}
                                                        className="p-2 bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 rounded-lg transition-colors"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => setEditingUser(null)}
                                                        className="p-2 bg-white/10 text-white/50 hover:bg-white/20 rounded-lg transition-colors"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => {
                                                        setEditingUser(user.id);
                                                        setNewLimit(limitGb.toString());
                                                    }}
                                                    className="p-2 text-white/20 hover:text-white hover:bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default StorageManagement;
