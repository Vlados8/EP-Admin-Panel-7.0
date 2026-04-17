import { useState, useEffect } from 'react';
import api from '../../services/api';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const CallHistoryPage = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchLogs = async () => {
        try {
            const res = await api.get('/phone/logs');
            setLogs(res.data.data.logs);
        } catch (error) {
            console.error('Error fetching call logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const getStatusBadge = (status) => {
        const styles = {
            completed: 'bg-green-500/10 text-green-400 border-green-500/20',
            missed: 'bg-red-500/10 text-red-400 border-red-500/20',
            failed: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
            busy: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
            'no-answer': 'bg-orange-500/10 text-orange-400 border-orange-500/20'
        };
        const labels = {
            completed: 'Erfolgreich',
            missed: 'Verpasst',
            failed: 'Fehlgeschlagen',
            busy: 'Besetzt',
            'no-answer': 'Keine Antwort'
        };
        return (
            <span className={`px-2 py-1 rounded-md text-[10px] font-medium border ${styles[status] || styles.failed}`}>
                {labels[status] || status}
            </span>
        );
    };

    const formatDuration = (seconds) => {
        if (!seconds) return '0s';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    const filteredLogs = logs.filter(log => {
        const query = searchQuery.toLowerCase();
        return (
            log.remote_number?.toLowerCase().includes(query) ||
            log.customer_name?.toLowerCase().includes(query)
        );
    });

    return (
        <div className="animate-[fadeIn_0.4s_ease-out_forwards]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white">Anrufverlauf</h2>
                    <p className="text-gray-400 text-sm mt-1">Ihre letzten ausgehenden und eingehenden Anrufe.</p>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
                        <input 
                            type="text"
                            placeholder="Suchen (Nummer, Name)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                        />
                    </div>
                    <button 
                        onClick={fetchLogs}
                        className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 transition-colors border border-white/10"
                        title="Aktualisieren"
                    >
                        <i className="fa-solid fa-rotate"></i>
                    </button>
                </div>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden border border-white/10 shadow-xl bg-black/20 backdrop-blur-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-white/5 border-b border-white/10 text-gray-400 uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="p-4">Richtung</th>
                                <th className="p-4">Nummer</th>
                                <th className="p-4">Zeitpunkt</th>
                                <th className="p-4">Dauer</th>
                                <th className="p-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="5" className="p-4 h-16 bg-white/5"></td>
                                    </tr>
                                ))
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-20 text-center text-gray-500 italic">
                                        {searchQuery ? 'Keine Treffer für Ihre Suche.' : 'Kein Anrufverlauf gefunden.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                                    log.direction === 'outbound' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                                                }`}>
                                                    <i className={`fa-solid ${log.direction === 'outbound' ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}`}></i>
                                                </div>
                                                <span className="font-medium text-gray-300">
                                                    {log.direction === 'outbound' ? 'Ausgehend' : 'Eingehend'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                {log.customer_name && (
                                                    <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-0.5">
                                                        {log.customer_name}
                                                    </span>
                                                )}
                                                <span className="font-semibold text-white tracking-widest text-sm">
                                                    {log.remote_number}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-400">
                                            {format(new Date(log.created_at), 'PPPp', { locale: de })}
                                        </td>
                                        <td className="p-4 text-gray-300">
                                            {formatDuration(log.duration_seconds)}
                                        </td>
                                        <td className="p-4">
                                            {getStatusBadge(log.status)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CallHistoryPage;
