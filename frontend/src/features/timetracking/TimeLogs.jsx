import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const TimeLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [workers, setWorkers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedWorker, setSelectedWorker] = useState('');
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [editingLog, setEditingLog] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [ttSettings, setTtSettings] = useState({
        standard_workday_hours: 8.5,
        break_duration_6: 0,
        break_duration_6_10: 0.5,
        break_duration_10: 0.75
    });

    const initialLogState = {
        worker_id: '',
        project_name: 'Allgemein',
        date: format(new Date(), 'yyyy-MM-dd'),
        check_in_time: '',
        check_out_time: '',
        total_hours: 0,
        break_deducted: 0,
        type: 'work',
        status: 'closed'
    };

    const [newLog, setNewLog] = useState(initialLogState);

    useEffect(() => {
        fetchLogs();
        fetchWorkers();
        fetchProjects();
        fetchSettings();
    }, [selectedWorker, month, year]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];
            
            const params = { start_date: startDate, end_date: endDate };
            if (selectedWorker) params.worker_id = selectedWorker;

            const res = await api.get('/time-tracking/logs', { params });
            setLogs(res.data.data || []);
        } catch (err) {
            console.error('Error fetching logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchWorkers = async () => {
        try {
            const res = await api.get('/users');
            setWorkers(res.data.data.users || []);
        } catch (err) {
            console.error('Error fetching workers:', err);
        }
    };

    const fetchProjects = async () => {
        try {
            const res = await api.get('/projects');
            setProjects(res.data.data.projects || []);
        } catch (err) {
            console.error('Error fetching projects:', err);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await api.get('/company');
            const settings = res.data.data.settings?.time_tracking;
            if (settings) {
                setTtSettings({
                    standard_workday_hours: settings.standard_workday_hours ?? 8.5,
                    break_duration_6: settings.break_duration_6 ?? 0,
                    break_duration_6_10: settings.break_duration_6_10 ?? 0.5,
                    break_duration_10: settings.break_duration_10 ?? 0.75
                });
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        try {
            await api.patch('/company/settings', {
                settings: {
                    time_tracking: ttSettings
                }
            });
            setShowSettings(false);
            fetchLogs(); // Refresh hours display
        } catch (err) {
            console.error('Error saving settings:', err);
            alert('Fehler beim Speichern der Einstellungen');
        }
    };

    const calculateHours = (log) => {
        if (log.type !== 'work') {
            if (log.type === 'work_free') return log.total_hours || 0;
            return log.total_hours || ttSettings.standard_workday_hours;
        }
        if (!log.check_in_time || !log.check_out_time) return 0;

        const start = new Date(`${log.date}T${log.check_in_time}`);
        const end = new Date(`${log.date}T${log.check_out_time}`);
        let diff = (end - start) / (1000 * 60 * 60);

        if (diff < 0) diff += 24; 

        let autoBreak = 0;
        if (diff > 10) {
            autoBreak = ttSettings.break_duration_10;
        } else if (diff > 6) {
            autoBreak = ttSettings.break_duration_6_10;
        } else {
            autoBreak = ttSettings.break_duration_6;
        }

        return {
            total: Math.max(0, diff - (log.break_deducted || autoBreak)),
            suggestedBreak: autoBreak
        };
    };

    const handleUpdateLog = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...editingLog };
            
            if (payload.type === 'work') {
                // Only format if they are HH:mm strings (from the modal)
                if (payload.check_in_time && payload.check_in_time.includes(':') && !payload.check_in_time.includes('T')) {
                    payload.check_in_time = new Date(`${payload.date}T${payload.check_in_time}`).toISOString();
                }
                if (payload.check_out_time && payload.check_out_time.includes(':') && !payload.check_out_time.includes('T')) {
                    payload.check_out_time = new Date(`${payload.date}T${payload.check_out_time}`).toISOString();
                }
            } else {
                // For non-work types, clear check-in/out times
                payload.check_in_time = null;
                payload.check_out_time = null;
                if (payload.type === 'work_free') payload.total_hours = 0;
            }

            await api.patch(`/time-tracking/logs/${editingLog.id}`, payload);
            setEditingLog(null);
            fetchLogs();
        } catch (err) {
            console.error('Error updating log:', err);
        }
    };

    const handleCreateLog = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...newLog };
            if (payload.type === 'work') {
                payload.check_in_time = new Date(`${payload.date}T${payload.check_in_time}`).toISOString();
                payload.check_out_time = new Date(`${payload.date}T${payload.check_out_time}`).toISOString();
            }

            await api.post('/time-tracking/logs', payload);
            setIsAdding(false);
            setNewLog(initialLogState);
            fetchLogs();
        } catch (err) {
            console.error('Error creating log:', err);
        }
    };

    const handleDeleteLog = async (id) => {
        if (!window.confirm('Eintrag wirklich löschen?')) return;
        try {
            await api.delete(`/time-tracking/logs/${id}`);
            setEditingLog(null);
            fetchLogs();
        } catch (err) {
            console.error('Error deleting log:', err);
        }
    };

    const downloadReport = async (workerId) => {
        try {
            const response = await api.get('/time-tracking/report', {
                params: { worker_id: workerId, month, year },
                responseType: 'blob'
            });

            const worker = workers.find(w => w.id === workerId);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Stundenzettel_${worker?.name || 'Worker'}_${month}_${year}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Error downloading report:', err);
            alert('Fehler beim Herunterladen des Berichts');
        }
    };

    return (
        <div className="flex flex-col gap-6 h-full p-4 overflow-y-auto">
            {/* Header / Filter Bar */}
            <div className="glass-panel p-6 rounded-3xl flex flex-wrap items-end gap-6">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Mitarbeiter Filter</label>
                    <select
                        value={selectedWorker}
                        onChange={(e) => setSelectedWorker(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                    >
                        <option value="">Alle Mitarbeiter</option>
                        {workers.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </div>

                <div className="w-40">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Monat</label>
                    <select
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                                {new Date(2000, i).toLocaleString('de-DE', { month: 'long' })}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="w-32">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Jahr</label>
                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                    >
                        {[2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => setIsAdding(true)}
                        className="bg-white/5 border border-white/10 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
                    >
                        <i className="fa-solid fa-plus text-blue-400"></i>
                        Eintrag
                    </button>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="bg-white/5 border border-white/10 text-white w-11 h-11 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center"
                        title="Einstellungen"
                    >
                        <i className="fa-solid fa-gear text-gray-400"></i>
                    </button>
                    {selectedWorker && (
                        <button
                            onClick={() => downloadReport(selectedWorker)}
                            className="bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-400 transition-all flex items-center gap-2"
                        >
                            <i className="fa-solid fa-file-excel"></i>
                            Excel Drucken
                        </button>
                    )}
                </div>
            </div>

            {/* Logs Table */}
            <div className="glass-panel flex-1 rounded-[32px] overflow-hidden flex flex-col min-h-[400px] border border-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/[0.03] backdrop-blur-md">
                                <th className="pl-8 pr-4 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400/80">Datum / Tag</th>
                                <th className="px-6 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400/80">Mitarbeiter</th>
                                <th className="px-6 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400/80">Kategorie & Projekt</th>
                                <th className="px-6 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400/80 text-center">Zeitplan</th>
                                <th className="px-6 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400/80">Stunden</th>
                                <th className="px-6 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400/80">Status</th>
                                <th className="pl-4 pr-8 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-center text-gray-400/80">Optionen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                            {loading ? (
                                <tr><td colSpan="7" className="px-6 py-20 text-center text-gray-500 italic animate-pulse tracking-widest uppercase text-[10px] font-bold">Initialisiere Datenstrom...</td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan="7" className="px-6 py-20 text-center text-gray-500 italic tracking-widest uppercase text-[10px] font-bold opacity-50">Keine Aufzeichnungen in diesem Zeitraum</td></tr>
                            ) : (
                                logs.map((log, index) => (
                                    <tr 
                                        key={log.id} 
                                        className="hover:bg-white/[0.03] transition-all duration-300 group animate-in slide-in-from-right-4 fade-in fill-mode-both"
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        <td className="pl-8 pr-4 py-5 whitespace-nowrap">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 group-hover:border-blue-500/30 transition-colors shadow-inner">
                                                    <span className="text-[10px] font-black text-blue-400/70 uppercase leading-none mb-1">
                                                        {format(new Date(log.date), 'EEE', { locale: de })}
                                                    </span>
                                                    <span className="text-sm font-black text-white leading-none">
                                                        {format(new Date(log.date), 'dd')}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                                                        {format(new Date(log.date), 'MMMMM yyyy', { locale: de })}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-[11px] font-black text-white uppercase shadow-lg group-hover:from-blue-500/30 transition-all">
                                                        {log.worker?.name?.split(' ').map(n=>n[0]).join('')}
                                                    </div>
                                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#030305] shadow-lg"></div>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-200 group-hover:text-white transition-colors">
                                                        {log.worker?.name}
                                                    </span>
                                                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                                                        {log.worker?.specialty || 'Personal'}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1 items-center">
                                                {log.type === 'work' ? (
                                                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-wider border border-blue-500/20 shadow-[0_0_15px_-5px_rgba(59,130,246,0.2)]">
                                                        <i className="fa-solid fa-briefcase text-[9px]"></i>
                                                        Dienst
                                                    </span>
                                                ) : log.type === 'vacation' ? (
                                                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-500/20 shadow-[0_0_15px_-5px_rgba(16,185,129,0.2)]">
                                                        <i className="fa-solid fa-plane-departure text-[9px]"></i>
                                                        Urlaub
                                                    </span>
                                                ) : log.type === 'sick' ? (
                                                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase tracking-wider border border-rose-500/20 shadow-[0_0_15px_-5px_rgba(244,63,94,0.2)]">
                                                        <i className="fa-solid fa-heart-pulse text-[9px]"></i>
                                                        Krank
                                                    </span>
                                                ) : log.type === 'holiday' ? (
                                                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-wider border border-indigo-500/20 shadow-[0_0_15px_-5px_rgba(99,102,241,0.2)]">
                                                        <i className="fa-solid fa-calendar-star text-[9px]"></i>
                                                        Feiertag
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-500/10 text-slate-400 text-[10px] font-black uppercase tracking-wider border border-slate-500/20">
                                                        <i className="fa-solid fa-umbrella-beach text-[9px]"></i>
                                                        Frei
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-gray-500 font-medium tracking-tight mt-0.5">{log.project_name || 'Allgemein'}</span>
                                            </div>
                                        </td>

                                        <td className="px-6 py-5 text-center">
                                            {log.type === 'work' ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="flex items-center justify-center gap-3 font-mono text-xs">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[8px] text-green-500/60 font-black uppercase tracking-tighter">Start</span>
                                                            <span className="text-gray-300 font-bold group-hover:text-emerald-400 transition-colors">
                                                                {log.check_in_time ? format(new Date(log.check_in_time), 'HH:mm') : '--:--'}
                                                            </span>
                                                        </div>
                                                        <div className="w-8 h-px bg-white/10 relative">
                                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500/50"></div>
                                                        </div>
                                                        <div className="flex flex-col items-start">
                                                            <span className="text-[8px] text-red-500/60 font-black uppercase tracking-tighter">Ende</span>
                                                            <span className="text-gray-300 font-bold group-hover:text-rose-400 transition-colors">
                                                                {log.check_out_time ? format(new Date(log.check_out_time), 'HH:mm') : '--:--'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center gap-2 opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                                                    <div className="w-8 h-8 rounded-full border border-dashed border-white/20 flex items-center justify-center">
                                                        <i className="fa-solid fa-calendar-day text-[10px] text-gray-500"></i>
                                                    </div>
                                                    <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest italic">Ganztägig</span>
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-lg font-black text-blue-400 group-hover:scale-110 origin-left transition-transform duration-500 leading-none">
                                                        {log.total_hours?.toFixed(2) || '0.00'}
                                                    </span>
                                                    <span className="text-[10px] font-black text-blue-500/50 uppercase">std</span>
                                                </div>
                                                {log.break_deducted > 0 && (
                                                    <div className="flex items-center gap-1 mt-1 opacity-60">
                                                        <i className="fa-solid fa-mug-hot text-[8px] text-gray-500"></i>
                                                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                                                            -{log.break_deducted}h Pause
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-6 py-5">
                                            <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest ${log.status === 'open' ? 'text-orange-400' : 'text-gray-500'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${log.status === 'open' ? 'bg-orange-500 animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.5)]' : 'bg-white/20'}`}></div>
                                                {log.status === 'open' ? 'In Bearbeitung' : 'Archiviert'}
                                            </div>
                                        </td>
                                        
                                        <td className="pl-4 pr-8 py-5 text-center">
                                            <button 
                                                onClick={() => {
                                                    const formattedLog = { 
                                                        ...log,
                                                        check_in_time: log.check_in_time ? format(new Date(log.check_in_time), 'HH:mm') : '',
                                                        check_out_time: log.check_out_time ? format(new Date(log.check_out_time), 'HH:mm') : ''
                                                    };
                                                    setEditingLog(formattedLog);
                                                }}
                                                className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 text-gray-500 hover:bg-blue-600 hover:text-white hover:border-blue-500 hover:shadow-[0_10px_20px_rgba(37,99,235,0.2)] transition-all duration-300 active:scale-90"
                                            >
                                                <i className="fa-solid fa-fingerprint text-lg"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add / Edit Modal */}
            {(editingLog || isAdding) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => { setEditingLog(null); setIsAdding(false); }}></div>
                    <form 
                        onSubmit={isAdding ? handleCreateLog : handleUpdateLog} 
                        className="glass-panel w-full max-w-xl rounded-[40px] p-10 relative animate-in fade-in zoom-in slide-in-from-bottom-10 duration-500 flex flex-col gap-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] border-t border-white/20"
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-black uppercase tracking-[0.3em] text-white">
                                {isAdding ? 'NEUER EINTRAG' : 'BEARBEITEN'}
                            </h3>
                            <div className="flex gap-4">
                                {!isAdding && (
                                    <button 
                                        type="button" 
                                        onClick={() => handleDeleteLog(editingLog.id)} 
                                        className="w-10 h-10 rounded-full border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all transform hover:rotate-12"
                                    >
                                        <i className="fa-solid fa-trash-can text-sm"></i>
                                    </button>
                                )}
                                <button type="button" onClick={() => { setEditingLog(null); setIsAdding(false); }} className="w-10 h-10 rounded-full bg-white/5 text-gray-400 hover:text-white transition-colors">
                                    <i className="fa-solid fa-xmark text-xl"></i>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            {/* Row 1: Worker & Type */}
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Mitarbeiter</label>
                                <select
                                    disabled={!isAdding}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-blue-500 transition-all text-white disabled:opacity-50"
                                    value={isAdding ? newLog.worker_id : editingLog.worker_id}
                                    onChange={(e) => isAdding ? setNewLog({...newLog, worker_id: e.target.value}) : setEditingLog({...editingLog, worker_id: e.target.value})}
                                    required
                                >
                                    <option value="">Wählen...</option>
                                    {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>

                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Kategorie</label>
                                <select
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-blue-500 transition-all appearance-none"
                                    value={isAdding ? newLog.type : editingLog.type}
                                    onChange={(e) => {
                                        const type = e.target.value;
                                        let total = 0;
                                        if (type === 'work_free') total = 0;
                                        else if (type !== 'work') total = ttSettings.standard_workday_hours;
                                        
                                        if (isAdding) setNewLog({...newLog, type, total_hours: total});
                                        else setEditingLog({...editingLog, type, total_hours: total});
                                    }}
                                >
                                    <option value="work">Dienst</option>
                                    <option value="vacation">Urlaub</option>
                                    <option value="sick">Krankheit</option>
                                    <option value="holiday">Feiertagsstunden</option>
                                    <option value="work_free">Arbeitsfrei</option>
                                </select>
                            </div>

                            {/* Row 2: Date & Project */}
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Datum</label>
                                <input
                                    type="date"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                                    value={isAdding ? newLog.date : editingLog.date}
                                    onChange={(e) => isAdding ? setNewLog({...newLog, date: e.target.value}) : setEditingLog({...editingLog, date: e.target.value})}
                                    required
                                />
                            </div>

                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Baustelle</label>
                                <select
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                                    value={isAdding ? newLog.project_name : editingLog.project_name}
                                    onChange={(e) => isAdding ? setNewLog({...newLog, project_name: e.target.value}) : setEditingLog({...editingLog, project_name: e.target.value})}
                                >
                                    <option value="Allgemein">Allgemein</option>
                                    {projects.map(p => <option key={p.id} value={p.title}>{p.title}</option>)}
                                </select>
                            </div>

                            {/* Row 3: Times (Only for Work) */}
                            {(isAdding ? newLog.type : editingLog.type) === 'work' ? (
                                <>
                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-green-500 mb-2 italic">Kommen</label>
                                        <input
                                            type="time"
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-green-500/50 transition-all text-white shadow-lg shadow-green-500/5"
                                            value={isAdding ? newLog.check_in_time : editingLog.check_in_time}
                                            onChange={(e) => {
                                                const log = isAdding ? newLog : editingLog;
                                                const updated = {...log, check_in_time: e.target.value};
                                                const res = calculateHours(updated);
                                                updated.total_hours = res.total;
                                                updated.break_deducted = res.suggestedBreak;
                                                isAdding ? setNewLog(updated) : setEditingLog(updated);
                                            }}
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-red-500 mb-2 italic">Gehen</label>
                                        <input
                                            type="time"
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-red-500/50 transition-all text-white shadow-lg shadow-red-500/5"
                                            value={isAdding ? newLog.check_out_time : editingLog.check_out_time}
                                            onChange={(e) => {
                                                const log = isAdding ? newLog : editingLog;
                                                const updated = {...log, check_out_time: e.target.value};
                                                const res = calculateHours(updated);
                                                updated.total_hours = res.total;
                                                updated.break_deducted = res.suggestedBreak;
                                                isAdding ? setNewLog(updated) : setEditingLog(updated);
                                            }}
                                        />
                                    </div>
                                </>
                            ) : null}

                            {/* Row 4: Totals & Breaks */}
                            <div className="col-span-1">
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-2">Netto Stunden</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full bg-white/10 border border-white/20 rounded-2xl px-5 py-4 text-xl font-black text-blue-400 focus:outline-none border-dashed"
                                    value={(isAdding ? newLog.total_hours : editingLog.total_hours) || 0}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        isAdding ? setNewLog({...newLog, total_hours: val}) : setEditingLog({...editingLog, total_hours: val});
                                    }}
                                />
                                <span className="text-[7px] text-gray-600 mt-1 uppercase block text-center tracking-tighter">Manuelle Anpassung möglich</span>
                            </div>

                            <div className="col-span-1">
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Pause Abzug (h)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                                    value={isAdding ? newLog.break_deducted : editingLog.break_deducted}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        const log = isAdding ? newLog : editingLog;
                                        const updated = {...log, break_deducted: val};
                                        const res = calculateHours(updated); // Recalc total based on new break
                                        updated.total_hours = res.total;
                                        isAdding ? setNewLog(updated) : setEditingLog(updated);
                                    }}
                                />
                            </div>
                        </div>

                        <div className="flex gap-6 mt-4">
                            <button 
                                type="button" 
                                onClick={() => { setEditingLog(null); setIsAdding(false); }} 
                                className="flex-1 px-8 py-5 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:bg-white/5 transition-all active:scale-95"
                            >
                                Abbrechen
                            </button>
                            <button 
                                type="submit" 
                                className="flex-1 px-8 py-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_15px_30px_rgba(37,99,235,0.3)] text-white text-[10px] font-black uppercase tracking-[0.2em] hover:from-blue-500 hover:to-indigo-500 transition-all active:scale-95"
                            >
                                {isAdding ? 'EINTRAGEN' : 'AKTUALISIEREN'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowSettings(false)}></div>
                    <form 
                        onSubmit={handleSaveSettings} 
                        className="glass-panel w-full max-w-md rounded-[40px] p-10 relative animate-in fade-in zoom-in duration-500 flex flex-col gap-8 shadow-2xl border-t border-white/20"
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black uppercase tracking-[0.2em] text-white">EINSTELLUNGEN</h3>
                            <button type="button" onClick={() => setShowSettings(false)} className="w-10 h-10 rounded-full bg-white/5 text-gray-400 hover:text-white transition-colors">
                                <i className="fa-solid fa-xmark text-xl"></i>
                            </button>
                        </div>

                        <div className="flex flex-col gap-6">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Standard Arbeitstag (h)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-blue-500 transition-all"
                                    value={ttSettings.standard_workday_hours}
                                    onChange={(e) => setTtSettings({...ttSettings, standard_workday_hours: parseFloat(e.target.value)})}
                                    required
                                />
                                <p className="text-[9px] text-gray-600 mt-2 italic">Stunden für Urlaub & Krankheitstage</p>
                            </div>

                            <div className="flex flex-col gap-4">
                                <div className="grid grid-cols-2 gap-4 items-center">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Pause &lt; 6h (h)</label>
                                    <input
                                        type="number"
                                        step="0.25"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-blue-500 transition-all text-sm"
                                        value={ttSettings.break_duration_6}
                                        onChange={(e) => setTtSettings({...ttSettings, break_duration_6: parseFloat(e.target.value)})}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4 items-center">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Pause 6-10h (h)</label>
                                    <input
                                        type="number"
                                        step="0.25"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-blue-500 transition-all text-sm"
                                        value={ttSettings.break_duration_6_10}
                                        onChange={(e) => setTtSettings({...ttSettings, break_duration_6_10: parseFloat(e.target.value)})}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4 items-center">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Pause &gt; 10h (h)</label>
                                    <input
                                        type="number"
                                        step="0.25"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-blue-500 transition-all text-sm"
                                        value={ttSettings.break_duration_10}
                                        onChange={(e) => setTtSettings({...ttSettings, break_duration_10: parseFloat(e.target.value)})}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-4">
                            <button 
                                type="button" 
                                onClick={() => setShowSettings(false)} 
                                className="flex-1 px-6 py-4 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-white/5 transition-all"
                            >
                                Schließen
                            </button>
                            <button 
                                type="submit" 
                                className="flex-1 px-6 py-4 rounded-2xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all"
                            >
                                Speichern
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default TimeLogs;
