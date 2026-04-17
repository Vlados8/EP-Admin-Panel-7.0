import React from 'react';

const TelephonyInstructionsPage = () => {
    return (
        <div className="p-8 max-w-5xl mx-auto">
            <header className="mb-12">
                <h1 className="text-4xl font-extrabold text-white mb-4 tracking-tight">IP System • O2 Digital Phone</h1>
                <p className="text-gray-400 text-lg leading-relaxed max-w-3xl">
                    Hier finden Sie die Anleitung zur Einrichtung und Integration Ihrer O2 Business Telefonanlage in das Admin-Panel. 
                    Folgen Sie diesen Schritten, um WebRTC-Anrufe und automatisches Logging zu aktivieren.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                {/* Section 1: Credentials */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl hover:bg-white/[0.07] transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-6 border border-blue-500/20 text-xl">
                        <i className="fa-solid fa-key"></i>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-4">1. SIP Zugangsdaten</h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6">
                        Diese Daten erhalten Sie direkt aus Ihrem O2 Business Portal. Sie sind für jeden Mitarbeiter individuell.
                    </p>
                    <ul className="space-y-3">
                        <li className="flex items-center gap-3 text-sm text-gray-300">
                            <i className="fa-solid fa-check text-blue-400 text-[10px]"></i>
                            <strong>SIP User:</strong> Ihre Durchwahl (z.B. 100)
                        </li>
                        <li className="flex items-center gap-3 text-sm text-gray-300">
                            <i className="fa-solid fa-check text-blue-400 text-[10px]"></i>
                            <strong>Passwort:</strong> Ihr SIP-Passwort
                        </li>
                        <li className="flex items-center gap-3 text-sm text-gray-300">
                            <i className="fa-solid fa-check text-blue-400 text-[10px]"></i>
                            <strong>Domain:</strong> o2-business-server.com
                        </li>
                    </ul>
                </div>

                {/* Section 2: Technical Config */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl hover:bg-white/[0.07] transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-6 border border-purple-500/20 text-xl">
                        <i className="fa-solid fa-server"></i>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-4">2. Technische Anbindung</h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6">
                        Die WebRTC-Verbindung benötigt einen WebSocket-Proxy (WSS), um sicher durch den Browser zu kommunizieren.
                    </p>
                    <div className="bg-black/40 border border-white/10 rounded-xl p-4 font-mono text-xs text-blue-300">
                        WSS URL: wss://webrtc-proxy.o2.de:443
                    </div>
                </div>
            </div>

            {/* Inbound vs Outbound Section */}
            <div className="bg-gradient-to-br from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-3xl p-10 mb-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 text-9xl">
                    <i className="fa-solid fa-phone-volume"></i>
                </div>
                <div className="relative z-10">
                    <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                        <i className="fa-solid fa-circle-info text-blue-400"></i>
                        Inbound vs. Outbound
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div>
                            <h4 className="text-emerald-400 font-bold mb-2 uppercase tracking-widest text-xs">Ausgehende Anrufe</h4>
                            <p className="text-gray-300 text-sm leading-relaxed">
                                Diese erfolgen direkt über das Admin-Panel. Klicken Sie auf das Telefon-Icon bei einem Kunden, und das WebRTC-Modul startet den Ruf.
                            </p>
                        </div>
                        <div>
                            <h4 className="text-amber-400 font-bold mb-2 uppercase tracking-widest text-xs">Eingehende Anrufe</h4>
                            <p className="text-gray-300 text-sm leading-relaxed">
                                Eingehende Rufe werden im Browser **ignoriert**. Nutzen Sie hierfür Ihr physisches IP-Telefon oder die O2 Mobile App.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Webhook Section */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                    <i className="fa-solid fa-hook text-gray-400"></i>
                    Webhook & Logging
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-8">
                    Damit Anrufe automatisch im System protokolliert werden, muss der Webhook im O2 Portal hinterlegt werden.
                </p>
                <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Webhook URL</label>
                        <div className="bg-black/40 border border-white/10 rounded-xl p-3 font-mono text-sm text-gray-300 flex justify-between items-center">
                            <span>https://ihre-admin-url.de/api/v1/phone/webhook</span>
                            <i className="fa-regular fa-copy cursor-pointer hover:text-white transition-colors"></i>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500">API Token (Header: x-api-token)</label>
                        <div className="bg-black/40 border border-white/10 rounded-xl p-3 font-mono text-sm text-blue-400/70 border-dashed">
                            {'{TELEPHONY_W_TOKEN from environment}'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TelephonyInstructionsPage;
