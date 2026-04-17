import { useState, useEffect } from 'react';
import api from '../../services/api';
import { usePhone } from '../../context/PhoneContext';
import { toast } from 'react-hot-toast';
import { useDispatch } from 'react-redux';
import { updateUser } from '../../store/slices/authSlice';

const PhoneSettingsPage = () => {
    const dispatch = useDispatch();
    const { reinitialize } = usePhone();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        sip_user: '',
        sip_password: '',
        sip_domain: '',
        wss_url: ''
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get('/phone/settings');
                if (res.data.status === 'success') {
                    setSettings(res.data.data);
                }
            } catch (error) {
                console.error('Error fetching telephony settings:', error);
                toast.error('Fehler beim Laden der Einstellungen');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.patch('/phone/settings', settings);
            dispatch(updateUser(settings));
            toast.success('Einstellungen erfolgreich gespeichert');
            // Re-initialize phone connection with new settings
            reinitialize();
        } catch (error) {
            console.error('Error saving telephony settings:', error);
            toast.error('Fehler beim Speichern');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-10 text-center text-gray-400">Wird geladen...</div>;
    }

    return (
        <div className="animate-[fadeIn_0.4s_ease-out_forwards] max-w-2xl mx-auto">
            <div className="mb-8 text-center">
                <div className="w-16 h-16 bg-blue-600/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20 shadow-lg shadow-blue-900/10">
                    <i className="fa-solid fa-gears text-2xl"></i>
                </div>
                <h2 className="text-2xl font-bold text-white">Telefon-Einstellungen</h2>
                <p className="text-gray-400 text-sm mt-1">Konfigurieren Sie Ihre VoIP-Zugangsdaten für O2 Business.</p>
            </div>

            <div className="glass-card p-8 rounded-3xl border border-white/10 shadow-2xl bg-black/20 backdrop-blur-md">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">SIP Benutzer / Nummer</label>
                            <div className="relative">
                                <i className="fa-solid fa-user absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                <input
                                    type="text"
                                    value={settings.sip_user}
                                    onChange={(e) => setSettings({ ...settings, sip_user: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                    placeholder="e.g. 4912345678"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">SIP Passwort</label>
                            <div className="relative">
                                <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                <input
                                    type="password"
                                    value={settings.sip_password}
                                    onChange={(e) => setSettings({ ...settings, sip_password: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">SIP Server / Domain</label>
                        <div className="relative">
                            <i className="fa-solid fa-server absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
                            <input
                                type="text"
                                value={settings.sip_domain}
                                onChange={(e) => setSettings({ ...settings, sip_domain: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                placeholder="e.g. o2-digitalphone.de"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">WSS Proxy URL</label>
                        <div className="relative">
                            <i className="fa-solid fa-bolt absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
                            <input
                                type="text"
                                value={settings.wss_url}
                                onChange={(e) => setSettings({ ...settings, wss_url: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                placeholder="wss://webrtc-gateway.o2.de"
                                required
                            />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2 px-1">
                            Die WebSocket Secure-URL für die WebRTC-Verbindung.
                        </p>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {saving ? (
                                <i className="fa-solid fa-spinner fa-spin"></i>
                            ) : (
                                <i className="fa-solid fa-floppy-disk"></i>
                            )}
                            {saving ? 'Wird gespeichert...' : 'Konfiguration Speichern'}
                        </button>
                    </div>
                </form>

                <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex gap-4">
                    <i className="fa-solid fa-circle-info text-yellow-500 mt-1"></i>
                    <p className="text-xs text-yellow-200/70 leading-relaxed">
                        Nach dem Speichern wird die Telefonverbindung automatisch neu aufgebaut. Stellen Sie sicher, dass Ihre Daten korrekt sind, um Erreichbarkeit zu garantieren.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PhoneSettingsPage;
