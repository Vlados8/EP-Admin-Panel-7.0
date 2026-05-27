import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../services/api';
import ProjectWizard from './ProjectWizard';
import usePermission from '../../hooks/usePermission';
import { getImageUrl } from '../../utils/config';

const Projects = () => {
    const { user: currentUser } = useSelector(state => state.auth);
    const [projects, setProjects] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Premium Date Filters
    const [dateFilter, setDateFilter] = useState('all'); // 'all' or 'custom'
    const [selectedDate, setSelectedDate] = useState(getLocalDateString(0));
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    
    const canManageProjects = usePermission('MANAGE_PROJECTS');
    const navigate = useNavigate();

    useEffect(() => {
        fetchData();
    }, []);

    // Timezone-safe date utility helpers
    function getLocalDateString(offsetDays = 0) {
        const d = new Date();
        if (offsetDays !== 0) {
            d.setDate(d.getDate() + offsetDays);
        }
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    const todayStr = getLocalDateString(0);

    const cleanDate = (dStr) => {
        if (!dStr) return '';
        return dStr.includes('T') ? dStr.split('T')[0] : dStr;
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const [projectsRes, clientsRes] = await Promise.all([
                api.get('/projects?excludeStatus=angebot'),
                api.get('/clients')
            ]);
            setProjects(Array.isArray(projectsRes.data?.data?.projects) ? projectsRes.data.data.projects : (Array.isArray(projectsRes.data) ? projectsRes.data : []));
            setClients(Array.isArray(clientsRes.data?.data?.clients) ? clientsRes.data.data.clients : (Array.isArray(clientsRes.data) ? clientsRes.data : []));
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenProject = (id) => {
        navigate(`/projekte/${id}`);
    };

    const getProgressColor = (progress) => {
        if (progress >= 100) return 'from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]';
        if (progress > 50) return 'from-blue-500 to-indigo-400 shadow-[0_0_12px_rgba(59,130,246,0.4)]';
        if (progress > 20) return 'from-amber-500 to-yellow-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]';
        return 'from-rose-500 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.4)]';
    };

    const formatLocalDateGerman = (dateStr) => {
        if (!dateStr) return '';
        const cleaned = cleanDate(dateStr);
        const [year, month, day] = cleaned.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        if (isNaN(date.getTime())) return dateStr;
        
        return date.toLocaleDateString('de-DE', {
            weekday: 'long',
            day: '2-digit',
            month: 'long'
        });
    };

    const getRoleColor = (role) => {
        switch (role?.toLowerCase()) {
            case 'admin':
                return 'bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-rose-500/10';
            case 'projektleiter':
            case 'pl':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30 shadow-blue-500/10';
            case 'gruppenleiter':
            case 'gl':
                return 'bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-amber-500/10';
            case 'büro':
            case 'buero':
                return 'bg-purple-500/20 text-purple-400 border-purple-500/30 shadow-purple-500/10';
            case 'worker':
                return 'bg-slate-500/20 text-slate-400 border-slate-500/30 shadow-slate-500/10';
            default:
                return 'bg-white/10 text-white border-white/20 shadow-black/20';
        }
    };

    // Filter projects subset based on search query
    const filteredProjects = projects.filter(project => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();

        return (
            project.title?.toLowerCase().includes(q) ||
            project.project_number?.toLowerCase().includes(q) ||
            project.address?.toLowerCase().includes(q) ||
            project.description?.toLowerCase().includes(q) ||
            project.client?.name?.toLowerCase().includes(q) ||
            project.client?.email?.toLowerCase().includes(q) ||
            project.client?.contact_person?.toLowerCase().includes(q)
        );
    });

    const isActiveOnDate = (project, dateStr) => {
        const start = cleanDate(project.start_date);
        const end = cleanDate(project.end_date);
        // A project is classified as "past" and excluded from active schedules if abgeschlossen or end_date < today
        const isPast = project.status?.toLowerCase() === 'abgeschlossen' || (end && end < todayStr);
        if (isPast) return false;

        // If no start_date and no end_date, it's considered active/ongoing ongoing schedule
        if (!start) {
            return true;
        }

        // Active if dateStr is >= start_date AND (no end_date OR dateStr <= end_date)
        const matchesStart = dateStr >= start;
        const matchesEnd = !end || dateStr <= end;
        return matchesStart && matchesEnd;
    };

    // Classify into: Active/Future schedules and Past/Completed
    const pastProjects = filteredProjects.filter(p => {
        const end = cleanDate(p.end_date);
        return p.status?.toLowerCase() === 'abgeschlossen' || (end && end < todayStr);
    });

    const activeOrFutureProjects = filteredProjects.filter(p => {
        const end = cleanDate(p.end_date);
        return !(p.status?.toLowerCase() === 'abgeschlossen' || (end && end < todayStr));
    });

    // Grouping for Day-by-Day View (Display next 7 days week agenda)
    const chronologicalDays = [];
    if (dateFilter === 'all') {
        for (let i = 0; i < 7; i++) {
            const dateStr = getLocalDateString(i);
            const dayProjects = activeOrFutureProjects.filter(p => isActiveOnDate(p, dateStr));
            chronologicalDays.push({
                dateStr,
                label: i === 0 ? 'Heute' : i === 1 ? 'Morgen' : formatLocalDateGerman(dateStr),
                projects: dayProjects
            });
        }
    } else {
        // Custom single date view
        const dayProjects = activeOrFutureProjects.filter(p => isActiveOnDate(p, selectedDate));
        chronologicalDays.push({
            dateStr: selectedDate,
            label: selectedDate === todayStr ? 'Heute' : selectedDate === getLocalDateString(1) ? 'Morgen' : formatLocalDateGerman(selectedDate),
            projects: dayProjects
        });
    }

    // Projects starting far in the future (after 7 days) that are not already captured in the first 7 days
    const farFutureThreshold = getLocalDateString(7);
    const farFutureProjects = activeOrFutureProjects.filter(p => {
        const isActiveInFirst7Days = Array.from({ length: 7 }, (_, idx) => getLocalDateString(idx))
            .some(dStr => isActiveOnDate(p, dStr));
        return p.start_date && p.start_date >= farFutureThreshold && !isActiveInFirst7Days;
    });

    const searchSortedProjects = [...filteredProjects].sort((a, b) => {
        const getStatusLevel = (p) => {
            const hasPL = (p.assigned_personnel || []).some(pers => pers.role?.toLowerCase() === 'projektleiter' || pers.role?.toLowerCase() === 'pl');
            if (hasPL) return 0;

            const start = cleanDate(p.start_date);
            if (!start) return 1;

            const startDate = new Date(start);
            startDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const diffDays = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
            if (diffDays <= 0) return 3; // Critical
            if (diffDays <= 3) return 2; // Urgent
            return 1; // Warning
        };

        const statusA = getStatusLevel(a);
        const statusB = getStatusLevel(b);

        if (statusA !== statusB) return statusB - statusA;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const renderProjectCard = (project) => {
        const hasPL = (project.assigned_personnel || []).some(p => p.role?.toLowerCase() === 'projektleiter' || p.role?.toLowerCase() === 'pl');
        
        let statusLevel = 0; // Normal
        if (!hasPL) {
            const start = cleanDate(project.start_date);
            if (!start) {
                statusLevel = 1; // Warning
            } else {
                const startDate = new Date(start);
                startDate.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));

                if (diffDays <= 0) statusLevel = 3; // Critical
                else if (diffDays <= 3) statusLevel = 2; // Urgent
                else statusLevel = 1; // Warning
            }
        }

        // Extremely Premium Glowing Borders based on levels
        const highlightClass = statusLevel === 3
            ? 'border-purple-500/50 shadow-[0_0_25px_rgba(168,85,247,0.25)] hover:border-purple-400'
            : statusLevel === 2
                ? 'border-red-500/50 shadow-[0_0_25px_rgba(239,68,68,0.25)] hover:border-red-400'
                : statusLevel === 1
                    ? 'border-orange-500/40 shadow-[0_0_20px_rgba(249,115,22,0.18)] hover:border-orange-400'
                    : 'border-white/10 hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]';

        const bannerBorder = statusLevel === 3
            ? 'border-purple-500/20'
            : statusLevel === 2
                ? 'border-red-500/20'
                : statusLevel === 1
                    ? 'border-orange-500/20'
                    : 'border-white/5';

        const formattedDuration = (() => {
            const start = cleanDate(project.start_date);
            const end = cleanDate(project.end_date);
            if (!start && !end) return 'Laufendes Projekt';
            const fmt = (dStr) => {
                if (!dStr) return '';
                const [y, m, d] = dStr.split('-');
                return `${d}.${m}`;
            };
            if (start && !end) return `Ab ${fmt(start)}`;
            if (!start && end) return `Bis ${fmt(end)}`;
            return `${fmt(start)} - ${fmt(end)}`;
        })();

        return (
            <div
                key={project.id}
                onClick={() => handleOpenProject(project.id)}
                className={`bg-[#0f1322]/70 backdrop-blur-md rounded-2xl overflow-hidden flex flex-col hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 cursor-pointer border group relative ${highlightClass}`}
            >
                {/* Visual Glow Ornament inside card */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-transparent blur-2xl pointer-events-none rounded-full"></div>

                {/* Banner Section */}
                <div className={`bg-slate-950/60 h-32 relative overflow-hidden flex justify-between items-start border-b ${bannerBorder}`}>
                    {project.main_image ? (
                        <img
                            src={getImageUrl(project.main_image)}
                            alt={project.title}
                            className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-85 transition-all duration-700 scale-100 group-hover:scale-110"
                        />
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-[#1e293b]/50 opacity-60"></div>
                    )}
                    
                    {/* Animated grid overlay inside banner for modern look */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:14px_14px]"></div>

                    <div className="relative z-10 w-full p-4 flex justify-between items-start">
                        {/* Glowing Premium Status Badge */}
                        <span className={`text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider shadow-lg border backdrop-blur-md ${
                            project.status?.toLowerCase() === 'aktiv'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                                : project.status?.toLowerCase() === 'pausiert'
                                    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                                    : project.status?.toLowerCase() === 'abgeschlossen'
                                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                                        : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        }`}>
                            {project.status || 'Aktiv'}
                        </span>
                        
                        {/* Project Number badge */}
                        <span className="bg-black/70 backdrop-blur-md text-gray-300 text-[10px] px-2.5 py-1 rounded-lg font-mono font-bold border border-white/10 shadow-lg">
                            {project.project_number}
                        </span>
                    </div>

                    {/* Quick date range float badge */}
                    <div className="absolute bottom-3 left-4 z-10 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-[10px] text-gray-300 font-medium flex items-center gap-1.5 shadow-lg">
                        <i className="fa-regular fa-calendar text-blue-400 text-[10px]"></i>
                        {formattedDuration}
                    </div>
                </div>

                {/* Card Content Section */}
                <div className="p-5 flex-1 flex flex-col justify-between bg-gradient-to-b from-white/[0.02] to-transparent">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-white mb-1.5 group-hover:text-blue-400 transition-colors line-clamp-1">{project.title}</h3>
                        
                        {/* Location address row with micro-bouncing icon */}
                        <p className="text-gray-400 text-xs flex items-center gap-2 mb-1.5">
                            <i className="fa-solid fa-location-dot text-blue-500/80 text-[13px] group-hover:animate-[bounce_1s_infinite]"></i>
                            <span className="line-clamp-1">{project.address || `${project.client?.city || ''}, ${project.client?.address || ''}`}</span>
                        </p>

                        {/* Customer details row */}
                        {project.client && (
                            <p className="text-gray-400 text-xs flex items-center gap-2">
                                <i className="fa-solid fa-user-tie text-purple-500/80 text-[12px]"></i>
                                <span className="text-slate-300 font-medium line-clamp-1">
                                    Kunde: <span className="text-white font-semibold">{project.client.name}</span>
                                </span>
                            </p>
                        )}

                        {/* Project description snippet */}
                        {project.description && (
                            <p className="text-gray-400 text-[11px] mt-2.5 line-clamp-2 bg-white/[0.02] border border-white/5 rounded-lg p-2 font-light leading-relaxed">
                                {project.description}
                            </p>
                        )}
                    </div>

                    {/* Progress Bar Container with custom glows */}
                    <div className="mb-5">
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fortschritt</span>
                            <span className="text-xs font-mono font-bold text-white">{project.progress || 0}%</span>
                        </div>
                        <div className="w-full bg-slate-950/80 rounded-full h-2 border border-white/5 overflow-hidden p-0.5">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 bg-gradient-to-r ${getProgressColor(project.progress || 0)}`}
                                style={{ width: `${project.progress || 0}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Footer Row: Personnel and open button */}
                    <div className="flex justify-between items-center mt-2 pt-3 border-t border-white/5">
                        <div className="flex -space-x-1.5 overflow-hidden">
                            {(project.assigned_personnel || []).slice(0, 3).map((au, i) => {
                                const uName = au.user?.name || `${au.user?.first_name || ''} ${au.user?.last_name || ''}`;
                                const initials = uName.split(' ').map(n => n.charAt(0)).join('').toUpperCase().substring(0, 2);
                                const roleColor = getRoleColor(au.role);
                                return (
                                    <div
                                        key={i}
                                        className="w-7.5 h-7.5 rounded-lg backdrop-blur-md border flex items-center justify-center text-[9px] font-bold shadow-lg transition-all hover:scale-115 hover:-translate-y-0.5 hover:z-10 cursor-help"
                                        title={`${uName} (${au.role})`}
                                    >
                                        <div className={`w-full h-full rounded-lg flex items-center justify-center border ${roleColor.split(' ').slice(0,3).join(' ')}`}>
                                            {initials || '--'}
                                        </div>
                                    </div>
                                );
                            })}
                            {project.assigned_personnel && project.assigned_personnel.length > 3 && (
                                <div className="w-7.5 h-7.5 rounded-lg bg-slate-900/90 backdrop-blur-md border border-white/10 flex items-center justify-center text-[9px] font-bold text-gray-300 shadow-lg">
                                    +{project.assigned_personnel.length - 3}
                                </div>
                            )}
                            {(!project.assigned_personnel || project.assigned_personnel.length === 0) && (
                                <div className="w-7.5 h-7.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[9px] text-gray-500 hover:text-gray-400 transition-colors">
                                    <i className="fa-solid fa-user-plus"></i>
                                </div>
                            )}
                        </div>
                        
                        <span className="text-blue-400 text-xs font-semibold flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                            Details <i className="fa-solid fa-arrow-right text-[10px]"></i>
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="animate-[fadeIn_0.4s_ease-out_forwards]">
            {/* Header / Top Toolbar with high z-index stacking context to stay above lower grids */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 relative z-30">
                <div>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent">Bauprojekte</h2>
                    <p className="text-gray-400 text-sm mt-1">Übersicht und Verwaltung aller Bauprojekte.</p>
                </div>
                
                {/* Advanced Premium Navigation / Filters Row */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto relative z-40">
                    {/* Interactive Glassmorphic Date Filter Dropdown */}
                    <div className="flex flex-wrap items-center gap-2 bg-[#0f1322]/40 p-1 rounded-xl border border-white/5 backdrop-blur-md relative z-50">
                        <button
                            onClick={() => {
                                setDateFilter('all');
                                setIsDatePickerOpen(false);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 ${
                                dateFilter === 'all'
                                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.18)]'
                                    : 'text-gray-400 hover:text-white border border-transparent'
                            }`}
                        >
                            <i className="fa-solid fa-calendar-days"></i> Alle Tage (Zeitplan)
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => {
                                    setDateFilter('custom');
                                    setIsDatePickerOpen(!isDatePickerOpen);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 ${
                                    dateFilter === 'custom'
                                        ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.18)]'
                                        : 'text-gray-400 hover:text-white border border-transparent'
                                }`}
                            >
                                <i className="fa-solid fa-calendar-day"></i> {dateFilter === 'custom' ? `Datum: ${new Date(selectedDate).toLocaleDateString('de-DE')}` : 'Bestimmtes Datum...'}
                                <i className={`fa-solid fa-chevron-down text-[9px] transition-transform ${isDatePickerOpen ? 'rotate-180' : ''}`}></i>
                            </button>
                            {isDatePickerOpen && (
                                <div className="absolute right-0 mt-2 z-50 bg-[#0f1322]/95 border border-white/10 backdrop-blur-xl p-4 rounded-xl shadow-2xl animate-[fadeIn_0.2s_ease-out] w-64">
                                    <label className="block text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2">Datum auswählen</label>
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => {
                                            setSelectedDate(e.target.value);
                                            setDateFilter('custom');
                                            setIsDatePickerOpen(false);
                                        }}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-purple-500 transition-all font-mono"
                                    />
                                    <div className="mt-3 flex justify-end gap-2">
                                        <button
                                            onClick={() => {
                                                setSelectedDate(todayStr);
                                                setDateFilter('custom');
                                                setIsDatePickerOpen(false);
                                            }}
                                            className="text-[9px] uppercase font-bold text-gray-400 hover:text-white transition-colors"
                                        >
                                            Heute
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="relative flex-1 md:flex-none">
                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input
                            type="text"
                            placeholder="Projekte suchen..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-black/20 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-blue-500 transition-all w-full md:w-64 backdrop-blur-sm placeholder:text-gray-500"
                        />
                    </div>
                    
                    {canManageProjects && (
                        <button
                            onClick={() => setIsWizardOpen(true)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] hover:-translate-y-0.5 flex items-center gap-2 text-xs font-semibold whitespace-nowrap"
                        >
                            <i className="fa-solid fa-wand-magic-sparkles mr-0.5 text-xs"></i> Neues Projekt
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-sm font-medium tracking-wide">Lade Projekte...</p>
                </div>
            ) : filteredProjects.length === 0 ? (
                <div className="bg-[#0f1322]/50 border border-white/5 rounded-2xl p-16 text-center text-gray-400 backdrop-blur-md animate-[fadeIn_0.3s_ease-out]">
                    <i className="fa-solid fa-magnifying-glass text-5xl mb-4 text-slate-700/60"></i>
                    <p className="text-lg font-medium text-white mb-2">Keine Projekte gefunden</p>
                    <p className="text-sm text-gray-500 max-w-sm mx-auto">Es konnten keine passenden Einträge für Ihre aktuelle Suche gefunden werden.</p>
                    <button
                        onClick={() => setSearchQuery('')}
                        className="mt-6 bg-white/5 border border-white/10 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl transition-all text-xs font-bold uppercase tracking-wider"
                    >
                        Suche zurücksetzen
                    </button>
                </div>
            ) : searchQuery.trim() ? (
                /* Search Active Mode: Show single flat premium grid of matched projects directly */
                <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                    <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                        <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.15)]">
                            Suchergebnisse
                        </span>
                        <span className="text-[10px] text-gray-500 font-bold bg-white/5 px-2 py-0.5 rounded border border-white/5 font-mono">
                            {filteredProjects.length} {filteredProjects.length === 1 ? 'Treffer' : 'Treffer'}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {searchSortedProjects.map(project => renderProjectCard(project))}
                    </div>
                </div>
            ) : (
                /* Normal Mode: Chronological Weekly Timeline & Sections */
                <div className="space-y-12">
                    {/* 1. CHRONOLOGICAL ACTIVE & FUTURE SECTIONS */}
                    {chronologicalDays.map(day => (
                        <div key={day.dateStr} className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
                            {/* Day Header Badges with premium glows */}
                            <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                                <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                                    day.label === 'Heute'
                                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                                        : day.label === 'Morgen'
                                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                                            : 'bg-slate-800 text-gray-300 border border-white/5'
                                }`}>
                                    {day.label}
                                </span>
                                {day.dateStr && (
                                    <span className="text-xs text-gray-500 font-mono font-medium">
                                        {new Date(day.dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </span>
                                )}
                                <span className="text-[10px] text-gray-500 font-bold bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                    {day.projects.length} {day.projects.length === 1 ? 'Projekt' : 'Projekte'}
                                </span>
                            </div>

                            {/* Projects Grid or premium compact glass empty placeholder */}
                            {day.projects.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {day.projects.map(project => renderProjectCard(project))}
                                </div>
                            ) : (
                                <div className="bg-[#0f1322]/30 border border-white/[0.03] rounded-xl p-4 flex items-center gap-3 text-gray-500 backdrop-blur-sm">
                                    <i className="fa-regular fa-calendar-check text-blue-500/40 text-sm"></i>
                                    <span className="text-xs tracking-wide">Keine Projekte für diesen Tag geplant</span>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Notice if Day-by-Day schedule has no items but we have far-future items */}
                    {chronologicalDays.every(d => d.projects.length === 0) && activeOrFutureProjects.length > 0 && (
                        <div className="bg-[#0f1322]/30 border border-white/5 p-8 rounded-2xl text-center text-gray-400 backdrop-blur-md">
                            <i className="fa-regular fa-calendar-xmark text-3xl mb-3 text-slate-700"></i>
                            <p className="text-sm">Keine aktiven Projekte für den ausgewählten Zeitraum geplant.</p>
                        </div>
                    )}

                    {/* 2. FAR FUTURE PROJECTS SECTON (if dateFilter === 'all' and any exist) */}
                    {dateFilter === 'all' && farFutureProjects.length > 0 && (
                        <div className="space-y-4 pt-4 border-t border-white/5 animate-[fadeIn_0.3s_ease-out]">
                            <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-800 text-gray-300 border border-white/5">
                                    Zukünftige Projekte (in mehr als 7 Tagen)
                                </span>
                                <span className="text-[10px] text-gray-500 font-bold bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                    {farFutureProjects.length}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {farFutureProjects.map(project => renderProjectCard(project))}
                            </div>
                        </div>
                    )}

                    {/* 3. PAST & COMPLETED PROJECTS SECTION (ALWAYS AT THE BOTTOM) */}
                    {pastProjects.length > 0 && (
                        <div className="space-y-4 pt-8 border-t border-white/10 animate-[fadeIn_0.3s_ease-out]">
                            <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-900/60 text-gray-400 border border-white/5 shadow-inner">
                                    Vergangene & Abgeschlossene Projekte
                                </span>
                                <span className="text-[10px] text-gray-500 font-bold bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                    {pastProjects.length}
                                </span>
                            </div>
                            
                            {/* Render completed/past projects with slightly dimmed/ghostly/glass aesthetic to visually prioritize active ones */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-75 hover:opacity-100 transition-opacity duration-300">
                                {pastProjects.map(project => renderProjectCard(project))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <ProjectWizard
                isOpen={isWizardOpen}
                onClose={() => setIsWizardOpen(false)}
                onProjectCreated={fetchData}
            />
        </div>
    );
};

export default Projects;
