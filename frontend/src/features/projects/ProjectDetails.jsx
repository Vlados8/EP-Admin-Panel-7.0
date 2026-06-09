import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../services/api';
import { useDispatch } from 'react-redux';
import { setBreadcrumbOverride } from '../../store/slices/uiSlice';
import ProjectEditModal from './ProjectEditModal';
import ProjectFileManager from './ProjectFileManager';
import MediaViewer from '../../components/common/MediaViewer';
import { getImageUrl } from '../../utils/config';
import usePermission from '../../hooks/usePermission';
import { useCompany } from '../../context/CompanyContext';

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
    const isGroupLeader = currentUser?.role?.name === 'Gruppenleiter' || currentUser?.role === 'Gruppenleiter';
    const isSubcontractor = currentUser?.role?.name === 'Subcontractor' || currentUser?.role === 'Subcontractor';
    const hideBudget = isWorker || isGroupLeader || (isSubcontractor && !currentUser?.isPartner);
    const hasEndClient = project ? !!(project.client_first_name || project.client_last_name || project.client_phone || project.client_email) : false;
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

    const { companyData } = useCompany();
    const [routeInfo, setRouteInfo] = useState(null);
    const [calculatingRoute, setCalculatingRoute] = useState(false);
    
    // Wetter & Koordinaten State
    const [projectCoords, setProjectCoords] = useState(null);
    const [weatherForecast, setWeatherForecast] = useState(null);
    const [loadingWeather, setLoadingWeather] = useState(false);

    // Bautagebuch (Journal) State
    const [diaryLogs, setDiaryLogs] = useState([]);
    const [loadingDiary, setLoadingDiary] = useState(false);
    const [isAddingLog, setIsAddingLog] = useState(false);
    const [newLogTitle, setNewLogTitle] = useState('');
    const [newLogContent, setNewLogContent] = useState('');
    const [newLogCategory, setNewLogCategory] = useState('blue'); // blue (Info), green (Fortschritt), yellow (Wichtig), red (Problem)
    const [newLogDate, setNewLogDate] = useState(new Date().toISOString().split('T')[0]);
    const [newLogFiles, setNewLogFiles] = useState([]);
    const [newLogIsPinned, setNewLogIsPinned] = useState(false);
    const logFileInputRef = React.useRef(null);

    // Media Viewer State for feed images
    const [isMediaViewerOpen, setIsMediaViewerOpen] = useState(false);
    const [mediaViewerItems, setMediaViewerItems] = useState([]);
    const [mediaViewerIndex, setMediaViewerIndex] = useState(0);

    const openMediaViewer = (attachments, initialIdx) => {
        setMediaViewerItems(attachments);
        setMediaViewerIndex(initialIdx);
        setIsMediaViewerOpen(true);
    };

    // States for Bautagebuch note upload progress and button disabling
    const [isSavingLog, setIsSavingLog] = useState(false);
    const [logUploadProgress, setLogUploadProgress] = useState(0);

    // States for Etappen (Stages) upload progress and button disabling
    const [isSavingTask, setIsSavingTask] = useState(false);
    const [taskUploadProgress, setTaskUploadProgress] = useState(0);

    // Haversine fallback formula for straight line distance
    const haversineDistance = (lat1, lon1, lat2, lon2) => {
        const toRad = (x) => x * Math.PI / 180;
        const R = 6371; // Earth radius in km
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const calculateDistance = async (fromAddr, toAddr) => {
        try {
            // 1. Geocode Company address
            const fromRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fromAddr)}&format=json&limit=1`, {
                headers: { 'User-Agent': 'EP-Admin-Panel-Geocoder' }
            });
            const fromData = await fromRes.json();
            if (!fromData || fromData.length === 0) return null;
            const fromLat = parseFloat(fromData[0].lat);
            const fromLon = parseFloat(fromData[0].lon);

            // 2. Geocode Project address
            const toRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(toAddr)}&format=json&limit=1`, {
                headers: { 'User-Agent': 'EP-Admin-Panel-Geocoder' }
            });
            const toData = await toRes.json();
            if (!toData || toData.length === 0) return null;
            const toLat = parseFloat(toData[0].lat);
            const toLon = parseFloat(toData[0].lon);
            
            // Save coordinates to state for weather fetching
            setProjectCoords({ lat: toLat, lon: toLon });

            // 3. Get OSRM road distance
            try {
                const osrmRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=false`);
                const osrmData = await osrmRes.json();
                if (osrmData.code === 'Ok' && osrmData.routes && osrmData.routes.length > 0) {
                    const route = osrmData.routes[0];
                    const distanceKm = (route.distance / 1000).toFixed(1); // Convert meters to km
                    const durationMin = Math.round(route.duration / 60); // Convert seconds to minutes
                    return { distance: distanceKm, duration: durationMin };
                }
            } catch (osrmErr) {
                console.warn('OSRM router failed, using Haversine fallback:', osrmErr);
            }
            
            // Fallback to straight-line distance
            const distanceKm = haversineDistance(fromLat, fromLon, toLat, toLon).toFixed(1);
            return { distance: distanceKm, duration: Math.round(distanceKm * 1.2) }; // Estimate 1.2 min per km
        } catch (err) {
            console.error('Error calculating distance:', err);
            return null;
        }
    };

    // Fetch Weather Forecast when coordinates are available
    useEffect(() => {
        if (projectCoords) {
            setLoadingWeather(true);
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${projectCoords.lat}&longitude=${projectCoords.lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.daily) {
                        const forecast = [];
                        for (let i = 0; i < 3; i++) {
                            forecast.push({
                                date: new Date(data.daily.time[i]).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }),
                                code: data.daily.weathercode[i],
                                tempMax: Math.round(data.daily.temperature_2m_max[i]),
                                tempMin: Math.round(data.daily.temperature_2m_min[i])
                            });
                        }
                        setWeatherForecast(forecast);
                    }
                    setLoadingWeather(false);
                })
                .catch(err => {
                    console.error('Weather forecast fetch error:', err);
                    setLoadingWeather(false);
                });
        }
    }, [projectCoords]);

    const sortLogs = (logs) => {
        return [...logs].sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.date + 'T' + (b.time || '00:00')) - new Date(a.date + 'T' + (a.time || '00:00'));
        });
    };

    // Fetch Bautagebuch (notes) when activeTab is diary or on mount
    const fetchDiaryLogs = async () => {
        try {
            setLoadingDiary(true);
            const res = await api.get(`/notes?projectId=${id}`);
            if (res.data && res.data.status === 'success') {
                setDiaryLogs(sortLogs(res.data.data.notes));
            }
        } catch (err) {
            console.error('Error fetching diary logs:', err);
        } finally {
            setLoadingDiary(false);
        }
    };

    useEffect(() => {
        if (id && (activeTab === 'diary' || activeTab === 'info')) {
            fetchDiaryLogs();
        }
    }, [id, activeTab]);

    const handleAddDiaryLog = async (e) => {
        e.preventDefault();
        if (!newLogTitle.trim() || !newLogContent.trim()) {
            alert('Bitte Titel und Inhalt für den Bautagebucheintrag ausfüllen.');
            return;
        }

        setIsSavingLog(true);
        setLogUploadProgress(0);

        const formData = new FormData();
        formData.append('title', newLogTitle);
        formData.append('content', newLogContent);
        formData.append('date', newLogDate);
        formData.append('color', newLogCategory);
        formData.append('project_id', id);
        formData.append('isPinned', newLogIsPinned);
        formData.append('showInDiary', 'true');

        newLogFiles.forEach(file => {
            formData.append('files', file);
        });

        try {
            const res = await api.post('/notes', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const total = progressEvent.total || 1;
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / total);
                    setLogUploadProgress(percentCompleted);
                }
            });

            if (res.data?.status === 'success') {
                const newNote = res.data.data.note;
                setDiaryLogs(prev => sortLogs([newNote, ...prev]));
                setNewLogTitle('');
                setNewLogContent('');
                setNewLogCategory('blue');
                setNewLogIsPinned(false);
                setNewLogFiles([]);
                setIsAddingLog(false);
            }
        } catch (err) {
            console.error('Error adding Bautagebuch log:', err);
            alert('Fehler beim Speichern des Bautagebucheintrags.');
        } finally {
            setIsSavingLog(false);
            setLogUploadProgress(0);
        }
    };

    const handleTogglePinDiaryLog = async (logId, currentPinnedState) => {
        try {
            const res = await api.patch(`/notes/${logId}`, { isPinned: !currentPinnedState });
            if (res.data?.status === 'success') {
                const updated = res.data.data.note;
                setDiaryLogs(prev => sortLogs(prev.map(l => l.id === logId ? updated : l)));
            }
        } catch (err) {
            console.error('Error toggling pin:', err);
            alert('Fehler beim Anheften/Lösen.');
        }
    };

    const handleDeleteDiaryLog = async (logId) => {
        if (!window.confirm('Möchten Sie diesen Bautagebucheintrag wirklich unwiderruflich löschen?')) return;
        try {
            await api.delete(`/notes/${logId}`);
            setDiaryLogs(prev => prev.filter(l => l.id !== logId));
        } catch (err) {
            console.error('Error deleting note:', err);
            alert('Fehler beim Löschen.');
        }
    };

    const handleLogFileChange = (e) => {
        const files = Array.from(e.target.files);
        setNewLogFiles(prev => [...prev, ...files]);
    };

    const removeLogFile = (index) => {
        setNewLogFiles(prev => prev.filter((_, i) => i !== index));
    };

    // OpenMeteo helpers
    const getWeatherIconClass = (code) => {
        if (code === 0) return 'fa-sun text-yellow-400';
        if ([1, 2, 3].includes(code)) return 'fa-cloud-sun text-blue-300';
        if ([45, 48].includes(code)) return 'fa-smog text-gray-400';
        if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'fa-cloud-showers-heavy text-blue-400';
        if ([71, 73, 75, 77, 85, 86].includes(code)) return 'fa-snowflake text-white';
        if ([95, 96, 99].includes(code)) return 'fa-cloud-bolt text-purple-400';
        return 'fa-cloud text-gray-300';
    };

    const getWeatherDesc = (code) => {
        if (code === 0) return 'Sonnig';
        if ([1, 2, 3].includes(code)) return 'Leicht bewölkt';
        if ([45, 48].includes(code)) return 'Nebel';
        if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Regen';
        if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Schnee';
        if ([95, 96, 99].includes(code)) return 'Gewitter';
        return 'Bewölkt';
    };

    useEffect(() => {
        if (project?.address && companyData?.settings?.address) {
            const fromAddr = `${companyData.settings.address}, ${companyData.settings.zipCity || ''}`;
            const toAddr = project.address;
            
            setCalculatingRoute(true);
            calculateDistance(fromAddr, toAddr).then(info => {
                setRouteInfo(info);
                setCalculatingRoute(false);
            });
        }
    }, [project?.address, companyData?.settings?.address]);

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
        if (!newTaskTitle.trim() || isSavingTask) return;

        setIsSavingTask(true);
        setTaskUploadProgress(0);

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
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const total = progressEvent.total || 1;
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / total);
                    setTaskUploadProgress(percentCompleted);
                }
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
        } finally {
            setIsSavingTask(false);
            setTaskUploadProgress(0);
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
        if (!editTaskTitle.trim() || isSavingTask) return;

        setIsSavingTask(true);
        setTaskUploadProgress(0);

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
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const total = progressEvent.total || 1;
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / total);
                    setTaskUploadProgress(percentCompleted);
                }
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
        } finally {
            setIsSavingTask(false);
            setTaskUploadProgress(0);
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
        if (!window.confirm('Möchten Sie dieses Angebot bestätigen und das Projekt aktivieren?')) return;
        try {
            const res = await api.post(`/offers/confirm/${id}`);
            if (res.data?.status === 'success') {
                alert('Projekt erfolgreich aktiviert!');
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

    const handleEmailClick = (email, e) => {
        if (e) e.preventDefault();
        if (email) {
            navigator.clipboard.writeText(email)
                .then(() => {
                    alert(`E-Mail-Adresse "${email}" wurde in die Zwischenablage kopiert.`);
                })
                .catch(err => {
                    console.error('Fehler beim Kopieren:', err);
                });
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
                        {project.client && (!(isSubcontractor && hasEndClient) || currentUser?.isPartner) && (
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
                            <p className="text-gray-400 text-sm max-w-sm">Dies ist ein Entwurf. Bestätigen Sie das Angebot, um standardmäßige Projektordner zu erstellen und mit der Arbeit zu beginnen.</p>
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
                <button
                    onClick={() => setActiveTab('diary')}
                    className={`px-6 py-3 text-sm font-medium transition-all relative ${activeTab === 'diary' ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    <i className="fa-solid fa-book-open mr-2"></i>Bautagebuch
                    {activeTab === 'diary' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>}
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

                        {/* Pinned Notes Card */}
                        {diaryLogs.some(l => l.isPinned) && (
                            <div className="glass-card rounded-2xl p-6 border-amber-500/20 bg-amber-500/[0.02] shadow-[0_0_20px_rgba(245,158,11,0.05)] animate-[fadeInUp_0.4s_ease-out]">
                                <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <i className="fa-solid fa-thumbtack text-amber-400"></i> Angeheftete Notizen
                                </h3>
                                <div className="space-y-4">
                                    {diaryLogs.filter(l => l.isPinned).map(log => (
                                        <div key={log.id} className="bg-white/5 p-4 rounded-xl border border-white/5 relative group/pinned flex justify-between items-start gap-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className="text-[10px] text-gray-400 font-medium">
                                                        {new Date(log.date).toLocaleDateString('de-DE')} {log.time || ''}
                                                    </span>
                                                    {log.user && (
                                                        <span className="text-[10px] text-blue-400 font-bold">
                                                            von {log.user.name}
                                                        </span>
                                                    )}
                                                    {log.subcontractor && (
                                                        <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1.5">
                                                            von {log.subcontractor.name} <i className="fa-solid fa-helmet-safety text-amber-400 text-[10px]"></i>
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className="text-sm font-bold text-white mb-1">{log.title}</h4>
                                                <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{log.content}</p>
                                                
                                                {/* Photos attached to pinned note */}
                                                {log.attachments?.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 pt-2 mt-2 border-t border-white/5">
                                                        {log.attachments.map((att, attIdx) => (
                                                            <div 
                                                                key={att.id} 
                                                                className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 hover:border-blue-500/50 transition-all cursor-pointer"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openMediaViewer(log.attachments, attIdx);
                                                                }}
                                                            >
                                                                <img 
                                                                    src={getImageUrl(att.file_url || att.original_url)} 
                                                                    alt={att.file_name} 
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleTogglePinDiaryLog(log.id, true)}
                                                className="text-amber-400 hover:text-gray-400 transition-colors p-1"
                                                title="Notiz lösen"
                                            >
                                                <i className="fa-solid fa-thumbtack text-xs"></i>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

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

                                {['Admin', 'Büro', 'Projektleiter'].includes(currentUser?.role?.name || currentUser?.role) && (
                                    <div>
                                        <h4 className="text-xs text-blue-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                                            <i className="fa-solid fa-lock"></i> Interne Beschreibung
                                        </h4>
                                        <div className="text-gray-200 text-sm whitespace-pre-wrap leading-relaxed bg-white/5 p-4 rounded-xl border border-blue-500/25">
                                            {project.internal_description || <span className="text-gray-400 italic">Keine interne Beschreibung hinterlegt.</span>}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="col-span-2 md:col-span-1">
                                        <h4 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-2">
                                            <i className="fa-solid fa-location-dot"></i> Standort
                                        </h4>
                                        <p className="text-white text-sm font-semibold">{project.address || '-'}</p>
                                        
                                        {calculatingRoute && (
                                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 animate-pulse select-none">
                                                <i className="fa-solid fa-circle-notch animate-spin"></i>
                                                Berechne Route...
                                            </div>
                                        )}
                                        {routeInfo && (
                                            <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3 animate-[fadeIn_0.3s_ease-out]">
                                                <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                                                    <i className="fa-solid fa-car-side"></i>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white text-xs">{routeInfo.distance} km Anfahrtsweg</div>
                                                    <div className="text-[10px] text-gray-400">ca. {routeInfo.duration} Min. Fahrtzeit vom Firmensitz</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        {!hideBudget && (
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
                                        )}
                                        {project.start_date && (
                                            <div>
                                                <h4 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-2">
                                                    <i className="fa-regular fa-calendar text-blue-400"></i> Startdatum
                                                </h4>
                                                <p className="text-white text-sm font-semibold">{new Date(project.start_date).toLocaleDateString('de-DE')}</p>
                                            </div>
                                        )}
                                        {project.end_date && (
                                            <div>
                                                <h4 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-2">
                                                    <i className="fa-regular fa-calendar text-emerald-400"></i> Enddatum
                                                </h4>
                                                <p className="text-white text-sm font-semibold">{new Date(project.end_date).toLocaleDateString('de-DE')}</p>
                                            </div>
                                        )}
                                        <div>
                                            <h4 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-2">
                                                <i className="fa-regular fa-calendar"></i> Erstellt am
                                            </h4>
                                            <p className="text-white text-sm">{project.createdAt ? new Date(project.createdAt).toLocaleDateString('de-DE') : '-'}</p>
                                        </div>
                                    </div>

                                    {project.address && (
                                        <div className="col-span-2 mt-2">
                                            <div className="rounded-2xl overflow-hidden border border-white/10 h-64 relative group shadow-inner">
                                                <iframe 
                                                    width="100%" 
                                                    height="100%" 
                                                    frameBorder="0" 
                                                    style={{ border: 0, opacity: 0.8 }} 
                                                    src={`https://maps.google.com/maps?q=${encodeURIComponent(project.address)}&t=&z=14&ie=UTF8&iwloc=&output=embed`} 
                                                    allowFullScreen
                                                    title="Project Location Map"
                                                ></iframe>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Financial Widget */}
                        {!hideBudget && (() => {
                            const budget = parseFloat(project.budget || 0);
                            const estimatedCosts = project.estimated_costs !== undefined && project.estimated_costs !== null
                                ? parseFloat(project.estimated_costs)
                                : budget * 0.65;
                            const profitMargin = budget - estimatedCosts;
                            
                            const costPercent = budget > 0 ? Math.round((estimatedCosts / budget) * 100) : 65;
                            const marginPercent = budget > 0 ? Math.round((profitMargin / budget) * 100) : 35;
                            
                            return (
                                <div className="glass-card rounded-2xl p-6">
                                    <h3 className="text-lg font-semibold text-white mb-6 border-b border-white/10 pb-4 flex items-center gap-2">
                                        <i className="fa-solid fa-chart-pie text-blue-400"></i> Finanzübersicht & Marge
                                    </h3>
                                    <div className="space-y-5">
                                        <div>
                                            <div className="flex justify-between text-xs font-bold text-gray-400 mb-1.5">
                                                <span>Gesamtbudget</span>
                                                <span className="text-white font-black">
                                                    {budget.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                                </span>
                                            </div>
                                            <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden border border-white/10 p-[2px] relative flex">
                                                <div 
                                                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                                                    style={{ width: `${costPercent}%` }}
                                                ></div>
                                                <div 
                                                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                                                    style={{ width: `${marginPercent}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                                <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">
                                                    Geschätzte Kosten ({costPercent}%)
                                                </div>
                                                <div className="text-base font-black text-amber-400">
                                                    {estimatedCosts.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                                </div>
                                            </div>
                                            <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10">
                                                <div className={`text-[10px] uppercase tracking-widest font-bold mb-1 ${profitMargin >= 0 ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                                                    Geplante Marge ({marginPercent}%)
                                                </div>
                                                <div className={`text-base font-black ${profitMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {profitMargin.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Survey/Answers Card */}
                        {(project.category || (project.answers && project.answers.length > 0)) && (
                            <div className="glass-card rounded-2xl p-6 animate-[fadeIn_0.4s_ease-out]">
                                <h3 className="text-lg font-semibold text-white mb-6 border-b border-white/10 pb-4 flex items-center gap-2">
                                    <i className="fa-solid fa-clipboard-list text-blue-400"></i> Projekt-Klassifizierung & Antworten
                                </h3>

                                {/* Category Headers (Multi-Category Support) */}
                                {((project.categories_list && project.categories_list.length > 0) || project.category || project.subcategory) && (
                                    <div className="flex flex-wrap gap-4 mb-6">
                                        {project.categories_list && project.categories_list.length > 0 ? (
                                            project.categories_list.map((catItem, idx) => (
                                                <div key={idx} className="flex flex-wrap items-center gap-2 bg-white/5 border border-white/10 p-3 rounded-2xl animate-[fadeIn_0.3s_ease-out]">
                                                    {catItem.category && (
                                                        <div className="flex items-center gap-2.5 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-xl">
                                                            <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs">
                                                                <i className={`fa-solid ${catItem.category.icon || 'fa-folder'}`}></i>
                                                            </div>
                                                            <div>
                                                                <div className="text-[9px] text-blue-400/80 uppercase tracking-wider font-bold">Hauptkategorie</div>
                                                                <div className="text-xs font-semibold text-blue-100">{catItem.category.name}</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {catItem.subcategory && (
                                                        <div className="flex items-center gap-2.5 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-xl">
                                                            <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs">
                                                                <i className="fa-solid fa-layer-group"></i>
                                                            </div>
                                                            <div>
                                                                <div className="text-[9px] text-purple-400/80 uppercase tracking-wider font-bold">Unterkategorie</div>
                                                                <div className="text-xs font-semibold text-purple-100">{catItem.subcategory.name}</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <>
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
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Projekt-Klassifizierung & Antworten (Grouped by Category/Subcategory) */}
                                {(() => {
                                    if (!project.answers || project.answers.length === 0) return null;
                                    
                                    const groups = {};
                                    project.answers.forEach(ans => {
                                        const subId = ans.question?.subcategory_id;
                                        let groupKey = "Sonstiges";
                                        let categoryName = "";
                                        let subcategoryName = "";
                                        let categoryIcon = "fa-clipboard-list";
                                        
                                        if (project.categories_list && project.categories_list.length > 0) {
                                            const match = project.categories_list.find(item => item.subcategory?.id === subId);
                                            if (match) {
                                                categoryName = match.category?.name || "";
                                                subcategoryName = match.subcategory?.name || "";
                                                categoryIcon = match.category?.icon || "fa-folder";
                                            }
                                        }
                                        
                                        if (!categoryName && project.category) {
                                            if (project.subcategory?.id === subId || !subId) {
                                                categoryName = project.category.name || "";
                                                subcategoryName = project.subcategory?.name || "";
                                                categoryIcon = project.category.icon || "fa-folder";
                                            }
                                        }
                                        
                                        if (categoryName) {
                                            groupKey = subcategoryName ? `${categoryName} - ${subcategoryName}` : categoryName;
                                        }
                                        
                                        if (!groups[groupKey]) {
                                            groups[groupKey] = {
                                                categoryName,
                                                subcategoryName,
                                                categoryIcon,
                                                answers: []
                                            };
                                        }
                                        groups[groupKey].answers.push(ans);
                                    });

                                    return (
                                        <div className="space-y-6">
                                            <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2 mb-2">
                                                <i className="fa-solid fa-list-check"></i> Spezifische Fragen & Antworten
                                            </h3>
                                            
                                            {Object.keys(groups).map((groupKey, gIdx) => {
                                                const group = groups[groupKey];
                                                return (
                                                    <div key={gIdx} className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-4 animate-[fadeIn_0.3s_ease-out]">
                                                        {/* Group Header Card */}
                                                        <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 px-4 py-3 rounded-xl">
                                                            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                                                                <i className={`fa-solid ${group.categoryIcon || 'fa-folder'}`}></i>
                                                            </div>
                                                            <div>
                                                                <div className="text-[9px] text-blue-400 uppercase tracking-widest font-black">Hauptkategorie: {group.categoryName || 'Sonstiges'}</div>
                                                                <div className="text-xs font-semibold text-white">{group.subcategoryName || 'Allgemeine Angaben'}</div>
                                                            </div>
                                                        </div>

                                                        {/* Question Answers Grid */}
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {group.answers.map((ans) => (
                                                                <div key={ans.id} className="bg-[#0a101d]/60 p-4 rounded-xl border border-white/5 group hover:border-blue-500/30 transition-all">
                                                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1.5 group-hover:text-blue-400/80 transition-colors">
                                                                        {ans.question?.question_text || 'Unbekannte Frage'}
                                                                    </div>
                                                                    <div className="text-sm font-semibold text-white group-hover:text-blue-50">
                                                                        {ans.custom_value ? ans.custom_value : (ans.answer?.answer_text || '-')}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    {/* Sidebar Info */}
                    <div className="space-y-6">
                        {/* Weather Forecast Widget */}
                        {project.address && (
                            <div className="glass-card rounded-2xl p-6">
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 border-b border-white/10 pb-3 flex items-center gap-2">
                                    <i className="fa-solid fa-cloud-sun text-blue-400"></i> Wetter vor Ort
                                </h3>
                                {loadingWeather && (
                                    <div className="flex items-center justify-center py-6 text-xs text-gray-500 animate-pulse">
                                        <i className="fa-solid fa-circle-notch animate-spin mr-2"></i> Lade Wetterdaten...
                                    </div>
                                )}
                                {!loadingWeather && weatherForecast && (
                                    <div className="grid grid-cols-3 gap-3">
                                        {weatherForecast.map((w, idx) => (
                                            <div key={idx} className="bg-white/5 p-3 rounded-xl border border-white/5 text-center flex flex-col items-center justify-between gap-2 hover:bg-white/10 transition-all">
                                                <span className="text-[10px] text-gray-400 font-bold uppercase">{w.date}</span>
                                                <div className="text-xl">
                                                    <i className={`fa-solid ${getWeatherIconClass(w.code)}`}></i>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-white">{w.tempMax}°C</span>
                                                    <span className="text-[9px] text-gray-500">{w.tempMin}°C</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {!loadingWeather && !weatherForecast && (
                                    <div className="text-xs text-gray-500 italic text-center py-4">Wetterdaten nicht verfügbar</div>
                                )}
                            </div>
                        )}

                        {/* Client Info */}
                        <div className="glass-card rounded-2xl p-6">
                            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 border-b border-white/10 pb-3 flex items-center justify-between">
                                <span>Auftraggeber & Kontakt</span>
                                <i className="fa-solid fa-user-tie text-emerald-400"></i>
                            </h3>
                            
                            {project.client && (!(isSubcontractor && hasEndClient) || currentUser?.isPartner) && (
                                <div className="flex items-start gap-4 mb-4 pb-4 border-b border-white/5">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-blue-400 text-sm font-bold shrink-0">
                                        <i className="fa-solid fa-building"></i>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">Kundenfirma</div>
                                        <div className="font-semibold text-white truncate">{project.client.company_name || project.client.name}</div>
                                        {project.client.contact_person && (!isSubcontractor || currentUser?.isPartner) && (
                                            <div className="text-xs text-emerald-400 font-medium mt-0.5 flex items-center gap-1.5">
                                                <i className="fa-regular fa-user text-emerald-400/80 text-[10px]"></i>
                                                {project.client.contact_person}
                                            </div>
                                        )}
                                        {project.client.email && (!isSubcontractor || currentUser?.isPartner) ? (
                                            <button 
                                                onClick={(e) => handleEmailClick(project.client.email, e)}
                                                className="text-xs text-blue-400 hover:underline truncate mt-0.5 block text-left"
                                            >
                                                {project.client.email}
                                            </button>
                                        ) : null}
                                        {project.client.phone && (!isSubcontractor || currentUser?.isPartner) && (
                                            <div className="text-xs text-gray-400 truncate mt-0.5">{project.client.phone}</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {(project.client_first_name || project.client_last_name || project.client_phone || project.client_email) ? (
                                <div className="space-y-3">
                                    <div>
                                        <div className="text-[10px] text-emerald-400 uppercase font-bold mb-0.5">Projekt-Ansprechpartner</div>
                                        <div className="font-semibold text-white flex items-center gap-2">
                                            <i className="fa-regular fa-user text-gray-400"></i>
                                            {project.client_first_name || ''} {project.client_last_name || ''}
                                        </div>
                                    </div>
                                    
                                    {project.client_phone && (
                                        <div>
                                            <div className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">Telefon</div>
                                            <a href={`tel:${project.client_phone}`} className="text-sm text-blue-400 hover:underline flex items-center gap-2">
                                                <i className="fa-solid fa-phone text-gray-400 text-xs"></i>
                                                {project.client_phone}
                                            </a>
                                        </div>
                                    )}
                                    
                                    {project.client_email && (
                                        <div>
                                            <div className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">E-Mail</div>
                                            <button 
                                                onClick={(e) => handleEmailClick(project.client_email, e)}
                                                className="text-sm text-blue-400 hover:underline flex items-center gap-2 truncate block text-left w-full cursor-pointer"
                                            >
                                                <i className="fa-solid fa-envelope text-gray-400 text-xs"></i>
                                                {project.client_email}
                                            </button>
                                        </div>
                                    )}

                                    {project.client_address && (
                                        <div>
                                            <div className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">Kontakt-Adresse</div>
                                            <div className="text-xs text-gray-300 flex items-start gap-2">
                                                <i className="fa-solid fa-location-dot text-gray-400 text-xs mt-0.5"></i>
                                                <span>{project.client_address}</span>
                                            </div>
                                        </div>
                                    )}

                                    {project.client_notes && (!isSubcontractor || currentUser?.isPartner) && (
                                        <div className="pt-2 border-t border-white/5">
                                            <div className="text-[10px] text-emerald-400 uppercase font-bold mb-1">Kunden-Notizen (intern)</div>
                                            <div className="text-xs text-gray-300 bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-lg leading-relaxed whitespace-pre-wrap">
                                                {project.client_notes}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                !project.client && <div className="text-sm text-gray-400 italic">Keine Ansprechpartner-Informationen hinterlegt.</div>
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
                                            <div key={m.id} className="flex items-start bg-white/[0.02] border border-white/5 p-3 rounded-xl hover:bg-white/[0.05] transition-all mb-2.5">
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 text-xs font-bold border border-blue-500/20 shrink-0 mt-0.5">
                                                        {m.user?.name?.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0 space-y-0.5">
                                                        <div className="text-sm font-semibold text-white truncate">{m.user?.name}</div>
                                                        {m.user?.specialty && <div className="text-[10px] text-gray-400 truncate">{m.user.specialty}</div>}
                                                        {m.user?.phone && (
                                                            <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-1 select-text">
                                                                <i className="fa-solid fa-phone text-blue-400 w-3 text-center"></i>
                                                                <a href={`tel:${m.user.phone}`} className="hover:text-blue-400 transition-colors">{m.user.phone}</a>
                                                            </div>
                                                        )}
                                                        {m.user?.email && (
                                                            <div className="text-[11px] text-gray-400 flex items-center gap-1.5 select-text">
                                                                <i className="fa-solid fa-envelope text-blue-400 w-3 text-center"></i>
                                                                <button 
                                                                    onClick={(e) => handleEmailClick(m.user.email, e)}
                                                                    className="hover:text-blue-400 transition-colors text-left truncate cursor-pointer"
                                                                >
                                                                    {m.user.email}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {groupLeaders.length > 0 && (
                                    <div>
                                        <div className="text-xs text-gray-500 mb-2 uppercase select-none">Gruppenleiter</div>
                                        {groupLeaders.map(gl => (
                                            <div key={gl.id} className="flex items-start bg-white/[0.02] border border-white/5 p-3 rounded-xl hover:bg-white/[0.05] transition-all mb-2.5">
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xs font-bold border border-emerald-500/20 shrink-0 mt-0.5">
                                                        {gl.user?.name?.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0 space-y-0.5">
                                                        <div className="text-sm font-semibold text-white truncate">{gl.user?.name}</div>
                                                        {gl.user?.specialty && <div className="text-[10px] text-gray-400 truncate">{gl.user.specialty}</div>}
                                                        {gl.user?.phone && (
                                                            <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-1 select-text">
                                                                <i className="fa-solid fa-phone text-emerald-400 w-3 text-center"></i>
                                                                <a href={`tel:${gl.user.phone}`} className="hover:text-emerald-400 transition-colors">{gl.user.phone}</a>
                                                            </div>
                                                        )}
                                                        {gl.user?.email && (
                                                            <div className="text-[11px] text-gray-400 flex items-center gap-1.5 select-text">
                                                                <i className="fa-solid fa-envelope text-emerald-400 w-3 text-center"></i>
                                                                <button 
                                                                    onClick={(e) => handleEmailClick(gl.user.email, e)}
                                                                    className="hover:text-emerald-400 transition-colors text-left truncate cursor-pointer"
                                                                >
                                                                    {gl.user.email}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {workers.length > 0 && (
                                    <div>
                                        <div className="text-xs text-gray-500 mb-2 uppercase select-none">Mitarbeiter</div>
                                        {workers.map(w => (
                                            <div key={w.id} className="flex items-start bg-white/[0.02] border border-white/5 p-3 rounded-xl hover:bg-white/[0.05] transition-all mb-2.5">
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 text-xs font-bold border border-amber-500/20 shrink-0 mt-0.5">
                                                        {w.user?.name?.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0 space-y-0.5">
                                                        <div className="text-sm font-semibold text-white truncate">{w.user?.name}</div>
                                                        {w.user?.specialty && <div className="text-[10px] text-gray-400 truncate">{w.user.specialty}</div>}
                                                        {w.user?.phone && (
                                                            <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-1 select-text">
                                                                <i className="fa-solid fa-phone text-amber-400 w-3 text-center"></i>
                                                                <a href={`tel:${w.user.phone}`} className="hover:text-amber-400 transition-colors">{w.user.phone}</a>
                                                            </div>
                                                        )}
                                                        {w.user?.email && (
                                                            <div className="text-[11px] text-gray-400 flex items-center gap-1.5 select-text">
                                                                <i className="fa-solid fa-envelope text-amber-400 w-3 text-center"></i>
                                                                <button 
                                                                    onClick={(e) => handleEmailClick(w.user.email, e)}
                                                                    className="hover:text-amber-400 transition-colors text-left truncate cursor-pointer"
                                                                >
                                                                    {w.user.email}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
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
                                                    <div className="flex items-center gap-2 text-[11px] text-blue-400 select-text cursor-default">
                                                        <i className="fa-solid fa-envelope text-gray-500 w-3"></i>
                                                        <button 
                                                            onClick={(e) => handleEmailClick(as.subcontractor.email, e)}
                                                            className="hover:underline text-left font-medium cursor-pointer"
                                                        >
                                                            {as.subcontractor.email}
                                                        </button>
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
                                <button 
                                    onClick={() => {
                                        setActiveTab('diary');
                                        setIsAddingLog(true);
                                    }}
                                    className="w-full bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-lg py-2 text-sm transition-colors text-left px-4 flex items-center gap-3"
                                >
                                    <i className="fa-solid fa-note-sticky text-yellow-400 w-4"></i> Bautagebuch-Eintrag
                                </button>
                                <button 
                                    onClick={() => setActiveTab('files')}
                                    className="w-full bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-lg py-2 text-sm transition-colors text-left px-4 flex items-center gap-3"
                                >
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
                                        disabled={isSavingTask}
                                        placeholder="Etappenname (z.B. Fundament gießen)"
                                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                        onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                                    />
                                    <button
                                        onClick={handleAddTask}
                                        disabled={isSavingTask}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSavingTask ? (
                                            <>
                                                <i className="fa-solid fa-circle-notch animate-spin"></i>
                                                Speichern...
                                            </>
                                        ) : (
                                            'Erstellen'
                                        )}
                                    </button>
                                </div>

                                <textarea
                                    value={newTaskDescription}
                                    onChange={e => setNewTaskDescription(e.target.value)}
                                    disabled={isSavingTask}
                                    placeholder="Beschreibung der Etappe (optional)"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                                    rows="3"
                                />

                                <div className="flex flex-col gap-3">
                                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold px-1">Fotos hinzufügen</label>
                                    <div className="flex flex-wrap gap-3">
                                        {selectedFiles.map((file, i) => (
                                            <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 shadow-lg">
                                                <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                                                {!isSavingTask && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedFiles(selectedFiles.filter((_, idx) => idx !== i))}
                                                        className="absolute top-1 right-1 bg-black/60 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] hover:bg-red-500 transition-colors"
                                                    >
                                                        <i className="fa-solid fa-xmark"></i>
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {!isSavingTask ? (
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
                                        ) : (
                                            <div className="w-20 h-20 rounded-xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-gray-600 bg-white/[0.02] cursor-not-allowed">
                                                <i className="fa-solid fa-camera text-lg"></i>
                                                <span className="text-[10px] mt-1 font-bold">Warten...</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {isSavingTask && (
                                    <div className="space-y-2 bg-white/5 p-4 rounded-xl border border-white/5 animate-[fadeIn_0.3s_ease-out] pt-4 border-t border-white/10 mt-2">
                                        <div className="flex justify-between text-xs font-bold text-gray-400">
                                            <span className="flex items-center gap-2">
                                                <i className="fa-solid fa-circle-notch animate-spin text-blue-400"></i>
                                                Bilder werden hochgeladen...
                                            </span>
                                            <span className="text-blue-400 font-mono">{taskUploadProgress}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                            <div 
                                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all duration-300 relative"
                                                style={{ width: `${taskUploadProgress}%` }}
                                            >
                                                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
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
                                            {(canManageStages || task.creator?.id === currentUser.id || (task.created_by_subcontractor_id === currentUser.id && isSubcontractor)) && (
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
                                                            disabled={isSavingTask}
                                                            className="flex-1 bg-black/40 border border-blue-500/40 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            autoFocus
                                                            placeholder="Titel"
                                                        />
                                                        <div className="flex gap-2">
                                                            <button 
                                                                onClick={() => handleSaveTaskEdit(task.id)} 
                                                                disabled={isSavingTask}
                                                                className="flex-1 sm:w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 flex items-center justify-center transition-all border border-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {isSavingTask ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-check"></i>}
                                                            </button>
                                                            <button 
                                                                onClick={() => setEditingTaskId(null)} 
                                                                disabled={isSavingTask}
                                                                className="flex-1 sm:w-10 h-10 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-all border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                <i className="fa-solid fa-xmark"></i>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <textarea
                                                        value={editTaskDescription}
                                                        onChange={e => setEditTaskDescription(e.target.value)}
                                                        disabled={isSavingTask}
                                                        placeholder="Beschreibung"
                                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                                                        rows="3"
                                                    />

                                                    {/* Manage Existing Images */}
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-[10px] text-gray-400 uppercase font-bold px-1">Aktuelle Bilder:</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {task.images?.map(img => (
                                                                <div key={img.id} className={`relative w-16 h-16 rounded-lg overflow-hidden border transition-all ${imagesToDelete.includes(img.id) ? 'border-red-500 opacity-40 grayscale' : 'border-white/10'}`}>
                                                                    <img src={getImageUrl(img.path)} alt="" className="w-full h-full object-cover" />
                                                                    {!isSavingTask && (
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
                                                                    )}
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
                                                                    {!isSavingTask && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setEditSelectedFiles(editSelectedFiles.filter((_, idx) => idx !== i))}
                                                                            className="absolute top-0.5 right-0.5 bg-black/60 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                                                                        >
                                                                            <i className="fa-solid fa-xmark"></i>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            {!isSavingTask ? (
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
                                                            ) : (
                                                                <div className="w-16 h-16 rounded-lg border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-gray-600 bg-white/[0.02] cursor-not-allowed">
                                                                    <i className="fa-solid fa-plus text-xs"></i>
                                                                    <span className="text-[8px] mt-1">Warten...</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {isSavingTask && (
                                                        <div className="space-y-2 bg-white/5 p-4 rounded-xl border border-white/5 animate-[fadeIn_0.3s_ease-out] pt-4 border-t border-white/10 mt-2">
                                                            <div className="flex justify-between text-xs font-bold text-gray-400">
                                                                <span className="flex items-center gap-2">
                                                                    <i className="fa-solid fa-circle-notch animate-spin text-blue-400"></i>
                                                                    Änderungen werden gespeichert...
                                                                </span>
                                                                <span className="text-blue-400 font-mono">{taskUploadProgress}%</span>
                                                            </div>
                                                            <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                                                <div 
                                                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all duration-300 relative"
                                                                    style={{ width: `${taskUploadProgress}%` }}
                                                                >
                                                                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className={`font-bold text-base ${task.status === 'Erledigt' ? 'text-gray-400 line-through' : 'text-white'}`}>{task.title}</div>

                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                                        {task.creator ? (
                                                            <div className="text-[11px] md:text-[12px] text-blue-400 font-bold flex items-center gap-1.5">
                                                                <i className="fa-solid fa-user text-[10px]"></i>
                                                                {task.creator.name}
                                                            </div>
                                                        ) : task.subcontractor_creator ? (
                                                            <div className="text-[11px] md:text-[12px] text-amber-400 font-bold flex items-center gap-1.5">
                                                                <i className="fa-solid fa-helmet-safety text-[10px] text-amber-400"></i>
                                                                {task.subcontractor_creator.name}
                                                            </div>
                                                        ) : null}
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
                                                            {task.images.map((img, imgIdx) => (
                                                                <div 
                                                                    key={img.id} 
                                                                    className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 cursor-pointer hover:border-blue-500/50 transition-all shadow-lg"
                                                                    title="Bild in Vollbild öffnen"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const mappedImages = task.images.map(ti => ({
                                                                            id: ti.id,
                                                                            file_name: ti.path.split('/').pop() || 'Bild',
                                                                            content_type: 'image/jpeg',
                                                                            file_url: ti.path,
                                                                            original_url: ti.path,
                                                                            thumb_url: ti.path,
                                                                            file_size: 0
                                                                        }));
                                                                        openMediaViewer(mappedImages, imgIdx);
                                                                    }}
                                                                >
                                                                    <img
                                                                        src={getImageUrl(img.path)}
                                                                        alt=""
                                                                        className="w-full h-full object-cover"
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
                                            {(canManageStages || task.creator?.id === currentUser.id || (task.created_by_subcontractor_id === currentUser.id && isSubcontractor)) && (
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

            {/* Tab: Bautagebuch (Journal) */}
            {activeTab === 'diary' && (
                <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-white">Bautagebuch & Journal</h3>
                            <p className="text-gray-400 text-xs mt-1">Dokumentieren Sie den täglichen Fortschritt und Vorfälle auf der Baustelle.</p>
                        </div>
                        <button
                            onClick={() => setIsAddingLog(!isAddingLog)}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 self-start sm:self-center"
                        >
                            <i className={`fa-solid ${isAddingLog ? 'fa-xmark' : 'fa-plus'}`}></i>
                            {isAddingLog ? 'Abbrechen' : 'Eintrag hinzufügen'}
                        </button>
                    </div>

                    {isAddingLog && (
                        <div className="glass-card rounded-2xl p-6 border border-white/10 bg-white/5 animate-[fadeInUp_0.4s_ease-out]">
                            <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-[0.2em]">Neuer Tagebucheintrag</h4>
                            <form onSubmit={handleAddDiaryLog} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Titel</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            placeholder="z.B. Fundament betoniert, Elektrik verlegt..."
                                            value={newLogTitle}
                                            onChange={e => setNewLogTitle(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Datum</label>
                                        <input 
                                            type="date" 
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            value={newLogDate}
                                            onChange={e => setNewLogDate(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kategorie</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {[
                                            { key: 'green', label: 'Fortschritt', bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', activeBg: 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' },
                                            { key: 'blue', label: 'Info', bg: 'bg-blue-500/10 border-blue-500/30 text-blue-400', activeBg: 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' },
                                            { key: 'yellow', label: 'Wichtig / Warnung', bg: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400', activeBg: 'bg-yellow-600 border-yellow-500 text-black shadow-lg shadow-yellow-500/20' },
                                            { key: 'red', label: 'Problem / Baustopp', bg: 'bg-red-500/10 border-red-500/30 text-red-400', activeBg: 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-500/20' }
                                        ].map(cat => (
                                            <button
                                                key={cat.key}
                                                type="button"
                                                onClick={() => setNewLogCategory(cat.key)}
                                                className={`py-3 px-1 rounded-xl text-xs font-bold border transition-all ${
                                                    newLogCategory === cat.key ? cat.activeBg : `${cat.bg} hover:bg-white/5`
                                                }`}
                                            >
                                                {cat.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/5 select-none cursor-pointer hover:bg-white/10 transition-colors" onClick={() => setNewLogIsPinned(!newLogIsPinned)}>
                                    <input 
                                        type="checkbox"
                                        checked={newLogIsPinned}
                                        onChange={e => setNewLogIsPinned(e.target.checked)}
                                        onClick={e => e.stopPropagation()}
                                        className="w-4 h-4 rounded border-white/10 bg-white/5 text-blue-500 focus:ring-blue-500/50 focus:ring-offset-0 focus:outline-none"
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-white uppercase tracking-wider">Notiz anheften (Wichtig)</div>
                                        <div className="text-[10px] text-gray-400 mt-0.5">Diese Notiz wird ganz oben im Tagebuch und auf der Projektübersicht angeheftet.</div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Bericht / Beschreibung</label>
                                    <textarea 
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white text-sm min-h-[120px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        placeholder="Beschreiben Sie hier im Detail die geleisteten Arbeiten, Zwischenfälle oder Abnahmen..."
                                        value={newLogContent}
                                        onChange={e => setNewLogContent(e.target.value)}
                                        required
                                    ></textarea>
                                </div>

                                {/* Onsite Photos Attachments */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Fotos von der Baustelle ({newLogFiles.length})</label>
                                        <button 
                                            type="button"
                                            onClick={() => logFileInputRef.current?.click()}
                                            className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
                                        >
                                            + Bilder hinzufügen
                                        </button>
                                    </div>
                                    <input 
                                        type="file" 
                                        multiple 
                                        ref={logFileInputRef} 
                                        onChange={handleLogFileChange} 
                                        accept="image/*" 
                                        className="hidden" 
                                    />
                                    
                                    <div className="flex flex-wrap gap-2">
                                        {newLogFiles.map((file, i) => (
                                            <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-blue-500/30 shadow-lg animate-[scaleIn_0.2s_ease-out]">
                                                <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeLogFile(i)}
                                                    className="absolute top-0.5 right-0.5 bg-black/60 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] hover:bg-black/80 transition-colors"
                                                >
                                                    <i className="fa-solid fa-xmark"></i>
                                                </button>
                                            </div>
                                        ))}
                                        {newLogFiles.length === 0 && (
                                            <p className="text-xs text-gray-600 italic">Keine Fotos ausgewählt.</p>
                                        )}
                                    </div>
                                </div>

                                {isSavingLog && (
                                    <div className="space-y-2 bg-white/5 p-4 rounded-xl border border-white/5 animate-[fadeIn_0.3s_ease-out]">
                                        <div className="flex justify-between text-xs font-bold text-gray-400">
                                            <span className="flex items-center gap-2">
                                                <i className="fa-solid fa-circle-notch animate-spin text-blue-400"></i>
                                                Eintrag wird gespeichert...
                                            </span>
                                            <span className="text-blue-400 font-mono">{logUploadProgress}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                            <div 
                                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all duration-300 relative"
                                                style={{ width: `${logUploadProgress}%` }}
                                            >
                                                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 pt-2">
                                    <button 
                                        type="submit"
                                        disabled={isSavingLog}
                                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20 active:scale-95 hover:scale-[1.02] flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {isSavingLog ? (
                                            <>
                                                <i className="fa-solid fa-circle-notch animate-spin text-xs"></i>
                                                Speichern...
                                            </>
                                        ) : (
                                            'Speichern'
                                        )}
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setIsAddingLog(false)}
                                        disabled={isSavingLog}
                                        className="bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 font-bold px-6 py-3 rounded-xl text-sm transition-all hover:scale-[1.02] disabled:opacity-50"
                                    >
                                        Abbrechen
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {loadingDiary ? (
                        <div className="flex items-center justify-center py-20 text-gray-500 animate-pulse">
                            <i className="fa-solid fa-circle-notch animate-spin text-2xl mr-3 text-blue-500"></i>
                            <span>Lade Bautagebuch...</span>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {diaryLogs.length > 0 ? (
                                diaryLogs.map(log => {
                                    // Map color keys to CSS styles
                                    const getCatColorClasses = (col) => {
                                        switch (col) {
                                            case 'green': return { border: 'border-l-emerald-500', badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', label: 'Fortschritt' };
                                            case 'yellow': return { border: 'border-l-yellow-500', badge: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400', label: 'Wichtig' };
                                            case 'red': return { border: 'border-l-red-500', badge: 'bg-red-500/10 border-red-500/20 text-red-400', label: 'Problem' };
                                            default: return { border: 'border-l-blue-500', badge: 'bg-blue-500/10 border-blue-500/20 text-blue-400', label: 'Information' };
                                        }
                                    };
                                    
                                    const design = getCatColorClasses(log.color);
                                    
                                    return (
                                        <div 
                                            key={log.id} 
                                            className={`glass-card p-6 rounded-2xl border border-white/10 border-l-4 ${design.border} ${log.isPinned ? 'border-amber-500/30 bg-amber-500/[0.02] shadow-[0_0_15px_rgba(245,158,11,0.05)]' : 'bg-white/5'} space-y-4 transition-all hover:bg-white/10 group`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    {log.isPinned && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border bg-amber-500/10 border-amber-500/20 text-amber-400 flex items-center gap-1 animate-pulse">
                                                            <i className="fa-solid fa-thumbtack text-[8px]"></i> Angeheftet
                                                        </span>
                                                    )}
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${design.badge}`}>
                                                        {design.label}
                                                    </span>
                                                    <span className="text-xs text-gray-400 font-medium">
                                                        {new Date(log.date).toLocaleDateString('de-DE')} {log.time || ''}
                                                    </span>
                                                    {log.subcontractor ? (
                                                        <span className="text-xs text-amber-400 font-bold flex items-center gap-1.5 pl-2 border-l border-white/10" title="Subunternehmer">
                                                            <i className="fa-solid fa-helmet-safety text-[10px] text-amber-400"></i>
                                                            {log.subcontractor.name}
                                                        </span>
                                                    ) : log.user ? (
                                                        <span className="text-xs text-blue-400 font-bold flex items-center gap-1.5 pl-2 border-l border-white/10">
                                                            <i className="fa-solid fa-user-pen text-[10px]"></i>
                                                            {log.user.name}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={() => handleTogglePinDiaryLog(log.id, log.isPinned)}
                                                        className={`p-1.5 rounded-lg transition-all ${log.isPinned ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' : 'text-gray-500 hover:text-amber-400 hover:bg-white/5 opacity-0 group-hover:opacity-100'}`}
                                                        title={log.isPinned ? 'Notiz lösen' : 'Notiz anheften'}
                                                    >
                                                        <i className="fa-solid fa-thumbtack text-xs"></i>
                                                    </button>
                                                    
                                                    {(canManageStages || log.user_id === currentUser.id || (log.subcontractor_id === currentUser.id && isSubcontractor)) && (
                                                        <button 
                                                            onClick={() => handleDeleteDiaryLog(log.id)}
                                                            className="text-gray-600 hover:text-red-400 transition-colors p-1.5 opacity-0 group-hover:opacity-100"
                                                            title="Eintrag löschen"
                                                        >
                                                            <i className="fa-solid fa-trash-can text-sm"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <h4 className="text-lg font-black text-white">{log.title}</h4>
                                                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{log.content}</p>
                                            </div>

                                            {/* Photo gallery inside log */}
                                            {log.attachments?.length > 0 && (
                                                <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                                                    {log.attachments.map((att, attIdx) => (
                                                        <div 
                                                            key={att.id} 
                                                            className="w-20 h-20 rounded-xl overflow-hidden border border-white/10 hover:border-blue-500/50 transition-all shadow-lg cursor-pointer"
                                                            title="Bild in Vollbild öffnen"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openMediaViewer(log.attachments, attIdx);
                                                            }}
                                                        >
                                                            <img 
                                                                src={getImageUrl(att.file_url || att.original_url)} 
                                                                alt={att.file_name} 
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-16 bg-white/5 border border-white/10 rounded-2xl">
                                    <i className="fa-solid fa-book-open text-4xl text-gray-600 mb-4 opacity-30"></i>
                                    <p className="text-gray-400">Keine Bautagebucheinträge für dieses Projekt vorhanden.</p>
                                    <button
                                        onClick={() => setIsAddingLog(true)}
                                        className="mt-4 text-blue-400 hover:underline text-sm font-medium"
                                    >
                                        Ersten Eintrag jetzt erstellen
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
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

            <MediaViewer 
                isOpen={isMediaViewerOpen}
                onClose={() => setIsMediaViewerOpen(false)}
                items={mediaViewerItems}
                initialIndex={mediaViewerIndex}
            />
        </div>
    );
};

export default ProjectDetails;
