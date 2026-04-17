import React, { useState, useEffect } from 'react';
import { usePhone } from '../../context/PhoneContext';
import api from '../../services/api';

const InboundCallModal = () => {
    const { incomingCall, answerCall, rejectCall } = usePhone();
    const [customerName, setCustomerName] = useState(null);
    const [staff, setStaff] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState('');
    const [isTransferring, setIsTransferring] = useState(false);

    useEffect(() => {
        if (incomingCall) {
            // Try to resolve customer name
            api.get(`/clients/search?query=${incomingCall.remoteNumber}`)
                .then(res => {
                    if (res.data.status === 'success' && res.data.data.clients?.length > 0) {
                        setCustomerName(res.data.data.clients[0].name);
                    }
                })
                .catch(err => console.error('Failed to resolve customer:', err));

            // Fetch staff for transfer list
            api.get('/users')
                .then(res => {
                    if (res.data.status === 'success') {
                        setStaff(res.data.data.users.filter(u => u.mobile_phone));
                    }
                })
                .catch(err => console.error('Failed to fetch staff:', err));
        } else {
            setCustomerName(null);
            setSelectedStaff('');
            setIsTransferring(false);
        }
    }, [incomingCall]);

    const handleTransfer = async () => {
        if (!selectedStaff) return;
        setIsTransferring(true);
        try {
            await api.post('/phone/transfer', {
                target_user_id: selectedStaff,
                call_id: incomingCall.session.id // Simplified
            });
            rejectCall(); // End local session after transfer
        } catch (err) {
            console.error('Transfer failed:', err);
            setIsTransferring(false);
        }
    };

    if (!incomingCall) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="glass-card w-full max-w-md rounded-[2.5rem] overflow-hidden border border-white/20 shadow-2xl bg-slate-900/80 p-8 text-center animate-in zoom-in-95 duration-300">
                
                {/* Visual Ringing Indicator */}
                <div className="relative w-24 h-24 mx-auto mb-8">
                    <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping"></div>
                    <div className="relative w-full h-full bg-gradient-to-tr from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white/20">
                        <i className="fa-solid fa-phone-volume text-3xl text-white animate-bounce-slow"></i>
                    </div>
                </div>

                <div className="space-y-4 mb-10">
                    <h3 className="text-[10px] uppercase tracking-[0.2em] font-black text-blue-400">Eingehender Anruf</h3>
                    <div>
                        <p className="text-3xl font-bold text-white tracking-tight leading-none mb-2">
                            {customerName || 'Unbekannter Anrufer'}
                        </p>
                        <p className="text-gray-400 font-mono text-sm tracking-widest bg-white/5 inline-block py-1 px-3 rounded-full border border-white/10 mt-2">
                            {incomingCall.remoteNumber}
                        </p>
                    </div>
                </div>

                {/* Transfer Section */}
                {!isTransferring && (
                    <div className="mb-10 text-left bg-white/5 border border-white/10 rounded-2xl p-4">
                        <label className="block text-[10px] uppercase font-bold text-gray-400 mb-2 pl-1">Gespräch weiterleiten</label>
                        <div className="flex gap-2">
                            <select 
                                value={selectedStaff}
                                onChange={(e) => setSelectedStaff(e.target.value)}
                                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                            >
                                <option value="">Mitarbeiter wählen...</option>
                                {staff.map(u => (
                                    <option key={u.id} value={u.id}>{u.name} ({u.mobile_phone})</option>
                                ))}
                            </select>
                            <button 
                                onClick={handleTransfer}
                                disabled={!selectedStaff}
                                className="px-3 py-2 bg-white/10 hover:bg-blue-600 disabled:opacity-30 disabled:hover:bg-white/10 text-white rounded-xl transition-all"
                                title="Weiterleiten"
                            >
                                <i className="fa-solid fa-share-from-square"></i>
                            </button>
                        </div>
                    </div>
                )}

                {isTransferring && (
                    <div className="mb-10 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center gap-3 text-blue-400 text-sm italic animate-pulse">
                        <i className="fa-solid fa-spinner fa-spin"></i>
                        Wird weitergeleitet...
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={rejectCall}
                        className="group relative h-14 rounded-2xl bg-red-500/10 border border-red-500/20 hover:bg-red-500 transition-all duration-300"
                    >
                        <div className="flex items-center justify-center gap-2 text-red-500 group-hover:text-white font-bold">
                            <i className="fa-solid fa-phone-slash text-lg"></i>
                            <span>Ablehnen</span>
                        </div>
                    </button>
                    <button 
                        onClick={answerCall}
                        className="group relative h-14 rounded-2xl bg-green-500 hover:bg-green-400 border border-green-400/50 transition-all duration-300 shadow-[0_4px_20px_rgba(34,197,94,0.4)]"
                    >
                        <div className="flex items-center justify-center gap-2 text-white font-bold">
                            <i className="fa-solid fa-phone text-lg animate-pulse"></i>
                            <span>Annehmen</span>
                        </div>
                    </button>
                </div>
            </div>

            <style jsx>{`
                .animate-bounce-slow {
                    animation: bounce-slow 2s infinite ease-in-out;
                }
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0) rotate(0); }
                    50% { transform: translateY(-5px) rotate(5deg); }
                }
            `}</style>
        </div>
    );
};

export default InboundCallModal;
