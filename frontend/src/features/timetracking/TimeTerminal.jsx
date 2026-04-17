import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../../services/api';

const TimeTerminal = () => {
    const [pin, setPin] = useState('');
    const [status, setStatus] = useState('idle'); // idle, clocking_in, clocking_out, success, error
    const [message, setMessage] = useState('');
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        fetchProjects();
        return () => clearInterval(timer);
    }, []);

    const fetchProjects = async () => {
        try {
            const res = await api.get('/projects');
            setProjects(res.data.data.projects || []);
        } catch (err) {
            console.error('Error fetching projects:', err);
        }
    };

    const handleNumberClick = (num) => {
        if (pin.length < 6) {
            setPin(prev => prev + num);
        }
    };

    const handleClear = () => setPin('');

    const handleClockAction = async (action) => {
        if (!pin) {
            setMessage('Пожалуйста, введите PIN');
            setStatus('error');
            setTimeout(() => setStatus('idle'), 3000);
            return;
        }

        if (action === 'in') {
            setSearchTerm('');
            setShowProjectModal(true);
        } else {
            submitAction('out');
        }
    };

    const submitAction = async (action, projectId = null) => {
        setStatus(action === 'in' ? 'clocking_in' : 'clocking_out');
        try {
            const endpoint = action === 'in' ? '/time-tracking/check-in' : '/time-tracking/check-out';
            const payload = { pin };
            if (projectId) payload.project_id = projectId;

            const res = await api.post(endpoint, payload);
            
            setMessage(res.data.message);
            setStatus('success');
            setPin('');
            setShowProjectModal(false);
            setSelectedProject(null);

            // Hide success message after 3 seconds
            setTimeout(() => setStatus('idle'), 3000);
        } catch (err) {
            setMessage(err.response?.data?.message || 'Ошибка сервера');
            setStatus('error');
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    const KeypadButton = ({ val, onClick, className = "" }) => (
        <button
            onClick={() => onClick(val)}
            className={`w-20 h-20 rounded-2xl bg-white/5 border border-white/10 text-2xl font-bold hover:bg-white/10 active:scale-95 transition-all ${className}`}
        >
            {val}
        </button>
    );

    const filteredProjects = projects.filter(p => 
        p.project_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.title?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="z-10 w-full max-w-md flex flex-col items-center gap-8">
                {/* Clock & Header */}
                <div className="text-center">
                    <h2 className="text-5xl font-mono font-bold tracking-tighter text-white mb-2">
                        {currentTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </h2>
                    <p className="text-blue-400 font-semibold tracking-widest uppercase text-sm">
                        {currentTime.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
                    </p>
                </div>

                {/* PIN Display */}
                <div className="flex gap-4 h-16 items-center">
                    {[0, 1, 2, 3, 4, 5].map(i => (
                        <div 
                            key={i} 
                            className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${pin.length > i ? 'bg-blue-500 border-blue-400 scale-125 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'border-white/20'}`}
                        ></div>
                    ))}
                </div>

                {/* Status Message Overlay */}
                {status === 'success' || status === 'error' ? (
                    <div className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300 ${status === 'success' ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-red-500/20 border-red-500/40 text-red-400'}`}>
                        <i className={`fa-solid ${status === 'success' ? 'fa-circle-check text-4xl' : 'fa-circle-exclamation text-4xl'}`}></i>
                        <div className="text-center">
                            <p className="text-xl font-bold uppercase tracking-wide">{status === 'success' ? 'Erfolg!' : 'Fehler!'}</p>
                            <p className="text-sm opacity-80">{message}</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Keypad */}
                        <div className="grid grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                <KeypadButton key={num} val={num} onClick={handleNumberClick} />
                            ))}
                            <button onClick={handleClear} className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xl font-bold hover:bg-red-500/20 active:scale-95 transition-all">
                                C
                            </button>
                            <KeypadButton val={0} onClick={handleNumberClick} />
                            <div className="w-20 h-20"></div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-4 w-full px-4 mt-4">
                            <button
                                onClick={() => handleClockAction('in')}
                                disabled={status !== 'idle'}
                                className="flex-1 h-20 rounded-3xl bg-green-500 text-black font-black text-xl tracking-widest uppercase hover:bg-green-400 active:scale-95 transition-all shadow-xl shadow-green-500/20"
                            >
                                <i className="fa-solid fa-arrow-right-to-bracket mr-3"></i>
                                KOMMEN
                            </button>
                            <button
                                onClick={() => handleClockAction('out')}
                                disabled={status !== 'idle'}
                                className="flex-1 h-20 rounded-3xl bg-white/10 border border-white/10 text-white font-black text-xl tracking-widest uppercase hover:bg-white/20 active:scale-95 transition-all"
                            >
                                <i className="fa-solid fa-arrow-right-from-bracket mr-3"></i>
                                GEHEN
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Project Selection Modal */}
            {showProjectModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowProjectModal(false)}></div>
                    <div className="glass-panel w-full max-w-lg rounded-3xl flex flex-col max-h-[90vh] relative animate-in fade-in zoom-in duration-300 overflow-hidden">
                        <div className="p-6 border-b border-white/10">
                            <h3 className="text-2xl font-bold text-white uppercase tracking-widest text-center mb-4">Baustelle wählen</h3>
                            
                            {/* Search Input */}
                            <div className="relative">
                                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-white/40"></i>
                                <input 
                                    type="text"
                                    placeholder="Projektnummer oder Name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 text-white focus:outline-none focus:border-blue-500/50 transition-all"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
                            {/* General Option */}
                            {!searchTerm && (
                                <button
                                    onClick={() => submitAction('in', null)}
                                    className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left flex items-center justify-between group"
                                >
                                    <div>
                                        <p className="font-bold text-white tracking-wide uppercase">Allgemein</p>
                                        <p className="text-xs text-gray-500">Ohne Projekt</p>
                                    </div>
                                    <i className="fa-solid fa-chevron-right opacity-0 group-hover:opacity-100 transition-opacity"></i>
                                </button>
                            )}

                            {/* Active Projects */}
                            {filteredProjects.map(project => (
                                <button
                                    key={project.id}
                                    onClick={() => submitAction('in', project.id)}
                                    className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-blue-500/20 hover:border-blue-500/40 transition-all text-left flex items-center justify-between group"
                                >
                                    <div className="flex flex-col gap-1">
                                        <p className="text-blue-400 font-mono font-bold tracking-wider text-lg">
                                            {project.project_number}
                                        </p>
                                        <p className="font-bold text-white tracking-wide uppercase">
                                            {project.title}
                                        </p>
                                    </div>
                                    <i className="fa-solid fa-chevron-right opacity-0 group-hover:opacity-100 transition-opacity text-blue-400"></i>
                                </button>
                            ))}

                            {filteredProjects.length === 0 && (
                                <div className="p-10 text-center text-gray-500 flex flex-col items-center gap-4">
                                    <i className="fa-solid fa-folder-open text-4xl opacity-20"></i>
                                    <p>Keine Projekte gefunden</p>
                                </div>
                            )}
                        </div>
                        <button 
                            onClick={() => setShowProjectModal(false)}
                            className="p-6 bg-white/5 hover:bg-white/10 text-gray-400 uppercase tracking-widest font-bold text-xs"
                        >
                            Abbrechen
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimeTerminal;
