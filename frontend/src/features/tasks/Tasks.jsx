import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import usePermission from '../../hooks/usePermission';
import MediaViewer from '../../components/common/MediaViewer';

const Tasks = () => {
    const { user: currentUser } = useSelector(state => state.auth);
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([]);
    const [users, setUsers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        status: 'In Arbeit',
        assigned_to_id: '',
        project_id: '',
        due_date: '',
        time: '' // New field
    });
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [filePreviews, setFilePreviews] = useState([]);
    const [editingTask, setEditingTask] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Gallery State
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryItems, setGalleryItems] = useState([]);
    const [galleryIndex, setGalleryIndex] = useState(0);

    const openGallery = (items, index) => {
        setGalleryItems(items);
        setGalleryIndex(index);
        setIsGalleryOpen(true);
    };

    const fetchTasksUsersAndProjects = async () => {
        try {
            const [tasksRes, usersRes, projectsRes] = await Promise.all([
                api.get('/tasks'),
                api.get('/users'),
                api.get('/projects?status=aktiv')
            ]);
            setTasks(tasksRes.data.data.tasks);
            setUsers(usersRes.data.data.users);
            setProjects(projectsRes.data.data.projects);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasksUsersAndProjects();
    }, []);

    const resetForm = () => {
        setFormData({ title: '', description: '', status: 'In Arbeit', assigned_to_id: '', project_id: '', due_date: '', time: '' });
        setSelectedFiles([]);
        filePreviews.forEach(p => URL.revokeObjectURL(p.url));
        setFilePreviews([]);
        setEditingTask(null);
    };

    const handleOpenModal = (task = null) => {
        if (task) {
            setEditingTask(task);
            setFormData({
                title: task.title,
                description: task.description,
                status: task.status,
                assigned_to_id: task.assigned_to_id || '',
                project_id: task.project_id || '',
                due_date: task.due_date || '',
                time: task.time || ''
            });
        } else {
            resetForm();
        }
        setIsModalOpen(true);
    };

    const handleDeleteAttachment = async (attachmentId) => {
        if (!window.confirm('Anhang wirklich löschen?')) return;
        try {
            await api.delete(`/attachments/${attachmentId}`);
            fetchTasksUsersAndProjects();
            if (editingTask) {
                setEditingTask({
                    ...editingTask,
                    attachments: editingTask.attachments.filter(a => a.id !== attachmentId)
                });
            }
        } catch (error) {
            console.error('Error deleting attachment:', error);
            alert('Fehler beim Löschen des Anhangs');
        }
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const newFiles = [...selectedFiles, ...files];
        setSelectedFiles(newFiles);

        const newPreviews = files.map(file => ({
            name: file.name,
            url: URL.createObjectURL(file),
            type: file.type
        }));
        setFilePreviews([...filePreviews, ...newPreviews]);
    };

    const removeSelectedFile = (index) => {
        const fileToRemove = filePreviews[index];
        URL.revokeObjectURL(fileToRemove.url);
        
        const newFiles = [...selectedFiles];
        newFiles.splice(index, 1);
        setSelectedFiles(newFiles);

        const newPreviews = [...filePreviews];
        newPreviews.splice(index, 1);
        setFilePreviews(newPreviews);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            const data = new FormData();
            data.append('title', formData.title);
            data.append('description', formData.description);
            data.append('status', formData.status);
            if (formData.assigned_to_id) data.append('assigned_to_id', formData.assigned_to_id);
            if (formData.project_id) data.append('project_id', formData.project_id);
            if (formData.due_date) data.append('due_date', formData.due_date);
            if (formData.time) data.append('time', formData.time);

            if (selectedFiles.length > 0) {
                for (let i = 0; i < selectedFiles.length; i++) {
                    data.append('files', selectedFiles[i]);
                }
            }

            if (editingTask) {
                await api.patch(`/tasks/${editingTask.id}`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                await api.post('/tasks', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            fetchTasksUsersAndProjects();
            setIsModalOpen(false);
            resetForm();
        } catch (error) {
            console.error('Error saving task:', error);
            alert('Fehler beim Speichern der Aufgabe');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleStatus = async (task, e) => {
        if (e) e.stopPropagation();
        let newStatus = 'In Arbeit';
        if (task.status === 'In Arbeit') newStatus = 'Warten';
        else if (task.status === 'Warten') newStatus = 'Erledigt';
        else if (task.status === 'Erledigt') newStatus = 'In Arbeit';

        try {
            await api.patch(`/tasks/${task.id}`, { status: newStatus });
            fetchTasksUsersAndProjects();
        } catch (error) {
            console.error('Error updating task status:', error);
        }
    };

    const deleteTask = async (taskId, e) => {
        if (e) e.stopPropagation();
        if (!window.confirm('Möchten Sie diese Aufgabe wirklich löschen?')) return;
        try {
            await api.delete(`/tasks/${taskId}`);
            fetchTasksUsersAndProjects();
        } catch (error) {
            console.error('Error deleting task:', error);
            alert('Fehler beim Löschen der Aufgabe');
        }
    };

    const getStatusIconAndColor = (status) => {
        switch (status) {
            case 'Erledigt': return { icon: 'fa-check-circle', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-l-emerald-400' };
            case 'Warten': return { icon: 'fa-clock', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-l-yellow-400' };
            default: return { icon: 'fa-person-digging', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-l-blue-400' };
        }
    };

    // Calculate assignable users based on role
    const canCreateTasks = usePermission('MANAGE_TASKS');
    const currentUserRole = currentUser?.role?.name || currentUser?.role;

    // Derived assignable users
    const assignableUsers = users.filter(u => {
        if (!currentUserRole) return false;
        if (currentUserRole === 'Admin' || currentUserRole === 'Büro') return true;
        if (currentUserRole === 'Projektleiter' || currentUserRole === 'Gruppenleiter') {
            return u.manager_id === currentUser.id;
        }
        return false;
    });

    const displayedTasks = tasks.filter(task => {
        if (canCreateTasks && searchQuery.trim() !== '') {
            return task.assignee?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                task.title?.toLowerCase().includes(searchQuery.toLowerCase());
        }

        // Show own tasks OR tasks of subordinates OR tasks created by me
        const isOwnTask = task.assigned_to_id === currentUser?.id;
        const isSubordinateTask = assignableUsers.some(u => u.id === task.assigned_to_id);
        const isCreatedByMe = task.created_by_id === currentUser?.id;

        return isOwnTask || isSubordinateTask || isCreatedByMe;
    });

    return (
        <div className="animate-[fadeIn_0.4s_ease-out_forwards]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-white/10 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Aufgaben</h2>
                    <p className="text-gray-400 text-sm mt-1">Aufgaben verwalten und zuweisen.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {canCreateTasks && (
                        <div className="relative flex-grow md:flex-grow-0">
                            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                            <input
                                type="text"
                                placeholder="Suchen..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full md:w-64 bg-black/20 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                    )}
                    {canCreateTasks && (
                        <button onClick={() => handleOpenModal()} className="w-full md:w-auto bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-medium transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2">
                            <i className="fa-solid fa-plus"></i>Neue Aufgabe
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-12 text-center text-gray-400">
                        <i className="fa-solid fa-circle-notch fa-spin text-2xl mb-2"></i>
                        <p>Aufgaben werden geladen...</p>
                    </div>
                ) : displayedTasks.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-gray-400 bg-white/5 rounded-2xl border border-white/10 border-dashed">
                        <i className="fa-solid fa-clipboard-list text-4xl mb-3 opacity-50"></i>
                        <p>Keine Aufgaben gefunden.</p>
                    </div>
                ) : (
                    displayedTasks.map(task => {
                        const statusUI = getStatusIconAndColor(task.status);
                        const isDone = task.status === 'Erledigt';

                        return (
                            <div key={task.id} className={`glass-card p-5 rounded-2xl border-l-[6px] ${statusUI.border} ${isDone ? 'opacity-60' : ''} flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300 shadow-lg`}>
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex flex-col gap-1">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusUI.bg} ${statusUI.color} w-fit`}>
                                                <i className={`fa-solid ${statusUI.icon}`}></i> {task.status}
                                            </span>
                                            {task.due_date && (
                                                <span className={`text-xs mt-1 font-medium ${new Date(task.due_date) < new Date() && !isDone ? 'text-red-400' : 'text-gray-400'}`}>
                                                    <i className="fa-regular fa-calendar mr-1"></i>
                                                    Bis: {new Date(task.due_date).toLocaleDateString('de-DE')}
                                                    {task.time && ` ${task.time}`}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleOpenModal(task); }}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                                title="Aufgabe bearbeiten"
                                            >
                                                <i className="fa-solid fa-pen-to-square"></i>
                                            </button>
                                            <button
                                                onClick={(e) => toggleStatus(task, e)}
                                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-white/5 text-gray-400 hover:text-white hover:bg-white/10`}
                                                title="Status ändern"
                                            >
                                                <i className="fa-solid fa-rotate"></i>
                                            </button>
                                            {(currentUserRole === 'Admin' || currentUserRole === 'Büro' || task.creator?.id === currentUser?.id) && canCreateTasks && (
                                                <button
                                                    onClick={(e) => deleteTask(task.id, e)}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                    title="Aufgabe löschen"
                                                >
                                                    <i className="fa-solid fa-trash"></i>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <h4 className={`font-semibold text-lg text-white mb-2 ${isDone ? 'line-through text-gray-400' : ''}`}>{task.title}</h4>
                                    <p className={`text-sm mb-4 line-clamp-3 ${isDone ? 'text-gray-500' : 'text-gray-300'}`}>{task.description}</p>

                                    {/* Attachments Display */}
                                    {task.attachments && task.attachments.length > 0 && (
                                        <div className="mt-2 space-y-2">
                                            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Anhänge</p>
                                            <div className="flex flex-wrap gap-2">
                                                {task.attachments.map((att, index) => (
                                                    <div 
                                                        key={att.id} 
                                                        onClick={(e) => { e.stopPropagation(); openGallery(task.attachments, index); }}
                                                        className="group relative flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-1 hover:bg-white/10 transition-all cursor-pointer"
                                                    >
                                                        <div className="w-8 h-8 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                                                            <i className={`fa-solid ${att.content_type?.startsWith('image/') ? 'fa-image' : att.content_type?.startsWith('video/') ? 'fa-video' : 'fa-file'} text-xs`}></i>
                                                        </div>
                                                        <span className="text-[10px] text-gray-300 truncate max-w-[80px] pr-2" title={att.file_name}>{att.file_name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2">
                                    <div className="flex justify-between items-center text-xs text-gray-400">
                                        <div className="flex items-center gap-1.5" title={`Erstellt von: ${task.creator?.name || 'Unbekannt'}`}>
                                            <i className="fa-solid fa-arrow-right-from-bracket opacity-70"></i>
                                            <span>{task.creator?.name || 'Unbekannt'}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 font-medium text-white bg-white/10 px-2 py-1 rounded-md" title="Zugewiesen an">
                                            <i className="fa-solid fa-user-check opacity-70 text-blue-400"></i>
                                            <span>{task.assignee?.name || 'Unbekannt'}</span>
                                        </div>
                                    </div>

                                    {task.project && (
                                        <span
                                            onClick={(e) => { e.stopPropagation(); navigate(`/projekte/${task.project.id}`); }}
                                            className="inline-flex items-center gap-1 mt-1 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md w-fit border border-emerald-400/20 max-w-full truncate cursor-pointer hover:bg-emerald-400/20 transition-colors text-xs"
                                            title={`${task.project.project_number} - ${task.project.title}`}
                                        >
                                            <i className="fa-solid fa-folder shrink-0"></i>
                                            <span className="truncate">{task.project.project_number} - {task.project.title}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Modal for Creating Task */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4 py-8 overflow-y-auto">
                    <div className="glass-card w-full max-w-xl rounded-2xl border border-white/10 shadow-2xl animate-[slideUp_0.3s_ease-out] my-auto">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 rounded-t-2xl">
                            <h2 className="text-xl font-semibold text-white flex items-center gap-3">
                                <i className="fa-solid fa-list-check text-blue-400"></i> {editingTask ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
                            </h2>
                             <button 
                                onClick={() => { setIsModalOpen(false); resetForm(); }} 
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-400 pl-1">Titel</label>
                                <div className="relative">
                                    <i className="fa-solid fa-heading absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                        placeholder="z.B. Material bestellen"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400 pl-1">Zuweisen an</label>
                                    <div className="relative">
                                        <i className="fa-solid fa-user absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                        <select
                                            required
                                            value={formData.assigned_to_id}
                                            onChange={(e) => setFormData({ ...formData, assigned_to_id: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none [&>option]:bg-gray-900"
                                        >
                                            <option value="" disabled>Bitte wählen...</option>
                                            {assignableUsers.map(user => (
                                                <option key={user.id} value={user.id}>{user.name} ({user.role?.name || '?'})</option>
                                            ))}
                                        </select>
                                    </div>
                                    {assignableUsers.length === 0 && (
                                        <p className="text-xs text-red-400 mt-1 pl-1">Keine verfügbaren Mitarbeiter gefunden.</p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400 pl-1">Projekt (Optional)</label>
                                    <div className="relative">
                                        <i className="fa-solid fa-folder absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                        <select
                                            value={formData.project_id}
                                            onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none [&>option]:bg-gray-900"
                                        >
                                            <option value="">Kein Projekt ausgewählt</option>
                                            {projects.map(project => (
                                                <option key={project.id} value={project.id}>
                                                    {project.project_number} - {project.title}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-400 pl-1">Fälligkeit (Datum & Zeit)</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <i className="fa-regular fa-calendar absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                        <input
                                            type="date"
                                            value={formData.due_date}
                                            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors [&::-webkit-calendar-pickerindicator]:invert"
                                        />
                                    </div>
                                    <div className="relative w-32">
                                        <i className="fa-regular fa-clock absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                        <input
                                            type="time"
                                            value={formData.time}
                                            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors [&::-webkit-calendar-picker-indicator]:invert"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-400 pl-1">Beschreibung</label>
                                <textarea
                                    required
                                    rows="4"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
                                    placeholder="Details zur Aufgabe..."
                                ></textarea>
                            </div>

                            {/* Existing Attachments */}
                            {editingTask && editingTask.attachments && editingTask.attachments.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-gray-400 pl-1">Aktuelle Anhänge</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {editingTask.attachments.map(att => (
                                            <div key={att.id} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-xl p-2.5">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <i className={`fa-solid ${att.content_type?.startsWith('image/') ? 'fa-image text-emerald-400' : att.content_type?.startsWith('video/') ? 'fa-video text-blue-400' : 'fa-file text-gray-400'}`}></i>
                                                    <span className="text-xs text-gray-300 truncate">{att.file_name}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteAttachment(att.id)}
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                >
                                                    <i className="fa-solid fa-trash-can text-xs"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                             {/* File Upload Grid Preview */}
                             <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-400 pl-1">Anhänge (Bilder, Videos, Dokumente)</label>
                                
                                {filePreviews.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                                        {filePreviews.map((preview, idx) => (
                                            <div key={idx} className="relative group/preview aspect-video bg-black/40 rounded-xl overflow-hidden border border-white/10">
                                                {preview.type.startsWith('image/') ? (
                                                    <img crossOrigin="anonymous" src={preview.url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
                                                        <i className={`fa-solid ${preview.type.startsWith('video/') ? 'fa-video text-blue-400' : 'fa-file text-gray-400'} text-xl`}></i>
                                                        <span className="text-[10px] text-gray-400 truncate w-full text-center px-1">{preview.name}</span>
                                                    </div>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => removeSelectedFile(idx)}
                                                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-opacity shadow-lg"
                                                >
                                                    <i className="fa-solid fa-xmark text-xs"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="relative group">
                                    <input
                                        type="file"
                                        multiple
                                        onChange={handleFileChange}
                                        className="hidden"
                                        id="task-file-upload"
                                    />
                                    <label
                                        htmlFor="task-file-upload"
                                        className="w-full bg-black/20 border border-white/10 border-dashed rounded-xl py-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all"
                                    >
                                        <i className="fa-solid fa-cloud-arrow-up text-xl text-gray-500 group-hover:text-blue-400 transition-colors"></i>
                                        <span className="text-xs text-gray-400">Dateien auswählen</span>
                                    </label>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-white/10">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                                    Abbrechen
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting || assignableUsers.length === 0} 
                                    className="px-6 py-2.5 text-sm font-medium bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)] flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <i className="fa-solid fa-circle-notch fa-spin"></i>
                                            Wird gespeichert...
                                        </>
                                    ) : (
                                        'Aufgabe speichern'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Media Gallery Viewer */}
            <MediaViewer 
                isOpen={isGalleryOpen}
                onClose={() => setIsGalleryOpen(false)}
                items={galleryItems}
                initialIndex={galleryIndex}
            />
        </div>
    );
};

export default Tasks;
