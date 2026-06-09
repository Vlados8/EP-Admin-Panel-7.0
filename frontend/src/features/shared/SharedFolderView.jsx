import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import JSZip from 'jszip';
import MediaViewer from '../../components/common/MediaViewer';
import { 
    File, 
    Folder, 
    Download, 
    ChevronRight, 
    ArrowLeft, 
    Globe, 
    ShieldCheck, 
    HardDrive,
    FileText,
    Image as ImageIcon,
    Loader2
} from 'lucide-react';
import { getImageUrl } from '../../utils/config';

const SharedFolderView = () => {
    const { token } = useParams();
    const [contentData, setContentData] = useState(null);
    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [companyInfo, setCompanyInfo] = useState(null);
    const [downloadingAll, setDownloadingAll] = useState(false);
    const [downloadingFolders, setDownloadingFolders] = useState({});
    
    // Gallery State
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryItems, setGalleryItems] = useState([]);
    const [galleryIndex, setGalleryIndex] = useState(0);

    const fetchCompanyInfo = async () => {
        try {
            const res = await api.get('/company/public');
            if (res.data?.status === 'success') {
                setCompanyInfo(res.data.data);
            }
        } catch (err) {
            console.error('Error fetching company info:', err);
        }
    };

    const fetchSharedContent = async () => {
        setLoading(true);
        try {
            // First try the new File Manager sharing endpoint
            const res = await api.get(`/public/assets/${token}`, {
                params: { folder_id: currentFolderId }
            });
            
            if (res.data?.status === 'success') {
                setContentData(res.data.data);
                // If it's a folder and we just started, set initial breadcrumb
                if (res.data.data.type === 'folder' && breadcrumbs.length === 0) {
                    setBreadcrumbs([{ id: null, name: res.data.data.folderName }]);
                }
            }
        } catch (err) {
            // Fallback to legacy project sharing if 404
            console.log('Main sharing failed, trying legacy...');
            try {
                const legacyRes = await api.get(`/public/shared-folder/${token}`);
                if (legacyRes.data?.status === 'success') {
                    // Adapt legacy data to new internal format if needed, 
                    // but for now let's just use it as is if we can.
                    // Actually, let's keep it simple: if it's legacy, wrap it.
                    setContentData({
                        type: 'folder',
                        isLegacy: true,
                        ...legacyRes.data.data
                    });
                } else {
                    throw new Error('Not found');
                }
            } catch (legacyErr) {
                setError('Inhalt nicht gefunden или Zugriff abgelaufen.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCompanyInfo();
    }, []);

    useEffect(() => {
        fetchSharedContent();
    }, [token, currentFolderId]);

    const triggerDownload = async (url, filename) => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Fetch download failed, falling back to window.open', err);
            window.open(url, '_blank');
        }
    };

    const handleDownload = async (file) => {
        const url = file.url || file.file_url;
        if (url) {
            await triggerDownload(url, file.name);
        }
    };

    const handleDownloadAll = async () => {
        if (!contentData?.items || downloadingAll) return;
        setDownloadingAll(true);
        try {
            const filesOnly = contentData.items.filter(i => !i.isDirectory);
            if (filesOnly.length === 0) return;

            const zip = new JSZip();
            
            for (let i = 0; i < filesOnly.length; i++) {
                const file = filesOnly[i];
                const url = file.url || file.file_url;
                if (url) {
                    try {
                        const response = await fetch(url);
                        if (!response.ok) throw new Error(`Failed to fetch ${file.name}`);
                        const blob = await response.blob();
                        zip.file(file.name, blob);
                    } catch (err) {
                        console.error(`Failed to add ${file.name} to zip:`, err);
                    }
                }
            }

            const content = await zip.generateAsync({ type: 'blob' });
            const blobUrl = window.URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = blobUrl;
            
            // Name the zip archive after the project title or folder name
            const folderName = contentData.folderName || (contentData.project && contentData.project.title) || 'Dateien';
            const zipName = `${folderName.replace(/[\/\\?%*:|"<>\s]/g, '_')}.zip`;
            
            a.download = zipName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Failed to generate zip archive:', err);
        } finally {
            setDownloadingAll(false);
        }
    };

    const fetchSharedFolderFilesRecursively = async (rootFolderId, isLegacy, rootPath) => {
        let allFiles = [];
        
        if (isLegacy) {
            const queue = [rootPath];
            while (queue.length > 0) {
                const current = queue.shift();
                const res = await api.get(`/public/shared-folder/${token}`, {
                    params: { path: current }
                });
                if (res.data?.status === 'success') {
                    const itemsList = res.data.data.items;
                    for (const item of itemsList) {
                        const itemPath = current ? `${current}/${item.name}` : item.name;
                        if (item.isDirectory) {
                            queue.push(itemPath);
                        } else {
                            let zipPath = '';
                            if (current !== rootPath) {
                                zipPath = current.replace(new RegExp(`^${rootPath}/?`), '');
                            }
                            allFiles.push({
                                name: item.name,
                                url: item.url || item.file_url,
                                zipPath: zipPath
                            });
                        }
                    }
                }
            }
        } else {
            const queue = [{ id: rootFolderId, path: '' }];
            while (queue.length > 0) {
                const current = queue.shift();
                const res = await api.get(`/public/assets/${token}`, {
                    params: { folder_id: current.id }
                });
                if (res.data?.status === 'success') {
                    const itemsList = res.data.data.items;
                    for (const item of itemsList) {
                        if (item.isDirectory) {
                            const subPath = current.path ? `${current.path}/${item.name}` : item.name;
                            queue.push({ id: item.id, path: subPath });
                        } else {
                            allFiles.push({
                                name: item.name,
                                url: item.url || item.file_url,
                                zipPath: current.path
                            });
                        }
                    }
                }
            }
        }
        return allFiles;
    };

    const handleDownloadFolder = async (folderItem, e) => {
        e.stopPropagation();
        const folderId = folderItem.id;
        const isLegacy = contentData?.isLegacy;
        const legacyPath = folderItem.path || (contentData?.currentPath ? `${contentData.currentPath}/${folderItem.name}` : folderItem.name);
        
        const folderKey = isLegacy ? legacyPath : folderId;
        if (downloadingFolders[folderKey]) return;

        setDownloadingFolders(prev => ({ ...prev, [folderKey]: true }));
        try {
            const files = await fetchSharedFolderFilesRecursively(folderId, isLegacy, legacyPath);
            if (files.length === 0) {
                alert('Dieser Ordner enthält keine Dateien.');
                return;
            }

            const zip = new JSZip();

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const url = file.url;
                if (url) {
                    try {
                        const response = await fetch(url);
                        if (!response.ok) throw new Error(`Failed to fetch ${file.name}`);
                        const blob = await response.blob();
                        const zipFilePath = file.zipPath ? `${file.zipPath}/${file.name}` : file.name;
                        zip.file(zipFilePath, blob);
                    } catch (err) {
                        console.error(`Failed to add ${file.name} to zip:`, err);
                    }
                }
            }

            const content = await zip.generateAsync({ type: 'blob' });
            const blobUrl = window.URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = blobUrl;
            
            const zipName = `${folderItem.name.replace(/[\/\\?%*:|"<>\s]/g, '_')}.zip`;
            a.download = zipName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Failed to download folder as zip:', err);
            alert('Fehler beim Herunterladen des Ordners.');
        } finally {
            setDownloadingFolders(prev => {
                const copy = { ...prev };
                delete copy[folderKey];
                return copy;
            });
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

    const openGallery = (item) => {
        if (contentData.type !== 'folder') return;
        
        const filesOnly = contentData.items.filter(i => !i.isDirectory);
        const mappedItems = filesOnly.map(file => ({
            file_url: file.url || file.file_url,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.mime_type
        }));
        
        const index = filesOnly.findIndex(f => f.id === item.id || f.name === item.name);
        setGalleryItems(mappedItems);
        setGalleryIndex(index >= 0 ? index : 0);
        setIsGalleryOpen(true);
    };

    const formatSize = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    if (loading && !contentData) {
        return (
            <div className="min-h-screen bg-[#0f111a] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-gray-400 animate-pulse font-medium tracking-widest uppercase text-xs">Sichere Verbindung wird hergestellt...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#0f111a] flex items-center justify-center p-6">
                <div className="bg-white/5 border border-white/10 rounded-3xl max-w-md w-full p-10 text-center shadow-2xl backdrop-blur-xl">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
                        <X className="text-4xl text-red-500 w-10 h-10" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-3">Zugriff verweigert</h1>
                    <p className="text-gray-400 mb-10 leading-relaxed">{error}</p>
                    <a href="/" className="inline-flex items-center gap-3 bg-white/5 hover:bg-white/10 text-white px-8 py-3 rounded-2xl transition-all font-bold border border-white/10">
                        <ArrowLeft className="w-4 h-4" />
                        Zurück zur Startseite
                    </a>
                </div>
            </div>
        );
    }

    // Single File View
    if (contentData?.type === 'file') {
        const file = contentData.file;
        return (
            <div className="min-h-screen bg-[#0b0c14] py-20 px-6 flex items-center justify-center">
                <div className="max-w-xl w-full">
                    <BrandingHeader companyInfo={companyInfo} />
                    <div className="bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 rounded-3xl p-10 shadow-2xl backdrop-blur-3xl text-center relative overflow-hidden group">
                        <div className="absolute -top-24 -right-24 w-60 h-60 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none" />
                        
                        <div className="mb-8 flex justify-center">
                            <div className="p-8 bg-blue-500/10 rounded-3xl border border-white/5 relative group-hover:scale-110 transition-transform duration-500">
                                {file.mime_type?.startsWith('image/') ? <ImageIcon className="w-20 h-20 text-emerald-400" /> : <FileText className="w-20 h-20 text-blue-400" />}
                            </div>
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-2 break-words">{file.name}</h2>
                        <p className="text-white/40 font-mono text-sm mb-10 uppercase tracking-widest">{formatSize(file.size)} • {file.mime_type}</p>

                        <button 
                            onClick={() => handleDownload(file)}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-5 rounded-2xl shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                        >
                            <Download className="w-6 h-6" />
                            Datei Herunterladen
                        </button>
                    </div>
                    <BrandingFooter companyInfo={companyInfo} />
                </div>
            </div>
        );
    }

    // Folder View
    return (
        <div className="min-h-screen bg-[#0b0c14] py-12 px-6">
            <div className="max-w-5xl mx-auto">
                <BrandingHeader 
                    title={contentData?.isLegacy ? contentData?.project?.title : contentData?.folderName} 
                    subtitle={contentData?.isLegacy ? contentData?.project?.address : "Geteilte Inhalte"}
                    companyInfo={companyInfo}
                />

                {/* Premium Project & Client Details Card */}
                {contentData?.project && (
                    <div className="mb-8 bg-[#0f1322]/70 backdrop-blur-md rounded-2xl border border-white/10 p-6 shadow-2xl relative overflow-hidden animate-[fadeIn_0.4s_ease-out]">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent blur-2xl pointer-events-none rounded-full" />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Column 1: Client & Subclient Info */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em] mb-2 flex items-center gap-1.5">
                                    <i className="fa-solid fa-user-tie text-purple-400"></i> Kundeninformationen
                                </h3>
                                
                                <div className="space-y-2">
                                    <p className="text-sm text-gray-400 flex items-center gap-2">
                                        <span className="text-white/60 font-semibold min-w-[100px]">Hauptkunde:</span>
                                        <span className="text-white font-bold">{contentData.project.clientName}</span>
                                    </p>
                                    
                                    {/* Subclient / Underclient detailed fields */}
                                    {(contentData.project.subClientFirstName || contentData.project.subClientLastName) && (
                                        <p className="text-sm text-gray-400 flex items-center gap-2">
                                            <span className="text-white/60 font-semibold min-w-[100px]">Sub-Kunde:</span>
                                            <span className="text-white font-bold">
                                                {contentData.project.subClientFirstName || ''} {contentData.project.subClientLastName || ''}
                                            </span>
                                        </p>
                                    )}

                                    {/* Subclient Address */}
                                    {contentData.project.subClientAddress && (
                                        <p className="text-sm text-gray-400 flex items-center gap-2">
                                            <span className="text-white/60 font-semibold min-w-[100px]">Anschrift:</span>
                                            <span className="text-gray-300 font-medium">{contentData.project.subClientAddress}</span>
                                        </p>
                                    )}

                                    {/* Subclient Contacts */}
                                    {(contentData.project.subClientPhone || contentData.project.subClientEmail) && (
                                        <div className="pl-[108px] space-y-1">
                                            {contentData.project.subClientPhone && (
                                                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                                                    <i className="fa-solid fa-phone text-purple-400/60 text-[10px]"></i>
                                                    <span className="font-mono">{contentData.project.subClientPhone}</span>
                                                </p>
                                            )}
                                            {contentData.project.subClientEmail && (
                                                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                                                    <i className="fa-solid fa-envelope text-purple-400/60 text-[10px]"></i>
                                                    <span className="font-mono">{contentData.project.subClientEmail}</span>
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* Column 2: Project Scheduled Durations */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em] mb-2 flex items-center gap-1.5">
                                    <i className="fa-solid fa-calendar-days text-blue-400"></i> Projekt-Zeitplan
                                </h3>
                                
                                <div className="space-y-2">
                                    {/* Start & End Date Badge */}
                                    <div className="text-sm text-gray-400 flex items-center gap-2">
                                        <span className="text-white/60 font-semibold min-w-[100px]">Zeitraum:</span>
                                        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-lg text-xs font-mono font-bold shadow-[0_0_12px_rgba(59,130,246,0.15)] flex items-center gap-1.5">
                                            <i className="fa-regular fa-calendar"></i>
                                            {(() => {
                                                const fmt = (dStr) => {
                                                    if (!dStr) return '';
                                                    const clean = dStr.includes('T') ? dStr.split('T')[0] : dStr;
                                                    const [y, m, d] = clean.split('-');
                                                    return `${d}.${m}.${y}`;
                                                };
                                                const s = fmt(contentData.project.startDate);
                                                const e = fmt(contentData.project.endDate);
                                                if (!s && !e) return 'Laufendes Projekt';
                                                if (s && !e) return `Ab ${s}`;
                                                if (!s && e) return `Bis ${e}`;
                                                return `${s} - ${e}`;
                                            })()}
                                        </span>
                                    </div>

                                    {/* Location details */}
                                    <div className="text-sm text-gray-400 flex items-center gap-2">
                                        <span className="text-white/60 font-semibold min-w-[100px]">Bauort:</span>
                                        <span className="text-gray-300 font-medium flex items-center gap-1.5">
                                            <i className="fa-solid fa-location-dot text-red-400 text-xs"></i>
                                            {contentData.project.address}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Project Description Section */}
                        {contentData.project.description && (
                            <div className="mt-6 pt-5 border-t border-white/5 space-y-2">
                                <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em] flex items-center gap-1.5">
                                    <i className="fa-solid fa-circle-info text-blue-400"></i> Projektbeschreibung
                                </h3>
                                <p className="text-sm text-gray-300 font-medium leading-relaxed whitespace-pre-line">
                                    {contentData.project.description}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Breadcrumbs */}
                {!contentData?.isLegacy && (
                    <div className="flex items-center gap-2 mb-8 px-2 overflow-x-auto no-scrollbar">
                        {breadcrumbs.map((crumb, idx) => (
                            <React.Fragment key={idx}>
                                <button 
                                    onClick={() => navigateToBreadcrumb(idx)}
                                    className={`hover:text-white transition-colors whitespace-nowrap text-sm ${idx === breadcrumbs.length - 1 ? 'text-white font-black' : 'text-white/40 underline decoration-white/10'}`}
                                >
                                    {crumb.name}
                                </button>
                                {idx < breadcrumbs.length - 1 && <ChevronRight className="w-4 h-4 text-white/10" />}
                            </React.Fragment>
                        ))}
                    </div>
                )}

                {/* File List */}
                <div className="bg-white/[0.02] border border-white/10 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
                    <div className="p-6 border-b border-white/5 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] whitespace-nowrap">Dateien & Ordner</h2>
                            <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                Live-Zugriff
                            </div>
                        </div>
                        
                        {contentData?.items && contentData.items.filter(i => !i.isDirectory).length > 0 && (
                            <button
                                onClick={handleDownloadAll}
                                disabled={downloadingAll}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-lg active:scale-[0.98] self-end sm:self-auto ${downloadingAll ? 'bg-blue-600/50 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/10'}`}
                            >
                                {downloadingAll ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Dateien werden heruntergeladen...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-3.5 h-3.5" />
                                        Alle Dateien herunterladen ({contentData.items.filter(i => !i.isDirectory).length})
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    <div className="divide-y divide-white/[0.03]">
                        {!contentData?.items || contentData.items.length === 0 ? (
                            <div className="p-20 text-center text-white/10">
                                <Folder className="w-16 h-16 mx-auto mb-4 opacity-5" />
                                <p className="italic font-medium">Dieser Ordner ist leer</p>
                            </div>
                        ) : (
                            contentData.items.map((item, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={item.isDirectory ? () => navigateToFolder(item) : () => openGallery(item)}
                                    className="p-5 hover:bg-white/[0.03] transition-all flex items-center justify-between gap-4 group cursor-pointer"
                                >
                                    <div className="flex items-center gap-5 flex-1 min-w-0">
                                        <div className={`w-12 h-12 rounded-xl border border-white/5 flex items-center justify-center transition-all ${item.isDirectory ? 'bg-blue-500/10 text-blue-500' : 'bg-white/5 text-white/40 group-hover:bg-blue-500/10 group-hover:text-blue-400'}`}>
                                            {item.isDirectory ? <Folder className="w-6 h-6 fill-current opacity-20" /> : <File className="w-6 h-6" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-bold truncate group-hover:text-blue-100 transition-colors">
                                                {item.name}
                                            </p>
                                            <div className="flex items-center gap-3 mt-1">
                                                {item.isDirectory ? (
                                                    <span className="text-[10px] text-blue-500/50 font-black uppercase tracking-widest">Ordner</span>
                                                ) : (
                                                    <span className="text-[10px] text-white/20 font-black uppercase tracking-widest">{formatSize(item.size)}</span>
                                                )}
                                                <span className="w-1 h-1 bg-white/10 rounded-full" />
                                                <span className="text-[10px] text-white/20 italic">{new Date(item.createdAt).toLocaleDateString('de-DE')}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                        {item.isDirectory ? (
                                            <>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDownloadFolder(item, e); }}
                                                    disabled={downloadingFolders[isLegacy ? (item.path || (contentData?.currentPath ? `${contentData.currentPath}/${item.name}` : item.name)) : item.id]}
                                                    className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center disabled:opacity-50"
                                                    title="Ordner als ZIP herunterladen"
                                                >
                                                    {downloadingFolders[isLegacy ? (item.path || (contentData?.currentPath ? `${contentData.currentPath}/${item.name}` : item.name)) : item.id] ? (
                                                        <Loader2 className="w-4.5 h-4.5 animate-spin text-white" />
                                                    ) : (
                                                        <Download className="w-4 h-4" />
                                                    )}
                                                </button>
                                                <ChevronRight className="w-5 h-5 text-white/10 group-hover:text-white transition-colors" />
                                            </>
                                        ) : (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                                                className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                
                <BrandingFooter companyInfo={companyInfo} />
            </div>

            <MediaViewer 
                isOpen={isGalleryOpen}
                onClose={() => setIsGalleryOpen(false)}
                items={galleryItems}
                initialIndex={galleryIndex}
            />
        </div>
    );
};

const BrandingHeader = ({ title, subtitle, companyInfo }) => {
    const settings = companyInfo?.settings || {};
    const logoUpperText = settings.logoUpperText || 'EMPIRE';
    const logoLowerText = settings.logoLowerText || 'PREMIUM';
    const firmName = settings.firmName || companyInfo?.name || 'EMPIRE PREMIUM';

    // Prefer Logo Small White or Logo Large White for dark theme of shared view, fallback to standard small logo or dynamic text
    const logoUrl = settings.logoSmallWhite || settings.logoLargeWhite || settings.logoSmall || settings.logoLarge;

    return (
        <div className="mb-12 text-center md:text-left flex flex-col md:flex-row justify-between items-center md:items-end gap-6">
            <div>
                <div className="flex items-center gap-4 mb-4 justify-center md:justify-start">
                    {logoUrl ? (
                        <div className="flex items-center gap-3.5">
                            <img 
                                src={getImageUrl(logoUrl)} 
                                alt={firmName} 
                                className="h-10 object-contain max-w-[120px]" 
                            />
                            <div className="h-6 w-[1px] bg-white/20 hidden sm:block"></div>
                            <span className="text-white font-black text-xl italic tracking-tighter uppercase">
                                {logoUpperText} <span className="text-blue-500 font-extrabold">{logoLowerText}</span>
                            </span>
                        </div>
                    ) : (
                        <>
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                                <span className="text-white font-black text-xs">
                                    {logoUpperText.substring(0, 2).toUpperCase()}
                                </span>
                            </div>
                            <span className="text-white font-black text-xl italic tracking-tighter uppercase">
                                {logoUpperText} <span className="text-blue-500 font-extrabold">{logoLowerText}</span>
                            </span>
                        </>
                    )}
                </div>
                {title && (
                    <>
                        <h1 className="text-3xl md:text-5xl font-black text-white italic uppercase tracking-tighter mb-2">{title}</h1>
                        <p className="text-white/40 font-medium tracking-widest text-[10px] uppercase flex items-center justify-center md:justify-start gap-2">
                            <Globe className="w-3 h-3 text-blue-500" /> {subtitle || 'Externer Zugriff'}
                        </p>
                    </>
                )}
            </div>
            <div className="hidden md:block">
                <div className="bg-white/5 border border-white/10 px-6 py-4 rounded-2xl backdrop-blur-xl">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Sicherheitsstatus</p>
                    <div className="flex items-center gap-2 text-blue-400">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">End-to-End Verschlüsselt</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const BrandingFooter = ({ companyInfo }) => {
    const settings = companyInfo?.settings || {};
    const firmName = settings.firmName || companyInfo?.name || 'EMPIRE PREMIUM BAU';
    const email = settings.email;
    const phone = settings.phone;
    const address = settings.address;
    const zipCity = settings.zipCity;
    const website = settings.website;

    return (
        <div className="mt-20 pt-10 border-t border-white/5 flex flex-col gap-8 opacity-60 hover:opacity-100 transition-opacity duration-700">
            {/* Top row of footer with address & contacts if available */}
            {(address || email || phone || website) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-white/50 border-b border-white/5 pb-8">
                    {address && (
                        <div>
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1.5">Firmensitz</p>
                            <p className="font-semibold text-gray-300">{firmName}</p>
                            <p className="mt-0.5">{address}</p>
                            <p>{zipCity}</p>
                        </div>
                    )}
                    {(phone || email) && (
                        <div>
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1.5">Kontakt</p>
                            {phone && <p className="flex items-center gap-1.5"><i className="fa-solid fa-phone text-gray-500 text-[10px]"></i> {phone}</p>}
                            {email && (
                                <a href={`mailto:${email}`} className="flex items-center gap-1.5 hover:text-blue-400 transition-colors mt-0.5">
                                    <i className="fa-solid fa-envelope text-gray-500 text-[10px]"></i> {email}
                                </a>
                            )}
                        </div>
                    )}
                    {website && (
                        <div>
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-1.5">Online</p>
                            <a 
                                href={website.startsWith('http') ? website : `https://${website}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex items-center gap-1.5 hover:text-blue-400 transition-colors"
                            >
                                <Globe className="w-3.5 h-3.5 text-blue-500" /> {website}
                            </a>
                        </div>
                    )}
                </div>
            )}

            {/* Bottom copyright row */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 text-blue-500" />
                    </div>
                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Sichere Übertragung via Empire Premium Cloud</p>
                </div>
                <p className="text-[9px] text-white/20 font-mono">© {new Date().getFullYear()} {firmName.toUpperCase()} • ALL RIGHTS RESERVED</p>
            </div>
        </div>
    );
};

export default SharedFolderView;
