import React, { useState } from 'react';
import { usePhone } from '../../context/PhoneContext';
import api from '../../services/api';

const PhoneWidget = () => {
    const { status, callState, remoteNumber, hangup, isMuted, toggleMute, timer } = usePhone();
    const [isMinimized, setIsMinimized] = useState(false);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (status === 'Disconnected' && callState === 'idle') return null;

    // Show widget automatically if a call starts
    if ((callState === 'calling' || callState === 'active') && isMinimized) {
        setIsMinimized(false);
    }

    return (
        <div 
            className={`fixed bottom-6 right-6 z-[2000] transition-all duration-500 ease-in-out ${
                isMinimized ? 'w-16 h-16 rounded-2xl' : 'w-72 rounded-3xl'
            } bg-[#00509a]/90 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden`}
        >
            {isMinimized ? (
                <button 
                    onClick={() => setIsMinimized(false)}
                    className="w-full h-full flex items-center justify-center text-white relative"
                >
                    <i className={`fa-solid ${callState === 'active' ? 'fa-phone-volume animate-pulse' : 'fa-phone'} text-xl`}></i>
                    {callState === 'active' && (
                        <span className="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full border-2 border-[#00509a]"></span>
                    )}
                </button>
            ) : (
                <>
                    {/* Header */}
                    <div className="bg-[#003a70] p-4 flex items-center justify-between border-b border-white/10">
                        <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${status === 'Connected' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">O2 Business Call</span>
                        </div>
                        <button 
                            onClick={() => setIsMinimized(true)}
                            className="text-white/40 hover:text-white transition-colors"
                        >
                            <i className="fa-solid fa-minus"></i>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 flex flex-col items-center gap-4">
                        <div className="text-center">
                            <p className="text-white/60 text-[10px] uppercase tracking-widest mb-1">
                                {callState === 'calling' ? 'Wählt...' : callState === 'active' ? 'Im Gespräch' : 'Bereit'}
                            </p>
                            <p className="text-white text-xl font-bold tracking-tight">
                                {remoteNumber || 'Unbekannt'}
                            </p>
                            {callState === 'active' && (
                                <p className="text-emerald-400 text-sm font-mono mt-1">
                                    {formatTime(timer)}
                                </p>
                            )}
                        </div>

                        {/* Controls */}
                        <div className="flex flex-col gap-4 w-full px-2">
                            <div className="flex items-center justify-center gap-4">
                                <button
                                    onClick={toggleMute}
                                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all border ${
                                        isMuted ? 'bg-red-500/20 text-red-500 border-red-500/50' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                                    }`}
                                >
                                    <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                                </button>

                                <button
                                    onClick={hangup}
                                    className="w-14 h-14 rounded-2xl bg-red-600 text-white shadow-lg shadow-red-600/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                                >
                                    <i className="fa-solid fa-phone-slash rotate-[135deg]"></i>
                                </button>
                            </div>

                            {/* Active Call Transfer */}
                            {callState === 'active' && (
                                <div className="mt-2 pt-4 border-t border-white/10">
                                    <p className="text-[9px] uppercase font-black text-white/40 mb-2 pl-1 tracking-widest text-center">Transferieren</p>
                                    <div className="flex gap-2">
                                        <select 
                                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-[10px] text-white focus:outline-none focus:border-blue-500/50"
                                            onChange={async (e) => {
                                                const val = e.target.value;
                                                if (!val) return;
                                                // Handle instant transfer
                                                try {
                                                    await api.post('/phone/transfer', { target_user_id: val });
                                                    hangup();
                                                } catch (err) {
                                                    console.error('Transfer failed');
                                                }
                                            }}
                                        >
                                            <option value="">Wählen...</option>
                                            {/* We should ideally pass staff list via context here or fetch it */}
                                            {/* For now, this is a simplified placeholder as per prompt */}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default PhoneWidget;
