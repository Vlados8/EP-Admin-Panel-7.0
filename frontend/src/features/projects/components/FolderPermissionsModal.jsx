import React, { useState, useEffect } from 'react';
import api from '../../../services/api';

const FolderPermissionsModal = ({ isOpen, onClose, folder, projectId, onUpdate }) => {
    const [roles, setRoles] = useState([]);
    const [selectedRoleIds, setSelectedRoleIds] = useState([]);
    const [isPublic, setIsPublic] = useState(false);
    const [shareToken, setShareToken] = useState('');
    const [visibleToSubcontractors, setVisibleToSubcontractors] = useState(true);
    const [visibleToPartners, setVisibleToPartners] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchRoles();
            if (folder.permissions) {
                const allowedRoles = Array.isArray(folder.permissions.allowed_role_ids)
                    ? folder.permissions.allowed_role_ids
                    : (folder.permissions.allowed_role_ids ? JSON.parse(folder.permissions.allowed_role_ids) : []);
                setSelectedRoleIds(allowedRoles);
                setIsPublic(folder.permissions.is_public || false);
                setShareToken(folder.permissions.share_token || '');
                setVisibleToSubcontractors(folder.permissions.visible_to_subcontractors !== false);
                setVisibleToPartners(folder.permissions.visible_to_partners || false);
            } else {
                setSelectedRoleIds([]);
                setIsPublic(false);
                setShareToken('');
                setVisibleToSubcontractors(true);
                setVisibleToPartners(false);
            }
        }
    }, [isOpen, folder]);

    const fetchRoles = async () => {
        try {
            const res = await api.get('/roles');
            if (res.data?.status === 'success' && res.data.data?.roles) {
                // Filter out Admin and Büro roles as they have implicit access
                const filteredRoles = res.data.data.roles.filter(
                    role => !['Admin', 'Büro'].includes(role.name)
                );
                setRoles(filteredRoles);
            } else {
                setRoles([]);
            }
        } catch (err) {
            console.error('Error fetching roles:', err);
            setRoles([]);
        }
    };

    const handleSavePermissions = async () => {
        setLoading(true);
        try {
            await api.patch(`/projects/${projectId}/files/permissions`, {
                path: folder.parentPath || '',
                name: folder.name,
                allowed_role_ids: selectedRoleIds,
                visible_to_subcontractors: visibleToSubcontractors,
                visible_to_partners: visibleToPartners
            });
            onUpdate();
            onClose();
        } catch (err) {
            alert('Fehler beim Speichern der Berechtigungen');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleShare = async () => {
        setLoading(true);
        try {
            const res = await api.post(`/projects/${projectId}/files/toggle-share`, {
                path: folder.parentPath || '',
                name: folder.name
            });
            setIsPublic(res.data.is_public);
            setShareToken(res.data.share_token);
            onUpdate();
        } catch (err) {
            alert('Fehler beim Teilen');
        } finally {
            setLoading(false);
        }
    };

    const toggleRoleId = (roleId) => {
        setSelectedRoleIds(prev => 
            prev.includes(roleId) 
                ? prev.filter(id => id !== roleId)
                : [...prev, roleId]
        );
    };

    const copySharedLink = () => {
        const url = `${window.location.origin}/shared/${shareToken}`;
        navigator.clipboard.writeText(url);
        alert('Link kopiert!');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-[#1a1c2e] border border-white/10 rounded-2xl w-full max-w-md relative overflow-hidden shadow-2xl animate-[fadeIn_0.2s_ease-out]">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <i className="fa-solid fa-shield-halved text-blue-400"></i>
                        Ordner-Berechtigungen
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <i className="fa-solid fa-xmark text-xl"></i>
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Role Selection */}
                    <div>
                        <label className="text-gray-400 text-sm font-medium mb-3 block italic">Wer darf diesen Ordner sehen?</label>
                        <div className="space-y-2">
                            {Array.isArray(roles) && roles.map(role => (
                                <label 
                                    key={role.id} 
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${selectedRoleIds.includes(role.id) ? 'bg-blue-500/20 border-blue-500/50 text-white' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
                                >
                                    <span className="font-medium">{role.name}</span>
                                    <input 
                                        type="checkbox" 
                                        className="hidden" 
                                        checked={selectedRoleIds.includes(role.id)}
                                        onChange={() => toggleRoleId(role.id)}
                                    />
                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${selectedRoleIds.includes(role.id) ? 'bg-blue-500 border-blue-500' : 'border-white/20'}`}>
                                        {selectedRoleIds.includes(role.id) && <i className="fa-solid fa-check text-[10px] text-white"></i>}
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-white/5"></div>

                    {/* Subcontractor Visibility */}
                    <div>
                        <label className="text-gray-400 text-sm font-medium mb-3 block italic">Sichtbarkeit für Subunternehmer</label>
                        <label 
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${visibleToSubcontractors ? 'bg-amber-500/15 border-amber-500/50 text-white' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
                        >
                            <span className="font-bold flex items-center gap-2">
                                <i className="fa-solid fa-helmet-safety text-amber-400"></i>
                                Subunternehmer erlauben
                            </span>
                            <input 
                                type="checkbox" 
                                className="hidden" 
                                checked={visibleToSubcontractors}
                                onChange={() => setVisibleToSubcontractors(!visibleToSubcontractors)}
                            />
                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${visibleToSubcontractors ? 'bg-amber-500 border-amber-500' : 'border-white/20'}`}>
                                {visibleToSubcontractors && <i className="fa-solid fa-check text-[10px] text-white"></i>}
                            </div>
                        </label>
                    </div>

                    <div className="h-px bg-white/5"></div>

                    {/* Partner Visibility */}
                    <div>
                        <label className="text-gray-400 text-sm font-medium mb-3 block italic">Sichtbarkeit für Partner</label>
                        <label 
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${visibleToPartners ? 'bg-purple-500/15 border-purple-500/50 text-white' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
                        >
                            <span className="font-bold flex items-center gap-2">
                                <i className="fa-solid fa-handshake text-purple-400"></i>
                                Partner erlauben
                            </span>
                            <input 
                                type="checkbox" 
                                className="hidden" 
                                checked={visibleToPartners}
                                onChange={() => setVisibleToPartners(!visibleToPartners)}
                            />
                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${visibleToPartners ? 'bg-purple-500 border-purple-500' : 'border-white/20'}`}>
                                {visibleToPartners && <i className="fa-solid fa-check text-[10px] text-white"></i>}
                            </div>
                        </label>
                    </div>

                    <div className="h-px bg-white/5"></div>

                    {/* Public Sharing */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white font-medium mb-1">Inhaber eines Links</p>
                                <p className="text-gray-400 text-xs">Jeder mit diesem Link kann die Dateien sehen.</p>
                            </div>
                            <button 
                                onClick={handleToggleShare}
                                disabled={loading}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isPublic ? 'bg-blue-600' : 'bg-gray-700'}`}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isPublic ? 'translate-x-5' : 'translate-x-0'}`}></span>
                            </button>
                        </div>

                        {isPublic && (
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-center justify-between gap-3 animate-[fadeIn_0.3s_ease-out]">
                                <span className="text-blue-400 text-xs truncate flex-1">
                                    {window.location.origin}/shared/{shareToken}
                                </span>
                                <button 
                                    onClick={copySharedLink}
                                    className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
                                    title="Link kopieren"
                                >
                                    <i className="fa-solid fa-copy"></i>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 bg-white/2 border-t border-white/5 flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-all"
                    >
                        Abbrechen
                    </button>
                    <button 
                        onClick={handleSavePermissions}
                        disabled={loading}
                        className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
                    >
                        {loading && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                        Speichern
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FolderPermissionsModal;
