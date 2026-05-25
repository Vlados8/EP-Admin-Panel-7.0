import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useSelector } from 'react-redux';

const Offers = () => {
    const navigate = useNavigate();
    const { user } = useSelector(state => state.auth);
    const isWorker = user?.role?.name === 'Worker' || user?.role === 'Worker';
    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchOffers = async () => {
            try {
                // For now, we fetch projects with status 'angebot'
                const res = await api.get('/projects?status=angebot');
                if (res.data?.status === 'success') {
                    setOffers(res.data.data.projects);
                }
            } catch (error) {
                console.error('Error fetching offers:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchOffers();
    }, []);

    const getStatusStyle = (status) => {
        switch (status?.toLowerCase()) {
            case 'angebot': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
            case 'aktiv': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
            default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
        }
    };

    const filteredOffers = offers.filter(offer => 
        offer.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        offer.project_number?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="animate-[fadeIn_0.3s_ease-out] flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Angebote</h2>
                    <p className="text-gray-400 text-sm mt-1">Verwalten und erstellen Sie Ihre Angebote</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input
                            type="text"
                            placeholder="Angebote suchen..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-black/20 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all w-full md:w-64 backdrop-blur-sm"
                        />
                    </div>
                    {!isWorker && (
                        <button
                            onClick={() => navigate('/angebote/neu')}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_25px_rgba(37,99,235,0.6)] hover:-translate-y-0.5 flex items-center gap-2 text-sm font-medium whitespace-nowrap active:scale-95"
                        >
                            <i className="fa-solid fa-plus mr-1"></i> Neues Angebot
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
            ) : filteredOffers.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center glass-panel rounded-3xl border-dashed border-white/10 p-12">
                    <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-4 text-gray-500 text-3xl">
                        <i className="fa-solid fa-file-invoice-dollar opacity-30"></i>
                    </div>
                    <p className="text-gray-400 text-lg font-medium">Keine Angebote gefunden</p>
                    {!isWorker && (
                        <button 
                            onClick={() => navigate('/angebote/neu')}
                            className="mt-4 text-blue-400 hover:text-blue-300 transition-colors font-medium border-b border-blue-400/20"
                        >
                            Erstes Angebot erstellen
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto pr-2 custom-scrollbar">
                    {filteredOffers.map((offer) => (
                        <div
                            key={offer.id}
                            onClick={() => navigate(`/projekte/${offer.id}`)}
                            className="glass-card p-6 rounded-3xl cursor-pointer relative overflow-hidden group"
                        >
                            {/* Decorative background glow */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-all"></div>
                            
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-400/80 bg-blue-400/5 px-2 py-1 rounded-md border border-blue-400/10">
                                        {offer.project_number}
                                    </span>
                                    <span className={`text-[10px] px-2 py-1 rounded-md border font-bold uppercase tracking-tighter ${getStatusStyle(offer.status)}`}>
                                        {offer.status}
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-300 transition-colors line-clamp-1">
                                    {offer.title}
                                </h3>
                                {offer.client && (
                                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
                                        <i className="fa-solid fa-user-tie text-xs opacity-50"></i>
                                        <span className="truncate">{offer.client.company_name || offer.client.name}</span>
                                    </div>
                                )}
                                
                                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Budget</span>
                                        <span className="text-white font-mono font-bold">
                                            {new Number(offer.budget || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                        </span>
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-white group-hover:bg-blue-600 transition-all shadow-lg active:scale-90">
                                        <i className="fa-solid fa-arrow-right"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Offers;
