import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Folder, 
    File, 
    Image as ImageIcon, 
    FileText, 
    Download, 
    Trash2, 
    Plus, 
    Search,
    ChevronRight,
    Users,
    Clock,
    Star,
    Grid,
    List,
    Upload,
    HardDrive,
    Shield,
    Loader2,
    ArrowLeft,
    FolderPlus,
    X,
    Link2,
    Share2,
    Copy,
    Check,
    Globe
} from 'lucide-react';
import api from '../../services/api';
import { useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import MediaViewer from '../../components/common/MediaViewer';
import { getImageUrl } from '../../utils/config';

const FileManager = () => {
    const { user } = useSelector(state => state.auth);
    const [viewMode, setViewMode] = useState('grid');
    const [activeSection, setActiveSection] = useState('private'); // 'private', 'public', 'favorites'
    const [currentFolderId, setCurrentFolderId] = useState('root');
    const [breadcrumbs, setBreadcrumbs] = useState([{ id: 'root', name: 'Dateien' }]);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [files, setFiles] = useState([]);
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    
    // UI State
    const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [shareModalData, setShareModalData] = useState(null); // { id, type, name, is_external_shared, share_token }

    // Media Viewer State
    const [isMediaViewerOpen, setIsMediaViewerOpen] = useState(false);
    const [mediaViewerItems, setMediaViewerItems] = useState([]);
    const [mediaViewerIndex, setMediaViewerIndex] = useState(0);

    const openPreview = (fileList, index) => {
        setMediaViewerItems(fileList);
        setMediaViewerIndex(index);
        setIsMediaViewerOpen(true);
    };

    const fetchContent = async () => {
        try {
            setLoading(true);
            const res = await api.get('/files', {
                params: {
                    folder_id: currentFolderId,
                    is_public: activeSection === 'public',
                    favorite_only: activeSection === 'favorites'
                }
            });
            setFiles(res.data.data.files || []);
            setFolders(res.data.data.folders || []);
        } catch (err) {
            console.error('Error fetching files:', err);
            toast.error('Fehler beim Laden der Inhalten');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContent();
    }, [currentFolderId, activeSection]);

    const handleUpload = async (e) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles.length) return;

        const formData = new FormData();
        for (let i = 0; i < selectedFiles.length; i++) {
            formData.append('files', selectedFiles[i]);
        }
        formData.append('is_public', activeSection === 'public');
        if (currentFolderId !== 'root') {
            formData.append('folder_id', currentFolderId);
        }

        try {
            setUploading(true);
            await api.post('/files/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Hochgeladen');
            fetchContent();
        } catch (err) {
            console.error('Upload error:', err);
            toast.error(err.response?.data?.message || 'Fehler beim Hochladen');
        } finally {
            setUploading(false);
        }
    };

    const handleCreateFolder = async (e) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;

        try {
            await api.post('/files/folders', {
                name: newFolderName,
                parent_id: currentFolderId === 'root' ? null : currentFolderId,
                is_public: activeSection === 'public'
            });
            toast.success('Ordner erstellt');
            setIsNewFolderModalOpen(false);
            setNewFolderName('');
            fetchContent();
        } catch (err) {
            toast.error('Geben Sie einen gültigen Namen ein');
        }
    };

    const handleDeleteFile = async (fileId) => {
        if (!window.confirm('Datei wirklich löschen?')) return;
        try {
            await api.delete(`/files/${fileId}`);
            setFiles(prev => prev.filter(f => f.id !== fileId));
            toast.success('Gelöscht');
        } catch (err) {
            toast.error('Fehler beim Löschen');
        }
    };

    const handleDeleteFolder = async (folderId) => {
        if (!window.confirm('Ordner и ALLE Inhalte wirklich löschen?')) return;
        try {
            await api.delete(`/files/folders/${folderId}`);
            setFolders(prev => prev.filter(f => f.id !== folderId));
            toast.success('Ordner gelöscht');
        } catch (err) {
            toast.error('Fehler beim Löschen');
        }
    };

    const handleToggleFavorite = async (id, type = 'file') => {
        try {
            const res = await api.post('/files/favorite', { id, type });
            const isFav = res.data.is_favorite;
            
            const updateState = (prev) => prev.map(item => {
                if (item.id === id) {
                    return {
                        ...item,
                        favorited_by: isFav ? [{ user_id: user.id }] : []
                    };
                }
                return item;
            });

            const filterState = (prev) => prev.filter(item => item.id !== id);

            if (type === 'folder') {
                setFolders(updateState);
                if (activeSection === 'favorites' && !isFav) setFolders(filterState);
            } else {
                setFiles(updateState);
                if (activeSection === 'favorites' && !isFav) setFiles(filterState);
            }

            toast.success(isFav ? 'Zu Favoriten hinzugefügt' : 'Aus Favoriten entfernt');
        } catch (err) {
            console.error('Favorite toggle frontend error:', err);
            const msg = err.response?.data?.message || 'Fehler beim Ändern des Favoriten-Status';
            toast.error(msg);
        }
    };

    const handleToggleShare = async () => {
        if (!shareModalData) return;
        try {
            const res = await api.post('/files/toggle-share', {
                id: shareModalData.id,
                type: shareModalData.type
            });
            
            const updated = res.data;
            setShareModalData(prev => ({
                ...prev,
                is_external_shared: updated.is_external_shared,
                share_token: updated.share_token
            }));

            // Sync with main list
            if (shareModalData.type === 'folder') {
                setFolders(prev => prev.map(f => f.id === shareModalData.id ? { ...f, ...updated } : f));
            } else {
                setFiles(prev => prev.map(f => f.id === shareModalData.id ? { ...f, ...updated } : f));
            }

            toast.success(updated.is_external_shared ? 'Link-Freigabe aktiviert' : 'Freigabe deaktiviert');
        } catch (err) {
            toast.error('Fehler beim Ändern der Freigabe');
        }
    };

    const navigateToFolder = (folder) => {
        setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
        setCurrentFolderId(folder.id);
    };

    const navigateToBreadcrumb = (index) => {
        const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
        setBreadcrumbs(newBreadcrumbs);
        setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
    };

    const goBack = () => {
        if (breadcrumbs.length > 1) {
            navigateToBreadcrumb(breadcrumbs.length - 2);
        }
    };

    const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const storageUsedGb = (user?.storage_used_bytes || 0) / (1024 * 1024 * 1024);
    const storageLimitGb = user?.storage_limit_gb || 2.0;
    const storagePercent = Math.min(100, (storageUsedGb / storageLimitGb) * 100);

    const formatSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="p-4 md:p-8 min-h-screen bg-transparent">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <HardDrive className="text-blue-500" /> Dateimanager
                    </h1>
                    <p className="text-white/50">Organisieren Sie Ihre Dokumentе и digitalen Assets.</p>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button 
                        onClick={() => setIsNewFolderModalOpen(true)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white px-5 py-3 rounded-xl border border-white/10 transition-all"
                    >
                        <FolderPlus className="w-5 h-5" />
                        Neuer Ordner
                    </button>
                    <label className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl shadow-lg shadow-blue-600/20 transition-all duration-300 cursor-pointer">
                        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                        {uploading ? 'Lädt...' : 'Hochladen'}
                        <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
                    </label>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Sidebar */}
                <div className="lg:col-span-3">
                    <div className="bg-white/5 rounded-2xl border border-white/10 p-4 sticky top-8 backdrop-blur-xl">
                        <div className="space-y-1">
                            <SidebarItem 
                                icon={<Shield className="w-5 h-5" />} 
                                label="Meine Dateien" 
                                active={activeSection === 'private'}
                                onClick={() => { setActiveSection('private'); setCurrentFolderId('root'); setBreadcrumbs([{id: 'root', name: 'Dateien'}]); }}
                            />
                            <SidebarItem 
                                icon={<Users className="w-5 h-5" />} 
                                label="Öffentlich" 
                                active={activeSection === 'public'}
                                onClick={() => { setActiveSection('public'); setCurrentFolderId('root'); setBreadcrumbs([{id: 'root', name: 'Öffentlich'}]); }}
                            />
                            <div className="h-px bg-white/10 my-4" />
                            <SidebarItem 
                                icon={<Star className="w-5 h-5" />} 
                                label="Favoriten" 
                                active={activeSection === 'favorites'}
                                onClick={() => { setActiveSection('favorites'); setCurrentFolderId('root'); }}
                            />
                        </div>

                        {/* Storage */}
                        <div className="mt-10 p-4 bg-white/5 rounded-xl border border-white/5">
                            <div className="flex justify-between text-[10px] text-white/40 mb-2 font-mono">
                                <span>SPEICHER</span>
                                <span>{storagePercent.toFixed(1)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${storagePercent}%` }}
                                    className={`h-full bg-gradient-to-r ${storagePercent > 90 ? 'from-red-500 to-orange-500' : 'from-blue-500 to-indigo-500'}`} 
                                />
                            </div>
                            <p className="mt-3 text-[9px] text-white/30 text-center uppercase tracking-widest">
                                {storageUsedGb.toFixed(2)} / {storageLimitGb} GB
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="lg:col-span-9">
                    {/* Toolbar */}
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                            <input 
                                type="text"
                                placeholder="Suchen..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            />
                        </div>

                        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/10">
                            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}><Grid className="w-4 h-4" /></button>
                            <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}><List className="w-4 h-4" /></button>
                        </div>
                    </div>

                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 text-sm mb-8 px-2 overflow-x-auto no-scrollbar">
                        {breadcrumbs.length > 1 && (
                            <button onClick={goBack} className="p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors">
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                        )}
                        {breadcrumbs.map((crumb, idx) => (
                            <React.Fragment key={crumb.id}>
                                <button 
                                    onClick={() => navigateToBreadcrumb(idx)}
                                    className={`hover:text-white transition-colors whitespace-nowrap ${idx === breadcrumbs.length - 1 ? 'text-white font-bold' : 'text-white/40'}`}
                                >
                                    {crumb.name}
                                </button>
                                {idx < breadcrumbs.length - 1 && <ChevronRight className="w-4 h-4 text-white/10" />}
                            </React.Fragment>
                        ))}
                    </div>

                    {/* List Area */}
                    <div className="min-h-[400px] relative">
                        {loading ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                            </div>
                        ) : (filteredFolders.length === 0 && filteredFiles.length === 0) ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/10">
                                <Folder className="w-20 h-20 mb-4 opacity-5" />
                                <p className="font-medium tracking-widest uppercase text-xs">Ordner ist leer</p>
                            </div>
                        ) : (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className={viewMode === 'grid' ? "grid grid-cols-2 lg:grid-cols-4 gap-6" : "space-y-2"}
                            >
                                {/* Folders */}
                                {filteredFolders.map(folder => (
                                    <FolderItem 
                                        key={folder.id} 
                                        folder={folder} 
                                        mode={viewMode} 
                                        onClick={() => navigateToFolder(folder)}
                                        onDelete={() => handleDeleteFolder(folder.id)}
                                        onShare={() => setShareModalData({ id: folder.id, type: 'folder', name: folder.name, is_external_shared: folder.is_external_shared, share_token: folder.share_token })}
                                    />
                                ))}

                                {/* Files */}
                                {filteredFiles.map((file, index) => (
                                    <FileItem 
                                        key={file.id} 
                                        file={file} 
                                        mode={viewMode} 
                                        onClick={() => openPreview(filteredFiles, index)}
                                        onDelete={() => handleDeleteFile(file.id)}
                                        onToggleFavorite={() => handleToggleFavorite(file.id, 'file')}
                                        onShare={() => setShareModalData({ id: file.id, type: 'file', name: file.name, is_external_shared: file.is_external_shared, share_token: file.share_token })}
                                        isFavorite={file.favorited_by?.length > 0}
                                        formatSize={formatSize}
                                    />
                                ))}
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>

            {/* New Folder Modal */}
            <AnimatePresence>
                {isNewFolderModalOpen && (
                    <Modal onClose={() => setIsNewFolderModalOpen(false)}>
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                            <FolderPlus className="text-blue-500" /> Neuen Ordner erstellen
                        </h3>
                        <form onSubmit={handleCreateFolder}>
                            <input 
                                autoFocus
                                type="text"
                                placeholder="Name des Ordners..."
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                            />
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setIsNewFolderModalOpen(false)} className="px-5 py-2.5 text-white/40 hover:text-white transition-colors">Abbrechen</button>
                                <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all">Erstellen</button>
                            </div>
                        </form>
                    </Modal>
                )}
            </AnimatePresence>

            {/* Share Modal */}
            <AnimatePresence>
                {shareModalData && (
                    <ShareModal 
                        data={shareModalData} 
                        onClose={() => setShareModalData(null)} 
                        onToggleShare={handleToggleShare} 
                    />
                )}
            </AnimatePresence>

            {/* Media Viewer */}
            <MediaViewer 
                isOpen={isMediaViewerOpen}
                onClose={() => setIsMediaViewerOpen(false)}
                items={mediaViewerItems}
                initialIndex={mediaViewerIndex}
                onShare={(item) => setShareModalData({ 
                    id: item.id, 
                    type: 'file', 
                    name: item.name || item.file_name, 
                    is_external_shared: item.is_external_shared, 
                    share_token: item.share_token 
                })}
            />
        </div>
    );
};

const Modal = ({ children, onClose }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#151518] border border-white/10 w-full max-w-md rounded-2xl p-8 relative shadow-2xl">
            {children}
        </motion.div>
    </div>
);

const ShareModal = ({ data, onClose, onToggleShare }) => {
    const [copied, setCopied] = useState(false);
    // Relative URL to absolute
    const shareUrl = data.share_token ? `${window.location.origin}/shared/${data.share_token}` : '';

    const handleCopy = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Modal onClose={onClose}>
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-3">
                        <Share2 className="text-blue-500 w-5 h-5" /> Freigabe verwalten
                    </h3>
                    <p className="text-xs text-white/40 truncate max-w-[280px]">{data.name}</p>
                </div>
                <button onClick={onClose} className="text-white/20 hover:text-white p-1 transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 cursor-pointer group" onClick={onToggleShare}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg transition-colors ${data.is_external_shared ? 'bg-blue-500/20 text-blue-500' : 'bg-white/5 text-white/20'}`}>
                            <Globe className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">Öffentliche Freigabe</p>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest">{data.is_external_shared ? 'Aktiviert' : 'Deaktiviert'}</p>
                        </div>
                    </div>
                    <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${data.is_external_shared ? 'bg-blue-600' : 'bg-white/10'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ${data.is_external_shared ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                </div>

                {data.is_external_shared && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                        <p className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em] mb-2 px-1">Teilbarer Link</p>
                        <div className="flex gap-2">
                            <div className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-xs text-blue-400 font-mono truncate">
                                {shareUrl}
                            </div>
                            <button 
                                onClick={handleCopy}
                                className="bg-white/5 hover:bg-white/10 text-white p-3 rounded-xl border border-white/10 transition-all active:scale-95"
                            >
                                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-[10px] text-emerald-400/60 text-center italic">
                            Jeder mit diesem Link kann den Inhalt ansehen.
                        </p>
                    </motion.div>
                )}
            </div>
        </Modal>
    );
};

const SidebarItem = ({ icon, label, active, onClick }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
    >
        {icon}
        <span className="text-sm font-medium">{label}</span>
    </button>
);

const FolderItem = ({ folder, mode, onClick, onDelete, onShare }) => {
    const isShared = folder.is_external_shared;

    if (mode === 'grid') {
        return (
            <motion.div 
                whileHover={{ y: -5 }}
                className="group relative bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-blue-500/50 transition-all cursor-pointer"
                onClick={onClick}
            >
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors relative">
                        <Folder className="w-8 h-8 text-blue-500 fill-blue-500/10" />
                        {isShared && <div className="absolute -top-1 -right-1 bg-emerald-500 w-3 h-3 rounded-full border-2 border-black" title="Öffentlich geteilt" />}
                    </div>
                    <div className="flex flex-col gap-1 items-center">
                        <button onClick={(e) => { e.stopPropagation(); onShare(); }} className="opacity-0 group-hover:opacity-100 p-1 text-white/10 hover:text-blue-400 transition-all">
                            <Link2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="flex justify-between items-start">
                    <div className="min-w-0">
                        <h3 className="text-white font-medium text-sm truncate">{folder.name}</h3>
                        <span className="text-[10px] text-white/30 uppercase tracking-widest mt-1 block">Ordner</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="opacity-0 group-hover:opacity-100 p-1.5 text-white/10 hover:text-red-400 transition-all">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </motion.div>
        );
    }
    return (
        <div 
            onClick={onClick}
            className="group flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer"
        >
            <div className="flex items-center gap-4">
                <div className="relative">
                    <Folder className="w-5 h-5 text-blue-500 fill-blue-500/10" />
                    {isShared && <div className="absolute -top-1 -right-1 bg-emerald-500 w-2 h-2 rounded-full" />}
                </div>
                <span className="text-white text-sm font-medium">{folder.name}</span>
            </div>
            <div className="flex items-center gap-1">
                <button onClick={(e) => { e.stopPropagation(); onShare(); }} className="opacity-0 group-hover:opacity-100 p-2 text-white/20 hover:text-blue-400 transition-all">
                    <Link2 className="w-4 h-4" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="opacity-0 group-hover:opacity-100 p-2 text-white/20 hover:text-red-400 transition-all">
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const FileItem = ({ file, mode, onClick, onDelete, onToggleFavorite, onShare, isFavorite, formatSize }) => {
    const handleDownload = (e) => {
        e.stopPropagation();
        window.open(file.file_url, '_blank');
    };

    const isShared = file.is_external_shared;

    const icon = file.mime_type?.startsWith('image/') ? <ImageIcon className="w-8 h-8 text-emerald-400" /> :
                 file.mime_type?.includes('pdf') ? <FileText className="w-8 h-8 text-red-400" /> :
                 <File className="w-8 h-8 text-blue-400" />;

    if (mode === 'grid') {
        return (
            <motion.div 
                whileHover={{ y: -5 }}
                onClick={onClick}
                className="group relative bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-blue-500/50 transition-all cursor-pointer"
            >
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-white/5 rounded-xl relative">
                        {icon}
                        {isShared && <div className="absolute -top-1 -right-1 bg-emerald-500 w-3 h-3 rounded-full border-2 border-black" />}
                    </div>
                    <div className="flex flex-col gap-1 items-center">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }} 
                            className={`${isFavorite ? 'text-yellow-500' : 'text-white/10 hover:text-yellow-500'} p-1 transition-colors`}
                        >
                            <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-500' : ''}`} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onShare(); }} className="opacity-0 group-hover:opacity-100 p-1 text-white/10 hover:text-blue-400 transition-all">
                            <Link2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <h3 className="text-white font-medium text-sm truncate mb-1" title={file.name}>{file.name}</h3>
                <div className="flex justify-between items-center text-[9px] text-white/20 uppercase font-mono">
                    <span>{formatSize(file.size)}</span>
                    <div className="flex items-center gap-2">
                        <button onClick={handleDownload} className="hover:text-blue-400"><Download className="w-3.5 h-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                </div>
            </motion.div>
        );
    }
    return (
        <div 
            onClick={onClick}
            className="group flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer"
        >
            <div className="flex items-center gap-4 flex-1">
                <div className="relative">
                    {React.cloneElement(icon, { className: 'w-5 h-5' })}
                    {isShared && <div className="absolute -top-1 -right-1 bg-emerald-500 w-2 h-2 rounded-full" />}
                </div>
                <span className="text-white text-sm font-medium truncate">{file.name}</span>
            </div>
            <div className="flex items-center gap-4">
                <span className="text-[10px] text-white/20 font-mono hidden md:block">{formatSize(file.size)}</span>
                <button 
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
                    className={`${isFavorite ? 'text-yellow-500' : 'text-white/20 hover:text-yellow-500'}`}
                >
                    <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-500' : ''}`} />
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={(e) => { e.stopPropagation(); onShare(); }} className="p-2 text-white/20 hover:text-blue-400"><Link2 className="w-4 h-4" /></button>
                    <button onClick={handleDownload} className="p-2 text-white/20 hover:text-blue-400"><Download className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 text-white/20 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
            </div>
        </div>
    );
};

export default FileManager;
