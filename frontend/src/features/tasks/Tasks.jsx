import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import usePermission from '../../hooks/usePermission';
import MediaViewer from '../../components/common/MediaViewer';
import { getImageUrl } from '../../utils/config';

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

    // View Modes
    const [viewMode, setViewMode] = useState('grid');
    const [calendarTab, setCalendarTab] = useState('month');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedTimelineUserId, setSelectedTimelineUserId] = useState('all');
    const [isModalEditMode, setIsModalEditMode] = useState(false);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 30000);
        return () => clearInterval(timer);
    }, []);

    const monthNames = [
        'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];
    const dayNamesShort = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const dayNamesLong = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => {
        const day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1; // Monday is 0, Sunday is 6
    };

    const getWeekDays = (d) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        const monday = new Date(date.setDate(diff));
        const days = [];
        for (let i = 0; i < 7; i++) {
            const nextDay = new Date(monday);
            nextDay.setDate(monday.getDate() + i);
            days.push(nextDay);
        }
        return days;
    };

    const formatDateString = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const getTaskHour = (timeStr) => {
        if (!timeStr) return null;
        const parts = timeStr.split(':');
        return parseInt(parts[0], 10);
    };

    const handleOpenModalForDate = (dateStr, assignedToId = '', timeStr = '') => {
        resetForm();
        setFormData({
            title: '',
            description: '',
            status: 'In Arbeit',
            assigned_to_id: assignedToId || currentUser?.id || '',
            project_id: '',
            due_date: dateStr || '',
            time: timeStr || ''
        });
        setIsModalEditMode(true);
        setIsModalOpen(true);
    };

    const handlePrevDate = () => {
        if (calendarTab === 'month') {
            setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
        } else if (calendarTab === 'week') {
            setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 7));
        }
    };

    const handleNextDate = () => {
        if (calendarTab === 'month') {
            setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
        } else if (calendarTab === 'week') {
            setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 7));
        }
    };

    const handleSetToday = () => {
        setSelectedDate(new Date());
    };

    const getCalendarNavTitle = () => {
        if (calendarTab === 'month') {
            return `${monthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
        } else if (calendarTab === 'week') {
            const weekDays = getWeekDays(selectedDate);
            const startStr = `${weekDays[0].getDate()}. ${monthNames[weekDays[0].getMonth()]}`;
            const endStr = `${weekDays[6].getDate()}. ${monthNames[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`;
            return `${startStr} - ${endStr}`;
        }
        return '';
    };

    const renderCompactTaskCard = (t) => {
        const statusUI = getStatusIconAndColor(t.status);
        return (
            <div
                key={t.id}
                onClick={(e) => { e.stopPropagation(); handleOpenModal(t); }}
                className={`p-2.5 rounded-xl border border-white/10 bg-black/60 hover:bg-black/80 flex flex-col justify-between gap-1.5 cursor-pointer border-l-4 ${statusUI.border} transition-all shadow-md group/card`}
                title={`${t.title} (${t.status})`}
            >
                <div className="flex justify-between items-start gap-1">
                    <span className="text-[10px] font-bold text-white truncate max-w-[110px] leading-tight group-hover/card:text-blue-400 transition-colors">
                        {t.title}
                    </span>
                    <i className={`fa-solid ${statusUI.icon} ${statusUI.color} text-[8px] shrink-0`}></i>
                </div>
                
                <div className="flex flex-col gap-1 text-[8px] text-gray-500 font-bold">
                    <div className="flex items-center justify-between gap-2">
                        {t.time ? (
                            <span className="flex items-center gap-0.5">
                                <i className="fa-regular fa-clock text-[7px] opacity-75"></i>
                                {t.time}
                            </span>
                        ) : (
                            <span>Ganztägig</span>
                        )}
                        {t.project && (
                            <span className="text-emerald-400 bg-emerald-400/10 px-1 rounded truncate max-w-[60px] shrink-0">
                                {t.project.project_number}
                            </span>
                        )}
                    </div>
                    {/* Show Assignee Name if viewing All Workers */}
                    {selectedTimelineUserId === 'all' && t.assignee && (
                        <span className="text-blue-400 truncate font-semibold flex items-center gap-0.5">
                            <i className="fa-solid fa-user text-[7px] opacity-75"></i>
                            {t.assignee.name}
                        </span>
                    )}
                </div>
            </div>
        );
    };

    const renderMonthView = () => {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        
        const daysInMonth = getDaysInMonth(year, month);
        const firstDayIndex = getFirstDayOfMonth(year, month);
        
        const prevMonthDays = getDaysInMonth(year, month - 1);
        
        const gridDays = [];
        
        // Prev month days padding
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            gridDays.push({
                day: prevMonthDays - i,
                isCurrentMonth: false,
                dateObj: new Date(year, month - 1, prevMonthDays - i)
            });
        }
        
        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            gridDays.push({
                day: i,
                isCurrentMonth: true,
                dateObj: new Date(year, month, i)
            });
        }
        
        // Next month days padding (fill grid of 42 or 35 cells)
        const totalCells = gridDays.length > 35 ? 42 : 35;
        const nextMonthPadding = totalCells - gridDays.length;
        for (let i = 1; i <= nextMonthPadding; i++) {
            gridDays.push({
                day: i,
                isCurrentMonth: false,
                dateObj: new Date(year, month + 1, i)
            });
        }
        
        return (
            <div className="glass-card rounded-2xl border border-white/10 p-5 bg-black/20 animate-[fadeIn_0.3s_ease-out] w-full overflow-x-auto">
                <div className="min-w-[700px]">
                    {/* Days of week header */}
                    <div className="grid grid-cols-7 gap-2 mb-3">
                        {dayNamesShort.map((day, idx) => (
                            <div key={idx} className="text-center text-xs font-bold text-gray-500 uppercase tracking-widest py-2">
                                {day}
                            </div>
                        ))}
                    </div>
                    
                    {/* Cells Grid */}
                    <div className="grid grid-cols-7 gap-2">
                        {gridDays.map((cell, idx) => {
                            const dateStr = formatDateString(cell.dateObj);
                            const isToday = formatDateString(new Date()) === dateStr;
                            
                            const dayTasks = displayedTasks.filter(t => t.due_date === dateStr);
                            
                            return (
                                <div 
                                    key={idx} 
                                    className={`min-h-[110px] rounded-xl border p-2 flex flex-col justify-between group relative transition-all ${
                                        cell.isCurrentMonth 
                                            ? 'bg-white/5 border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5' 
                                            : 'bg-white/[0.01] border-white/5 opacity-40 hover:opacity-60'
                                    } ${isToday ? 'border-blue-500 ring-1 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)] bg-blue-500/5' : ''}`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`text-xs font-black ${isToday ? 'text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-md' : 'text-gray-400'}`}>
                                            {cell.day}
                                        </span>
                                        
                                        {/* Inline Add Button on Hover */}
                                        <button
                                            type="button"
                                            onClick={() => handleOpenModalForDate(dateStr)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-md bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white flex items-center justify-center text-[10px]"
                                            title="Aufgabe an diesem Tag erstellen"
                                        >
                                            <i className="fa-solid fa-plus"></i>
                                        </button>
                                    </div>
                                    
                                    {/* Day Tasks Pills list */}
                                    <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[85px] pr-1 custom-scrollbar">
                                        {dayTasks.map(t => {
                                            const statusUI = getStatusIconAndColor(t.status);
                                            return (
                                                <div
                                                    key={t.id}
                                                    onClick={(e) => { e.stopPropagation(); handleOpenModal(t); }}
                                                    className={`px-2 py-1 rounded-lg border border-white/5 flex items-center justify-between gap-1.5 cursor-pointer bg-black/40 hover:bg-black/60 transition-all ${statusUI.color} border-l-[3px] ${statusUI.border}`}
                                                    title={`${t.time ? `${t.time} - ` : ''}${t.title} (${t.status})`}
                                                >
                                                    <div className="flex items-center gap-1 min-w-0 flex-1">
                                                        {t.time && (
                                                            <span className="text-[9px] font-black opacity-80 shrink-0">
                                                                {t.time}
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] font-bold truncate flex-1 leading-tight">
                                                            {t.title}
                                                        </span>
                                                    </div>
                                                    <i className={`fa-solid ${statusUI.icon} text-[9px] shrink-0 opacity-70`}></i>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };



    const renderWeekView = () => {
        const weekDays = getWeekDays(selectedDate);
        
        const weekTasks = displayedTasks.filter(t => {
            if (selectedTimelineUserId !== 'all') {
                if (!t.assigned_to_id || t.assigned_to_id.toString() !== selectedTimelineUserId.toString()) return false;
            }
            return weekDays.some(day => formatDateString(day) === t.due_date);
        });
        
        const hours = [];
        for (let i = 7; i <= 20; i++) {
            hours.push(i);
        }

        const today = now;
        const isCurrentWeek = weekDays.some(day => formatDateString(day) === formatDateString(today));
        const currentHour = today.getHours();
        const currentMinute = today.getMinutes();
        
        return (
            <div className="glass-card rounded-2xl border border-white/10 p-5 bg-black/20 overflow-x-auto custom-scrollbar animate-[fadeIn_0.3s_ease-out]">
                <div className="min-w-[900px] flex flex-col">
                    {/* Columns Header (Days Mon-Sun) */}
                    <div className="flex border-b border-white/10 pb-3 mb-2">
                        {/* Time label placeholder */}
                        <div className="w-24 shrink-0 text-xs font-bold text-gray-500 uppercase tracking-widest text-center self-end">
                            Uhrzeit
                        </div>
                        {/* Week Days Columns */}
                        <div className="flex flex-1 gap-3">
                            {weekDays.map((day, idx) => {
                                const isToday = formatDateString(today) === formatDateString(day);
                                return (
                                    <div key={idx} className={`flex-1 min-w-[110px] p-3 rounded-xl flex flex-col items-center justify-center border ${
                                        isToday 
                                            ? 'bg-blue-500/10 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.1)]' 
                                            : 'bg-white/5 border-white/10'
                                    }`}>
                                        <p className={`text-xs font-black uppercase tracking-wider ${isToday ? 'text-blue-400' : 'text-gray-400'}`}>
                                            {dayNamesShort[idx]}
                                        </p>
                                        <span className={`text-sm font-black mt-1 ${isToday ? 'text-white' : 'text-gray-300'}`}>
                                            {day.getDate()}.{String(day.getMonth() + 1).padStart(2, '0')}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    
                    {/* Ganztägig (All Day) Row */}
                    <div className="flex border-b border-white/5 py-2.5 bg-white/[0.02] rounded-xl mb-3 border border-white/10">
                        <div className="w-24 shrink-0 flex flex-col items-center justify-center px-2">
                            <span className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Ganztägig</span>
                            <i className="fa-solid fa-umbrella text-gray-600 text-xs mt-1"></i>
                        </div>
                        <div className="flex flex-1 gap-3">
                            {weekDays.map((day, idx) => {
                                const dateStr = formatDateString(day);
                                const dayAllDayTasks = weekTasks.filter(t => t.due_date === dateStr && !t.time);
                                return (
                                    <div key={idx} className="flex-1 min-w-[110px] space-y-1.5 px-1 min-h-[55px] justify-center flex flex-col">
                                        {dayAllDayTasks.map(t => renderCompactTaskCard(t))}
                                        {dayAllDayTasks.length === 0 && (
                                            <span className="text-[10px] text-gray-600 italic text-center font-medium">Keine</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    
                    {/* Hourly Rows */}
                    <div className="space-y-2 relative">
                        {/* Live Running current time indicator line */}
                        {isCurrentWeek && currentHour >= 7 && currentHour < 21 && (
                            <div 
                                className="absolute left-[96px] right-0 flex items-center pointer-events-none z-30"
                                style={{ top: `${((currentHour - 7) + currentMinute / 60) * (90 + 8)}px` }}
                            >
                                <div className="w-full border-t-2 border-red-500 relative flex items-center">
                                    <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-red-500 ring-4 ring-red-500/30 animate-pulse"></div>
                                    <div className="absolute -left-[58px] bg-red-500 text-white font-black text-[9px] px-1.5 py-0.5 rounded shadow-lg flex items-center gap-0.5">
                                        <i className="fa-regular fa-clock text-[8px]"></i>
                                        {String(currentHour).padStart(2, '0')}:{String(currentMinute).padStart(2, '0')}
                                    </div>
                                </div>
                            </div>
                        )}

                        {hours.map(hour => {
                            const hourStr = `${String(hour).padStart(2, '0')}:00`;
                            return (
                                <div key={hour} className="flex items-stretch h-[90px] border-b border-white/5 pb-2">
                                    {/* Hour Label */}
                                    <div className="w-24 shrink-0 flex items-center justify-center font-black text-sm text-gray-500">
                                        <i className="fa-regular fa-clock text-xs text-gray-600 mr-1.5"></i>
                                        {hourStr}
                                    </div>
                                    
                                    {/* Slots per day */}
                                    <div className="flex flex-1 gap-3">
                                        {weekDays.map((day, idx) => {
                                            const dateStr = formatDateString(day);
                                            const dayHourTasks = weekTasks.filter(t => {
                                                if (t.due_date !== dateStr) return false;
                                                const taskHour = getTaskHour(t.time);
                                                return taskHour === hour;
                                            });
                                            
                                            return (
                                                <div 
                                                    key={idx} 
                                                    className="flex-1 min-w-[110px] bg-white/[0.02] hover:bg-blue-500/[0.03] border border-white/5 hover:border-blue-500/20 rounded-xl p-2 flex flex-col justify-between group relative transition-all"
                                                >
                                                    <div className="space-y-1.5 flex-1 flex flex-col justify-center overflow-y-auto max-h-[80px] custom-scrollbar pr-0.5">
                                                        {dayHourTasks.map(t => renderCompactTaskCard(t))}
                                                    </div>
                                                    
                                                    {/* Inline Add Button inside specific Slot */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenModalForDate(dateStr, selectedTimelineUserId === 'all' ? '' : selectedTimelineUserId, `${String(hour).padStart(2, '0')}:00`)}
                                                        className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-md bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white flex items-center justify-center text-[10px]"
                                                        title={`Aufgabe für ${dayNamesLong[day.getDay()]} um ${hourStr} erstellen`}
                                                    >
                                                        <i className="fa-solid fa-plus"></i>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

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
            setIsModalEditMode(false);
        } else {
            resetForm();
            setIsModalEditMode(true);
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

    const handleStatusChange = async (task, newStatus) => {
        try {
            await api.patch(`/tasks/${task.id}`, { status: newStatus });
            fetchTasksUsersAndProjects();
            setEditingTask(prev => prev ? { ...prev, status: newStatus } : null);
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
                    {/* View Switcher Toggle */}
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mr-2">
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                                viewMode === 'grid' 
                                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            <i className="fa-solid fa-clipboard-list"></i> Kachelansicht
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('calendar')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                                viewMode === 'calendar' 
                                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            <i className="fa-solid fa-calendar-days"></i> Kalender & Zeitplan
                        </button>
                    </div>

                    {canCreateTasks && viewMode === 'grid' && (
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

            {viewMode === 'grid' ? (
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
            ) : (
                <div className="space-y-6">
                    {/* Calendar Mode Tabs & Date Nav */}
                    <div className="glass-card p-4 rounded-2xl border border-white/10 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-black/30 animate-[fadeIn_0.3s_ease-out]">
                        {/* Tab Switchers */}
                        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 self-start">
                            <button
                                type="button"
                                onClick={() => setCalendarTab('month')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                    calendarTab === 'month' 
                                        ? 'bg-white/10 text-white border border-white/10' 
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                <i className="fa-solid fa-calendar"></i> Monatsansicht
                            </button>
                            <button
                                type="button"
                                onClick={() => setCalendarTab('week')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                    calendarTab === 'week' 
                                        ? 'bg-white/10 text-white border border-white/10' 
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                <i className="fa-solid fa-calendar-week"></i> Wochenplan
                            </button>
                        </div>

                        {/* Date Navigation Controllers */}
                        <div className="flex items-center gap-3 justify-between lg:justify-end">
                            <div className="flex items-center bg-black/40 rounded-xl border border-white/5 overflow-hidden p-0.5">
                                <button 
                                    type="button"
                                    onClick={handlePrevDate}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/5 transition-colors rounded-lg"
                                >
                                    <i className="fa-solid fa-chevron-left text-sm"></i>
                                </button>
                                <button 
                                    type="button"
                                    onClick={handleSetToday}
                                    className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-400 hover:text-white hover:bg-white/5 transition-colors rounded-lg border-x border-white/5"
                                >
                                    Heute
                                </button>
                                <button 
                                    type="button"
                                    onClick={handleNextDate}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/5 transition-colors rounded-lg"
                                >
                                    <i className="fa-solid fa-chevron-right text-sm"></i>
                                </button>
                            </div>
                            
                            <h3 className="text-white font-bold text-sm tracking-wide bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
                                {getCalendarNavTitle()}
                            </h3>
                        </div>

                        {/* Weekly Timeline view: User Select Dropdown */}
                        {calendarTab === 'week' && (
                            <div className="flex items-center gap-2 self-stretch lg:self-auto min-w-[220px]">
                                <i className="fa-solid fa-user-clock text-blue-400 text-sm"></i>
                                <select
                                    value={selectedTimelineUserId}
                                    onChange={(e) => setSelectedTimelineUserId(e.target.value)}
                                    className="flex-1 bg-black/40 border border-white/15 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-blue-500 appearance-none [&>option]:bg-gray-900"
                                >
                                    <option value="all">Wochenplan: Alle Mitarbeiter</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>Wochenplan: {u.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Sub-mode views contents */}
                    {calendarTab === 'month' && renderMonthView()}
                    {calendarTab === 'week' && renderWeekView()}
                </div>
            )}

            {/* Modal for Creating Task */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4 py-8 overflow-y-auto">
                    <div className="glass-card w-full max-w-xl rounded-2xl border border-white/10 shadow-2xl animate-[slideUp_0.3s_ease-out] my-auto">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 rounded-t-2xl">
                            <h2 className="text-xl font-semibold text-white flex items-center gap-3">
                                <i className="fa-solid fa-list-check text-blue-400"></i> {editingTask ? (isModalEditMode ? 'Aufgabe bearbeiten' : 'Aufgabendetails') : 'Neue Aufgabe'}
                            </h2>
                             <button 
                                onClick={() => { setIsModalOpen(false); resetForm(); }} 
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        
                        {editingTask && !isModalEditMode ? (
                            <div className="p-6 space-y-5 animate-[fadeIn_0.2s_ease-out]">
                                {/* Detail properties */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Status */}
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3 relative group">
                                        <div className={`w-8 h-8 rounded-lg ${getStatusIconAndColor(editingTask.status).bg} flex items-center justify-center flex-shrink-0`}>
                                            <i className={`fa-solid ${getStatusIconAndColor(editingTask.status).icon} ${getStatusIconAndColor(editingTask.status).color} text-sm`}></i>
                                        </div>
                                        <div className="flex-1 pr-4 relative">
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Status (Klicken zum Ändern)</p>
                                            <select
                                                value={editingTask.status}
                                                onChange={(e) => handleStatusChange(editingTask, e.target.value)}
                                                className="bg-transparent border-none text-white text-xs font-black mt-0.5 focus:outline-none cursor-pointer appearance-none w-full [&>option]:bg-gray-900"
                                            >
                                                <option value="In Arbeit">In Arbeit</option>
                                                <option value="Warten">Warten</option>
                                                <option value="Erledigt">Erledigt</option>
                                            </select>
                                            <div className="absolute right-0 top-[60%] -translate-y-1/2 pointer-events-none text-gray-500 text-[10px]">
                                                <i className="fa-solid fa-chevron-down"></i>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Zuweisung */}
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center flex-shrink-0">
                                            <i className="fa-solid fa-user-check text-sm"></i>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Zugewiesen an</p>
                                            <p className="text-white text-xs font-bold truncate mt-0.5">{editingTask.assignee?.name || 'Keine Zuweisung'}</p>
                                        </div>
                                    </div>

                                    {/* Projekt */}
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                                            <i className="fa-solid fa-folder text-sm"></i>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Projekt</p>
                                            {editingTask.project ? (
                                                <p 
                                                    onClick={() => { setIsModalOpen(false); navigate(`/projekte/${editingTask.project.id}`); }}
                                                    className="text-emerald-400 hover:text-emerald-300 text-xs font-bold truncate mt-0.5 cursor-pointer underline decoration-dotted"
                                                >
                                                    {editingTask.project.project_number} - {editingTask.project.title}
                                                </p>
                                            ) : (
                                                <p className="text-gray-400 text-xs mt-0.5">Kein Projekt</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Fälligkeit */}
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center flex-shrink-0">
                                            <i className="fa-solid fa-calendar-day text-sm"></i>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Fälligkeit</p>
                                            <p className="text-white text-xs font-bold mt-0.5">
                                                {editingTask.due_date ? new Date(editingTask.due_date).toLocaleDateString('de-DE') : 'Kein Datum'}
                                                {editingTask.time ? ` um ${editingTask.time}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Beschreibung */}
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Beschreibung</p>
                                    <p className="text-gray-200 text-sm whitespace-pre-wrap leading-relaxed max-h-[160px] overflow-y-auto custom-scrollbar">
                                        {editingTask.description || <span className="text-gray-500 italic">Keine Beschreibung angegeben.</span>}
                                    </p>
                                </div>

                                {/* Anhänge Grid */}
                                {editingTask.attachments && editingTask.attachments.length > 0 && (
                                    <div className="space-y-3">
                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold pl-1">Anhänge (Zum Vergrößern anklicken)</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {editingTask.attachments.map((att, index) => {
                                                const isImg = att.content_type?.startsWith('image/');
                                                const isVid = att.content_type?.startsWith('video/');
                                                return (
                                                    <div 
                                                        key={att.id} 
                                                        onClick={() => openGallery(editingTask.attachments, index)}
                                                        className="group relative aspect-video bg-black/40 rounded-xl overflow-hidden border border-white/10 hover:border-blue-500/50 hover:scale-[1.02] cursor-pointer transition-all shadow-md"
                                                    >
                                                        {isImg ? (
                                                            <img 
                                                                crossOrigin="anonymous" 
                                                                src={getImageUrl(att.thumb_url || att.file_url)} 
                                                                alt={att.file_name} 
                                                                className="w-full h-full object-cover" 
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-2 bg-gradient-to-b from-black/20 to-black/60">
                                                                <i className={`fa-solid ${isVid ? 'fa-video text-blue-400' : 'fa-file-invoice text-gray-400'} text-2xl`}></i>
                                                                <span className="text-[9px] text-gray-300 truncate w-full text-center px-1 font-medium">{att.file_name}</span>
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <i className="fa-solid fa-magnifying-glass-plus text-white text-lg"></i>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Action buttons inside View Mode */}
                                <div className="pt-4 flex justify-between items-center border-t border-white/10">
                                    {canCreateTasks ? (
                                        <button 
                                            type="button" 
                                            onClick={() => setIsModalEditMode(true)} 
                                            className="px-5 py-2 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-all shadow-[0_4px_15px_rgba(59,130,246,0.2)] flex items-center gap-2"
                                        >
                                            <i className="fa-solid fa-pen-to-square"></i> Bearbeiten
                                        </button>
                                    ) : (
                                        <div></div>
                                    )}
                                    
                                    <div className="flex gap-3">
                                        <button 
                                            type="button" 
                                            onClick={() => { setIsModalOpen(false); resetForm(); }} 
                                            className="px-5 py-2 text-sm font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                                        >
                                            Schließen
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
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
                                <button 
                                    type="button" 
                                    onClick={() => { 
                                        if (editingTask) {
                                            setIsModalEditMode(false);
                                        } else {
                                            setIsModalOpen(false); 
                                            resetForm(); 
                                        }
                                    }} 
                                    className="px-5 py-2.5 text-sm font-medium text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                                >
                                    {editingTask ? 'Zurück zur Ansicht' : 'Abbrechen'}
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
                    )}
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
