import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import { toast } from 'react-hot-toast';

const StatCard = ({ title, value, icon, colorClass, delay }) => (
    <div 
        className="glass-card p-6 rounded-3xl border border-white/10 hover:border-white/20 transition-all hover:translate-y-[-4px] duration-500 group relative overflow-hidden animate-[slideUp_0.5s_ease-out_forwards]"
        style={{ animationDelay: `${delay}ms` }}
    >
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-700"></div>
        
        <div className="flex justify-between items-start relative z-10">
            <div>
                <p className="text-gray-400 text-xs uppercase tracking-[0.2em] font-bold mb-2">{title}</p>
                <h3 className="text-3xl md:text-4xl font-black text-white tracking-tight">{value}</h3>
            </div>
            <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center ${colorClass} border border-white/10 shadow-2xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                <i className={`fa-solid ${icon} text-xl md:text-2xl`}></i>
            </div>
        </div>
    </div>
);

const SubcontractorDashboard = ({ user }) => {
    const navigate = useNavigate();
    const { companyData } = useCompany();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    const handleCopyEmail = (email, e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(email)
            .then(() => {
                toast.success('E-Mail-Adresse kopiert!');
            })
            .catch((err) => {
                console.error('Failed to copy email:', err);
                toast.error('Kopieren fehlgeschlagen');
            });
    };

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await api.get('/projects');
                if (res.data?.status === 'success') {
                    setProjects(res.data.data.projects || []);
                }
            } catch (err) {
                console.error('Error fetching projects for subcontractor dashboard:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchProjects();
    }, []);

    const activeProjects = projects.filter(p => p.status?.toLowerCase() === 'aktiv');
    const completedProjects = projects.filter(p => p.status?.toLowerCase() === 'abgeschlossen');

    const getProgressColor = (progress) => {
        if (progress >= 100) return 'bg-emerald-400';
        if (progress > 50) return 'bg-blue-400';
        if (progress > 20) return 'bg-yellow-400';
        return 'bg-red-400';
    };

    const getStatusStyles = (status) => {
        switch (status?.toLowerCase()) {
            case 'aktiv': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
            case 'abgeschlossen': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
            case 'pausiert': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
            default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
        }
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-[fadeIn_0.5s_ease-out]">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                        Willkommen zurück, <span className={`text-transparent bg-clip-text bg-gradient-to-r ${user.isPartner ? 'from-purple-400 to-indigo-400' : 'from-amber-400 to-orange-400'}`}>{user.name || 'Partner'}</span>
                    </h1>
                    <p className="text-gray-400 mt-1 flex items-center gap-2">
                        <i className="fa-regular fa-calendar"></i>
                        {new Date().toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {user.isPartner ? (
                        <div className="px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                            <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Partner-Portal</span>
                        </div>
                    ) : (
                        <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Subunternehmer-Portal</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                <StatCard
                    title="Aktive Projekte"
                    value={loading ? '...' : activeProjects.length}
                    icon="fa-screwdriver-wrench"
                    colorClass="bg-blue-500/20 text-blue-400 shadow-blue-500/10"
                    delay={0}
                />
                <StatCard
                    title="Abgeschlossene Projekte"
                    value={loading ? '...' : completedProjects.length}
                    icon="fa-circle-check"
                    colorClass="bg-emerald-500/20 text-emerald-400 shadow-emerald-500/10"
                    delay={100}
                />
                <StatCard
                    title="Gesamtprojekte"
                    value={loading ? '...' : projects.length}
                    icon="fa-folder-open"
                    colorClass="bg-purple-500/20 text-purple-400 shadow-purple-500/10"
                    delay={200}
                />
            </div>

            {/* Content Split Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                {/* Left: Contact Person (Ansprechpartner) */}
                <div className="lg:col-span-1 glass-card p-6 md:p-8 rounded-3xl border border-white/10 flex flex-col justify-between animate-[slideUp_0.5s_ease-out_0.3s_forwards] opacity-0 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                    
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                                <i className="fa-solid fa-address-book text-blue-400"></i>
                                Ihr Ansprechpartner (Büro)
                            </h3>
                            <span className="text-xs text-gray-500 font-mono">Support-Hotline</span>
                        </div>

                        <p className="text-gray-400 text-sm leading-relaxed mb-8">
                            Haben Sie Fragen zu Ihren Projekten, benötigen Sie Freigaben oder gibt es Probleme auf der Baustelle? 
                            Kontaktieren Sie direkt unser Büro. Wir sind gerne für Sie da!
                        </p>

                        <div className="space-y-6">
                            {/* Company Name & Address */}
                            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                                    <i className="fa-solid fa-building"></i>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">
                                        {companyData.settings.firmName || companyData.name || 'Empire Premium Bau'}
                                    </h4>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {companyData.settings.address || 'Musterstraße 123'}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {companyData.settings.zipCity || '12345 Stadt'}
                                    </p>
                                </div>
                            </div>

                            {/* Hotline Direct Links or Custom Contacts */}
                            {companyData.settings.subcontractorDashboardContacts && companyData.settings.subcontractorDashboardContacts.length > 0 ? (
                                companyData.settings.subcontractorDashboardContacts.map((contact, cIdx) => (
                                    <div key={contact.id || cIdx} className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl space-y-3">
                                        {/* Contact label */}
                                        <div className="text-[10px] text-blue-400 uppercase font-black tracking-widest pl-1">{contact.label}</div>
                                        
                                        {/* Phone link */}
                                        {contact.phone && (
                                            <a 
                                                href={`tel:${contact.phone}`}
                                                className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl flex items-center justify-between transition-all duration-300 shadow-lg shadow-blue-600/20 group/btn"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-white shrink-0 group-hover/btn:rotate-12 transition-transform">
                                                        <i className="fa-solid fa-phone text-xs"></i>
                                                    </div>
                                                    <div>
                                                        <div className="text-[9px] text-blue-200 uppercase font-bold tracking-wider">Telefonisch anrufen</div>
                                                        <div className="text-xs font-bold">{contact.phone}</div>
                                                    </div>
                                                </div>
                                                <i className="fa-solid fa-chevron-right text-white/50 text-xs group-hover/btn:translate-x-1 transition-transform mr-1"></i>
                                            </a>
                                        )}

                                        {/* Email link (if provided) */}
                                        {contact.email && (
                                            <button 
                                                onClick={(e) => handleCopyEmail(contact.email, e)}
                                                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white p-3 rounded-xl flex items-center justify-between transition-all duration-300 group/btn2 cursor-pointer text-left font-normal text-xs"
                                                title="E-Mail-Adresse kopieren"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 shrink-0 group-hover/btn2:scale-105 transition-transform">
                                                        <i className="fa-solid fa-envelope text-xs"></i>
                                                    </div>
                                                    <div>
                                                        <div className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">E-Mail kopieren</div>
                                                        <div className="text-xs font-bold text-gray-200">{contact.email}</div>
                                                    </div>
                                                </div>
                                                <i className="fa-solid fa-chevron-right text-white/30 text-xs group-hover/btn2:translate-x-1 transition-transform mr-1"></i>
                                            </button>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <>
                                    {companyData.settings.phone && (
                                        <a 
                                            href={`tel:${companyData.settings.phone}`}
                                            className="bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-2xl flex items-center justify-between transition-all duration-300 shadow-lg shadow-blue-600/20 group/btn"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white shrink-0 group-hover/btn:rotate-12 transition-transform">
                                                    <i className="fa-solid fa-phone"></i>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-blue-200 uppercase font-black tracking-widest">Telefonisch anrufen</div>
                                                    <div className="text-sm font-bold">{companyData.settings.phone}</div>
                                                </div>
                                            </div>
                                            <i className="fa-solid fa-chevron-right text-white/50 group-hover/btn:translate-x-1 transition-transform mr-2"></i>
                                        </a>
                                    )}

                                    {companyData.settings.email && (
                                        <button 
                                            onClick={(e) => handleCopyEmail(companyData.settings.email, e)}
                                            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white p-4 rounded-2xl flex items-center justify-between transition-all duration-300 group/btn2 cursor-pointer text-left font-normal text-xs"
                                            title="E-Mail-Adresse kopieren"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 shrink-0 group-hover/btn2:scale-105 transition-transform">
                                                    <i className="fa-solid fa-envelope"></i>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-gray-400 uppercase font-black tracking-widest">E-Mail kopieren</div>
                                                    <div className="text-sm font-bold text-gray-200">{companyData.settings.email}</div>
                                                </div>
                                            </div>
                                            <i className="fa-solid fa-chevron-right text-white/30 group-hover/btn2:translate-x-1 transition-transform mr-2"></i>
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Assigned Projects */}
                <div className="lg:col-span-2 glass-card p-6 md:p-8 rounded-3xl border border-white/10 flex flex-col justify-between animate-[slideUp_0.5s_ease-out_0.4s_forwards] opacity-0">
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                                <i className="fa-solid fa-building text-amber-400"></i>
                                Zugeordnete Projekte
                            </h3>
                            <button 
                                onClick={() => navigate('/projekte')} 
                                className="text-xs text-blue-400 hover:underline"
                            >
                                Alle anzeigen
                            </button>
                        </div>

                        <div className="overflow-x-auto w-full max-h-[380px] scrollbar-thin scrollbar-thumb-white/5 pr-1">
                            {loading ? (
                                <div className="text-gray-400 text-center py-12">Lade Projekte...</div>
                            ) : projects.length > 0 ? (
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                            <th className="pb-3 pr-4">Projekt-Nr.</th>
                                            <th className="pb-3 pr-4">Projektname</th>
                                            <th className="pb-3 pr-4">Status</th>
                                            <th className="pb-3 pr-4">Fortschritt</th>
                                            <th className="pb-3 text-right">Aktionen</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {projects.map((project) => (
                                            <tr 
                                                key={project.id}
                                                onClick={() => navigate(`/projekte/${project.id}`)}
                                                className="hover:bg-white/[0.02] cursor-pointer group transition-colors"
                                            >
                                                <td className="py-4 pr-4 font-mono text-xs font-semibold text-gray-400">
                                                    {project.project_number}
                                                </td>
                                                <td className="py-4 pr-4 font-semibold text-white group-hover:text-blue-400 transition-colors">
                                                    <div className="max-w-[180px] md:max-w-[240px] truncate" title={project.title}>
                                                        {project.title}
                                                    </div>
                                                </td>
                                                <td className="py-4 pr-4">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${getStatusStyles(project.status)}`}>
                                                        {project.status}
                                                    </span>
                                                </td>
                                                <td className="py-4 pr-4">
                                                    <div className="flex items-center gap-3 w-32">
                                                        <div className="flex-1 bg-black/40 rounded-full h-1.5 overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full ${getProgressColor(project.progress)} transition-all duration-500`}
                                                                style={{ width: `${project.progress}%` }}
                                                            ></div>
                                                        </div>
                                                        <span className="font-mono text-xs font-bold text-white shrink-0">{project.progress}%</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 text-right">
                                                    <button className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 ml-auto group-hover:translate-x-1 transition-transform">
                                                        Ansehen <i className="fa-solid fa-chevron-right text-[10px]"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-500 italic">
                                    <i className="fa-solid fa-folder-open text-3xl mb-3 opacity-40"></i>
                                    <span>Keine zugeordneten Projekte</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubcontractorDashboard;
