import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const Reonic = () => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [leads, setLeads] = useState([]);
    const [stats, setStats] = useState({ imported: 0, offers: 0, power: 0 });
    
    // Settings State
    const [hasApiKey, setHasApiKey] = useState(false);
    const [apiStatus, setApiStatus] = useState('disconnected'); // 'disconnected', 'connected', 'error'
    const [maskedKey, setMaskedKey] = useState('');
    const [clientId, setClientId] = useState('');
    const [webhookSecret, setWebhookSecret] = useState('');
    
    // Modal State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [newApiKey, setNewApiKey] = useState('');
    const [newClientId, setNewClientId] = useState('');
    const [newWebhookSecret, setNewWebhookSecret] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    // Create Lead Modal
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isCreatingLead, setIsCreatingLead] = useState(false);
    const [newLeadData, setNewLeadData] = useState({ firstName: '', lastName: '', email: '', phone: '', note: '' });

    useEffect(() => {
        fetchSettings();
        fetchLeads();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.get('/reonic/settings');
            if (res.data.success) {
                const hasKey = res.data.data.hasApiKey;
                setHasApiKey(hasKey);
                setApiStatus(hasKey ? 'connected' : 'disconnected');
                setMaskedKey(res.data.data.maskedKey);
                setClientId(res.data.data.clientId || '');
                setWebhookSecret(res.data.data.webhookSecret);
            }
        } catch (error) {
            console.error('Failed to fetch Reonic settings:', error);
        }
    };

    const fetchLeads = async () => {
        try {
            const res = await api.get('/reonic/leads');
            if (res.data.success) {
                setLeads(res.data.data);
                // Calculate simple mock stats based on real data length
                setStats({
                    imported: res.data.data.length,
                    offers: Math.floor(res.data.data.length * 0.6),
                    power: (res.data.data.length * 8.5).toFixed(1) + ' kWp'
                });
            }
        } catch (error) {
            console.error('Failed to fetch Reonic leads:', error);
        }
    };

    const handleSync = async () => {
        if (!hasApiKey) return alert('Bitte zuerst den API Key in den Einstellungen hinterlegen.');
        
        setIsSyncing(true);
        try {
            const res = await api.post('/reonic/sync');
            if (res.data.success) {
                alert(res.data.message);
                setApiStatus('connected');
                fetchLeads();
            }
        } catch (error) {
            console.error('Sync failed:', error);
            setApiStatus('error');
            alert(error.response?.data?.message || 'Synchronisierung fehlgeschlagen.');
        } finally {
            setIsSyncing(false);
        }
    };

    const saveSettings = async () => {
        setIsSaving(true);
        try {
            const res = await api.post('/reonic/settings', {
                apiKey: newApiKey || undefined,
                clientId: newClientId !== undefined ? newClientId : undefined,
                webhookSecret: newWebhookSecret !== undefined ? newWebhookSecret : undefined
            });
            if (res.data.success) {
                setIsSettingsOpen(false);
                setNewApiKey(''); // Clear security input
                fetchSettings();
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Fehler beim Speichern der Einstellungen.');
        } finally {
            setIsSaving(false);
        }
    };

    const openSettings = () => {
        setNewApiKey('');
        setNewClientId(clientId);
        setNewWebhookSecret(webhookSecret);
        setIsSettingsOpen(true);
    };

    return (
        <div className="h-full flex flex-col gap-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Reonic API Integration</h1>
                    <p className="text-gray-400 mt-1">Verwalten Sie Ihre Leads und Angebote aus der Reonic Plattform</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-2 px-4 py-2 border rounded-xl font-medium
                        ${apiStatus === 'connected' ? 'bg-green-500/10 border-green-500/20 text-green-400' : ''}
                        ${apiStatus === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : ''}
                        ${apiStatus === 'disconnected' ? 'bg-gray-500/10 border-gray-500/20 text-gray-400' : ''}
                    `}>
                        <div className={`w-2 h-2 rounded-full 
                            ${apiStatus === 'connected' ? 'bg-green-500 animate-pulse' : ''}
                            ${apiStatus === 'error' ? 'bg-red-500 animate-pulse' : ''}
                            ${apiStatus === 'disconnected' ? 'bg-gray-500' : ''}
                        `}></div>
                        {apiStatus === 'connected' ? 'API Verbunden' : apiStatus === 'error' ? 'API Fehler' : 'API Getrennt'}
                    </div>
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        disabled={!hasApiKey || isSyncing}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <i className="fa-solid fa-plus"></i>
                        Neuer Lead
                    </button>
                    <button 
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="btn-primary flex items-center gap-2"
                    >
                        <i className={`fa-solid fa-rotate ${isSyncing ? 'animate-spin' : ''}`}></i>
                        {isSyncing ? 'Synchronisiere...' : 'Jetzt Synchronisieren'}
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                        <i className="fa-solid fa-solar-panel text-8xl text-blue-500"></i>
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">Importierte Leads</p>
                        <p className="text-4xl font-bold text-white mt-2">{stats.imported}</p>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                        <i className="fa-solid fa-file-signature text-8xl text-purple-500"></i>
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">Generierte Angebote (Ca.)</p>
                        <p className="text-4xl font-bold text-white mt-2">{stats.offers}</p>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                        <i className="fa-solid fa-bolt text-8xl text-yellow-500"></i>
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">Geplante Leistung</p>
                        <p className="text-4xl font-bold text-white mt-2">{stats.power}</p>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Leads Table */}
                <div className="lg:col-span-2 glass-panel rounded-2xl border border-white/5 flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                        <h2 className="text-xl font-bold text-white flex items-center gap-3">
                            <i className="fa-solid fa-list-check text-blue-400"></i>
                            Aktuelle Reonic Leads
                        </h2>
                        <button className="text-sm text-blue-400 hover:text-blue-300 font-medium">
                            Alle anzeigen <i className="fa-solid fa-arrow-right ml-1"></i>
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto p-0">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-gray-400">
                                    <th className="px-6 py-4 font-semibold">ID & Datum</th>
                                    <th className="px-6 py-4 font-semibold">Kunde</th>
                                    <th className="px-6 py-4 font-semibold">Systemauslegung</th>
                                    <th className="px-6 py-4 font-semibold">Status</th>
                                    <th className="px-6 py-4 font-semibold text-right">Aktion</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-sm">
                                {leads.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                            Keine Leads vorhanden. Klicken Sie auf Synchronisieren, um Daten abzurufen.
                                        </td>
                                    </tr>
                                ) : leads.map((lead, idx) => (
                                    <tr key={lead.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-white">{lead.reonicId}</div>
                                            <div className="text-gray-500 text-xs mt-0.5">{new Date(lead.createdAt).toLocaleDateString('de-DE')}</div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-blue-400">
                                            {lead.customerData?.firstName} {lead.customerData?.lastName || 'Unbekannt'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-300">
                                            {lead.systemData?.components?.join(' + ') || 'Konfiguration importiert'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border
                                                ${lead.status === 'Bereit für Angebot' || lead.status === 'new' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : ''}
                                                ${lead.status === 'In Planung' || lead.status === 'processing' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' : ''}
                                                ${lead.status === 'Abgeschlossen' || lead.status === 'converted' ? 'bg-green-500/10 border-green-500/20 text-green-400' : ''}
                                                ${lead.status === 'Fehler' || lead.status === 'rejected' ? 'bg-red-500/10 border-red-500/20 text-red-400' : ''}
                                            `}>
                                                {lead.status === 'new' ? 'Neu' : lead.status === 'processing' ? 'In Bearbeitung' : lead.status === 'converted' ? 'Konvertiert' : lead.status === 'rejected' ? 'Abgelehnt' : lead.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-2 rounded-lg bg-white/5 hover:bg-blue-500 hover:text-white text-gray-400 transition-colors tooltip-trigger relative">
                                                <i className="fa-solid fa-arrow-right"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Settings & Logs */}
                <div className="flex flex-col gap-6">
                    {/* API Settings Card */}
                    <div className="glass-panel rounded-2xl border border-white/5 p-6">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <i className="fa-solid fa-gear text-gray-400"></i>
                            API Einstellungen
                        </h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">API Key</label>
                                <div className="flex relative">
                                    <input 
                                        type="password" 
                                        value={maskedKey || "Kein API Key hinterlegt"}
                                        readOnly
                                        className="form-input text-sm font-mono w-full pr-10 bg-white/5 text-gray-400"
                                    />
                                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                                        <i className="fa-regular fa-copy"></i>
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Client ID</label>
                                <input 
                                    type="text" 
                                    value={clientId || 'Nicht konfiguriert'}
                                    readOnly
                                    className="form-input text-sm font-mono w-full bg-white/5 text-gray-400"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Webhook Secret (Optional)</label>
                                <input 
                                    type="password" 
                                    value={webhookSecret ? '********' : 'Nicht konfiguriert'}
                                    readOnly
                                    className="form-input text-sm font-mono w-full bg-white/5 text-gray-400"
                                />
                            </div>

                            <button onClick={openSettings} className="w-full btn-secondary mt-2">
                                Einstellungen bearbeiten
                            </button>
                        </div>
                    </div>

                    {/* Sync Logs */}
                    <div className="glass-panel rounded-2xl border border-white/5 p-6 flex-1 flex flex-col">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <i className="fa-solid fa-terminal text-gray-400"></i>
                            Letzte Aktivität
                        </h2>
                        
                        <div className="flex-1 overflow-y-auto space-y-3 text-sm pr-2">
                            <div className="flex items-start gap-3">
                                <i className="fa-solid fa-check-circle text-green-400 mt-0.5"></i>
                                <div>
                                    <p className="text-gray-300">Sync erfolgreich abgeschlossen</p>
                                    <p className="text-xs text-gray-500">Heute, 14:32</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <i className="fa-solid fa-download text-blue-400 mt-0.5"></i>
                                <div>
                                    <p className="text-gray-300">Lead REO-1031 importiert</p>
                                    <p className="text-xs text-gray-500">Heute, 12:15</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <i className="fa-solid fa-triangle-exclamation text-yellow-400 mt-0.5"></i>
                                <div>
                                    <p className="text-gray-300">Timeout bei Kundenabfrage</p>
                                    <p className="text-xs text-gray-500">Gestern, 09:45</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <i className="fa-solid fa-check-circle text-green-400 mt-0.5"></i>
                                <div>
                                    <p className="text-gray-300">Webhook registriert</p>
                                    <p className="text-xs text-gray-500">24.04.2026, 16:20</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Settings Modal */}
            {isSettingsOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}></div>
                    <div className="glass-panel p-6 rounded-2xl w-full max-w-md relative z-10 border border-white/10 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">API Einstellungen</h2>
                            <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-white">
                                <i className="fa-solid fa-xmark text-xl"></i>
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Reonic API Key</label>
                                <input 
                                    type="text" 
                                    placeholder={maskedKey ? "Neuen Key eingeben um zu überschreiben" : "eyJhbGciOiJIUzI1NiIsIn..."}
                                    value={newApiKey}
                                    onChange={(e) => setNewApiKey(e.target.value)}
                                    className="form-input w-full font-mono text-sm"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Generieren Sie den Key im Reonic Dashboard unter Einstellungen &gt; Integrationen.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Client ID</label>
                                <input 
                                    type="text" 
                                    placeholder="Ihre Reonic Client ID"
                                    value={newClientId}
                                    onChange={(e) => setNewClientId(e.target.value)}
                                    className="form-input w-full font-mono text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Webhook Secret (Optional)</label>
                                <input 
                                    type="text" 
                                    placeholder="Secret für Webhook Verifizierung"
                                    value={newWebhookSecret}
                                    onChange={(e) => setNewWebhookSecret(e.target.value)}
                                    className="form-input w-full font-mono text-sm"
                                />
                            </div>
                            
                            <div className="pt-4 border-t border-white/5 flex gap-3">
                                <button 
                                    onClick={() => setIsSettingsOpen(false)}
                                    className="btn-secondary flex-1"
                                >
                                    Abbrechen
                                </button>
                                <button 
                                    onClick={saveSettings}
                                    disabled={isSaving}
                                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                                >
                                    {isSaving ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-save"></i>}
                                    Speichern
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Lead Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)}></div>
                    <div className="glass-panel p-6 rounded-2xl w-full max-w-lg relative z-10 border border-white/10 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Neuen Lead an Reonic senden</h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-white">
                                <i className="fa-solid fa-xmark text-xl"></i>
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Vorname *</label>
                                    <input 
                                        type="text" 
                                        value={newLeadData.firstName}
                                        onChange={(e) => setNewLeadData({...newLeadData, firstName: e.target.value})}
                                        className="form-input w-full text-sm"
                                        placeholder="Max"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Nachname *</label>
                                    <input 
                                        type="text" 
                                        value={newLeadData.lastName}
                                        onChange={(e) => setNewLeadData({...newLeadData, lastName: e.target.value})}
                                        className="form-input w-full text-sm"
                                        placeholder="Mustermann"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">E-Mail</label>
                                    <input 
                                        type="email" 
                                        value={newLeadData.email}
                                        onChange={(e) => setNewLeadData({...newLeadData, email: e.target.value})}
                                        className="form-input w-full text-sm"
                                        placeholder="max@beispiel.de"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Telefon</label>
                                    <input 
                                        type="tel" 
                                        value={newLeadData.phone}
                                        onChange={(e) => setNewLeadData({...newLeadData, phone: e.target.value})}
                                        className="form-input w-full text-sm"
                                        placeholder="+49 123 456789"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Notiz</label>
                                <textarea 
                                    value={newLeadData.note}
                                    onChange={(e) => setNewLeadData({...newLeadData, note: e.target.value})}
                                    className="form-input w-full text-sm h-24 resize-none"
                                    placeholder="Interesse an PV Anlage..."
                                ></textarea>
                            </div>
                            
                            <div className="pt-4 border-t border-white/5 flex gap-3">
                                <button 
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="btn-secondary flex-1"
                                >
                                    Abbrechen
                                </button>
                                <button 
                                    onClick={async () => {
                                        if (!newLeadData.firstName || !newLeadData.lastName) {
                                            return alert('Bitte Vorname und Nachname eingeben');
                                        }
                                        setIsCreatingLead(true);
                                        try {
                                            const res = await api.post('/reonic/leads', newLeadData);
                                            if (res.data.success) {
                                                alert('Lead erfolgreich gesendet!');
                                                setIsCreateModalOpen(false);
                                                setNewLeadData({ firstName: '', lastName: '', email: '', phone: '', note: '' });
                                                // If webhook is active, it will auto-sync. Alternatively, we can call fetchLeads()
                                                fetchLeads();
                                            }
                                        } catch (error) {
                                            console.error(error);
                                            alert(error.response?.data?.message || 'Fehler beim Senden');
                                        } finally {
                                            setIsCreatingLead(false);
                                        }
                                    }}
                                    disabled={isCreatingLead || !newLeadData.firstName || !newLeadData.lastName}
                                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                                >
                                    {isCreatingLead ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
                                    An Reonic senden
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reonic;
