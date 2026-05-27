import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import socketService from '../../services/socket';

const BulkEmail = () => {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [attachments, setAttachments] = useState([]);
    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        from: '',
        recipientsText: '',
        subject: '',
        text: ''
    });

    const [delay, setDelay] = useState(2); // Throttling delay in seconds
    const [jobId, setJobId] = useState(null);
    const [results, setResults] = useState({ success: [], failed: [] });
    const [status, setStatus] = useState('idle'); // idle, sending, completed

    // Custom select dropdown state hooks
    const [isSenderSelectOpen, setIsSenderSelectOpen] = useState(false);

    const jobIdRef = useRef(null);

    useEffect(() => {
        fetchAccounts();
    }, []);

    useEffect(() => {
        // Connect and handle socket progress updates
        socketService.connect();

        const handleProgress = (data) => {
            if (data.jobId === jobIdRef.current) {
                setProgress({ current: data.current, total: data.total });
                setResults(data.results);
                
                if (data.status === 'completed') {
                    setSending(false);
                    setStatus('completed');
                    
                    const successCount = data.results.success.length;
                    const failCount = data.results.failed.length;
                    
                    if (failCount === 0) {
                        toast.success(`${successCount} E-Mails erfolgreich gesendet!`);
                        setFormData(prev => ({ ...prev, recipientsText: '', subject: '', text: '' }));
                        setAttachments([]);
                    } else {
                        toast.success(`${successCount} gesendet, ${failCount} fehlgeschlagen.`);
                    }
                }
            }
        };

        socketService.on('bulk_email_progress', handleProgress);

        return () => {
            socketService.off('bulk_email_progress', handleProgress);
        };
    }, []);

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const res = await api.get('/emails');
            const accs = res.data.data.accounts;
            setAccounts(accs);
            if (accs.length > 0) {
                setFormData(prev => ({ ...prev, from: accs[0].email }));
            }
        } catch (err) {
            console.error('Error fetching accounts:', err);
            toast.error('Fehler beim Laden der E-Mail-Konten.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        setAttachments(prev => [...prev, ...files]);
    };

    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Extract recipients and deduplicate
        const recipientList = [...new Set(formData.recipientsText
            .split(/[\n,;]/)
            .map(email => email.trim())
            .filter(email => email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))];

        if (recipientList.length === 0) {
            toast.error('Bitte geben Sie mindestens eine gültige E-Mail-Adresse an.');
            return;
        }

        if (!formData.subject || !formData.text) {
            toast.error('Betreff und Inhalt sind erforderlich.');
            return;
        }

        const data = new FormData();
        data.append('from', formData.from);
        recipientList.forEach(email => data.append('recipients', email));
        
        data.append('subject', formData.subject);
        data.append('text', formData.text);
        data.append('delay', delay); // Append configurable delay
        
        attachments.forEach(file => {
            data.append('attachments', file);
        });

        try {
            setSending(true);
            setStatus('sending');
            setProgress({ current: 0, total: recipientList.length });
            setResults({ success: [], failed: [] });
            
            const res = await api.post('/emails/send-bulk', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const jobInfo = res.data.data;
            jobIdRef.current = jobInfo.jobId;
            setJobId(jobInfo.jobId);
            
            toast.success('Massen-E-Mail-Versand gestartet...');
        } catch (err) {
            console.error('Bulk Send Error:', err);
            toast.error(err.response?.data?.message || 'Fehler beim Senden der Massen-E-Mail.');
            setSending(false);
            setStatus('idle');
        }
    };

    if (status === 'sending' || status === 'completed') {
        const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
        
        return (
            <div className="animate-[fadeIn_0.4s_ease-out_forwards] p-6 max-w-2xl mx-auto">
                <div className="glass-card p-8 rounded-[2rem] border border-white/10 bg-white/5 space-y-8 shadow-2xl">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-black text-white mb-2 tracking-tight">
                                {status === 'completed' ? 'Versand Abgeschlossen' : 'E-Mails werden gesendet...'}
                            </h2>
                            <p className="text-sm text-gray-500">
                                {status === 'completed' 
                                    ? 'Alle Nachrichten wurden erfolgreich verarbeitet.' 
                                    : `Sende an Empfänger ${progress.current} von ${progress.total}...`}
                            </p>
                        </div>
                        <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                            status === 'completed' 
                                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                                : 'bg-blue-500/10 border border-blue-500/30 text-blue-400 animate-pulse'
                        }`}>
                            {status === 'completed' ? 'Erledigt' : 'Aktiv'}
                        </span>
                    </div>

                    {/* Progress Circle or Bar */}
                    <div className="space-y-3">
                        <div className="flex justify-between text-xs font-bold text-gray-400">
                            <span>Fortschritt</span>
                            <span>{percent}% ({progress.current}/{progress.total})</span>
                        </div>
                        <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden border border-white/10 p-[2px]">
                            <div 
                                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                                style={{ width: `${percent}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Status Stats Grid */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center">
                            <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Gesamt</span>
                            <span className="text-2xl font-black text-white">{progress.total}</span>
                        </div>
                        <div className="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/10 text-center">
                            <span className="block text-xs font-bold text-emerald-500/55 uppercase tracking-wider mb-1">Erfolgreich</span>
                            <span className="text-2xl font-black text-emerald-400">{results.success.length}</span>
                        </div>
                        <div className="bg-red-500/5 rounded-2xl p-4 border border-red-500/10 text-center">
                            <span className="block text-xs font-bold text-red-500/55 uppercase tracking-wider mb-1">Fehler</span>
                            <span className="text-2xl font-black text-red-400">{results.failed.length}</span>
                        </div>
                    </div>

                    {/* Live log */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Aktivitätsprotokoll</h4>
                        <div className="bg-black/25 rounded-2xl p-4 border border-white/5 h-48 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-2 custom-scrollbar">
                            {results.success.map((item, idx) => (
                                <div key={`s-${idx}`} className="flex items-center text-emerald-400 gap-2 animate-[fadeIn_0.3s_ease-out]">
                                    <span className="text-xs">✓</span>
                                    <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span>
                                    <span>Gesendet an: {item.to}</span>
                                </div>
                            ))}
                            {results.failed.map((item, idx) => (
                                <div key={`f-${idx}`} className="flex items-start text-red-400 gap-2 animate-[fadeIn_0.3s_ease-out]">
                                    <span className="text-xs mt-[2px]">✗</span>
                                    <div className="flex-1">
                                        <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span>
                                        <span className="font-bold"> Fehler bei {item.to}:</span>
                                        <span className="text-red-300/80 block pl-4">{item.error}</span>
                                    </div>
                                </div>
                            ))}
                            {status === 'sending' && (
                                <div className="flex items-center text-blue-400 gap-2 animate-pulse">
                                    <span className="animate-spin text-xs">↻</span>
                                    <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span>
                                    <span>Verarbeite Empfänger... {delay > 0 ? `(Wartezeit ${delay}s)` : ''}</span>
                                </div>
                            )}
                            {results.success.length === 0 && results.failed.length === 0 && status === 'sending' && (
                                <div className="text-gray-600 italic">Verbindung wird aufgebaut und Job gestartet...</div>
                            )}
                        </div>
                    </div>

                    {/* Footer buttons */}
                    <div className="pt-4">
                        <button
                            type="button"
                            onClick={() => {
                                setStatus('idle');
                                setSending(false);
                            }}
                            disabled={status === 'sending'}
                            className={`w-full py-4 rounded-2xl font-black text-sm transition-all border ${
                                status === 'sending'
                                    ? 'bg-white/5 border-white/10 text-gray-600 cursor-not-allowed'
                                    : 'bg-blue-600 border-blue-500 hover:bg-blue-500 text-white cursor-pointer hover:scale-[1.02] shadow-xl shadow-blue-500/20'
                            }`}
                        >
                            {status === 'sending' ? 'Sendevorgang läuft...' : 'Zurück zur Übersicht'}
                        </button>
                    </div>
                </div>
                <style dangerouslySetInnerHTML={{ __html: `
                    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
                    .glass-card { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(20px); }
                `}} />
            </div>
        );
    }

    return (
        <div className="animate-[fadeIn_0.4s_ease-out_forwards] p-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Massen-E-Mail</h1>
                    <p className="text-gray-500">Senden Sie Nachrichten an mehrere Empfänger gleichzeitig.</p>
                </div>
                <div className={`px-4 py-2 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-widest ${sending ? 'animate-pulse' : ''}`}>
                    {sending ? 'Sende...' : 'Bereit'}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Column: Config */}
                    <div className="space-y-6">
                        <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5 space-y-4">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Konfiguration</h3>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Absender</label>
                                <div className="relative">
                                    <button
                                        type="button"
                                        disabled={sending}
                                        onClick={() => setIsSenderSelectOpen(!isSenderSelectOpen)}
                                        className="w-full glass-input rounded-2xl px-4 py-4 text-white font-bold text-left flex items-center justify-between disabled:opacity-50"
                                    >
                                        <span className="truncate">
                                            {formData.from 
                                                ? (() => {
                                                    const acc = accounts.find(a => String(a.email) === String(formData.from));
                                                    return acc ? (acc.display_name ? `${acc.display_name} <${acc.email}>` : acc.email) : formData.from;
                                                  })()
                                                : 'Absender wählen...'}
                                        </span>
                                        <i className={`fa-solid fa-chevron-down text-gray-400 text-xs transition-transform duration-200 ${isSenderSelectOpen ? 'rotate-180' : ''}`}></i>
                                    </button>
                                    {isSenderSelectOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setIsSenderSelectOpen(false)} />
                                            <div className="absolute left-0 right-0 mt-1 bg-[#121212]/95 border border-white/10 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto py-1.5 backdrop-blur-md animate-[fadeIn_0.15s_ease-out] custom-scrollbar text-left font-normal">
                                                {accounts.map(acc => (
                                                    <button
                                                        key={acc.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setFormData({ ...formData, from: acc.email });
                                                            setIsSenderSelectOpen(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors truncate ${String(formData.from) === String(acc.email) ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                    >
                                                        {acc.display_name ? `${acc.display_name} <${acc.email}>` : acc.email}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Empfänger (Komma, Semikolon oder neue Zeile)</label>
                                <textarea 
                                    className="w-full glass-input rounded-2xl px-4 py-4 text-white min-h-[150px] text-sm font-mono"
                                    placeholder="email1@example.com&#10;email2@example.com"
                                    value={formData.recipientsText}
                                    onChange={(e) => setFormData({ ...formData, recipientsText: e.target.value })}
                                    disabled={sending}
                                ></textarea>
                                <p className="text-[10px] text-gray-600 mt-2 italic">Gültige Adressen werden automatisch erkannt.</p>
                            </div>

                            {/* Delay Selector */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Sende-Verzögerung</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {[0, 1, 2, 5, 10].map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setDelay(s)}
                                            disabled={sending}
                                            className={`py-3 px-1 rounded-xl text-xs font-bold border transition-all ${
                                                delay === s
                                                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                                                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                                            }`}
                                        >
                                            {s}s
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-gray-600 mt-2 italic">
                                    {delay === 0 
                                        ? 'Sofortiger Versand (keine Verzögerung zwischen E-Mails).' 
                                        : `Wartet ${delay} Sekunden zwischen jedem Empfänger, um Spam-Filter zu umgehen.`}
                                </p>
                            </div>
                        </div>

                        <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Anhänge ({attachments.length})</h3>
                                <button 
                                    type="button"
                                    onClick={() => fileInputRef.current.click()}
                                    disabled={sending}
                                    className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    + Hinzufügen
                                </button>
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple className="hidden" />
                            
                            <div className="space-y-2">
                                {attachments.map((file, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 group">
                                        <span className="text-xs text-gray-300 truncate max-w-[200px]">{file.name}</span>
                                        <button type="button" onClick={() => removeAttachment(i)} className="text-gray-600 hover:text-red-400">
                                            <i className="fa-solid fa-xmark"></i>
                                        </button>
                                    </div>
                                ))}
                                {attachments.length === 0 && <p className="text-xs text-gray-600 italic">Keine Dateien ausgewählt.</p>}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Message Content */}
                    <div className="glass-card p-8 rounded-[2rem] border border-white/10 bg-white/5 flex flex-col">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Nachricht</h3>
                        
                        <div className="space-y-6 flex-1 flex flex-col">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Betreff</label>
                                <input 
                                    type="text"
                                    className="w-full glass-input rounded-2xl px-4 py-4 text-white font-bold text-lg"
                                    placeholder="Wichtige Information..."
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    disabled={sending}
                                />
                            </div>

                            <div className="flex-1 flex flex-col">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Inhalt</label>
                                <textarea 
                                    className="w-full glass-input rounded-2xl px-6 py-6 text-white flex-1 min-h-[300px] leading-relaxed"
                                    placeholder="Schreiben Sie Ihre Nachricht hier..."
                                    value={formData.text}
                                    onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                                    disabled={sending}
                                ></textarea>
                            </div>
                        </div>

                        <div className="pt-8">
                            <button 
                                type="submit" 
                                disabled={sending || loading}
                                className={`w-full py-5 rounded-[1.5rem] bg-blue-600 hover:bg-blue-500 text-white font-black text-lg transition-all shadow-2xl shadow-blue-500/40 flex items-center justify-center gap-3 ${sending ? 'opacity-70 scale-[0.98]' : 'hover:scale-[1.02]'}`}
                            >
                                {sending ? (
                                    <>
                                        <i className="fa-solid fa-circle-notch animate-spin"></i>
                                        Sende Massen-E-Mail...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-paper-plane"></i>
                                        Jetzt Senden
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </form>

            <style dangerouslySetInnerHTML={{ __html: `
                .glass-card { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(20px); }
                .glass-input { background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); outline: none; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
                .glass-input:focus { border-color: rgba(59, 130, 246, 0.5); background: rgba(255, 255, 255, 0.08); box-shadow: 0 0 30px rgba(59, 130, 246, 0.1); }
            `}} />
        </div>
    );
};

export default BulkEmail;
