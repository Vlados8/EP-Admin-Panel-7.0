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
    const canManageProjects = usePermission('MANAGE_PROJECTS');

    const navigate = useNavigate();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [projectsRes, clientsRes] = await Promise.all([
                api.get('/projects'),
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
        if (progress >= 100) return 'bg-emerald-400';
        if (progress > 50) return 'bg-blue-400';
        if (progress > 20) return 'bg-yellow-400';
        return 'bg-red-400';
    };

    const displayedProjects = projects
        .filter(project => {
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
        })
        .sort((a, b) => {
            const getStatusLevel = (p) => {
                const hasPL = (p.assigned_personnel || []).some(pers => pers.role?.toLowerCase() === 'projektleiter' || pers.role?.toLowerCase() === 'pl');
                if (hasPL) return 0; // Normal

                if (!p.start_date) return 1; // Warning (Orange)

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const startDate = new Date(p.start_date);
                startDate.setHours(0, 0, 0, 0);

                const diffDays = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
                if (diffDays <= 0) return 3; // Critical (Purple)
                if (diffDays <= 3) return 2; // Urgent (Red)
                return 1; // Warning (Orange)
            };

            const statusA = getStatusLevel(a);
            const statusB = getStatusLevel(b);

            if (statusA !== statusB) return statusB - statusA;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

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

    return (
        <div className="animate-[fadeIn_0.4s_ease-out_forwards]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Bauprojekte</h2>
                    <p className="text-gray-400 text-sm mt-1">Übersicht und Verwaltung aller Bauprojekte.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input
                            type="text"
                            placeholder="Projekte suchen..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-black/20 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all w-full md:w-64 backdrop-blur-sm"
                        />
                    </div>
                    {canManageProjects && (
                        <button
                            onClick={() => setIsWizardOpen(true)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_25px_rgba(37,99,235,0.6)] hover:-translate-y-0.5 flex items-center gap-2 text-sm font-medium whitespace-nowrap"
                        >
                            <i className="fa-solid fa-wand-magic-sparkles mr-1"></i> Neues Projekt
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="text-gray-400 text-center py-10">Lade Projekte...</div>
            ) : displayedProjects.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center text-gray-400 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]">
                    <i className="fa-solid fa-magnifying-glass text-4xl mb-4 opacity-20"></i>
                    <p className="text-lg">Keine Projekte gefunden.</p>
                    <button onClick={() => setSearchQuery('')} className="mt-4 text-blue-400 hover:text-blue-300 transition-colors text-sm">
                        Suche zurücksetzen
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(Array.isArray(displayedProjects) ? displayedProjects : []).map(project => {
                        const hasPL = (project.assigned_personnel || []).some(p => p.role?.toLowerCase() === 'projektleiter' || p.role?.toLowerCase() === 'pl');

                        let statusLevel = 0; // Normal
                        if (!hasPL) {
                            if (!project.start_date) {
                                statusLevel = 1; // Warning
                            } else {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const startDate = new Date(project.start_date);
                                startDate.setHours(0, 0, 0, 0);
                                const diffDays = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));

                                if (diffDays <= 0) statusLevel = 3; // Critical
                                else if (diffDays <= 3) statusLevel = 2; // Urgent
                                else statusLevel = 1; // Warning
                            }
                        }

                        const highlightClass = statusLevel === 3
                            ? 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                            : statusLevel === 2
                                ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                                : statusLevel === 1
                                    ? 'border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.15)]'
                                    : 'border-white/10 hover:shadow-blue-500/10';

                        const bannerClass = statusLevel === 3
                            ? 'border-purple-500/30'
                            : statusLevel === 2
                                ? 'border-red-500/30'
                                : statusLevel === 1
                                    ? 'border-orange-500/30'
                                    : 'border-white/5';

                        return (
                            <div key={project.id} onClick={() => handleOpenProject(project.id)} className={`bg-[#2a3042]/80 backdrop-blur-md rounded-2xl overflow-hidden flex flex-col hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 cursor-pointer border group ${highlightClass}`}>
                                <div className={`bg-black/40 h-32 relative overflow-hidden flex justify-between items-start border-b ${bannerClass}`}>
                                    {project.main_image ? (
                                        <img
                                            src={getImageUrl(project.main_image)}
                                            alt={project.title}
                                            className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700 scale-100 group-hover:scale-110"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-transparent"></div>
                                    )}

                                    <div className="relative z-10 w-full p-4 flex justify-between items-start">
                                        <span className={`text-[10px] px-2 py-1 rounded-lg font-bold uppercase tracking-wider shadow-lg backdrop-blur-md border border-white/10 ${project.status?.toLowerCase() === 'aktiv' ? 'bg-emerald-500/80 text-white' :
                                            project.status?.toLowerCase() === 'pausiert' ? 'bg-yellow-500/80 text-white' :
                                                project.status?.toLowerCase() === 'abgeschlossen' ? 'bg-blue-500/80 text-white' :
                                                    'bg-gray-500/80 text-white'
                                            }`}>
                                            {project.status || 'Aktiv'}
                                        </span>
                                        <div className="flex flex-col items-end gap-2">
                                            <span className="bg-black/60 backdrop-blur-md text-gray-300 text-[10px] px-2 py-1 rounded-lg font-mono font-bold border border-white/10 shadow-lg">
                                                {project.project_number}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-5 flex-1 flex flex-col justify-between bg-gradient-to-b from-white/5 to-transparent">
                                    <div className="mb-4">
                                        <h3 className="text-xl font-bold text-white mb-1.5 group-hover:text-blue-400 transition-colors">{project.title}</h3>
                                        <p className="text-gray-400 text-sm flex items-center gap-1.5">
                                            <i className="fa-solid fa-location-dot text-blue-500/60"></i> {project.address || `${project.client?.city || ''}, ${project.client?.address || ''}`}
                                        </p>
                                    </div>

                                    <div className="mb-4">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Fortschritt</span>
                                            <span className="text-xs font-medium text-white">{project.progress || 0}%</span>
                                        </div>
                                        <div className="w-full bg-black/40 rounded-full h-2 border border-white/5 overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-1000 ${getProgressColor(project.progress)}`} style={{ width: `${project.progress || 0}%` }}></div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mt-2 group/team">
                                        <div className="flex -space-x-2">
                                            {(project.assigned_personnel || []).slice(0, 3).map((au, i) => {
                                                const uName = au.user?.name || `${au.user?.first_name || ''} ${au.user?.last_name || ''}`;
                                                const initials = uName.split(' ').map(n => n.charAt(0)).join('').toUpperCase().substring(0, 2);
                                                const roleColor = getRoleColor(au.role);
                                                return (
                                                    <div key={i} className={`w-8 h-8 rounded-lg backdrop-blur-md border flex items-center justify-center text-[10px] font-bold shadow-lg transition-transform group-hover/team:translate-x-1 ${roleColor}`} style={{ transitionDelay: `${i * 50}ms` }} title={`${uName} (${au.role})`}>
                                                        {initials || '--'}
                                                    </div>
                                                );
                                            })}
                                            {project.assigned_personnel && project.assigned_personnel.length > 3 && (
                                                <div className="w-8 h-8 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-[10px] font-bold text-gray-300 shadow-lg">
                                                    +{project.assigned_personnel.length - 3}
                                                </div>
                                            )}
                                            {(!project.assigned_personnel || project.assigned_personnel.length === 0) && (
                                                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                                    <i className="fa-solid fa-user-plus text-[10px]"></i>
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-blue-400 text-sm font-medium flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                                            Öffnen <i className="fa-solid fa-arrow-right"></i>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
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
