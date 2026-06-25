import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Image as ImageIcon,
    FileText,
    File,
    FileVideo,
    FileAudio,
    FileArchive,
    Loader2,
    CheckCircle2,
    AlertCircle,
    X,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import api from '../../services/api';
import JSZip from 'jszip';
import MediaViewer from '../../components/common/MediaViewer';
import FolderPermissionsModal from './components/FolderPermissionsModal';
import { getImageUrl } from '../../utils/config';

const ProjectFileManager = ({ project }) => {
    const projectId = project.id;
    const [currentPath, setCurrentPath] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [downloadingFolders, setDownloadingFolders] = useState({});
    const fileInputRef = useRef(null);
    const [viewMode, setViewMode] = useState(() => {
        return localStorage.getItem('project_files_view_mode') || 'grid';
    });

    useEffect(() => {
        localStorage.setItem('project_files_view_mode', viewMode);
    }, [viewMode]);

    // Upload Queue State
    const [uploadQueue, setUploadQueue] = useState([]); // { id, fileName, progress, status, error }
    const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false);
    const [isUploadPanelMinimized, setIsUploadPanelMinimized] = useState(false);

    // Auth & Permissions
    const { user } = useSelector(state => state.auth);
    const userRole = user?.role?.name || user?.role; // Fallback for safety
    const isManagement = ['Admin', 'Büro', 'Projektleiter', 'Gruppenleiter'].includes(userRole);

    // Workers can create, but not delete, folders. They can only delete their own files.
    // Management can do everything.
    // Subcontractors can create folders, upload files, and delete their own files/folders.
    const isSubcontractor = userRole === 'Subcontractor';
    const canManagePermissions = isManagement && !isSubcontractor;
    const canCreateFolder = true;
    const canUploadFiles = true;
    const canDeleteItems = true;

    // Gallery State
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryItems, setGalleryItems] = useState([]);
    const [galleryIndex, setGalleryIndex] = useState(0);

    // Permissions Modal State
    const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
    const [selectedFolderForPermissions, setSelectedFolderForPermissions] = useState(null);

    const openGallery = (allFiles, currentItemIdx) => {
        // Filter only files (not directories) and map them to the format MediaViewer expects
        const filesOnly = allFiles
            .filter(item => !item.isDirectory)
            .map(item => ({
                id: item.name,
                file_name: item.name,
                file_url: item.url,
                file_size: item.size,
                content_type: isImage(item.name) ? 'image/jpeg' : (item.name.match(/\.(mp4|webm|mov|avi|mkv|wmv|flv|m4v|3gp)$/i) ? 'video/mp4' : 'application/octet-stream')
            }));

        // Find the index of the current item in the filtered list
        const currentItem = allFiles[currentItemIdx];
        const newIdx = filesOnly.findIndex(f => f.file_name === currentItem.name);

        setGalleryItems(filesOnly);
        setGalleryIndex(newIdx !== -1 ? newIdx : 0);
        setIsGalleryOpen(true);
    };

    const fetchFiles = async (path = currentPath) => {
        setLoading(true);
        try {
            const res = await api.get(`/projects/${projectId}/files`, {
                params: { path }
            });
            if (res.data?.status === 'success') {
                setItems(res.data.data);
            }
        } catch (error) {
            console.error('Error fetching files:', error);
            // If the folder doesn't exist (e.g. brand new project), just show empty
            if (error.response?.status === 404) {
                setItems([]);
            } else {
                setItems([]);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles(currentPath);
    }, [projectId, currentPath]);

    // Refresh content when an upload completes
    useEffect(() => {
        const hasUploading = uploadQueue.some(u => u.status === 'uploading');
        if (!hasUploading && uploadQueue.length > 0 && uploadQueue.some(u => u.status === 'completed')) {
            fetchFiles();
        }
    }, [uploadQueue.map(u => u.status).join(',')]);

    const startSingleUpload = async (file) => {
        const uploadId = Math.random().toString(36).substring(7);
        const newUpload = {
            id: uploadId,
            fileName: file.name,
            progress: 0,
            status: 'uploading',
            error: null
        };

        setUploadQueue(prev => [...prev, newUpload]);

        // Client-side size check (100MB)
        const MAX_SIZE = 100 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            setUploadQueue(prev => prev.map(item =>
                item.id === uploadId ? { ...item, status: 'error', error: 'Datei ist zu groß (Max 100MB)' } : item
            ));
            return;
        }

        const formData = new FormData();
        formData.append('files', file);
        formData.append('path', currentPath);

        console.log(`[UPLOAD DEBUG] Sending file: ${file.name}, Path: ${currentPath}, Size: ${file.size} bytes`);

        try {
            const res = await api.post(`/projects/${projectId}/files/upload`, formData, {
                onUploadProgress: (progressEvent) => {
                    const total = progressEvent.total || file.size;
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / total);
                    setUploadQueue(prev => prev.map(item =>
                        item.id === uploadId ? { ...item, progress: percentCompleted } : item
                    ));
                }
            });

            if (res.status === 201 || res.data?.status === 'success') {
                setUploadQueue(prev => prev.map(item =>
                    item.id === uploadId ? { ...item, status: 'completed', progress: 100 } : item
                ));
                fetchFiles();
            }
        } catch (err) {
            console.error(`[UPLOAD ERROR] Failed for ${file.name}:`, err);
            if (err.response) {
                console.error(`[UPLOAD ERROR] Server Response Data:`, err.response.data);
            }
            const errorMsg = err.response?.data?.error || err.message || 'Upload fehlgeschlagen';
            setUploadQueue(prev => prev.map(item =>
                item.id === uploadId ? { ...item, status: 'error', error: errorMsg } : item
            ));
        }
    };

    const handleCreateFolder = async () => {
        const folderName = window.prompt('Name des neuen Ordners:');
        if (!folderName || !folderName.trim()) return;

        try {
            const res = await api.post(`/projects/${projectId}/files/folder`, {
                path: currentPath,
                name: folderName.trim()
            });
            if (res.data?.status === 'success') {
                fetchFiles();
            }
        } catch (error) {
            console.error('Error creating folder:', error);
            alert(error.response?.data?.error || 'Fehler beim Erstellen des Ordners');
        }
    };

    const handleFileUpload = async (e) => {
        const selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length === 0) return;

        setIsUploadPanelOpen(true);
        setIsUploadPanelMinimized(false);

        selectedFiles.forEach(file => {
            startSingleUpload(file);
        });

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDelete = async (item) => {
        const itemName = item.name;
        const isDirectory = item.isDirectory;
        const physicalName = item.physicalName;
        const confirmMsg = isDirectory
            ? `Möchten Sie den Ordner "${itemName}" und alle darin enthaltenen Dateien wirklich löschen?`
            : `Möchten Sie die Datei "${itemName}" wirklich löschen?`;

        if (!window.confirm(confirmMsg)) return;

        const effectiveName = physicalName || itemName;
        const itemPath = item.path || (currentPath ? `${currentPath}/${effectiveName}` : effectiveName);

        try {
            const res = await api.delete(`/projects/${projectId}/files`, {
                params: { path: itemPath }
            });
            if (res.data?.status === 'success') {
                fetchFiles();
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            alert(error.response?.data?.error || 'Fehler beim Löschen');
        }
    };

    const navigateTo = (item) => {
        const folderName = item.physicalName || item.name;
        setCurrentPath(prev => prev ? `${prev}/${folderName}` : folderName);
    };

    const navigateUp = () => {
        if (!currentPath) return;
        const parts = currentPath.split('/');
        parts.pop();
        setCurrentPath(parts.join('/'));
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const isImage = (filename) => {
        return /\.(jpg|jpeg|png|gif|webp|svg|heic|heif|tiff|bmp|jfif|avif|ico|dng)$/i.test(filename);
    };

    const isStagesDir = currentPath.startsWith('stages');

    const getDisplayName = (item, path) => {
        // If the backend provided a name (displayName), use it.
        if (item.name) return item.name;

        const name = item.physicalName || item.name;
        if (path === '' && name === 'stages') return 'Etappen (Bauschritte)';
        if (path === 'stages') {
            const stageIndex = project.stages?.findIndex(s => String(s.id) === name);
            if (stageIndex !== -1) {
                const stage = project.stages[stageIndex];
                return `Etappe ${stageIndex + 1}: ${stage.title}`;
            }
        }
        return name;
    };

    const handleDownload = async (item, e) => {
        e.stopPropagation();
        const itemPath = item.path || (currentPath ? `${currentPath}/${item.name}` : item.name);
        try {
            const res = await api.get(`/projects/${projectId}/files/download`, {
                params: { path: itemPath },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', item.name);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (error) {
            console.error('Download error:', error);
            alert('Fehler beim Herunterladen');
        }
    };

    const fetchFolderFilesRecursively = async (rootFolderPath) => {
        let allFiles = [];
        const queue = [rootFolderPath];
        
        while (queue.length > 0) {
            const current = queue.shift();
            try {
                const res = await api.get(`/projects/${projectId}/files`, {
                    params: { path: current }
                });
                if (res.data?.status === 'success') {
                    const itemsList = res.data.data;
                    for (const item of itemsList) {
                        const itemPhysicalName = item.physicalName || item.name;
                        const itemPath = item.path || (current ? `${current}/${itemPhysicalName}` : itemPhysicalName);
                        
                        if (item.isDirectory) {
                            queue.push(itemPath);
                        } else {
                            let zipPath = '';
                            if (current !== rootFolderPath) {
                                zipPath = current.replace(new RegExp(`^${rootFolderPath}/?`), '');
                            }
                            allFiles.push({
                                name: item.name,
                                fullPath: itemPath,
                                zipPath: zipPath
                            });
                        }
                    }
                }
            } catch (err) {
                console.error(`Failed to list files in ${current}:`, err);
            }
        }
        return allFiles;
    };

    const handleDownloadFolder = async (item, e) => {
        e.stopPropagation();
        const folderPhysicalName = item.physicalName || item.name;
        const folderPath = item.path || (currentPath ? `${currentPath}/${folderPhysicalName}` : folderPhysicalName);
        
        if (downloadingFolders[folderPath]) return;
        
        setDownloadingFolders(prev => ({ ...prev, [folderPath]: true }));
        try {
            const files = await fetchFolderFilesRecursively(folderPath);
            if (files.length === 0) {
                alert('Dieser Ordner enthält keine Dateien zum Herunterladen.');
                return;
            }
            
            const zip = new JSZip();
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                try {
                    const res = await api.get(`/projects/${projectId}/files/download`, {
                        params: { path: file.fullPath },
                        responseType: 'blob'
                    });
                    
                    const zipFilePath = file.zipPath ? `${file.zipPath}/${file.name}` : file.name;
                    zip.file(zipFilePath, res.data);
                } catch (fileErr) {
                    console.error(`Failed to download file ${file.fullPath} for zip:`, fileErr);
                }
            }
            
            const content = await zip.generateAsync({ type: 'blob' });
            const blobUrl = window.URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = blobUrl;
            
            const zipName = `${item.name.replace(/[\/\\?%*:|"<>\s]/g, '_')}.zip`;
            a.download = zipName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Failed to download folder as zip:', err);
            alert('Fehler beim Herunterladen des Ordners als ZIP.');
        } finally {
            setDownloadingFolders(prev => {
                const copy = { ...prev };
                delete copy[folderPath];
                return copy;
            });
        }
    };

    const handleOpenPermissions = (item, e) => {
        e.stopPropagation();
        setSelectedFolderForPermissions({
            name: item.name,
            parentPath: currentPath,
            permissions: item.permissions
        });
        setIsPermissionsModalOpen(true);
    };

    return (
        <div className="glass-card rounded-2xl p-6 animate-[fadeIn_0.3s_ease-out]">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 custom-scrollbar">
                    <button
                        onClick={() => setCurrentPath('')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${currentPath === '' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
                    >
                        <i className="fa-solid fa-home mr-2"></i> Stammordner
                    </button>
                    {currentPath && currentPath.split('/').map((part, index, arr) => {
                        const pathSoFar = arr.slice(0, index + 1).join('/');
                        const isLast = index === arr.length - 1;
                        let displayPart = part;
                        if (index === 0 && part === 'stages') displayPart = 'Etappen';
                        if (index === 0 && part === 'gallery') displayPart = 'Galerie';
                        if (index === 1 && arr[0] === 'stages') {
                            const stageIndex = project.stages?.findIndex(s => String(s.id) === part);
                            if (stageIndex !== -1) displayPart = `Etappe ${stageIndex + 1}`;
                        }

                        return (
                            <React.Fragment key={pathSoFar}>
                                <i className="fa-solid fa-chevron-right text-gray-600 text-xs"></i>
                                <button
                                    onClick={() => setCurrentPath(pathSoFar)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${isLast ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
                                >
                                    {displayPart}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>

                <div className="flex items-center gap-3">
                    {/* View mode toggle */}
                    <div className="flex bg-white/5 rounded-xl border border-white/10 p-0.5 relative z-40">
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg text-xs transition-colors flex items-center justify-center ${viewMode === 'grid' ? 'bg-blue-500 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                            title="Kachelansicht"
                        >
                            <i className="fa-solid fa-grip-vertical"></i>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg text-xs transition-colors flex items-center justify-center ${viewMode === 'list' ? 'bg-blue-500 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                            title="Listenansicht"
                        >
                            <i className="fa-solid fa-list"></i>
                        </button>
                    </div>

                    {!isStagesDir && (
                        <>
                            {canCreateFolder && (
                                <button
                                    onClick={handleCreateFolder}
                                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <i className="fa-solid fa-folder-plus text-blue-400"></i> Neuer Ordner
                                </button>
                            )}

                            {canUploadFiles && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl border border-blue-500/50 text-sm font-medium transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)] flex items-center gap-2"
                                >
                                    <i className="fa-solid fa-cloud-arrow-up"></i> Hochladen
                                </button>
                            )}
                            <input
                                type="file"
                                multiple
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </>
                    )}
                </div>
            </div>

            {/* File Container */}
            <div className="bg-black/20 border border-white/5 rounded-xl min-h-[400px] p-4 flex flex-col">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <i className="fa-solid fa-circle-notch fa-spin text-3xl mb-3 text-blue-400"></i>
                        <p>Lade Verzeichnis...</p>
                    </div>
                ) : items.length === 0 && !currentPath ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <i className="fa-regular fa-folder-open text-5xl mb-4 opacity-30"></i>
                        <p>Dieser Ordner ist leer.</p>
                        <p className="text-xs mt-2 text-gray-600">Laden Sie Dateien hoch oder erstellen Sie einen Ordner.</p>
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="flex flex-col divide-y divide-white/5 bg-white/[0.01] rounded-xl border border-white/5">
                        {/* Go Up Directory Item in List View */}
                        {currentPath && (
                            <div
                                onClick={navigateUp}
                                className="group hover:bg-white/5 px-4 py-3 flex items-center gap-3.5 cursor-pointer transition-colors"
                            >
                                <div className="w-8 h-8 flex items-center justify-center rounded bg-white/5 text-gray-400 group-hover:text-white border border-white/5 transition-colors">
                                    <i className="fa-solid fa-reply text-sm"></i>
                                </div>
                                <span className="text-sm font-medium text-gray-400 group-hover:text-white">.. (Zurück)</span>
                            </div>
                        )}

                        {items.map((item, idx) => {
                            const displayName = getDisplayName(item, currentPath);
                            const isSpecialFolder = currentPath === '' && (item.physicalName === 'stages' || item.name === 'stages');

                            // RBAC check:
                            let canDelete = false;
                            if (isSubcontractor) {
                                if (user?.isPartner) {
                                    canDelete = item.created_by_client_id === user.id;
                                } else {
                                    canDelete = item.created_by_subcontractor_id === user.id;
                                }
                            } else if (isManagement) {
                                canDelete = !isSpecialFolder && !isStagesDir;
                            } else {
                                // Worker: Can delete files if they are the owner, but NEVER folders.
                                canDelete = !item.isDirectory && item.created_by_id === user.id;
                            }

                            // Icon logic for list view (no network images!)
                            let fileIcon = <i className="fa-solid fa-file-lines text-lg text-gray-400"></i>;
                            if (item.isDirectory) {
                                fileIcon = <i className="fa-solid fa-folder text-lg text-blue-400"></i>;
                            } else if (isImage(item.name)) {
                                fileIcon = <i className="fa-solid fa-file-image text-lg text-emerald-400"></i>;
                            } else if (item.name.match(/\.(mp4|webm|mov|avi|mkv|wmv|flv|m4v|3gp)$/i)) {
                                fileIcon = <i className="fa-solid fa-file-video text-lg text-blue-400"></i>;
                            }

                            return (
                                <div
                                    key={idx}
                                    className="group hover:bg-white/5 px-4 py-3.5 flex items-center justify-between gap-4 transition-colors relative"
                                >
                                    <div
                                        onClick={() => {
                                            if (item.isDirectory) {
                                                navigateTo(item);
                                            } else {
                                                const isVid = item.name.match(/\.(mp4|webm|mov|avi|mkv|wmv|flv|m4v|3gp)$/i);
                                                if (isVid || isImage(item.name)) {
                                                    openGallery(items, idx);
                                                } else {
                                                    window.open(getImageUrl(item.url), '_blank');
                                                }
                                            }
                                        }}
                                        className="flex-1 min-w-0 flex items-center gap-3.5 cursor-pointer"
                                    >
                                        <div className="w-8 h-8 flex items-center justify-center shrink-0 rounded bg-white/5 border border-white/5 group-hover:border-blue-500/30 transition-colors">
                                            {fileIcon}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-semibold text-gray-200 truncate group-hover:text-white" title={`${displayName}${item.creator_name ? ` (Erstellt von ${item.creator_name})` : ''}`}>
                                                {displayName}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-500 mt-0.5">
                                                <span>{!item.isDirectory ? formatSize(item.size) : 'Ordner'}</span>
                                                {item.creator_name && (
                                                    <span className={item.created_by_subcontractor_id ? 'text-amber-500/70 font-semibold' : (item.created_by_client_id ? 'text-purple-500/70 font-semibold' : 'text-gray-500')}>
                                                        • von {item.creator_name} {item.created_by_subcontractor_id && <i className="fa-solid fa-helmet-safety text-amber-500/70 text-[9px]"></i>} {item.created_by_client_id && <i className="fa-solid fa-handshake text-purple-500/70 text-[9px]"></i>}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                        {/* Permission button for folder */}
                                        {item.isDirectory && !isStagesDir && canManagePermissions && (
                                            <button
                                                onClick={(e) => handleOpenPermissions(item, e)}
                                                className="w-8 h-8 rounded-lg bg-blue-500/10 hover:bg-blue-500 border border-blue-500/20 text-blue-400 hover:text-white flex items-center justify-center text-xs transition-all shadow-md"
                                                title="Berechtigungen"
                                            >
                                                <i className="fa-solid fa-shield-halved"></i>
                                            </button>
                                        )}

                                        {/* Download button */}
                                        {item.isDirectory ? (
                                            !isSpecialFolder && (
                                                <button
                                                    onClick={(e) => handleDownloadFolder(item, e)}
                                                    disabled={downloadingFolders[item.path || (currentPath ? `${currentPath}/${item.physicalName || item.name}` : (item.physicalName || item.name))]}
                                                    className="w-8 h-8 bg-blue-500/10 hover:bg-blue-500 disabled:bg-blue-500/50 text-blue-400 hover:text-white border border-blue-500/20 rounded-lg flex items-center justify-center text-xs transition-all shadow-md"
                                                    title="Ordner als ZIP herunterladen"
                                                >
                                                    {downloadingFolders[item.path || (currentPath ? `${currentPath}/${item.physicalName || item.name}` : (item.physicalName || item.name))] ? (
                                                        <i className="fa-solid fa-circle-notch fa-spin"></i>
                                                    ) : (
                                                        <i className="fa-solid fa-download"></i>
                                                    )}
                                                </button>
                                            )
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDownload(item, e); }}
                                                className="w-8 h-8 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/20 rounded-lg flex items-center justify-center text-xs transition-all shadow-md"
                                                title="Herunterladen"
                                            >
                                                <i className="fa-solid fa-download"></i>
                                            </button>
                                        )}

                                        {/* Delete button */}
                                        {canDelete && canDeleteItems && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                                                className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500 border border-red-500/20 text-red-400 hover:text-white flex items-center justify-center text-xs transition-all shadow-md"
                                                title="Löschen"
                                            >
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {/* Go Up Directory Item */}
                        {currentPath && (
                            <div
                                onClick={navigateUp}
                                className="group bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all aspect-square"
                            >
                                <i className="fa-solid fa-reply text-3xl text-gray-400 group-hover:text-white transition-colors mb-3"></i>
                                <span className="text-sm font-medium text-gray-400 group-hover:text-white">Zurück</span>
                            </div>
                        )}

                        {items.map((item, idx) => {
                            const displayName = getDisplayName(item, currentPath);
                            const isSpecialFolder = currentPath === '' && (item.physicalName === 'stages' || item.name === 'stages');

                            // RBAC check:
                            let canDelete = false;
                            if (isSubcontractor) {
                                if (user?.isPartner) {
                                    canDelete = item.created_by_client_id === user.id;
                                } else {
                                    canDelete = item.created_by_subcontractor_id === user.id;
                                }
                            } else if (isManagement) {
                                canDelete = !isSpecialFolder && !isStagesDir;
                            } else {
                                // Worker: Can delete files if they are the owner, but NEVER folders.
                                canDelete = !item.isDirectory && item.created_by_id === user.id;
                            }

                            return (
                                <div key={idx} className="group relative bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-white/10 rounded-xl p-3 flex flex-col items-center justify-between transition-all aspect-square text-center">
                                    {/* Delete Button - Appears on Hover */}
                                    {canDelete && canDeleteItems && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                                            className="absolute top-2 right-2 w-6 h-6 rounded-md bg-red-500/80 text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 z-10 shadow-lg"
                                            title="Löschen"
                                        >
                                            <i className="fa-solid fa-trash"></i>
                                        </button>
                                    )}

                                    {/* Permission/Share Button - For Folders */}
                                    {item.isDirectory && !isStagesDir && canManagePermissions && (
                                        <button
                                            onClick={(e) => handleOpenPermissions(item, e)}
                                            className="absolute top-2 left-2 w-6 h-6 rounded-md bg-blue-500/80 text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-500 z-10 shadow-lg"
                                            title="Berechtigungen & Teilen"
                                        >
                                            <i className="fa-solid fa-shield-halved"></i>
                                        </button>
                                    )}

                                    {item.isDirectory ? (
                                        <>
                                            <div
                                                onClick={() => navigateTo(item)}
                                                className="flex-1 w-full flex flex-col items-center justify-center cursor-pointer"
                                            >
                                                <i className="fa-solid fa-folder text-5xl text-blue-400 mb-3 drop-shadow-md"></i>
                                                <span className="text-sm font-medium text-gray-200 truncate w-full px-2" title={`${displayName}${item.creator_name ? ` (Erstellt von ${item.creator_name})` : ''}`}>{displayName}</span>
                                                {item.creator_name && (
                                                    <span className={`text-[10px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 ${item.created_by_subcontractor_id ? 'text-amber-400 font-bold' : (item.created_by_client_id ? 'text-purple-400 font-bold' : 'text-gray-500')}`}>
                                                        von {item.creator_name} {item.created_by_subcontractor_id && <i className="fa-solid fa-helmet-safety text-amber-400 text-[10px]"></i>} {item.created_by_client_id && <i className="fa-solid fa-handshake text-purple-400 text-[10px]"></i>}
                                                    </span>
                                                )}
                                            </div>
                                            {!isSpecialFolder && (
                                                <button
                                                    onClick={(e) => handleDownloadFolder(item, e)}
                                                    disabled={downloadingFolders[item.path || (currentPath ? `${currentPath}/${item.physicalName || item.name}` : (item.physicalName || item.name))]}
                                                    className="absolute bottom-2 right-2 w-7 h-7 bg-blue-500/80 hover:bg-blue-500 disabled:bg-blue-500/50 text-white rounded-md flex items-center justify-center text-[12px] opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                    title="Ordner als ZIP herunterladen"
                                                >
                                                    {downloadingFolders[item.path || (currentPath ? `${currentPath}/${item.physicalName || item.name}` : (item.physicalName || item.name))] ? (
                                                        <i className="fa-solid fa-circle-notch fa-spin"></i>
                                                    ) : (
                                                        <i className="fa-solid fa-download"></i>
                                                    )}
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <div
                                            className="flex-1 w-full flex flex-col items-center justify-center relative group/file"
                                        >
                                            {isImage(item.name) ? (
                                                <div
                                                    onClick={() => openGallery(items, idx)}
                                                    className="w-20 h-20 mb-3 rounded-lg overflow-hidden border border-white/10 shadow-inner group-hover:border-blue-500/50 transition-colors cursor-pointer"
                                                >
                                                    <img crossOrigin="anonymous" src={getImageUrl(item.url)} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                                                </div>
                                            ) : (
                                                <i
                                                    onClick={() => {
                                                        const isVid = item.name.match(/\.(mp4|webm|mov|avi|mkv|wmv|flv|m4v|3gp)$/i);
                                                        if (isVid) openGallery(items, idx);
                                                        else window.open(getImageUrl(item.url), '_blank');
                                                    }}
                                                    className="fa-solid fa-file-lines text-5xl text-gray-400 mb-3 cursor-pointer hover:text-blue-400 transition-colors"
                                                ></i>
                                            )}
                                            <span className="text-xs font-medium text-gray-300 truncate w-full px-2" title={`${displayName}${item.creator_name ? ` (Hochgeladen von ${item.creator_name})` : ''}`}>{displayName}</span>
                                            <div className="flex flex-col items-center mt-1">
                                                <span className="text-[10px] text-gray-500">{formatSize(item.size)}</span>
                                                {item.creator_name && (
                                                    <span className={`text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 ${item.created_by_subcontractor_id ? 'text-amber-400 font-bold' : (item.created_by_client_id ? 'text-purple-400 font-bold' : 'text-gray-500')}`}>
                                                        von {item.creator_name} {item.created_by_subcontractor_id && <i className="fa-solid fa-helmet-safety text-amber-400 text-[10px]"></i>} {item.created_by_client_id && <i className="fa-solid fa-handshake text-purple-400 text-[10px]"></i>}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Download Button */}
                                            <button
                                                onClick={(e) => handleDownload(item, e)}
                                                className="absolute bottom-1 right-1 w-7 h-7 bg-blue-500/80 hover:bg-blue-500 text-white rounded-md flex items-center justify-center text-[12px] opacity-0 group-hover/file:opacity-100 transition-opacity shadow-lg"
                                                title="Herunterladen"
                                            >
                                                <i className="fa-solid fa-download"></i>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            {/* Media Gallery Viewer */}
            <MediaViewer
                isOpen={isGalleryOpen}
                onClose={() => setIsGalleryOpen(false)}
                items={galleryItems}
                initialIndex={galleryIndex}
                showThumbnails={viewMode !== 'list'}
            />
            {/* Folder Permissions Modal */}
            {selectedFolderForPermissions && (
                <FolderPermissionsModal
                    isOpen={isPermissionsModalOpen}
                    onClose={() => setIsPermissionsModalOpen(false)}
                    folder={selectedFolderForPermissions}
                    projectId={projectId}
                    onUpdate={() => fetchFiles(currentPath)}
                />
            )}
            {/* Global Upload Panel */}
            <AnimatePresence>
                {isUploadPanelOpen && (
                    <UploadPanel
                        queue={uploadQueue}
                        isMinimized={isUploadPanelMinimized}
                        onToggleMinimize={() => setIsUploadPanelMinimized(!isUploadPanelMinimized)}
                        onClose={() => {
                            setIsUploadPanelOpen(false);
                            setUploadQueue([]);
                        }}
                        onClearCompleted={() => setUploadQueue(prev => prev.filter(u => u.status === 'uploading'))}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

const UploadPanel = ({ queue, isMinimized, onToggleMinimize, onClose, onClearCompleted }) => {
    const uploadingCount = queue.filter(u => u.status === 'uploading').length;
    const completedCount = queue.filter(u => u.status === 'completed').length;
    const errorCount = queue.filter(u => u.status === 'error').length;

    const getFileIcon = (name) => {
        const ext = name.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'heic', 'heif', 'tiff', 'bmp', 'jfif', 'avif', 'ico', 'dng'].includes(ext)) return <ImageIcon className="w-4 h-4 text-emerald-400" />;
        if (['mp4', 'mov', 'avi', 'webm', 'ogg', 'mkv', 'wmv', 'flv', 'm4v', '3gp'].includes(ext)) return <FileVideo className="w-4 h-4 text-blue-400" />;
        if (['mp3', 'wav', 'ogg'].includes(ext)) return <FileAudio className="w-4 h-4 text-purple-400" />;
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <FileArchive className="w-4 h-4 text-orange-400" />;
        if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return <FileText className="w-4 h-4 text-red-400" />;
        return <File className="w-4 h-4 text-gray-400" />;
    };

    return (
        <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className={`fixed bottom-8 right-8 w-80 bg-[#151518] border border-white/10 rounded-2xl shadow-2xl z-[150] overflow-hidden backdrop-blur-xl flex flex-col transition-all duration-300 ${isMinimized ? 'h-14' : 'h-[400px]'}`}
        >
            {/* Header */}
            <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {uploadingCount > 0 ? (
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                    <span className="text-sm font-bold text-white">
                        {uploadingCount > 0 ? `Lädt ${uploadingCount} Datei${uploadingCount > 1 ? 'en' : ''} hoch` : 'Uploads abgeschlossen'}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={onToggleMinimize} className="p-1 text-white/40 hover:text-white transition-colors">
                        {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={onClose} className="p-1 text-white/40 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Body */}
            {!isMinimized && (
                <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                        {queue.map((item) => (
                            <div key={item.id} className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {getFileIcon(item.fileName)}
                                        <span className="text-xs text-white font-medium truncate" title={item.fileName}>
                                            {item.fileName}
                                        </span>
                                    </div>
                                    <div className="shrink-0">
                                        {item.status === 'uploading' && (
                                            <span className="text-[10px] font-mono text-blue-400">{item.progress}%</span>
                                        )}
                                        {item.status === 'completed' && (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        )}
                                        {item.status === 'error' && (
                                            <AlertCircle className="w-4 h-4 text-red-500" title={item.error} />
                                        )}
                                    </div>
                                </div>
                                {item.status === 'uploading' && (
                                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${item.progress}%` }}
                                            className="h-full bg-blue-500"
                                        />
                                    </div>
                                )}
                                {item.status === 'error' && (
                                    <p className="text-[9px] text-red-400 truncate">{item.error}</p>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    {(completedCount > 0 || errorCount > 0) && (
                        <div className="p-3 bg-white/5 border-t border-white/10 flex justify-center">
                            <button
                                onClick={onClearCompleted}
                                className="text-[10px] font-bold text-white/40 hover:text-white uppercase tracking-widest transition-colors"
                            >
                                Liste leeren
                            </button>
                        </div>
                    )}
                </>
            )}
        </motion.div>
    );
};

export default ProjectFileManager;
