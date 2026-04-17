import React, { useState } from 'react';
import { usePhone } from '../../context/PhoneContext';

const PhonePage = () => {
    const { status, callState, remoteNumber, makeCall, hangup } = usePhone();
    const [number, setNumber] = useState('');

    const handleNumberClick = (num) => {
        setNumber(prev => prev + num);
    };

    const handleClear = () => {
        setNumber('');
    };

    const handleBackspace = () => {
        setNumber(prev => prev.slice(0, -1));
    };

    const handleCall = () => {
        if (number) {
            makeCall(number);
        }
    };

    const buttons = [
        '1', '2', '3',
        '4', '5', '6',
        '7', '8', '9',
        '*', '0', '#'
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto">
            <div className="glass-panel w-full p-8 rounded-3xl flex flex-col gap-6">
                {/* Header / Status */}
                <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${status === 'Connected' ? 'bg-green-500' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}></div>
                        <span className="text-xs font-semibold uppercase tracking-widest text-white/60">{status}</span>
                    </div>
                    <h1 className="text-4xl font-light tracking-tight text-white mb-2">Telefon</h1>
                </div>

                {/* Number Display */}
                <div className="relative">
                    <input
                        type="text"
                        value={number}
                        readOnly
                        placeholder="Nummer eingeben..."
                        className="w-full bg-black/30 border border-white/10 rounded-2xl py-6 px-10 text-3xl text-center text-white focus:outline-none focus:border-blue-500/50 transition-all font-light"
                    />
                    {number && (
                        <button 
                            onClick={handleBackspace}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                        >
                            <i className="fa-solid fa-backspace text-xl"></i>
                        </button>
                    )}
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-4">
                    {buttons.map(btn => (
                        <button
                            key={btn}
                            onClick={() => handleNumberClick(btn)}
                            className="w-full aspect-square rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl font-light text-white hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all"
                        >
                            {btn}
                        </button>
                    ))}
                </div>

                {/* Call Controls */}
                <div className="flex justify-center mt-4">
                    {callState === 'idle' || callState === 'ended' ? (
                        <button
                            onClick={handleCall}
                            disabled={!number || status !== 'Connected'}
                            className="w-20 h-20 rounded-full bg-green-500 text-white shadow-2xl shadow-green-500/40 flex items-center justify-center hover:scale-110 active:scale-90 transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100"
                        >
                            <i className="fa-solid fa-phone text-2xl"></i>
                        </button>
                    ) : (
                        <button
                            onClick={hangup}
                            className="w-20 h-20 rounded-full bg-red-600 text-white shadow-2xl shadow-red-600/40 flex items-center justify-center hover:scale-110 active:scale-90 transition-all"
                        >
                            <i className="fa-solid fa-phone-slash text-2xl rotate-[135deg]"></i>
                        </button>
                    )}
                </div>

                {/* Active Call Status */}
                {(callState === 'calling' || callState === 'active') && (
                    <div className="text-center animate-pulse">
                        <p className="text-blue-400 font-medium">
                            {callState === 'calling' ? 'Wählt...' : 'Im Gespräch'}
                        </p>
                        <p className="text-white/60 text-sm mt-1">{remoteNumber}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PhonePage;
