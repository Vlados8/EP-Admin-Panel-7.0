import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import usePermission from '../../hooks/usePermission';
import MediaViewer from '../../components/common/MediaViewer';
import { getImageUrl } from '../../utils/config';

const Notes = () => {
    const { user: currentUser } = useSelector(state => state.auth);
    const navigate = useNavigate();
    const [notes, setNotes] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [formData, setFormData] = useState({
        title: '',
        content: '',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        color: 'blue',
        project_id: '',
        isDone: false
    });
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [filePreviews, setFilePreviews] = useState([]);
    const [editingNote, setEditingNote] = useState(null);
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

    const fetchData = async () => {
        try {
            const [notesRes, projectsRes] = await Promise.all([
                api.get('/notes'),
                api.get('/projects?status=aktiv')
            ]);
            setNotes(notesRes.data.data.notes);
            setProjects(projectsRes.data.data.projects);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const resetForm = () => {
        setFormData({
            title: '',
            content: '',
            date: new Date().toISOString().split('T')[0],
            time: new Date().toTimeString().split(' ')[0].substring(0, 5),
            color: 'blue',
            project_id: '',
            isDone: false
        });
        setSelectedFiles([]);
        filePreviews.forEach(p => URL.revokeObjectURL(p.url));
        setFilePreviews([]);
        setEditingNote(null);
    };

    const handleOpenModal = (note = null) => {
        if (note) {
            setEditingNote(note);
            setFormData({
                title: note.title,
                content: note.content,
                date: note.date,
                time: note.time || '',
                color: note.color || 'blue',
                project_id: note.project_id || '',
                isDone: note.isDone
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
            fetchData();
            if (editingNote) {
                setEditingNote({
                    ...editingNote,
                    attachments: editingNote.attachments.filter(a => a.id !== attachmentId)
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
            data.append('content', formData.content);
            data.append('date', formData.date);
            data.append('time', formData.time);
            data.append('color', formData.color);
            data.append('isDone', formData.isDone);
            data.append('project_id', formData.project_id || '');

            if (selectedFiles.length > 0) {
                for (let i = 0; i < selectedFiles.length; i++) {
                    data.append('files', selectedFiles[i]);
                }
            }

            if (editingNote) {
                await api.patch(`/notes/${editingNote.id}`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                await api.post('/notes', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            fetchData();
            setIsModalOpen(false);
            resetForm();
        } catch (error) {
            console.error('Error saving note:', error);
            alert('Fehler beim Speichern der Notiz');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleDone = async (note, e) => {
        if (e) e.stopPropagation();
        try {
            await api.patch(`/notes/${note.id}`, { isDone: !note.isDone });
            fetchData();
        } catch (error) {
            console.error('Error updating note status:', error);
        }
    };

    const deleteNote = async (noteId, e) => {
        if (e) e.stopPropagation();
        if (!window.confirm('Möchten Sie diese Notiz действительно löschen?')) return;
        try {
            await api.delete(`/notes/${noteId}`);
            fetchData();
        } catch (error) {
            console.error('Error deleting note:', error);
            alert('Fehler beim Löschen der Notiz');
        }
    };

    const canManageNotes = usePermission('MANAGE_NOTES');

    const displayedNotes = notes.filter(note => {
        if (searchQuery.trim() === '') return true;
        return note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
               note.content?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const getColorClass = (color) => {
        switch (color) {
            case 'red': return 'border-l-red-500';
            case 'green': return 'border-l-emerald-500';
            case 'yellow': return 'border-l-yellow-500';
            case 'purple': return 'border-l-purple-500';
            default: return 'border-l-blue-500';
        }
    };

    return (
        <div className="animate-[fadeIn_0.4s_ease-out_forwards]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-white/10 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Notizen</h2>
                    <p className="text-gray-400 text-sm mt-1">Личные и проектные заметки.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
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
                    <button onClick={() => handleOpenModal()} className="w-full md:w-auto bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-medium transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2">
                        <i className="fa-solid fa-plus"></i>Neue Notiz
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-12 text-center text-gray-400">
                        <i className="fa-solid fa-circle-notch fa-spin text-2xl mb-2"></i>
                        <p>Notizen werden geladen...</p>
                    </div>
                ) : displayedNotes.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-gray-400 bg-white/5 rounded-2xl border border-white/10 border-dashed">
                        <i className="fa-solid fa-note-sticky text-4xl mb-3 opacity-50"></i>
                        <p>Keine Notizen gefunden.</p>
                    </div>
                ) : (
                    displayedNotes.map(note => {
                        const isDone = note.isDone;

                        return (
                            <div key={note.id} className={`glass-card p-5 rounded-2xl border-l-[6px] ${getColorClass(note.color)} ${isDone ? 'opacity-60' : ''} flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300 shadow-lg`}>
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex flex-col gap-1">
                                            <span className={`text-xs font-medium text-gray-400`}>
                                                <i className="fa-regular fa-calendar mr-1"></i>
                                                {new Date(note.date).toLocaleDateString('de-DE')}
                                                {note.time && ` ${note.time}`}
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleOpenModal(note); }}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                                title="Notiz bearbeiten"
                                            >
                                                <i className="fa-solid fa-pen-to-square"></i>
                                            </button>
                                            <button
                                                onClick={(e) => toggleDone(note, e)}
                                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-white/5 ${isDone ? 'text-emerald-400 bg-emerald-500/10' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                                                title={isDone ? "Als nicht erledigt markieren" : "Als erledigt markieren"}
                                            >
                                                <i className="fa-solid fa-check"></i>
                                            </button>
                                            <button
                                                onClick={(e) => deleteNote(note.id, e)}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                title="Notiz löschen"
                                            >
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>

                                    <h4 className={`font-semibold text-lg text-white mb-2 ${isDone ? 'line-through text-gray-400' : ''}`}>{note.title}</h4>
                                    <p className={`text-sm mb-4 line-clamp-4 whitespace-pre-wrap ${isDone ? 'text-gray-500' : 'text-gray-300'}`}>{note.content}</p>

                                    {/* Attachments Display */}
                                    {note.attachments && note.attachments.length > 0 && (
                                        <div className="mt-2 space-y-2">
                                            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Anhänge</p>
                                            <div className="flex flex-wrap gap-2">
                                                {note.attachments.map((att, index) => (
                                                    <div 
                                                        key={att.id} 
                                                        onClick={(e) => { e.stopPropagation(); openGallery(note.attachments, index); }}
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

                                <div className="mt-4 pt-4 border-t border-white/10">
                                    {note.project && (
                                        <span
                                            onClick={(e) => { e.stopPropagation(); navigate(`/projekte/${note.project.id}`); }}
                                            className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md w-fit border border-emerald-400/20 max-w-full truncate cursor-pointer hover:bg-emerald-400/20 transition-colors text-xs"
                                            title={`${note.project.project_number} - ${note.project.title}`}
                                        >
                                            <i className="fa-solid fa-folder shrink-0"></i>
                                            <span className="truncate">{note.project.project_number} - {note.project.title}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Modal for Creating Note */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4 py-8 overflow-y-auto">
                    <div className="glass-card w-full max-w-xl rounded-2xl border border-white/10 shadow-2xl animate-[slideUp_0.3s_ease-out] my-auto">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 rounded-t-2xl">
                            <h2 className="text-xl font-semibold text-white flex items-center gap-3">
                                <i className="fa-solid fa-note-sticky text-blue-400"></i> {editingNote ? 'Notiz bearbeiten' : 'Neue Notiz'}
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
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder="Titel der Notiz..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400 pl-1">Datum</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors [&::-webkit-calendar-picker-indicator]:invert"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400 pl-1">Zeit</label>
                                    <input
                                        type="time"
                                        value={formData.time}
                                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors [&::-webkit-calendar-picker-indicator]:invert"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400 pl-1">Projekt (Optional)</label>
                                    <select
                                        value={formData.project_id}
                                        onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none [&>option]:bg-gray-900"
                                    >
                                        <option value="">Kein Projekt ausgewählt</option>
                                        {projects.map(project => (
                                            <option key={project.id} value={project.id}>
                                                {project.project_number} - {project.title}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400 pl-1">Farbe</label>
                                    <div className="flex gap-2 pt-1">
                                        {['blue', 'red', 'green', 'yellow', 'purple'].map(c => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, color: c })}
                                                className={`w-6 h-6 rounded-full border-2 transition-all ${formData.color === c ? 'border-white scale-125' : 'border-transparent opacity-50'}`}
                                                style={{ backgroundColor: c === 'blue' ? '#3B82F6' : c === 'red' ? '#EF4444' : c === 'green' ? '#10B981' : c === 'yellow' ? '#F59E0B' : '#8B5CF6' }}
                                            ></button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-400 pl-1">Inhalt</label>
                                <textarea
                                    required
                                    rows="6"
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
                                    placeholder="Inhalt der Notiz..."
                                ></textarea>
                            </div>

                            {/* Existing Attachments */}
                            {editingNote && editingNote.attachments && editingNote.attachments.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-gray-400 pl-1">Aktuelle Anhänge</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {editingNote.attachments.map(att => (
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
                                <label className="text-xs font-medium text-gray-400 pl-1">Anhänge (Bilder, Videos, Dokumentе)</label>
                                
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
                                        id="note-file-upload"
                                    />
                                    <label
                                        htmlFor="note-file-upload"
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
                                    disabled={isSubmitting}
                                    className="px-6 py-2.5 text-sm font-medium bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)] flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <i className="fa-solid fa-circle-notch fa-spin"></i>
                                            Wird gespeichert...
                                        </>
                                    ) : (
                                        'Notiz speichern'
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

export default Notes;
