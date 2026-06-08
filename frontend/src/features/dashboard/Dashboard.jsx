import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../services/api';
import SubcontractorDashboard from './SubcontractorDashboard';

const StatCard = ({ title, value, icon, colorClass, trend, delay }) => (
    <div 
        className="glass-card p-5 md:p-6 rounded-3xl border border-white/10 hover:border-white/20 transition-all hover:translate-y-[-4px] duration-500 group relative overflow-hidden animate-[slideUp_0.5s_ease-out_forwards]"
        style={{ animationDelay: `${delay}ms` }}
    >
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-700"></div>
        
        <div className="flex justify-between items-start relative z-10">
            <div>
                <p className="text-gray-400 text-[10px] md:text-xs uppercase tracking-[0.2em] font-bold mb-2">{title}</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl md:text-4xl font-black text-white tracking-tight">{value}</h3>
                    {trend && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${trend > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {trend > 0 ? '+' : ''}{trend}%
                        </span>
                    )}
                </div>
            </div>
            <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center ${colorClass} border border-white/10 shadow-2xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                <i className={`fa-solid ${icon} text-xl md:text-2xl`}></i>
            </div>
        </div>
    </div>
);

const ActivityChart = ({ data }) => {
    // Generate SVG path for a given set of data points (7 days)
    const generatePath = (points, isArea = false) => {
        if (!points || points.length === 0) return "";
        const max = Math.max(...points, 5); // Minimum scale of 5
        const width = 400;
        const height = 180; // Leaving room for labels
        const stepX = width / (points.length - 1);
        
        let d = `M 0 ${height - (points[0] / max) * height}`;
        
        for (let i = 1; i < points.length; i++) {
            const x = i * stepX;
            const y = height - (points[i] / max) * height;
            // Use quadratic curve for smoothness
            const prevX = (i - 1) * stepX;
            const prevY = height - (points[i - 1] / max) * height;
            const midX = (prevX + x) / 2;
            d += ` Q ${midX} ${prevY} ${x} ${y}`;
        }
        
        if (isArea) {
            d += ` V ${height} H 0 Z`;
        }
        return d;
    };

    return (
        <div className="glass-card p-6 md:p-8 rounded-3xl border border-white/10 h-full flex flex-col relative overflow-hidden group">
            <div className="flex items-center justify-between mb-8 overflow-hidden">
                <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Wöchentliche Aktivität</h3>
                    <p className="text-xs text-gray-500 mt-1">Interaktionen & Projektfortschritte</p>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Anfragen</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Projekte</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-[220px] relative mt-4">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 400 200" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="gradient-blue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="gradient-purple" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Grid Lines */}
                    {[0, 45, 90, 135, 180].map(y => (
                        <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="white" strokeOpacity="0.03" strokeWidth="1" />
                    ))}
                    
                    {/* Area Charts */}
                    <path
                        d={generatePath(data.inquiryPoints, true)}
                        fill="url(#gradient-blue)"
                        className="opacity-30 transition-all duration-1000"
                    />
                    <path
                        d={generatePath(data.projectPoints, true)}
                        fill="url(#gradient-purple)"
                        className="opacity-20 transition-all duration-1000"
                    />

                    {/* Lines */}
                    <path
                        d={generatePath(data.inquiryPoints)}
                        stroke="#3b82f6"
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray="1000"
                        strokeDashoffset={data.isInitial ? "1000" : "0"}
                        className={data.isInitial ? "animate-[drawPath_2s_ease-out_forwards]" : "transition-all duration-1000"}
                    />
                    <path
                        d={generatePath(data.projectPoints)}
                        stroke="#a855f7"
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray="1000"
                        strokeDashoffset={data.isInitial ? "1000" : "0"}
                        className={data.isInitial ? "animate-[drawPath_2s_ease-out_0.5s_forwards]" : "transition-all duration-1000"}
                    />
                </svg>

                {/* Day Labels */}
                <div className="flex justify-between mt-4">
                    {data.labels.map((label, i) => (
                        <span key={i} className="text-[9px] text-gray-600 font-bold uppercase tracking-tighter">
                            {label}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

const Dashboard = () => {
    const navigate = useNavigate();
    const { user: authUser } = useSelector((state) => state.auth);
    const isSubcontractor = authUser?.role?.name === 'Subcontractor' || authUser?.role === 'Subcontractor';

    if (isSubcontractor) {
        return <SubcontractorDashboard user={authUser} />;
    }

    const [stats, setStats] = useState({
        projects: 0,
        tasks: 0,
        inquiries: 0,
        users: 0,
        projectTrend: 0,
        taskTrend: 0,
        inquiryTrend: 0
    });
    const [chartData, setChartData] = useState({
        inquiryPoints: [0, 0, 0, 0, 0, 0, 0],
        projectPoints: [0, 0, 0, 0, 0, 0, 0],
        labels: [],
        isInitial: true
    });
    const [loading, setLoading] = useState(true);
    const [recentActivities, setRecentActivities] = useState([]);

    useEffect(() => {
        if (isSubcontractor) {
            setLoading(false);
            return;
        }
        const fetchDashboardData = async () => {
            try {
                const [projectsRes, tasksRes, inquiriesRes, usersRes] = await Promise.all([
                    api.get('/projects'),
                    api.get('/tasks'),
                    api.get('/inquiries'),
                    api.get('/users')
                ]);

                const projects = projectsRes.data?.data?.projects || [];
                const tasks = tasksRes.data?.data?.tasks || [];
                const inquiries = inquiriesRes.data?.data?.inquiries || [];
                const users = usersRes.data?.data?.users || [];

                // Filter for current status
                const activeProjectsCount = projects.filter(p => p.status === 'Aktiv').length;
                const openTasksCount = tasks.filter(t => t.status !== 'Erledigt').length;
                const newInquiriesCount = inquiries.filter(i => i.status === 'Neu').length;

                // --- Calculate Chart Data (Last 7 Days) ---
                const now = new Date();
                const last7Days = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date();
                    d.setDate(now.getDate() - (6 - i));
                    return d;
                });

                const labels = last7Days.map(d => d.toLocaleDateString('de-DE', { weekday: 'short' }));
                
                const inquiryPoints = last7Days.map(day => {
                    return inquiries.filter(i => {
                        const date = new Date(i.createdAt);
                        return date.toDateString() === day.toDateString();
                    }).length;
                });

                const projectPoints = last7Days.map(day => {
                    return projects.filter(p => {
                        const date = new Date(p.createdAt);
                        return date.toDateString() === day.toDateString();
                    }).length;
                });

                // --- Trend Calculations (Rough mock based on last week vs this week if enough data) ---
                // For now, let's just make them look slightly dynamic based on creation dates
                const thisWeekProjects = projects.filter(p => new Date(p.createdAt) > new Date(now - 7 * 24 * 60 * 60 * 1000)).length;
                const lastWeekProjects = projects.filter(p => {
                    const d = new Date(p.createdAt);
                    return d < new Date(now - 7 * 24 * 60 * 60 * 1000) && d > new Date(now - 14 * 24 * 60 * 60 * 1000);
                }).length;
                
                const projectTrend = lastWeekProjects === 0 ? (thisWeekProjects > 0 ? 100 : 0) : Math.round(((thisWeekProjects - lastWeekProjects) / lastWeekProjects) * 100);

                setStats({
                    projects: activeProjectsCount,
                    tasks: openTasksCount,
                    inquiries: newInquiriesCount,
                    users: users.length,
                    projectTrend: projectTrend,
                    taskTrend: -2, // Still mocked for tasks as they change frequently
                    inquiryTrend: inquiries.length > 5 ? 12 : 0
                });

                setChartData({
                    inquiryPoints,
                    projectPoints,
                    labels,
                    isInitial: true
                });

                // Recent activity from projects and inquiries
                const combined = [
                    ...projects.map(p => ({ ...p, type: 'PROJEKT', icon: 'fa-building', color: 'text-blue-400' })),
                    ...inquiries.map(i => ({ ...i, type: 'ANFRAGE', icon: 'fa-inbox', color: 'text-green-400' }))
                ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

                setRecentActivities(combined);
                setLoading(false);
                
                // Set initial false after first render for animations
                setTimeout(() => setChartData(prev => ({ ...prev, isInitial: false })), 2000);
            } catch (error) {
                console.error('Fehler beim Laden der Dashboard-Daten:', error);
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    return (
        <div className="space-y-8 pb-12">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-[fadeIn_0.5s_ease-out]">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                        Willkommen zurück, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">{user.name || 'Admin'}</span>
                    </h1>
                    <p className="text-gray-400 mt-1 flex items-center gap-2">
                        <i className="fa-regular fa-calendar"></i>
                        {new Date().toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">System Online</span>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <StatCard
                    title="Aktive Projekte"
                    value={loading ? '...' : stats.projects}
                    icon="fa-building"
                    colorClass="bg-blue-500/20 text-blue-400 shadow-blue-500/10"
                    trend={stats.projectTrend}
                    delay={0}
                />
                <StatCard
                    title="Offene Aufgaben"
                    value={loading ? '...' : stats.tasks}
                    icon="fa-list-check"
                    colorClass="bg-orange-500/20 text-orange-400 shadow-orange-500/10"
                    trend={stats.taskTrend}
                    delay={100}
                />
                <StatCard
                    title="Neue Anfragen"
                    value={loading ? '...' : stats.inquiries}
                    icon="fa-inbox"
                    colorClass="bg-green-500/20 text-green-400 shadow-green-500/10"
                    trend={stats.inquiryTrend}
                    delay={200}
                />
                <StatCard
                    title="Mitarbeiter"
                    value={loading ? '...' : stats.users}
                    icon="fa-users"
                    colorClass="bg-purple-500/20 text-purple-400 shadow-purple-500/10"
                    trend={0}
                    delay={300}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                {/* Main Activity Chart */}
                <div className="lg:col-span-2 min-h-[400px]">
                    <ActivityChart data={chartData} />
                </div>

                {/* Recent Activity List */}
                <div className="glass-card p-6 md:p-8 rounded-3xl border border-white/10 flex flex-col h-full animate-[slideUp_0.5s_ease-out_0.4s_forwards] opacity-0">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-white tracking-tight">Letzte Aktivitäten</h3>
                        <i className="fa-solid fa-clock-rotate-left text-gray-500"></i>
                    </div>

                    <div className="space-y-6 flex-1">
                        {recentActivities.length > 0 ? (
                            recentActivities.map((activity, idx) => (
                                <div key={idx} className="flex gap-4 group cursor-pointer hover:translate-x-1 transition-transform duration-300">
                                    <div className={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${activity.color} group-hover:scale-110 transition-transform`}>
                                        <i className={`fa-solid ${activity.icon} text-sm`}></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] uppercase tracking-widest font-black text-gray-500">{activity.type}</span>
                                            <span className="text-[10px] text-gray-600 font-bold whitespace-nowrap">
                                                {new Date(activity.createdAt).toLocaleDateString('de-DE')}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-bold text-white truncate mt-0.5 group-hover:text-blue-400 transition-colors">
                                            {activity.title || activity.company_name || activity.name}
                                        </h4>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full opacity-30 italic text-gray-400 py-12">
                                <i className="fa-solid fa-inbox text-4xl mb-4"></i>
                                <p>Keine neuen Aktivitäten</p>
                            </div>
                        )}
                    </div>

                    <button className="w-full mt-6 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-white transition-all">
                        Alle Aktivitäten anzeigen
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
