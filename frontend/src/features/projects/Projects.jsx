import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../services/api';
import ProjectWizard from './ProjectWizard';
import usePermission from '../../hooks/usePermission';
import { getImageUrl } from '../../utils/config';

const monthNamesGerman = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const Projects = () => {
    const { user: currentUser } = useSelector(state => state.auth);
    const [projects, setProjects] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Multi-View state
    const [activeView, setActiveView] = useState('grid'); // 'grid', 'calendar', 'timeline'
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [isEditUserSelectOpen, setIsEditUserSelectOpen] = useState(false);
    
    // Premium Date Filters
    const [dateFilter, setDateFilter] = useState('all'); // 'all' or 'custom'
    const [selectedDate, setSelectedDate] = useState(getLocalDateString(0));
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    
    // Premium Status / Overdue Filters
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'overdue', 'paused', 'completed'
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    
    const canManageProjects = usePermission('MANAGE_PROJECTS');
    const isSubcontractor = currentUser?.role?.name === 'Subcontractor' || currentUser?.role === 'Subcontractor';
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

    const isProjectOnDate = (project, dateStr) => {
        const start = cleanDate(project.start_date);
        const end = cleanDate(project.end_date);
        if (!start) return false;
        const matchesStart = dateStr >= start;
        const matchesEnd = !end || dateStr <= end;
        return matchesStart && matchesEnd;
    };

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        let startDayOfWeek = firstDay.getDay();
        startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
        const totalDays = new Date(year, month + 1, 0).getDate();
        const days = [];
        const prevMonthTotalDays = new Date(year, month, 0).getDate();
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            const dayNum = prevMonthTotalDays - i;
            const prevMonthDate = new Date(year, month - 1, dayNum);
            days.push({
                dayNum,
                date: prevMonthDate,
                isCurrentMonth: false,
                dateStr: formatDateISO(prevMonthDate)
            });
        }
        for (let i = 1; i <= totalDays; i++) {
            const currentMonthDate = new Date(year, month, i);
            days.push({
                dayNum: i,
                date: currentMonthDate,
                isCurrentMonth: true,
                dateStr: formatDateISO(currentMonthDate)
            });
        }
        const totalCells = days.length <= 35 ? 35 : 42;
        const nextMonthPadding = totalCells - days.length;
        for (let i = 1; i <= nextMonthPadding; i++) {
            const nextMonthDate = new Date(year, month + 1, i);
            days.push({
                dayNum: i,
                date: nextMonthDate,
                isCurrentMonth: false,
                dateStr: formatDateISO(nextMonthDate)
            });
        }
        return days;
    };

    function formatDateISO(d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

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
            project.client?.contact_person?.toLowerCase().includes(q) ||
            project.client_first_name?.toLowerCase().includes(q) ||
            project.client_last_name?.toLowerCase().includes(q) ||
            project.client_email?.toLowerCase().includes(q) ||
            project.client_phone?.toLowerCase().includes(q) ||
            project.client_address?.toLowerCase().includes(q) ||
            project.client_notes?.toLowerCase().includes(q)
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

    // Unified list based on statusFilter
    const statusFilteredProjects = filteredProjects.filter(p => {
        if (statusFilter === 'overdue') {
            const end = cleanDate(p.end_date);
            return p.status?.toLowerCase() !== 'abgeschlossen' && end && end < todayStr;
        }
        if (statusFilter === 'paused') {
            return p.status?.toLowerCase() === 'pausiert';
        }
        if (statusFilter === 'completed') {
            return p.status?.toLowerCase() === 'abgeschlossen';
        }
        // 'all' represents all projects
        return true;
    });

    // Classify into three main categories based on statusFilteredProjects
    const completedProjects = statusFilteredProjects.filter(p => p.status?.toLowerCase() === 'abgeschlossen');
    
    const overdueProjects = statusFilteredProjects.filter(p => {
        const end = cleanDate(p.end_date);
        return p.status?.toLowerCase() !== 'abgeschlossen' && end && end < todayStr;
    });

    const activeOrFutureProjects = statusFilteredProjects.filter(p => {
        const end = cleanDate(p.end_date);
        return p.status?.toLowerCase() !== 'abgeschlossen' && (!end || end >= todayStr);
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

    const searchSortedProjects = [...statusFilteredProjects].sort((a, b) => {
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
                        {(project.client || [project.client_first_name, project.client_last_name].some(Boolean)) && (
                            <p className="text-slate-300 text-xs flex items-center gap-1.5 mb-1.5 flex-wrap">
                                <i className="fa-solid fa-user-tie text-purple-400 text-[12px]"></i>
                                {project.client && !(isSubcontractor && [project.client_first_name, project.client_last_name].some(Boolean)) ? (
                                    <>
                                        <span className="font-medium">
                                            Kunde: <span className="text-white font-semibold">{project.client.name}</span>
                                        </span>
                                        {(() => {
                                            const addName = [project.client_first_name, project.client_last_name].filter(Boolean).join(' ');
                                            if (addName) {
                                                return (
                                                    <span className="text-gray-400 text-[11px] font-light flex items-center gap-1 before:content-['|'] before:text-white/10 before:mx-1">
                                                        <i className="fa-solid fa-user text-emerald-400 text-[10px]"></i>
                                                        Endkunde: <span className="text-emerald-300 font-medium">{addName}</span>
                                                    </span>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </>
                                ) : (
                                    (() => {
                                        const addName = [project.client_first_name, project.client_last_name].filter(Boolean).join(' ');
                                        return (
                                            <span className="font-medium">
                                                Endkunde: <span className="text-white font-semibold">{addName}</span>
                                            </span>
                                        );
                                    })()
                                )}
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

    const renderGridView = () => {
        const sorted = [...statusFilteredProjects].sort((a, b) => {
            const isCompletedA = a.status?.toLowerCase() === 'abgeschlossen';
            const isCompletedB = b.status?.toLowerCase() === 'abgeschlossen';
            if (isCompletedA && !isCompletedB) return 1;
            if (!isCompletedA && isCompletedB) return -1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        if (sorted.length === 0) {
            return renderEmptyState();
        }

        return (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sorted.map(project => renderProjectCard(project))}
                </div>
            </div>
        );
    };

    const renderEmptyState = () => (
        <div className="bg-[#0f1322]/50 border border-white/5 rounded-2xl p-16 text-center text-gray-400 backdrop-blur-md animate-[fadeIn_0.3s_ease-out]">
            <i className="fa-solid fa-magnifying-glass text-5xl mb-4 text-slate-700/60"></i>
            <p className="text-lg font-medium text-white mb-2">Keine Projekte gefunden</p>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">Es konnten keine passenden Einträge für Ihre aktuelle Auswahl gefunden werden.</p>
            <button
                onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                }}
                className="mt-6 bg-white/5 border border-white/10 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl transition-all text-xs font-bold uppercase tracking-wider"
            >
                Filter zurücksetzen
            </button>
        </div>
    );

    const renderCalendarView = () => {
        const days = getDaysInMonth(currentMonth);
        const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
        
        return (
            <div className="glass-card rounded-3xl border border-white/10 bg-[#0f1322]/40 backdrop-blur-md p-6 animate-[fadeIn_0.3s_ease-out] relative z-20">
                {/* Weekdays Header */}
                <div className="grid grid-cols-7 gap-2 mb-4 text-center">
                    {weekdays.map(d => (
                        <div key={d} className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 py-2">
                            {d}
                        </div>
                    ))}
                </div>
                
                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-2 auto-rows-[120px]">
                    {days.map((day, idx) => {
                        const dayProjects = statusFilteredProjects.filter(p => isProjectOnDate(p, day.dateStr));
                        const isToday = day.dateStr === todayStr;
                        
                        return (
                            <div
                                key={idx}
                                className={`rounded-2xl border p-2 text-left flex flex-col justify-between transition-all duration-300 relative ${
                                    day.isCurrentMonth
                                        ? isToday
                                            ? 'bg-blue-600/5 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                                            : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]'
                                        : 'bg-black/10 border-transparent opacity-40'
                                }`}
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className={`text-xs font-bold font-mono ${
                                        isToday 
                                            ? 'w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center' 
                                            : 'text-gray-400'
                                    }`}>
                                        {day.dayNum}
                                    </span>
                                    {dayProjects.length > 0 && (
                                        <span className="text-[8px] font-black text-gray-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                            {dayProjects.length}
                                        </span>
                                    )}
                                </div>
                                
                                <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin">
                                    {dayProjects.slice(0, 3).map(project => {
                                        const isCompleted = project.status?.toLowerCase() === 'abgeschlossen';
                                        const isPaused = project.status?.toLowerCase() === 'pausiert';
                                        const end = cleanDate(project.end_date);
                                        const isOverdue = !isCompleted && end && end < todayStr;
                                        
                                        let badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                                        if (isCompleted) badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                                        else if (isOverdue) badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                                        else if (isPaused) badgeColor = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
                                        
                                        return (
                                            <div
                                                key={project.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenProject(project.id);
                                                }}
                                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border truncate cursor-pointer transition-all hover:scale-[1.03] ${badgeColor}`}
                                                title={project.title}
                                            >
                                                {project.title}
                                            </div>
                                        );
                                    })}
                                    {dayProjects.length > 3 && (
                                        <div className="text-[8px] font-black text-gray-500 text-center py-0.5">
                                            +{dayProjects.length - 3} weitere
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderTimelineView = () => {
        return (
            <div className="space-y-12">
                {/* A. OVERDUE PROJECTS WARNING HEADER SECTION */}
                {overdueProjects.length > 0 && (
                    <div className="space-y-4 animate-[fadeIn_0.3s_ease-out] bg-red-950/15 border border-red-500/20 p-6 rounded-2xl backdrop-blur-md shadow-[0_0_30px_rgba(239,68,68,0.05)]">
                        <div className="flex items-center justify-between pb-2 border-b border-red-500/10">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.25)] animate-pulse">
                                    ⚠️ Handlungsbedarf
                                </span>
                                <h4 className="text-sm font-bold text-red-200">Überfällige aktive Projekte (Frist abgelaufen)</h4>
                            </div>
                            <span className="text-[10px] text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 font-mono">
                                {overdueProjects.length} {overdueProjects.length === 1 ? 'Eintrag' : 'Einträge'}
                            </span>
                        </div>
                        <p className="text-xs text-red-300/80 leading-relaxed max-w-2xl font-light">
                            Die folgenden Projekte haben ihr geplantes Enddatum überschritten, sind aber noch aktiv. Bitte aktualisieren Sie den Status auf "Abgeschlossen" oder passen Sie die Projektdaten an.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                            {overdueProjects.map(project => renderProjectCard(project))}
                        </div>
                    </div>
                )}

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

                        {/* Projects Grid */}
                        {day.projects.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {day.projects.map(project => renderProjectCard(project))}
                            </div>
                        ) : (
                            <div className="bg-[#0f1322]/20 border border-white/[0.03] rounded-2xl py-6 px-8 text-center text-gray-600 text-xs italic font-medium backdrop-blur-md">
                                Keine geplanten Projekte für diesen Tag.
                            </div>
                        )}
                    </div>
                ))}

                {/* 2. PROJECTS FAR IN THE FUTURE */}
                {farFutureProjects.length > 0 && (
                    <div className="space-y-4 animate-[fadeIn_0.3s_ease-out] pt-4">
                        <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-800 text-gray-300 border border-white/5">
                                Zukünftige Projekte
                            </span>
                            <span className="text-[10px] text-gray-500 font-bold bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                {farFutureProjects.length} {farFutureProjects.length === 1 ? 'Projekt' : 'Projekte'}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {farFutureProjects.map(project => renderProjectCard(project))}
                        </div>
                    </div>
                )}

                {/* 3. PAUSED PROJECTS SECTION */}
                {statusFilteredProjects.filter(p => p.status?.toLowerCase() === 'pausiert').length > 0 && (
                    <div className="space-y-4 animate-[fadeIn_0.3s_ease-out] pt-4">
                        <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
                                Pausiert
                            </span>
                            <span className="text-[10px] text-gray-500 font-bold bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                {statusFilteredProjects.filter(p => p.status?.toLowerCase() === 'pausiert').length} {statusFilteredProjects.filter(p => p.status?.toLowerCase() === 'pausiert').length === 1 ? 'Projekt' : 'Projekte'}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {statusFilteredProjects.filter(p => p.status?.toLowerCase() === 'pausiert').map(project => renderProjectCard(project))}
                        </div>
                    </div>
                )}

                {/* 4. COMPLETED PROJECTS SECTION */}
                {completedProjects.length > 0 && (
                    <div className="space-y-4 animate-[fadeIn_0.3s_ease-out] pt-4">
                        <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.15)]">
                                Abgeschlossen
                            </span>
                            <span className="text-[10px] text-gray-500 font-bold bg-white/5 px-2 py-0.5 rounded border border-white/5 font-mono">
                                {completedProjects.length} {completedProjects.length === 1 ? 'Eintrag' : 'Einträge'}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {completedProjects.map(project => renderProjectCard(project))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="animate-[fadeIn_0.4s_ease-out_forwards]">
            {/* Header with Title and Tab Switcher */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-6 relative z-30">
                <div>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent">Bauprojekte</h2>
                    <p className="text-gray-400 text-sm mt-1">Übersicht und Verwaltung aller Bauprojekte.</p>
                </div>

                {/* View Tabs Switcher - Glassmorphic Layout */}
                <div className="flex bg-[#0f1322]/40 p-1 rounded-xl border border-white/5 backdrop-blur-md w-full xl:w-auto relative z-50">
                    <button
                        onClick={() => setActiveView('grid')}
                        className={`flex-1 xl:flex-initial px-4 py-2 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-1.5 ${
                            activeView === 'grid'
                                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.18)]'
                                : 'text-gray-400 hover:text-white border border-transparent'
                        }`}
                    >
                        <i className="fa-solid fa-grip-horizontal"></i> Alle Projekte
                    </button>
                    <button
                        onClick={() => setActiveView('calendar')}
                        className={`flex-1 xl:flex-initial px-4 py-2 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-1.5 ${
                            activeView === 'calendar'
                                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.18)]'
                                : 'text-gray-400 hover:text-white border border-transparent'
                        }`}
                    >
                        <i className="fa-solid fa-calendar"></i> Kalender
                    </button>
                    <button
                        onClick={() => setActiveView('timeline')}
                        className={`flex-1 xl:flex-initial px-4 py-2 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-1.5 ${
                            activeView === 'timeline'
                                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.18)]'
                                : 'text-gray-400 hover:text-white border border-transparent'
                        }`}
                    >
                        <i className="fa-solid fa-clock"></i> Wochenansicht
                    </button>
                </div>
            </div>
            
            {/* Top Toolbar - Conditional Filters Row */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 relative z-30">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto relative z-40">
                    {/* Conditional Calendar Month Navigator */}
                    {activeView === 'calendar' && (
                        <div className="flex items-center bg-[#0f1322]/40 p-1 rounded-xl border border-white/5 backdrop-blur-md relative z-50">
                            <button
                                onClick={() => {
                                    const prev = new Date(currentMonth);
                                    prev.setMonth(prev.getMonth() - 1);
                                    setCurrentMonth(prev);
                                }}
                                className="px-2 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all text-xs font-bold"
                                title="Vorheriger Monat"
                            >
                                <i className="fa-solid fa-chevron-left"></i>
                            </button>
                            <span className="px-3 py-1.5 text-xs text-white font-bold tracking-wide uppercase font-mono min-w-[120px] text-center">
                                {monthNamesGerman[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                            </span>
                            <button
                                onClick={() => {
                                    const next = new Date(currentMonth);
                                    next.setMonth(next.getMonth() + 1);
                                    setCurrentMonth(next);
                                }}
                                className="px-2 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all text-xs font-bold"
                                title="Nächster Monat"
                            >
                                <i className="fa-solid fa-chevron-right"></i>
                            </button>
                        </div>
                    )}

                    {/* Conditional Date Filter Dropdown for Timeline View */}
                    {activeView === 'timeline' && (
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
                                    <div className="absolute left-0 mt-2 z-50 bg-[#0f1322]/95 border border-white/10 backdrop-blur-xl p-4 rounded-xl shadow-2xl animate-[fadeIn_0.2s_ease-out] w-64">
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
                    )}

                    {/* Interactive Glassmorphic Status Filter Dropdown */}
                    <div className="flex items-center bg-[#0f1322]/40 p-1 rounded-xl border border-white/5 backdrop-blur-md relative z-50">
                        <div className="relative">
                            <button
                                onClick={() => {
                                    setIsStatusDropdownOpen(!isStatusDropdownOpen);
                                    setIsDatePickerOpen(false);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 ${
                                    statusFilter !== 'all'
                                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.18)]'
                                        : 'text-gray-400 hover:text-white border border-transparent'
                                }`}
                            >
                                <i className="fa-solid fa-filter"></i>
                                {statusFilter === 'all' && 'Alle Projekte'}
                                {statusFilter === 'overdue' && '⚠️ Überfällig'}
                                {statusFilter === 'paused' && '⏸️ Pausiert'}
                                {statusFilter === 'completed' && '✅ Abgeschlossen'}
                                <i className={`fa-solid fa-chevron-down text-[9px] transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`}></i>
                            </button>
                            {isStatusDropdownOpen && (
                                <div className="absolute left-0 mt-2 z-50 bg-[#0f1322]/95 border border-white/10 backdrop-blur-xl p-2 rounded-xl shadow-2xl animate-[fadeIn_0.2s_ease-out] w-64 flex flex-col gap-1">
                                    <button
                                        onClick={() => {
                                            setStatusFilter('all');
                                            setIsStatusDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2.5 ${
                                            statusFilter === 'all' ? 'bg-white/10 text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        <i className="fa-solid fa-layer-group text-blue-400"></i> Alle Projekte
                                    </button>
                                    <button
                                        onClick={() => {
                                            setStatusFilter('overdue');
                                            setIsStatusDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2.5 ${
                                            statusFilter === 'overdue' ? 'bg-red-500/10 text-red-400 font-bold' : 'text-gray-400 hover:text-red-400 hover:bg-red-500/5'
                                        }`}
                                    >
                                        <span>⚠️</span> Überfällig
                                    </button>
                                    <button
                                        onClick={() => {
                                            setStatusFilter('paused');
                                            setIsStatusDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2.5 ${
                                            statusFilter === 'paused' ? 'bg-yellow-500/10 text-yellow-400 font-bold' : 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/5'
                                        }`}
                                    >
                                        <span>⏸️</span> Pausiert
                                    </button>
                                    <button
                                        onClick={() => {
                                            setStatusFilter('completed');
                                            setIsStatusDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2.5 ${
                                            statusFilter === 'completed' ? 'bg-blue-500/10 text-blue-400 font-bold' : 'text-gray-400 hover:text-blue-400 hover:bg-blue-500/5'
                                        }`}
                                    >
                                        <span>✅</span> Abgeschlossen
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Search Input */}
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
                </div>

                {canManageProjects && (
                    <button
                        onClick={() => setIsWizardOpen(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] hover:-translate-y-0.5 flex items-center gap-2 text-xs font-semibold whitespace-nowrap w-full md:w-auto justify-center"
                    >
                        <i className="fa-solid fa-wand-magic-sparkles mr-0.5 text-xs"></i> Neues Projekt
                    </button>
                )}
            </div>

            {/* Content Area */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-sm font-medium tracking-wide">Lade Projekte...</p>
                </div>
            ) : statusFilteredProjects.length === 0 ? (
                renderEmptyState()
            ) : (
                <div className="relative">
                    {activeView === 'grid' && renderGridView()}
                    {activeView === 'calendar' && renderCalendarView()}
                    {activeView === 'timeline' && renderTimelineView()}
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
