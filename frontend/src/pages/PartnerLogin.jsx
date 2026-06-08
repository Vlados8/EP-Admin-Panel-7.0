import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginPartner, clearError } from '../store/slices/authSlice';
import { useCompany } from '../context/CompanyContext';

const PartnerLogin = () => {
    const { companyData, getAssetUrl } = useCompany();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { isLoading, error, isAuthenticated } = useSelector((state) => state.auth);

    const bgUrl = companyData?.settings?.adminBackground 
        ? getAssetUrl(companyData.settings.adminBackground) 
        : '/images/glass_bg.png';

    const backgroundStyle = {
        backgroundImage: `linear-gradient(to bottom, rgba(10, 10, 12, 0.8), rgba(3, 3, 5, 0.9)), url('${bgUrl}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
    };

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/projekte');
        }
        return () => {
            dispatch(clearError());
        };
    }, [isAuthenticated, navigate, dispatch]);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (email && password) {
            dispatch(loginPartner({ email, password }));
        }
    };

    return (
        <div 
            style={backgroundStyle}
            className="h-screen w-screen flex items-center justify-center p-4"
        >
            <div className="glass-panel w-full max-w-md p-8 rounded-3xl animate-[fadeIn_0.5s_ease-out_forwards]">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 mx-auto rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 mb-4 shadow-[0_0_40px_rgba(255,255,255,0.05)] overflow-hidden p-2">
                        {companyData?.settings?.logoLargeWhite || companyData?.settings?.logoLarge ? (
                            <img 
                                src={getAssetUrl(companyData?.settings?.logoLargeWhite || companyData?.settings?.logoLarge)} 
                                alt="Logo" 
                                className="w-full h-full object-contain" 
                            />
                        ) : (
                            <img src="/assets/Logo EP white.png" alt="Empire Premium Bau Logo" className="w-full h-full object-contain" />
                        )}
                    </div>
                    <h1 className="text-3xl font-bold tracking-tighter text-white"> 
                        {companyData?.settings?.logoUpperText || companyData?.name?.split(' ')[0] || 'Empire'}
                        <span className="text-blue-400 ml-2">
                            {companyData?.settings?.logoLowerText || companyData?.name?.split(' ').slice(1).join(' ') || 'Premium Bau'}
                        </span>
                    </h1>
                    <p className="text-purple-400 mt-2 font-bold text-sm tracking-wider uppercase text-center flex items-center justify-center gap-1.5">
                        <i className="fa-solid fa-handshake"></i>
                        Partner Portal
                    </p>
                </div>

                <form onSubmit={handleLogin} className="flex flex-col gap-5">
                    {error && (
                        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl text-sm flex items-center gap-3 animate-[pulse_2s_ease-in-out_infinite]">
                            <i className="fa-solid fa-circle-exclamation"></i>
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <label className="text-sm text-slate-300 font-medium px-1">Partner E-Mail</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                                <i className="fa-solid fa-envelope"></i>
                            </div>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="glass-input w-full pl-11 pr-4 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                placeholder="partner@firma.de"
                                required
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm text-slate-300 font-medium px-1">Passwort</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                                <i className="fa-solid fa-lock"></i>
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="glass-input w-full pl-11 pr-4 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="mt-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3.5 px-4 rounded-xl transition-all shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_25px_rgba(147,51,234,0.5)] flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <i className="fa-solid fa-circle-notch fa-spin"></i>
                        ) : (
                            <>
                                Anmelden
                                <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                            </>
                        )}
                    </button>

                    <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-white/5">
                        <button
                            type="button"
                            onClick={() => navigate('/login')}
                            className="w-full bg-white/5 hover:bg-white/10 text-blue-400 font-medium py-3 px-4 rounded-xl border border-blue-500/20 hover:border-blue-500/40 transition-all text-sm flex items-center justify-center gap-2"
                        >
                            <i className="fa-solid fa-user-shield"></i>
                            Mitarbeiter Login
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/subcontractor-login')}
                            className="w-full bg-white/5 hover:bg-white/10 text-emerald-400 font-medium py-3 px-4 rounded-xl border border-emerald-500/20 hover:border-emerald-500/40 transition-all text-sm flex items-center justify-center gap-2"
                        >
                            <i className="fa-solid fa-truck-fast"></i>
                            Subunternehmer Portal
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PartnerLogin;
