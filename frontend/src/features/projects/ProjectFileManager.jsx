import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import api from '../../services/api';
import MediaViewer from '../../components/common/MediaViewer';
import FolderPermissionsModal from './components/FolderPermissionsModal';
import { getImageUrl } from '../../utils/config';

const ProjectFileManager = ({ project }) => {
    const projectId = project.id;
    const [currentPath, setCurrentPath] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Auth & Permissions
    const { user } = useSelector(state => state.auth);
    const userRole = user?.role?.name || user?.role; // Fallback for safety
    const isManagement = ['Admin', 'Büro', 'Projektleiter', 'Gruppenleiter'].includes(userRole);
    
    // Workers can create, but not delete, folders. They can only delete their own files.
    // Management can do everything.
    const canManagePermissions = isManagement;
    const canManageFiles = true; // All roles can upload/create folders now

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
                content_type: isImage(item.name) ? 'image/jpeg' : (item.name.match(/\.(mp4|webm|mov)$/i) ? 'video/mp4' : 'application/octet-stream')
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
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('path', currentPath);
        files.forEach(file => {
            formData.append('files', file);
        });

        try {
            const res = await api.post(`/projects/${projectId}/files/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data?.status === 'success') {
                fetchFiles();
            }
        } catch (error) {
            console.error('Error uploading files:', error);
            alert(error.response?.data?.error || 'Fehler beim Hochladen der Dateien');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (itemName, isDirectory, physicalName) => {
        const confirmMsg = isDirectory
            ? `Möchten Sie den Ordner "${itemName}" und alle darin enthaltenen Dateien wirklich löschen?`
            : `Möchten Sie die Datei "${itemName}" действительно löschen?`;

        if (!window.confirm(confirmMsg)) return;

        const effectiveName = physicalName || itemName;
        const itemPath = currentPath ? `${currentPath}/${effectiveName}` : effectiveName;

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
        return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filename);
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
        const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;
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
                    {!isStagesDir && canManageFiles && (
                        <>
                            <button
                                onClick={handleCreateFolder}
                                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                            >
                                <i className="fa-solid fa-folder-plus text-blue-400"></i> Neuer Ordner
                            </button>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl border border-blue-500/50 text-sm font-medium transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)] flex items-center gap-2"
                            >
                                {isUploading ? (
                                    <><i className="fa-solid fa-circle-notch fa-spin"></i> Lädt...</>
                                ) : (
                                    <><i className="fa-solid fa-cloud-arrow-up"></i> Hochladen</>
                                )}
                            </button>
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
                            if (isManagement) {
                                canDelete = !isSpecialFolder && !isStagesDir;
                            } else {
                                // Worker: Can delete files if they are the owner, but NEVER folders.
                                canDelete = !item.isDirectory && item.created_by_id === user.id;
                            }

                            return (
                                <div key={idx} className="group relative bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-white/10 rounded-xl p-3 flex flex-col items-center justify-between transition-all aspect-square text-center">
                                    {/* Delete Button - Appears on Hover */}
                                    {canDelete && canManageFiles && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(item.name, item.isDirectory, item.physicalName); }}
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
                                        <div
                                            onClick={() => navigateTo(item)}
                                            className="flex-1 w-full flex flex-col items-center justify-center cursor-pointer"
                                        >
                                            <i className="fa-solid fa-folder text-5xl text-blue-400 mb-3 drop-shadow-md"></i>
                                            <span className="text-sm font-medium text-gray-200 truncate w-full px-2" title={`${displayName}${item.creator_name ? ` (Erstellt von ${item.creator_name})` : ''}`}>{displayName}</span>
                                            {item.creator_name && <span className="text-[10px] text-gray-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">von {item.creator_name}</span>}
                                        </div>
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
                                                        const isVid = item.name.match(/\.(mp4|webm|mov)$/i);
                                                        if (isVid) openGallery(items, idx);
                                                        else window.open(getImageUrl(item.url), '_blank');
                                                    }}
                                                    className="fa-solid fa-file-lines text-5xl text-gray-400 mb-3 cursor-pointer hover:text-blue-400 transition-colors"
                                                ></i>
                                            )}
                                            <span className="text-xs font-medium text-gray-300 truncate w-full px-2" title={`${displayName}${item.creator_name ? ` (Hochgeladen von ${item.creator_name})` : ''}`}>{displayName}</span>
                                            <div className="flex flex-col items-center mt-1">
                                                <span className="text-[10px] text-gray-500">{formatSize(item.size)}</span>
                                                {item.creator_name && <span className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">von {item.creator_name}</span>}
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
        </div>
    );
};

export default ProjectFileManager;
