import { useState, useEffect } from 'react';
import api from '../../services/api';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const CallHistoryModal = ({ number, isOpen, onClose }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && number) {
            const fetchLogs = async () => {
                setLoading(true);
                try {
                    const res = await api.get(`/phone/history/${encodeURIComponent(number)}`);
                    setLogs(res.data.data.logs || []);
                } catch (error) {
                    console.error('Error fetching number history:', error);
                } finally {
                    setLoading(false);
                }
            };
            fetchLogs();
        }
    }, [isOpen, number]);

    if (!isOpen) return null;

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed': return <i className="fa-solid fa-circle-check text-green-400"></i>;
            case 'missed': return <i className="fa-solid fa-circle-xmark text-red-400"></i>;
            default: return <i className="fa-solid fa-circle-info text-gray-400"></i>;
        }
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2500] p-4">
            <div className="bg-[#1a1c1e] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-[scaleIn_0.3s_ease-out]">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/20">
                            <i className="fa-solid fa-clock-rotate-left"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white tracking-tight">Anrufverlauf</h3>
                            <p className="text-xs text-gray-400 font-mono tracking-wider">{number}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-2">
                        <i className="fa-solid fa-xmark text-xl"></i>
                    </button>
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                            <i className="fa-solid fa-spinner fa-spin text-blue-400 text-2xl"></i>
                            <p className="text-sm text-gray-500">Wird geladen...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="text-gray-500 italic">Keine Anrufe für diese Nummer gefunden.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {logs.map(log => (
                                <div key={log.id} className="bg-white/5 rounded-2xl p-4 border border-white/5 flex items-center justify-between hover:bg-white/[0.08] transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                            log.direction === 'outbound' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                                        }`}>
                                            <i className={`fa-solid ${log.direction === 'outbound' ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}`}></i>
                                        </div>
                                            <div className="flex flex-col">
                                                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                                                    <i className="fa-solid fa-user-tie"></i>
                                                    {log.user?.name || 'System'} {log.user?.sip_user ? `(EXT: ${log.user.sip_user})` : ''}
                                                </p>
                                                <p className="text-[11px] text-gray-500 font-mono">
                                                    {format(new Date(log.created_at), 'PPPp', { locale: de })}
                                                </p>
                                                <p className="text-sm font-semibold text-white/90">
                                                    {log.direction === 'outbound' ? 'Ausgehend' : 'Eingehend'} • {formatDuration(log.duration_seconds)}
                                                </p>
                                            </div>
                                    </div>
                                    <div className="text-base" title={log.status}>
                                        {getStatusIcon(log.status)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-white/5 border-t border-white/5 text-center px-6 py-4">
                    <button 
                        onClick={onClose}
                        className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all text-sm"
                    >
                        Schließen
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CallHistoryModal;
