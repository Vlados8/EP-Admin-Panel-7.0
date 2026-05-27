import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

const channels = [
    { 
        type: 'email', 
        name: 'E-Mails erhalten', 
        desc: 'Benachrichtigung bei neuen eingehenden E-Mails auf Ihren Konten.', 
        icon: 'fa-regular fa-envelope' 
    },
    { 
        type: 'chat', 
        name: 'Chat-Nachrichten', 
        desc: 'Benachrichtigung bei neuen Direktnachrichten oder Gruppen-Nachrichten.', 
        icon: 'fa-regular fa-comments' 
    },
    { 
        type: 'note', 
        name: 'Bautagebuch (Notizen)', 
        desc: 'Geplante Bautagebuch-Erinnerungen für eingetragene Notizen anfordern.', 
        icon: 'fa-regular fa-file-lines' 
    },
    { 
        type: 'task', 
        name: 'Aufgaben-Zuweisung & Fälligkeit', 
        desc: 'Mitteilung bei Zuweisung neuer Aufgaben sowie fälligen Fristen erhalten.', 
        icon: 'fa-regular fa-circle-check' 
    },
    { 
        type: 'call', 
        name: 'Telefonate & Anrufe', 
        desc: 'Push-Benachrichtigung bei eingehenden Audio- und Videogesprächen.', 
        icon: 'fa-solid fa-phone' 
    }
];

const NotificationSettings = () => {
    const [toggles, setToggles] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await api.get('/notifications/settings');
            const dbSettings = response.data.data.settings || [];
            
            // Build key-value map with default enabled = true
            const initialMap = {};
            channels.forEach(ch => {
                const match = dbSettings.find(s => s.type === ch.type);
                initialMap[ch.type] = match ? match.enabled : true;
            });
            
            setToggles(initialMap);
        } catch (error) {
            console.error('Failed to load notification settings:', error);
            toast.error('Fehler beim Laden der Benachrichtigungseinstellungen');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (type) => {
        const nextValue = !toggles[type];
        
        // Optimistic UI update
        setToggles(prev => ({ ...prev, [type]: nextValue }));

        try {
            await api.post('/notifications/settings', { type, enabled: nextValue });
            toast.success('Mitteilungskanal aktualisiert');
        } catch (error) {
            console.error('Failed to save setting:', error);
            toast.error('Änderung konnte nicht gespeichert werden');
            // Revert state
            setToggles(prev => ({ ...prev, [type]: !nextValue }));
        }
    };

    return (
        <div className="animate-[fadeIn_0.4s_ease-out_forwards] p-6 max-w-4xl mx-auto">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 text-blue-400">
                        <i className="fa-regular fa-bell"></i>
                    </div>
                    Benachrichtigungseinstellungen
                </h2>
                <p className="text-gray-400 text-sm mt-2">
                    Legen Sie hier fest, über welche Ereignisse Sie im Admin-Panel (Web) sowie auf Ihrem Smartphone (Mobile) informiert werden möchten.
                </p>
            </div>

            <div className="glass-card rounded-2xl border border-white/10 overflow-hidden divide-y divide-white/5 bg-white/5 backdrop-blur-md">
                {loading ? (
                    <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
                        <i className="fa-solid fa-circle-notch animate-spin text-2xl text-blue-500"></i>
                        <span>Einstellungen werden geladen...</span>
                    </div>
                ) : (
                    channels.map((ch) => (
                        <div key={ch.type} className="p-6 flex items-center justify-between gap-6 hover:bg-white/[0.02] transition-colors">
                            <div className="flex gap-4">
                                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 text-lg shrink-0">
                                    <i className={ch.icon}></i>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white text-base">{ch.name}</h3>
                                    <p className="text-gray-400 text-xs mt-1 leading-relaxed max-w-lg">{ch.desc}</p>
                                </div>
                            </div>

                            <button 
                                onClick={() => handleToggle(ch.type)}
                                className={`w-14 h-7 rounded-full relative transition-all duration-300 shrink-0 ${
                                    toggles[ch.type] ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)]' : 'bg-white/10 border border-white/10'
                                }`}
                            >
                                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all duration-300 shadow-md ${
                                    toggles[ch.type] ? 'left-8' : 'left-1'
                                }`}></div>
                            </button>
                        </div>
                    ))
                )}
            </div>

            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex gap-3 text-sm text-blue-300">
                <i className="fa-solid fa-mobile-screen-button text-blue-400 text-lg mt-0.5"></i>
                <p className="leading-relaxed">
                    <strong>Hinweis zur mobilen Nutzung:</strong> Diese Einstellungen steuern auch Ihre nativen Smartphone-Mitteilungen. Um Benachrichtigungen auf Ihrem Handy zu empfangen, stellen Sie bitte sicher, dass Sie den Push-Empfang in der Empire Premium Mobile App aktiviert haben.
                </p>
            </div>
        </div>
    );
};

export default NotificationSettings;
