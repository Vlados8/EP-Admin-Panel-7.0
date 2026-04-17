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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(null);
    const [currentDate, setCurrentDate] = useState(new Date());

    const [formData, setFormData] = useState({
        title: '',
        content: '',
        date: '',
        time: '', // New field
        color: 'blue',
        project_id: '',
    });
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [filePreviews, setFilePreviews] = useState([]);
    const [editingNote, setEditingNote] = useState(null);

    // Gallery State
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryItems, setGalleryItems] = useState([]);
    const [galleryIndex, setGalleryIndex] = useState(0);

    const openGallery = (items, index) => {
        setGalleryItems(items);
        setGalleryIndex(index);
        setIsGalleryOpen(true);
    };

    // Everyone can manage their own notes as per backend logic
    const canManageNotes = usePermission('MANAGE_NOTES');

    const resetForm = () => {
        setFormData({ title: '', content: '', date: '', time: '', color: 'blue', project_id: '' });
        setSelectedFiles([]);
        filePreviews.forEach(p => URL.revokeObjectURL(p.url));
        setFilePreviews([]);
        setEditingNote(null);
    };

    const fetchData = async () => {
        try {
            const [notesRes, projectsRes] = await Promise.all([
                api.get('/notes'),
                api.get('/projects'),
            ]);
            setNotes(notesRes.data.data.notes);
            setProjects(projectsRes.data.data?.projects || projectsRes.data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDateClick = (dayStr) => {
        setSelectedDate(selectedDate === dayStr ? null : dayStr);
    };

    const handleToggleDone = async (note) => {
        try {
            await api.patch(`/notes/${note.id}`, { isDone: !note.isDone });
            fetchData();
        } catch (error) {
            console.error('Error toggling note status:', error);
        }
    };

    const handleDeleteNote = async (id) => {
        if (!window.confirm('Möchten Sie diese Notiz wirklich löschen?')) return;
        try {
            await api.delete(`/notes/${id}`);
            fetchData();
        } catch (error) {
            console.error('Error deleting note:', error);
            alert('Fehler beim Löschen der Notiz');
        }
    };

    const handleEditNote = (note) => {
        setEditingNote(note);
        setFormData({
            title: note.title,
            content: note.content,
            date: note.date, // Already DATEONLY from backend
            time: note.time || '', // Directly from separate field
            color: note.color,
            project_id: note.project_id || '',
        });
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
        try {
            const data = new FormData();
            data.append('title', formData.title);
            data.append('content', formData.content);
            data.append('date', formData.date);
            if (formData.time) data.append('time', formData.time);
            
            data.append('color', formData.color);
            if (formData.project_id) data.append('project_id', formData.project_id);

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
        }
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
        setSelectedDate(null);
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
        setSelectedDate(null);
    };

    // Calendar Calculations
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => {
        let day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1; // Convert Sunday(0) to 6, Monday(1) to 0, etc. for proper EU start day
    };

    const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

    const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
    const currentMonthName = monthNames[currentDate.getMonth()];
    const currentYearStr = currentDate.getFullYear();
    const today = new Date();
    const isToday = (dayNum) => today.getDate() === dayNum && today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();

    // Previous month blanks
    const prevMonthDays = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth() - 1);
    const blanksStart = Array.from({ length: firstDay }, (_, i) => prevMonthDays - firstDay + 1 + i);

    // Total cells calculation (always show 6 weeks = 42 cells)
    const totalCells = 42;
    const blanksEndCount = totalCells - (firstDay + daysInMonth);
    const blanksEnd = Array.from({ length: blanksEndCount }, (_, i) => i + 1);

    return (
        <div className="animate-[fadeIn_0.4s_ease-out_forwards]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <p className="text-gray-400 text-sm md:text-base">Notizen im Kalender verwalten und planen.</p>
                <button
                    onClick={() => { resetForm(); setFormData(prev => ({ ...prev, date: new Date().toISOString().split('T')[0] })); setIsModalOpen(true); }}
                    className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 group hover:scale-[1.02] active:scale-[0.98]"
                >
                    <i className="fa-solid fa-plus transition-transform group-hover:rotate-90"></i>
                    Neue Notiz
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Calendar Sidebar */}
                <div className="glass-card p-5 rounded-2xl lg:w-1/3 h-fit">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={prevMonth} className="text-gray-400 hover:text-white p-2"><i className="fa-solid fa-chevron-left"></i></button>
                        <h4 className="font-bold">{currentMonthName} {currentYearStr}</h4>
                        <button onClick={nextMonth} className="text-gray-400 hover:text-white p-2"><i className="fa-solid fa-chevron-right"></i></button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2 text-gray-400">
                        <div>Mo</div><div>Di</div><div>Mi</div><div>Do</div><div>Fr</div><div>Sa</div><div>So</div>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-sm">
                        {/* Empty days */}
                        {blanksStart.map((dayNum, i) => (
                            <div key={`blank-start-${i}`} className="p-2 text-gray-600 opacity-50">{dayNum}</div>
                        ))}
                        {/* Days */}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const dayNum = i + 1;
                            const dateStr = `${currentYearStr}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
                            const dayNotes = notes.filter(n => n.date.startsWith(dateStr));
                            const hasNoteIndicator = dayNotes.length > 0;
                            // Check if ALL notes are done
                            const allDone = hasNoteIndicator && dayNotes.every(n => n.isDone);
                            const indicatorColor = hasNoteIndicator
                                ? (allDone ? 'bg-green-500' : (dayNotes[0].color === 'blue' ? 'bg-blue-400' : dayNotes[0].color === 'yellow' ? 'bg-yellow-400' : 'bg-pink-400'))
                                : '';

                            return (
                                <div
                                    key={dayNum}
                                    onClick={() => handleDateClick(dateStr)}
                                    className={`p-2 rounded-lg hover:bg-white/10 cursor-pointer relative 
                                        ${selectedDate === dateStr ? 'ring-2 ring-white/50 bg-white/10 font-bold' : ''} 
                                        ${isToday(dayNum) && selectedDate !== dateStr ? 'bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/30' : ''}`}
                                >
                                    {dayNum}
                                    {hasNoteIndicator && (
                                        <span className={`absolute top-1 right-1 w-1.5 h-1.5 ${indicatorColor} rounded-full ${allDone ? 'border border-gray-800' : ''}`}></span>
                                    )}
                                </div>
                            );
                        })}
                        {blanksEnd.map((dayNum, i) => (
                            <div key={`blank-end-${i}`} className="p-2 text-gray-600 opacity-50">{dayNum}</div>
                        ))}
                    </div>
                </div>

                {/* Notes for selected day */}
                <div className="lg:w-2/3 flex flex-col gap-4">
                    <h4 className="font-semibold text-lg border-b border-white/10 pb-2">
                        {selectedDate ? `Notizen für ${new Date(selectedDate).toLocaleDateString('de-DE')}` : `Alle Notizen (${currentMonthName} ${currentYearStr})`}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {loading ? (
                            <p className="text-gray-400 text-sm">Notizen werden geladen...</p>
                        ) : notes.filter(n => selectedDate ? n.date.startsWith(selectedDate) : n.date.startsWith(`${currentYearStr}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`)).length === 0 ? (
                            <p className="text-gray-400 text-sm">Keine Notizen vorhanden.</p>
                        ) : (
                            notes
                                .filter(n => selectedDate ? n.date.startsWith(selectedDate) : n.date.startsWith(`${currentYearStr}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`))
                                .sort((a, b) => new Date(a.date) - new Date(b.date))
                                .map(note => (
                                    <div key={note.id} className={`glass-card p-5 rounded-2xl border-l-4 ${note.color === 'blue' ? 'border-l-blue-400' : note.color === 'yellow' ? 'border-l-yellow-400' : 'border-l-pink-400'} ${note.isDone ? 'opacity-60' : ''}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="text-xs text-gray-400 flex flex-col gap-1">
                                                <span>Von: {note.user?.name || 'Unbekannt'}</span>
                                                <span>
                                                    {new Date(note.date).toLocaleDateString('de-DE')}
                                                    {note.time && ` ${note.time}`}
                                                </span>
                                                {note.project && (
                                                    <span
                                                        onClick={() => navigate(`/projekte/${note.project.id}`)}
                                                        className="inline-flex items-center gap-1 mt-1 text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md w-fit border border-emerald-400/20 max-w-full truncate cursor-pointer hover:bg-emerald-400/20 transition-colors"
                                                        title={`${note.project.project_number} - ${note.project.title}`}
                                                    >
                                                        <i className="fa-solid fa-folder shrink-0"></i>
                                                        <span className="truncate">{note.project.project_number} - {note.project.title}</span>
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleEditNote(note)}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                                    title="Notiz bearbeiten"
                                                >
                                                    <i className="fa-solid fa-pen-to-square"></i>
                                                </button>
                                                <button
                                                    onClick={() => handleToggleDone(note)}
                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${note.isDone ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
                                                    title={note.isDone ? "Als unerledigt markieren" : "Als erledigt markieren"}
                                                >
                                                    <i className={`fa-solid ${note.isDone ? 'fa-check' : 'fa-check'}`}></i>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteNote(note.id)}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                    title="Notiz löschen"
                                                >
                                                    <i className="fa-solid fa-trash"></i>
                                                </button>
                                            </div>
                                        </div>
                                        <h4 className={`font-semibold mb-2 ${note.isDone ? 'line-through text-gray-400' : ''}`}>{note.title}</h4>
                                        <p className={`text-sm mb-3 ${note.isDone ? 'line-through text-gray-500' : 'text-gray-300'}`}>{note.content}</p>

                                        {/* Attachments Display */}
                                        {note.attachments && note.attachments.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                                                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">Anhänge</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {note.attachments.map((att, index) => (
                                                        <div 
                                                            key={att.id} 
                                                            onClick={() => openGallery(note.attachments, index)}
                                                            className="group relative flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-2 pr-3 hover:bg-white/10 transition-all max-w-full cursor-pointer"
                                                        >
                                                            {att.content_type?.startsWith('image/') ? (
                                                                <div className="w-8 h-8 rounded overflow-hidden bg-black/40 flex-shrink-0">
                                                                    <img crossOrigin="anonymous" src={getImageUrl(att.file_url)} alt="" className="w-full h-full object-cover" />
                                                                </div>
                                                            ) : (
                                                                <div className="w-8 h-8 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                                                                    <i className={`fa-solid ${att.content_type?.startsWith('video/') ? 'fa-video' : 'fa-file'}`}></i>
                                                                </div>
                                                            )}
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-xs text-gray-300 truncate max-w-[120px]" title={att.file_name}>{att.file_name}</span>
                                                                <span className="text-[10px] text-gray-500">{(att.file_size / 1024 / 1024).toFixed(2)} MB</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                        )}
                    </div>
                </div>
            </div>

            {/* Note Creation Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4">
                    <div className="glass-card w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl animate-[slideUp_0.3s_ease-out]">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 rounded-t-2xl">
                            <h2 className="text-xl font-semibold text-white flex items-center gap-3">
                                <i className="fa-regular fa-note-sticky text-blue-400"></i> {editingNote ? 'Notiz bearbeiten' : 'Neue Notiz'}
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
                                        placeholder="z.B. Material fehlt"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-400 pl-1">Datum & Zeit</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <i className="fa-regular fa-calendar absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                        <input
                                            type="date"
                                            required
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors [&::-webkit-calendar-picker-indicator]:invert"
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

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400 pl-1">Farbe</label>
                                    <div className="relative">
                                        <i className="fa-solid fa-palette absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"></i>
                                        <select
                                            value={formData.color}
                                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none [&>option]:bg-gray-900"
                                        >
                                            <option value="blue">Blau (Information)</option>
                                            <option value="yellow">Gelb (Warnung/Warten)</option>
                                            <option value="pink">Pink (Dringend)</option>
                                        </select>
                                    </div>
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
                                <label className="text-xs font-medium text-gray-400 pl-1">Inhalt</label>
                                <textarea
                                    required
                                    rows="4"
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
                                    placeholder="Notizendetails eingeben..."
                                ></textarea>
                            </div>

                            {/* Existing Files for Editing */}
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

                            {/* File Upload Input */}
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
                                <button type="submit" className="px-6 py-2.5 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all shadow-[0_4px_15px_rgba(59,130,246,0.3)]">
                                    Notiz speichern
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
