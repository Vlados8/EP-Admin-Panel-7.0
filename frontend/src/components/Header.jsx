import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { logout } from '../store/slices/authSlice';
import { usePhone } from '../context/PhoneContext';
import api from '../services/api';
import socketService from '../services/socket';

const Header = ({ title, onMenuClick }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const phone = usePhone();
    const { user } = useSelector((state) => state.auth);
    const isSubcontractor = user?.role === 'Subcontractor' || user?.role?.name === 'Subcontractor';

    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (user && !isSubcontractor) {
            fetchNotifications();
            
            // Listen to real-time notification socket events
            const handleNewNotification = (newNotif) => {
                setNotifications(prev => [newNotif, ...prev]);
                try {
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav');
                    audio.volume = 0.2;
                    audio.play();
                } catch (e) {
                    // Blocked by chrome default browser policy if no interaction
                }
            };

            socketService.on('new_notification', handleNewNotification);
            return () => {
                socketService.off('new_notification', handleNewNotification);
            };
        }
    }, [user]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/notifications');
            setNotifications(res.data.data.notifications || []);
        } catch (err) {
            console.error('[Header] Failed to load notifications:', err);
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.patch('/notifications/mark-read', {});
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (err) {
            console.error('[Header] Failed to mark read:', err);
        }
    };

    const handleNotificationClick = async (n) => {
        try {
            if (!n.is_read) {
                await api.patch('/notifications/mark-read', { notificationIds: [n.id] });
                setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
            }
            setIsOpen(false);
            
            // Navigate dynamically to the fiting page
            if (n.type === 'task') {
                navigate('/aufgaben');
            } else if (n.type === 'note') {
                navigate('/notizen');
            } else if (n.type === 'chat') {
                navigate('/chat');
            } else if (n.type === 'email') {
                navigate('/email-messages');
            } else if (n.type === 'call') {
                navigate('/telefon');
            }
        } catch (err) {
            console.error('[Header] Click action failed:', err);
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const formatTimeAgo = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Gerade eben';
        if (diffMins < 60) return `Vor ${diffMins} Min.`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `Vor ${diffHours} Std.`;
        
        return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    };

    const getTypeIcon = (type) => {
        switch(type) {
            case 'note': return 'fa-regular fa-file-lines text-green-400 bg-green-500/10 border-green-500/20';
            case 'task': return 'fa-regular fa-circle-check text-blue-400 bg-blue-500/10 border-blue-500/20';
            case 'email': return 'fa-regular fa-envelope text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
            case 'chat': return 'fa-regular fa-comments text-purple-400 bg-purple-500/10 border-purple-500/20';
            case 'call': return 'fa-solid fa-phone text-red-400 bg-red-500/10 border-red-500/20';
            default: return 'fa-regular fa-bell text-gray-400 bg-gray-500/10 border-gray-500/20';
        }
    };

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
    };

    return (
        <header className="h-20 border-b border-white/10 flex items-center justify-between px-4 md:px-8 bg-black/20 backdrop-blur-xl shrink-0 relative z-[999]">
            <div className="flex items-center gap-4">
                <button 
                    onClick={onMenuClick}
                    className="md:hidden w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                    <i className="fa-solid fa-bars"></i>
                </button>
                <h1 className="text-xl md:text-2xl font-light text-white tracking-wide truncate max-w-[150px] md:max-w-none">{title}</h1>
            </div>

            <div className="flex items-center gap-6">
                {/* Browser Call Reception Toggle */}
                {!isSubcontractor && (
                    <div className="hidden lg:flex items-center gap-3 bg-white/5 border border-white/10 rounded-full py-1.5 pl-4 pr-1.5">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Browser-Anrufe</span>
                        <button 
                            onClick={() => phone.setIsReceivingCalls(!phone.isReceivingCalls)}
                            className={`w-10 h-5 rounded-full relative transition-all duration-300 ${
                                phone.isReceivingCalls ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]' : 'bg-white/10'
                            }`}
                        >
                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 shadow-sm ${
                                phone.isReceivingCalls ? 'left-6' : 'left-1'
                            }`}></div>
                        </button>
                        {phone.isReceivingCalls && (
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                        )}
                    </div>
                )}

                <div className="hidden md:relative">
                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input
                        type="text"
                        placeholder="Suchen..."
                        className="bg-black/20 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors w-64"
                    />
                </div>

                {/* Interactive Notifications Bell Dropdown */}
                {!isSubcontractor && (
                    <div className="relative" ref={dropdownRef}>
                        <button 
                            onClick={() => setIsOpen(!isOpen)}
                            className="relative p-2 text-gray-400 hover:text-white transition-colors flex items-center justify-center rounded-xl hover:bg-white/5"
                        >
                            <i className="fa-regular fa-bell text-xl"></i>
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 bg-blue-600 text-white rounded-full text-[9px] px-1.5 py-0.5 font-bold flex items-center justify-center min-w-[16px] h-4 shadow-[0_0_10px_rgba(37,99,235,0.6)] animate-pulse">
                                    {unreadCount}
                                </span>
                            )}
                        </button>

                        {isOpen && (
                            <div className="absolute right-0 top-14 w-80 md:w-[380px] bg-[#0c0c10]/90 border border-white/15 backdrop-blur-2xl rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] p-4 z-[9999] text-left animate-[slideUp_0.2s_ease-out] flex flex-col gap-3.5">
                                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                                    <span className="font-extrabold text-white text-xs uppercase tracking-widest">Mitteilungen</span>
                                    {unreadCount > 0 && (
                                        <button 
                                            onClick={markAllAsRead}
                                            className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors uppercase font-black tracking-widest hover:underline"
                                        >
                                            Alle lesen
                                        </button>
                                    )}
                                </div>

                                <div className="max-h-80 overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar">
                                    {notifications.length === 0 ? (
                                        <div className="py-10 text-center text-gray-500 text-xs flex flex-col gap-2.5 items-center justify-center bg-white/[0.02] border border-white/5 border-dashed rounded-xl">
                                            <i className="fa-regular fa-bell-slash text-xl text-gray-600"></i>
                                            <span className="font-bold uppercase tracking-widest text-[10px]">Keine Mitteilungen</span>
                                        </div>
                                    ) : (
                                        notifications.map((n) => (
                                            <div 
                                                key={n.id}
                                                onClick={() => handleNotificationClick(n)}
                                                className={`group p-3 rounded-xl border transition-all duration-300 cursor-pointer flex gap-3 ${
                                                    !n.is_read 
                                                        ? 'bg-blue-500/[0.04] hover:bg-blue-500/[0.08] border-blue-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]' 
                                                        : 'bg-white/[0.01] hover:bg-white/[0.04] border-white/5 hover:border-white/10'
                                                }`}
                                            >
                                                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-xs shrink-0 ${getTypeIcon(n.type)}`}></div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-center gap-2">
                                                        <span className={`text-[10px] font-black uppercase tracking-wider ${!n.is_read ? 'text-blue-400' : 'text-gray-500'}`}>
                                                            {n.type === 'note' ? 'Bautagebuch' : n.type === 'task' ? 'Aufgabe' : n.type === 'email' ? 'E-Mail' : n.type === 'chat' ? 'Chat' : n.type === 'call' ? 'Anruf' : 'Info'}
                                                        </span>
                                                        <span className="text-[9px] text-gray-500 font-bold uppercase whitespace-nowrap shrink-0">{formatTimeAgo(n.createdAt)}</span>
                                                    </div>
                                                    <p className={`text-xs font-bold truncate mt-1 leading-snug group-hover:text-blue-400 transition-colors ${!n.is_read ? 'text-white' : 'text-gray-300'}`}>
                                                        {n.title}
                                                    </p>
                                                    <p className={`text-[10px] leading-relaxed mt-0.5 line-clamp-2 ${!n.is_read ? 'text-gray-300' : 'text-gray-400'}`}>{n.body}</p>
                                                </div>
                                                {!n.is_read && (
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] self-center shrink-0"></div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="pt-2 border-t border-white/10 flex">
                                    <button 
                                        onClick={() => {
                                            setIsOpen(false);
                                            navigate('/settings/notifications');
                                        }}
                                        className="w-full text-center text-gray-400 hover:text-white text-xs transition-all duration-200 py-2.5 flex items-center justify-center gap-2 font-black uppercase tracking-widest bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 hover:border-white/20"
                                    >
                                        <i className="fa-solid fa-gear text-[10px]"></i> Einstellungen verwalten
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="h-8 w-px bg-white/10"></div>

                <div className="flex items-center gap-3 cursor-pointer group" onClick={handleLogout}>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 p-[2px]">
                        <div className="w-full h-full bg-black rounded-full flex items-center justify-center overflow-hidden relative">
                            <div className="absolute inset-0 bg-white/10 group-hover:bg-transparent transition-colors"></div>
                            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=random`} alt="Profil" className="w-full h-full object-cover" />
                        </div>
                    </div>
                    <div className="hidden md:block text-sm">
                        <p className="font-medium text-white group-hover:text-red-400 transition-colors">Abmelden <i className="fa-solid fa-right-from-bracket ml-1 text-xs"></i></p>
                        <p className="text-gray-400 text-xs text-left">{user?.name || 'Admin'} <span className="text-gray-500">({user?.isPartner ? 'Partner' : (user?.role || 'Rolle')})</span></p>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
