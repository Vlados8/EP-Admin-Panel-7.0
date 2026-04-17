import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../services/api';
import { useDispatch } from 'react-redux';
import { setBreadcrumbOverride } from '../../store/slices/uiSlice';
import ProjectEditModal from './ProjectEditModal';
import ProjectFileManager from './ProjectFileManager';
import { getImageUrl } from '../../utils/config';
import usePermission from '../../hooks/usePermission';

const ProjectDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { user: currentUser } = useSelector(state => state.auth);
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const canEditProject = usePermission('MANAGE_PROJECTS');
    const canDeleteProject = usePermission('MANAGE_USERS'); // Proxy for Admin/Office
    const canManageStages = usePermission('MANAGE_PROJECTS'); // PL and above can manage all stages
    const isWorker = currentUser?.role?.name === 'Worker' || currentUser?.role === 'Worker';
    const [activeTab, setActiveTab] = useState('info'); // 'info', 'steps', or 'files'
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [editTaskTitle, setEditTaskTitle] = useState('');
    const [editTaskDescription, setEditTaskDescription] = useState('');
    const [editSelectedFiles, setEditSelectedFiles] = useState([]);
    const [imagesToDelete, setImagesToDelete] = useState([]);
    const [newTaskDescription, setNewTaskDescription] = useState('');
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isUpdatingMainImage, setIsUpdatingMainImage] = useState(false);
    const mainImageInputRef = React.useRef(null);

    useEffect(() => {
        const fetchProject = async () => {
            try {
                const res = await api.get(`/projects/${id}`);
                if (res.data?.status === 'success') {
                    const projectData = res.data.data.project;
                    setProject(projectData);
                    dispatch(setBreadcrumbOverride({
                        path: `/projekte/${id}`,
                        title: `Projekte / ${projectData.project_number}`
                    }));
                } else {
                    setProject(res.data);
                }
            } catch (error) {
                console.error('Error fetching project:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProject();

        return () => {
            dispatch(setBreadcrumbOverride(null));
        };
    }, [id, dispatch]);

    const toggleTaskStatus = async (task) => {
        const newStatus = task.status === 'Erledigt' ? 'In Arbeit' : 'Erledigt';
        try {
            const res = await api.patch(`/project-stages/${task.id}`, { status: newStatus });
            if (res.data?.status === 'success') {
                setProject(prev => ({
                    ...prev,
                    stages: prev.stages.map(t => t.id === task.id ? res.data.data.stage : t)
                }));
            }
        } catch (error) {
            console.error('Error updating stage status:', error);
        }
    };

    const handleDeleteProject = async () => {
        if (window.confirm(`Möchten Sie das Projekt "${project.title}" und alle zugehörigen Daten (inkl. Bilder) WIRKLICH löschen?\n\nDies kann nicht rückgängig gemacht werden.`)) {
            try {
                await api.delete(`/projects/${project.id}`);
                navigate('/projekte'); // Redirect to projects list after deletion
            } catch (error) {
                console.error('Error deleting project:', error);
                alert('Fehler beim Löschen des Projekts.');
            }
        }
    };

    const handleAddTask = async () => {
        if (!newTaskTitle.trim()) return;
        try {
            const formData = new FormData();
            formData.append('title', newTaskTitle);
            formData.append('description', newTaskDescription);
            formData.append('project_id', project.id);

            // Fallback for assignee
            const assigneeId = managers[0]?.user_id || (project.assigned_personnel?.[0]?.user_id);
            if (assigneeId) formData.append('assigned_to_id', assigneeId);

            selectedFiles.forEach(file => {
                formData.append('images', file);
            });

            const res = await api.post('/project-stages', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data?.status === 'success' && res.data.data?.stage) {
                const newStage = res.data.data.stage;
                setProject(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        stages: [...(prev.stages || []), newStage]
                    };
                });
                setNewTaskTitle('');
                setNewTaskDescription('');
                setSelectedFiles([]);
                setIsAddingTask(false);
            } else {
                console.error('Invalid response from server:', res.data);
                alert('Fehler beim Hinzufügen des Arbeitsschritts: Ungültige Server-Antwort');
            }
        } catch (error) {
            console.error('Error adding stage:', error);
            const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Fehler beim Hinzufügen der Etappe.';
            alert(errorMsg);
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('Möchten Sie diese Etappe wirklich löschen?')) return;
        try {
            await api.delete(`/project-stages/${taskId}`);
            setProject(prev => ({
                ...prev,
                stages: prev.stages.filter(t => t.id !== taskId)
            }));
        } catch (error) {
            console.error('Error deleting stage:', error);
        }
    };

    const handleStartEditTask = (task) => {
        setEditingTaskId(task.id);
        setEditTaskTitle(task.title);
        setEditTaskDescription(task.description || '');
        setEditSelectedFiles([]);
        setImagesToDelete([]);
    };

    const handleSaveTaskEdit = async (taskId) => {
        if (!editTaskTitle.trim()) return;
        try {
            const formData = new FormData();
            formData.append('title', editTaskTitle);
            formData.append('description', editTaskDescription);

            if (imagesToDelete.length > 0) {
                formData.append('imagesToDelete', JSON.stringify(imagesToDelete));
            }

            editSelectedFiles.forEach(file => {
                formData.append('images', file);
            });

            const res = await api.patch(`/project-stages/${taskId}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data?.status === 'success') {
                const updatedStage = res.data.data.stage;
                setProject(prev => ({
                    ...prev,
                    stages: prev.stages.map(t => t.id === taskId ? updatedStage : t)
                }));
                setEditingTaskId(null);
                setEditSelectedFiles([]);
                setImagesToDelete([]);
            }
        } catch (error) {
            console.error('Error updating stage:', error);
            const errorMsg = error.response?.data?.message || 'Fehler beim Aktualisieren der Etappe.';
            alert(errorMsg);
        }
    };

    const handleMainImageChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUpdatingMainImage(true);
        try {
            const formData = new FormData();
            formData.append('mainImage', file);

            const res = await api.patch(`/projects/${id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data?.status === 'success') {
                const updatedProject = res.data.data.project;
                setProject(updatedProject);
            }
        } catch (error) {
            console.error('Error updating project avatar:', error);
            alert('Fehler beim Aktualisieren des Projektbildes.');
        } finally {
            setIsUpdatingMainImage(false);
            // Clear input
            if (mainImageInputRef.current) mainImageInputRef.current.value = '';
        }
    };

    const handleConfirmOffer = async () => {
        if (!window.confirm('Möchten Sie dieses Angebot подтвердить и проект активировать?')) return;
        try {
            const res = await api.post(`/offers/confirm/${id}`);
            if (res.data?.status === 'success') {
                alert('Project успешно активирован!');
                // Re-fetch project
                const updatedRes = await api.get(`/projects/${id}`);
                if (updatedRes.data?.status === 'success') {
                    setProject(updatedRes.data.data.project);
                }
            }
        } catch (error) {
            console.error('Error confirming offer:', error);
            alert('Fehler beim Aktivieren des Projekts.');
        }
    };

    if (loading) {
        return <div className="text-gray-400 text-center py-20 flex-1">Lade Projektdetails...</div>;
    }

    if (!project) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <i className="fa-solid fa-folder-open text-4xl mb-4 opacity-50"></i>
                <p>Projekt nicht gefunden.</p>
                <button onClick={() => navigate('/projekte')} className="mt-4 text-blue-400 hover:underline">
                    Zurück zur Übersicht
                </button>
            </div>
        );
    }

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

    // Group personnel by role
    const managers = project.assigned_personnel?.filter(ap => ap.role === 'projektleiter') || [];
    const groupLeaders = project.assigned_personnel?.filter(ap => ap.role === 'gruppenleiter') || [];
    const workers = project.assigned_personnel?.filter(ap => ap.role === 'worker') || [];

    return (
        <div className="animate-[fadeIn_0.3s_ease-out_forwards] flex-1 flex flex-col">
            {/* Header Navigation */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/projekte')}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors border border-white/10"
                    >
                        <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-white">{project.title}</h2>
                            <span className="bg-black/30 text-gray-300 text-xs px-2.5 py-1 rounded-lg font-mono font-medium border border-white/10">
                                {project.project_number}
                            </span>
                            <span className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${getStatusStyles(project.status)}`}>
                                {project.status}
                            </span>
                            {project.source_inquiry && (
                                <button
                                    onClick={() => navigate('/anfragen', { state: { openInquiryId: project.source_inquiry.id } })}
                                    className="text-[10px] px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all flex items-center gap-1.5 font-bold uppercase tracking-wider"
                                    title="Original-Anfrage anzeigen"
                                >
                                    <i className="fa-solid fa-link text-[8px]"></i>
                                    Anfrage #INQ-{String(project.source_inquiry.id).padStart(3, '0')}
                                </button>
                            )}
                        </div>
                        {project.client && (
                            <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
                                <i className="fa-solid fa-building text-gray-500"></i>
                                {project.client.company_name || project.client.name || project.client.contact_person}
                            </p>
                        )}
                    </div>
                </div>
                
                {canEditProject && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/angebote/neu', { state: { clientId: project.client_id, projectTitle: project.title, parentProjectId: project.id, parentProjectNumber: project.project_number } })}
                            className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 px-4 py-2 rounded-xl transition-all flex items-center gap-2 text-sm font-medium"
                            title="Ergänzungsangebot für dieses Projekt erstellen"
                        >
                            <i className="fa-solid fa-file-invoice"></i>
                            Angebot erstellen
                        </button>
                        <button
                            onClick={() => setIsEditModalOpen(true)}
                            className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-4 py-2 rounded-xl transition-all flex items-center gap-2 text-sm font-medium"
                        >
                            <i className="fa-solid fa-pen-to-square"></i>
                            Projekt bearbeiten
                        </button>
                    </div>
                )}
            </div>

            {/* Offer Activation Banner */}
            {project.status === 'angebot' && (
                <div className="mb-8 glass-panel border-blue-500/30 bg-blue-500/5 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 animate-[fadeInUp_0.4s_ease-out]">
                    <div className="flex items-center gap-5 text-center md:text-left">
                        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400 text-2xl shadow-lg">
                            <i className="fa-solid fa-file-signature"></i>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white mb-1">Angebot aktiv</h3>
                            <p className="text-gray-400 text-sm max-w-sm">Dies ist ein Entwurf. Bestätigen Sie das Angebot, um standardmäßige Projektordner zu erstellen и начать работу.</p>
                        </div>
                    </div>
                    <button
                        onClick={handleConfirmOffer}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-xl transition-all font-bold shadow-xl shadow-blue-600/20 active:scale-95 flex items-center gap-3 whitespace-nowrap"
                    >
                        <i className="fa-solid fa-check-double"></i>
                        Angebot annehmen
                    </button>
                </div>
            )}

            {/* Tabs Navigation */}
            <div className="flex items-center gap-1 mb-8 border-b border-white/10 overflow-x-auto whitespace-nowrap scrollbar-hide -mx-4 px-4">
                <button
                    onClick={() => setActiveTab('info')}
                    className={`px-6 py-3 text-sm font-medium transition-all relative ${activeTab === 'info' ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    Hauptinformationen
                    {activeTab === 'info' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('steps')}
                    className={`px-6 py-3 text-sm font-medium transition-all relative ${activeTab === 'steps' ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    Etappen (Bauschritte)
                    {activeTab === 'steps' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('files')}
                    className={`px-6 py-3 text-sm font-medium transition-all relative ${activeTab === 'files' ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    <i className="fa-solid fa-folder-open mr-2"></i>Dateien
                    {activeTab === 'files' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>}
                </button>
            </div>

            {/* Tab: Main Information */}
            {activeTab === 'info' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-[fadeIn_0.3s_ease-out]">
                    {/* Hidden Input for main image */}
                    <input
                        type="file"
                        ref={mainImageInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleMainImageChange}
                    />

                    {/* Main Content Info */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Hero Banner / Progress */}
                        <div className="glass-card rounded-2xl p-6 relative overflow-hidden min-h-[200px] flex flex-col justify-end group">
                            {project.main_image ? (
                                <img
                                    src={getImageUrl(project.main_image)}
                                    alt="Project Hero"
                                    className="absolute inset-0 w-full h-full object-cover opacity-20"
                                />
                            ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-30"></div>
                            )}

                            {/* Edit Avatar Button */}
                            {canEditProject && (
                                <div className="absolute top-4 left-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => mainImageInputRef.current?.click()}
                                        disabled={isUpdatingMainImage}
                                        className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition-all backdrop-blur-md shadow-lg"
                                        title="Hintergrundbild ändern"
                                    >
                                        {isUpdatingMainImage ? (
                                            <i className="fa-solid fa-circle-notch animate-spin"></i>
                                        ) : (
                                            <i className="fa-solid fa-camera"></i>
                                        )}
                                    </button>
                                </div>
                            )}

                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

                            <div className="relative z-10">
                                <h3 className="text-lg font-semibold text-white mb-4">Projektfortschritt</h3>
                                <div className="flex items-end justify-between mb-2">
                                    <div className="text-4xl font-bold text-white">{project.progress}<span className="text-xl text-gray-500">%</span></div>
                                    <div className="text-sm text-gray-400">Zuletzt aktualisiert: Heute</div>
                                </div>
                                <div className="w-full bg-black/40 rounded-full h-3 border border-white/5 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ease-out ${getProgressColor(project.progress)} relative`}
                                        style={{ width: `${project.progress}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/20"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Details Card */}
                        <div className="glass-card rounded-2xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-6 border-b border-white/10 pb-4">Projektdetails</h3>

                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">Beschreibung</h4>
                                    <div className="text-gray-200 text-sm whitespace-pre-wrap leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5">
                                        {project.description || <span className="text-gray-400 italic">Keine Beschreibung hinterlegt.</span>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-2">
                                            <i className="fa-solid fa-location-dot"></i> Standort
                                        </h4>
                                        <p className="text-white text-sm">{project.address || '-'}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-2">
                                            <i className="fa-solid fa-euro-sign"></i> Budget
                                        </h4>
                                        <p className="text-white text-sm">
                                            {project.budget !== undefined && project.budget !== null
                                                ? new Number(project.budget).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
                                                : '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <h4 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-2">
                                            <i className="fa-regular fa-calendar"></i> Erstellt am
                                        </h4>
                                        <p className="text-white text-sm">{project.createdAt ? new Date(project.createdAt).toLocaleDateString('de-DE') : '-'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Survey/Answers Card */}
                        {(project.category || (project.answers && project.answers.length > 0)) && (
                            <div className="glass-card rounded-2xl p-6 animate-[fadeIn_0.4s_ease-out]">
                                <h3 className="text-lg font-semibold text-white mb-6 border-b border-white/10 pb-4 flex items-center gap-2">
                                    <i className="fa-solid fa-clipboard-list text-blue-400"></i> Projekt-Klassifizierung & Antworten
                                </h3>

                                {/* Category Headers */}
                                {(project.category || project.subcategory) && (
                                    <div className="flex flex-wrap gap-3 mb-6">
                                        {project.category && (
                                            <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-xl">
                                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                                                    <i className={`fa-solid ${project.category.icon || 'fa-folder'}`}></i>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-blue-400/80 uppercase tracking-wider font-bold mb-0.5">Hauptkategorie</div>
                                                    <div className="text-sm font-semibold text-blue-100">{project.category.name}</div>
                                                </div>
                                            </div>
                                        )}
                                        {project.subcategory && (
                                            <div className="flex items-center gap-3 bg-purple-500/10 border border-purple-500/20 px-4 py-2 rounded-xl">
                                                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                                                    <i className="fa-solid fa-layer-group"></i>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-purple-400/80 uppercase tracking-wider font-bold mb-0.5">Unterkategorie</div>
                                                    <div className="text-sm font-semibold text-purple-100">{project.subcategory.name}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Projekt-Klassifizierung & Antworten */}
                                {project.answers && project.answers.length > 0 && (
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                                            <i className="fa-solid fa-list-check"></i> Projekt-Klassifizierung & Antworten
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {project.answers.map((ans) => (
                                                <div key={ans.id} className="bg-white/5 p-4 rounded-xl border border-white/5 group hover:border-blue-500/30 transition-all">
                                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1 group-hover:text-blue-400/80 transition-colors">
                                                        {ans.question?.question_text || 'Unbekannte Frage'}
                                                    </div>
                                                    <div className="text-sm font-semibold text-white group-hover:text-blue-50">
                                                        {ans.custom_value ? ans.custom_value : (ans.answer?.answer_text || '-')}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Sidebar Info */}
                    <div className="space-y-6">
                        {/* Client Info */}
                        <div className="glass-card rounded-2xl p-6">
                            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 border-b border-white/10 pb-3">Kundeninformationen</h3>
                            {project.client ? (
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-blue-400 text-xl font-bold">
                                        {(project.client.name || project.client.company_name)?.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-white">{project.client.company_name || project.client.name}</div>
                                        <div className="text-xs text-gray-400 mt-1">{project.client.email}</div>
                                        <div className="text-xs text-gray-400 mt-0.5">{project.client.phone}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-gray-400 italic">Kein Kunde zugewiesen.</div>
                            )}
                        </div>

                        {/* Team Info */}
                        <div className="glass-card rounded-2xl p-6">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 border-b border-white/10 pb-3">Projektteam</h3>
                            <div className="space-y-4">
                                {managers.length > 0 && (
                                    <div>
                                        <div className="text-xs text-gray-500 mb-2 uppercase select-none">Projektleiter</div>
                                        {managers.map(m => (
                                            <div key={m.id} className="flex items-center gap-3 mb-2">
                                                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 text-xs font-bold border border-blue-500/20">
                                                    {m.user?.name?.charAt(0)}
                                                </div>
                                                <div className="text-sm text-gray-300">{m.user?.name}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {groupLeaders.length > 0 && (
                                    <div>
                                        <div className="text-xs text-gray-500 mb-2 uppercase select-none">Gruppenleiter</div>
                                        {groupLeaders.map(gl => (
                                            <div key={gl.id} className="flex items-center gap-3 mb-2">
                                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xs font-bold border border-emerald-500/20">
                                                    {gl.user?.name?.charAt(0)}
                                                </div>
                                                <div className="text-sm text-gray-300">{gl.user?.name}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {workers.length > 0 && (
                                    <div>
                                        <div className="text-xs text-gray-500 mb-2 uppercase select-none">Mitarbeiter</div>
                                        {workers.map(w => (
                                            <div key={w.id} className="flex items-center gap-3 mb-2">
                                                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 text-xs font-bold border border-amber-500/20">
                                                    {w.user?.name?.charAt(0)}
                                                </div>
                                                <div className="text-sm text-gray-300">{w.user?.name}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {!managers.length && !groupLeaders.length && !workers.length && (
                                    <div className="text-sm text-gray-500 italic">Keine Teammitglieder zugewiesen.</div>
                                )}
                            </div>
                        </div>

                        {/* Subcontractors Info */}
                        <div className="glass-card rounded-2xl p-6">
                            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-4 border-b border-white/10 pb-3 flex items-center gap-2">
                                <i className="fa-solid fa-helmet-safety"></i> Nachunternehmer
                            </h3>
                            <div className="space-y-3">
                                {project.assigned_subcontractors?.length > 0 ? (
                                    project.assigned_subcontractors.map(as => (
                                        <div key={as.id} className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm font-bold text-white">{as.subcontractor?.name}</div>
                                                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">{as.subcontractor?.trade}</div>
                                                </div>
                                                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
                                                    <i className="fa-solid fa-helmet-safety text-xs"></i>
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-white/5 space-y-1.5">
                                                {as.subcontractor?.contact_person && (
                                                    <div className="flex items-center gap-2 text-[11px] text-gray-300">
                                                        <i className="fa-solid fa-user text-gray-500 w-3"></i>
                                                        {as.subcontractor.contact_person}
                                                    </div>
                                                )}
                                                {as.subcontractor?.phone && (
                                                    <div className="flex items-center gap-2 text-[11px] text-blue-400 hover:underline cursor-pointer">
                                                        <i className="fa-solid fa-phone text-gray-500 w-3"></i>
                                                        <a href={`tel:${as.subcontractor.phone}`}>{as.subcontractor.phone}</a>
                                                    </div>
                                                )}
                                                {as.subcontractor?.email && (
                                                    <div className="flex items-center gap-2 text-[11px] text-blue-400 hover:underline cursor-pointer">
                                                        <i className="fa-solid fa-envelope text-gray-500 w-3"></i>
                                                        <a href={`mailto:${as.subcontractor.email}`}>{as.subcontractor.email}</a>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-sm text-gray-500 italic">Keine Nachunternehmer.</div>
                                )}
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="glass-card rounded-2xl p-6 bg-blue-500/5 border-blue-500/10">
                            <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
                                <i className="fa-solid fa-bolt"></i> Schnellaktionen
                            </h3>
                            <div className="space-y-2">
                                <button
                                    onClick={() => {
                                        setActiveTab('steps');
                                        setIsAddingTask(true);
                                    }}
                                    className="w-full bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-lg py-2 text-sm transition-colors text-left px-4 flex items-center gap-3"
                                >
                                    <i className="fa-solid fa-check-square text-emerald-400 w-4"></i> Etappe hinzufügen
                                </button>
                                <button className="w-full bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-lg py-2 text-sm transition-colors text-left px-4 flex items-center gap-3">
                                    <i className="fa-solid fa-note-sticky text-yellow-400 w-4"></i> Notiz anheften
                                </button>
                                <button className="w-full bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-lg py-2 text-sm transition-colors text-left px-4 flex items-center gap-3">
                                    <i className="fa-solid fa-folder text-blue-400 w-4"></i> Dateien verwalten
                                </button>
                            </div>
                        </div>
                    </div>

                    {canDeleteProject && (
                        <div className="glass-card rounded-2xl p-6 border-red-500/20 bg-red-500/5 mt-6">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-red-500 mb-1 flex items-center gap-2">
                                        <i className="fa-solid fa-triangle-exclamation"></i> Gefahrenzone
                                    </h4>
                                    <p className="text-xs text-red-400/80">
                                        Das Löschen des Projekts entfernt alle zugehörigen Daten, Etappen, Antworten und Dateien unwiderruflich von den Servern.
                                    </p>
                                </div>
                                <button
                                    onClick={handleDeleteProject}
                                    className="bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/50 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] whitespace-nowrap flex items-center gap-2"
                                >
                                    <i className="fa-solid fa-trash-can"></i> Projekt löschen
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Tab: Project Steps (Etappen) */}
            {activeTab === 'steps' && (
                <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                    <div className="glass-card rounded-2xl p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <h3 className="text-lg font-semibold text-white">Bauschritte & Etappen</h3>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                                <button
                                    onClick={() => setIsAddingTask(!isAddingTask)}
                                    className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-600/30 transition-all flex items-center justify-center gap-2"
                                >
                                    <i className={`fa-solid ${isAddingTask ? 'fa-xmark' : 'fa-plus'}`}></i>
                                    {isAddingTask ? 'Abbrechen' : 'Etappe hinzufügen'}
                                </button>
                                <div className="text-[10px] md:text-xs text-gray-400 flex items-center justify-around sm:justify-start gap-4 bg-white/5 p-2 sm:p-0 rounded-lg sm:bg-transparent">
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-400"></div> Erledigt</div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-400"></div> In Arbeit</div>
                                </div>
                            </div>
                        </div>

                        {/* Add Task Form */}
                        {isAddingTask && (
                            <div className="mb-6 bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 md:p-6 animate-[slideDown_0.3s_ease-out] space-y-4">
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <input
                                        type="text"
                                        value={newTaskTitle}
                                        onChange={e => setNewTaskTitle(e.target.value)}
                                        placeholder="Etappenname (z.B. Fundament gießen)"
                                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                                        onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                                    />
                                    <button
                                        onClick={handleAddTask}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20"
                                    >
                                        Erstellen
                                    </button>
                                </div>

                                <textarea
                                    value={newTaskDescription}
                                    onChange={e => setNewTaskDescription(e.target.value)}
                                    placeholder="Beschreibung der Etappe (optional)"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                                    rows="3"
                                />

                                <div className="flex flex-col gap-3">
                                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold px-1">Fotos hinzufügen</label>
                                    <div className="flex flex-wrap gap-3">
                                        {selectedFiles.map((file, i) => (
                                            <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 shadow-lg">
                                                <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => setSelectedFiles(selectedFiles.filter((_, idx) => idx !== i))}
                                                    className="absolute top-1 right-1 bg-black/60 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] hover:bg-red-500 transition-colors"
                                                >
                                                    <i className="fa-solid fa-xmark"></i>
                                                </button>
                                            </div>
                                        ))}
                                        <label className="w-20 h-20 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-gray-500 hover:border-blue-500/50 hover:text-blue-400 cursor-pointer transition-all bg-white/5">
                                            <i className="fa-solid fa-camera text-lg"></i>
                                            <span className="text-[10px] mt-1 font-bold">Upload</span>
                                            <input
                                                type="file"
                                                multiple
                                                className="hidden"
                                                onChange={e => setSelectedFiles([...selectedFiles, ...Array.from(e.target.files)])}
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            {project.stages?.length > 0 ? (
                                [...project.stages]
                                    .filter(task => !!task)
                                    .sort((a, b) => (a.id || 0) - (b.id || 0))
                                    .map((task, idx) => (
                                        <div
                                            key={task.id || idx}
                                        className={`p-4 md:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row items-stretch sm:items-center gap-4 group ${task.status === 'Erledigt' ? 'bg-emerald-500/5 border-emerald-500/20 opacity-70' : 'bg-white/5 border-white/10 hover:bg-white/[0.07]'}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center text-gray-500 font-bold border border-white/5 group-hover:border-blue-500/30 transition-colors shrink-0">
                                                {idx + 1}
                                            </div>
                                            {/* Mobile Actions: Show always or on group hover */}
                                            {(canManageStages || task.creator?.id === currentUser.id) && (
                                                <div className="flex sm:hidden items-center gap-4 ml-auto">
                                                    <button onClick={() => handleStartEditTask(task)} className="text-gray-400 hover:text-blue-400 transition-colors p-2">
                                                        <i className="fa-solid fa-pen-to-square"></i>
                                                    </button>
                                                    <button onClick={() => handleDeleteTask(task.id)} className="text-gray-400 hover:text-red-400 transition-colors p-2">
                                                        <i className="fa-solid fa-trash"></i>
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            {editingTaskId === task.id ? (
                                                <div className="flex flex-col gap-4 w-full bg-blue-500/5 p-4 rounded-xl border border-blue-500/20">
                                                    <div className="flex flex-col sm:flex-row gap-4">
                                                        <input
                                                            type="text"
                                                            value={editTaskTitle}
                                                            onChange={e => setEditTaskTitle(e.target.value)}
                                                            className="flex-1 bg-black/40 border border-blue-500/40 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                                                            autoFocus
                                                            placeholder="Titel"
                                                        />
                                                        <div className="flex gap-2">
                                                            <button onClick={() => handleSaveTaskEdit(task.id)} className="flex-1 sm:w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 flex items-center justify-center transition-all border border-emerald-500/30">
                                                                <i className="fa-solid fa-check"></i>
                                                            </button>
                                                            <button onClick={() => setEditingTaskId(null)} className="flex-1 sm:w-10 h-10 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-all border border-red-500/30">
                                                                <i className="fa-solid fa-xmark"></i>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <textarea
                                                        value={editTaskDescription}
                                                        onChange={e => setEditTaskDescription(e.target.value)}
                                                        placeholder="Beschreibung"
                                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                                                        rows="3"
                                                    />

                                                    {/* Manage Existing Images */}
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[10px] text-gray-400 uppercase font-bold px-1">Aktuelle Bilder:</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {task.images?.map(img => (
                                                                <div key={img.id} className={`relative w-16 h-16 rounded-lg overflow-hidden border transition-all ${imagesToDelete.includes(img.id) ? 'border-red-500 opacity-40 grayscale' : 'border-white/10'}`}>
                                                                    <img src={getImageUrl(img.path)} alt="" className="w-full h-full object-cover" />
                                                                    <button
                                                                        onClick={() => {
                                                                            if (imagesToDelete.includes(img.id)) {
                                                                                setImagesToDelete(imagesToDelete.filter(id => id !== img.id));
                                                                            } else {
                                                                                setImagesToDelete([...imagesToDelete, img.id]);
                                                                            }
                                                                        }}
                                                                        className={`absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-lg transition-colors ${imagesToDelete.includes(img.id) ? 'bg-emerald-500 text-white' : 'bg-red-500/80 text-white hover:bg-red-600'}`}
                                                                    >
                                                                        <i className={`fa-solid ${imagesToDelete.includes(img.id) ? 'fa-undo' : 'fa-trash'}`}></i>
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            {!task.images?.length && <div className="text-[10px] text-gray-500 italic px-1">Keine Bilder vorhanden</div>}
                                                        </div>
                                                    </div>

                                                    {/* Add New Images During Edit */}
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[10px] text-gray-400 uppercase font-bold px-1">Neue Bilder hinzufügen:</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {editSelectedFiles.map((file, i) => (
                                                                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-blue-500/30">
                                                                    <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                                                                    <button
                                                                        onClick={() => setEditSelectedFiles(editSelectedFiles.filter((_, idx) => idx !== i))}
                                                                        className="absolute top-0.5 right-0.5 bg-black/60 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                                                                    >
                                                                        <i className="fa-solid fa-xmark"></i>
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            <label className="w-16 h-16 rounded-lg border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-gray-500 hover:border-blue-500/50 hover:text-blue-400 cursor-pointer transition-all">
                                                                <i className="fa-solid fa-plus text-xs"></i>
                                                                <span className="text-[8px] mt-1">Upload</span>
                                                                <input
                                                                    type="file"
                                                                    multiple
                                                                    className="hidden"
                                                                    onChange={e => setEditSelectedFiles([...editSelectedFiles, ...Array.from(e.target.files)])}
                                                                />
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className={`font-bold text-base ${task.status === 'Erledigt' ? 'text-gray-400 line-through' : 'text-white'}`}>{task.title}</div>

                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                                        {task.creator && (
                                                            <div className="text-[11px] md:text-[12px] text-blue-400 font-bold flex items-center gap-1.5">
                                                                <i className="fa-solid fa-user text-[10px]"></i>
                                                                {task.creator.name}
                                                            </div>
                                                        )}
                                                        <div className="text-[11px] md:text-[12px] text-gray-400 flex items-center gap-1.5">
                                                            <i className="fa-solid fa-clock text-[10px]"></i>
                                                            {new Date(task.createdAt).toLocaleString('de-DE', {
                                                                day: '2-digit',
                                                                month: '2-digit',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </div>
                                                    </div>

                                                    {task.description && (
                                                        <div className="text-sm text-gray-300 font-medium leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5 italic">
                                                            {task.description}
                                                        </div>
                                                    )}

                                                    {/* Task Images */}
                                                    {task.images?.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 pt-1">
                                                            {task.images.map(img => (
                                                                <div key={img.id} className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 cursor-pointer hover:border-blue-500/50 transition-all shadow-lg">
                                                                    <img
                                                                        src={getImageUrl(img.path)}
                                                                        alt=""
                                                                        className="w-full h-full object-cover"
                                                                        onClick={() => window.open(getImageUrl(img.path), '_blank')}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-6 pt-4 sm:pt-0 border-t sm:border-t-0 border-white/5 mt-2 sm:mt-0">
                                            {/* Desktop Actions: Hidden on mobile, show on group hover */}
                                            {(canManageStages || task.creator?.id === currentUser.id) && (
                                                <div className="hidden sm:flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleStartEditTask(task)} className="text-gray-400 hover:text-blue-400 transition-colors">
                                                        <i className="fa-solid fa-pen-to-square"></i>
                                                    </button>
                                                    <button onClick={() => handleDeleteTask(task.id)} className="text-gray-400 hover:text-red-400 transition-colors">
                                                        <i className="fa-solid fa-trash"></i>
                                                    </button>
                                                </div>
                                            )}

                                            <button
                                                onClick={() => toggleTaskStatus(task)}
                                                className={`w-14 h-7 rounded-full relative transition-all duration-300 ${task.status === 'Erledigt' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-white/10'}`}
                                            >
                                                <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ease-spring ${task.status === 'Erledigt' ? 'left-8' : 'left-1'}`}></div>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 bg-white/5 border border-white/10 rounded-2xl">
                                    <i className="fa-solid fa-list-check text-4xl text-gray-600 mb-4 opacity-30"></i>
                                    <p className="text-gray-400">Keine Etappen für dieses Projekt definiert.</p>
                                    <button
                                        onClick={() => setIsAddingTask(true)}
                                        className="mt-4 text-blue-400 hover:underline text-sm font-medium"
                                    >
                                        Etappen jetzt hinzufügen
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="glass-card rounded-2xl p-6 bg-purple-500/5 border border-purple-500/10 shadow-inner mt-6">
                        <h4 className="text-xs font-bold text-purple-400 mb-3 uppercase tracking-[0.2em] flex items-center gap-2">
                            <i className="fa-solid fa-circle-info text-sm"></i> Hinweis
                        </h4>
                        <p className="text-xs text-gray-400 leading-relaxed font-medium">
                            Mitarbeiter können Etappen im Bereich <span className="text-gray-300">"Meine Aufgaben"</span> oder direkt hier im Projekt schließen. Jedes Schließen einer Etappe wird im System protokolliert.
                        </p>
                    </div>
                </div>
            )}

            {/* Tab: Files Location */}
            {activeTab === 'files' && (
                <ProjectFileManager project={project} />
            )}

            <ProjectEditModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                project={project}
                onProjectUpdated={() => {
                    // Force a reload so the survey answers and all deep nested relational data refreshes correctly
                    window.location.reload();
                }}
            />
        </div>
    );
};

export default ProjectDetails;
