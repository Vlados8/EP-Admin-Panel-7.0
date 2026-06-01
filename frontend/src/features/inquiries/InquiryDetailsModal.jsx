import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const InquiryDetailsModal = ({ inquiry, isOpen, onClose, onProjectCreate, onInquiryUpdated, onInquiryDeleted }) => {
    const navigate = useNavigate();
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        contact_name: inquiry?.contact_name || '',
        contact_email: inquiry?.contact_email || '',
        contact_phone: inquiry?.contact_phone || '',
        location: inquiry?.location || '',
        notes: inquiry?.notes || '',
        category_id: inquiry?.category_id || '',
        subcategory_id: inquiry?.subcategory_id || ''
    });
    const [categories, setCategories] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        let isCancelled = false;
        
        if (isOpen && inquiry?.id) {
            setFormData({
                contact_name: inquiry?.contact_name || '',
                contact_email: inquiry?.contact_email || '',
                contact_phone: inquiry?.contact_phone || '',
                location: inquiry?.location || '',
                notes: inquiry?.notes || '',
                category_id: inquiry?.category_id || '',
                subcategory_id: inquiry?.subcategory_id || ''
            });
            fetchCategories();

            // Only fetch if it's actually unread to prevent loops
            if (!inquiry.is_read) {
                api.get(`/inquiries/${inquiry.id}`).then(res => {
                    if (isCancelled) return;
                    const updatedInquiry = res.data.data.inquiry;
                    if (onInquiryUpdated) {
                        onInquiryUpdated(updatedInquiry);
                    }
                }).catch(err => {
                    console.error('Error marking inquiry as read:', err);
                });
            }
        }

        return () => {
            isCancelled = true;
        };
    }, [isOpen, inquiry?.id, onInquiryUpdated, inquiry?.is_read]);

    const fetchCategories = async () => {
        try {
            const res = await api.get('/categories');
            setCategories(res.data.data.categories || []);
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    if (!isOpen || !inquiry) return null;

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await api.put(`/inquiries/${inquiry.id}`, formData);
            setIsEditing(false);
            onInquiryUpdated(res.data.data.inquiry);
        } catch (error) {
            console.error('Error updating inquiry:', error);
            alert('Fehler beim Speichern der Anfrage.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (window.confirm('Möchten Sie diese Anfrage wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
            setIsDeleting(true);
            try {
                await api.delete(`/inquiries/${inquiry.id}`);
                onInquiryDeleted(inquiry.id);
                onClose();
            } catch (error) {
                console.error('Error deleting inquiry:', error);
                alert('Fehler beim Löschen der Anfrage.');
            } finally {
                setIsDeleting(false);
            }
        }
    };

    const handleCreateProject = () => {
        onProjectCreate(inquiry);
    };

    const handleCreateOffer = async () => {
        try {
            // Automatically change status to 'proposal' (Angebot) when starting the offer creation
            await api.patch(`/inquiries/${inquiry.id}`, { status: 'proposal' });
        } catch (error) {
            console.error('Error auto-updating status to proposal:', error);
        }
        navigate('/angebote/neu', { state: { inquiry } });
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col my-auto max-h-none md:max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center flex-wrap gap-3">
                            {inquiry.title}
                            <span className="text-sm font-normal px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1.5">
                                {inquiry.category?.name || 'Keine Kategorie'}
                                {inquiry.category?.target && (
                                    <span className="text-[10px] opacity-75 bg-black/30 px-1.5 py-0.5 rounded font-medium border border-white/5">
                                        {inquiry.category.target === 'both' ? 'Beide' : inquiry.category.target === 'site' ? 'Website' : 'Admin'}
                                    </span>
                                )}
                            </span>
                            {inquiry.project && (
                                <button
                                    onClick={() => navigate(`/projekte/${inquiry.project.id}`)}
                                    className="text-sm font-normal px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/40 transition-all flex items-center gap-1.5"
                                    title="Zum Projekt springen"
                                >
                                    <i className="fa-solid fa-link text-[10px]"></i>
                                    Projekt ID: {inquiry.project.project_number}
                                </button>
                            )}
                        </h2>
                        <p className="text-gray-400 mt-1 text-sm">
                            Eingegangen am {new Date(inquiry.createdAt).toLocaleString('de-DE')}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleCreateProject}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                            title="Ein neues aktives Projekt aus этой Anfrage erstellen"
                        >
                            <i className="fa-solid fa-folder-plus"></i>
                            Projekt erstellen
                        </button>
                        <button
                            onClick={handleCreateOffer}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                            title="Ein Angebot basierend auf этой Anfrage erstellen"
                        >
                            <i className="fa-solid fa-file-invoice"></i>
                            Angebot erstellen
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                            <i className="fa-solid fa-xmark text-xl"></i>
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col md:flex-row gap-6">

                    {/* Left Column: Contact Info */}
                    <div className="w-full md:w-1/3 flex flex-col gap-4">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <i className="fa-regular fa-address-card text-blue-400"></i>
                                    Kontaktdaten
                                </h3>
                                <button
                                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                                    className={`text-sm ${isEditing ? 'text-emerald-400 hover:text-emerald-300' : 'text-blue-400 hover:text-blue-300'} transition-colors`}
                                    disabled={isSaving}
                                >
                                    {isSaving ? <i className="fa-solid fa-spinner fa-spin"></i> : (isEditing ? 'Speichern' : 'Bearbeiten')}
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Name</label>
                                    {isEditing ? (
                                        <input type="text" name="contact_name" value={formData.contact_name} onChange={handleChange} className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-blue-500" />
                                    ) : (
                                        <div className="text-white bg-black/10 p-2 rounded-lg">{inquiry.contact_name || '-'}</div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">E-Mail</label>
                                    {isEditing ? (
                                        <input type="email" name="contact_email" value={formData.contact_email} onChange={handleChange} className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-blue-500" />
                                    ) : (
                                        <div className="text-white bg-black/10 p-2 rounded-lg">{inquiry.contact_email || '-'}</div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Telefon</label>
                                    {isEditing ? (
                                        <input type="text" name="contact_phone" value={formData.contact_phone} onChange={handleChange} className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-blue-500" />
                                    ) : (
                                        <div className="text-white bg-black/10 p-2 rounded-lg">{inquiry.contact_phone || '-'}</div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Standort / Adresse</label>
                                    {isEditing ? (
                                        <input type="text" name="location" value={formData.location} onChange={handleChange} className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-blue-500" />
                                    ) : (
                                        <div className="text-white bg-black/10 p-2 rounded-lg break-words">{inquiry.location || '-'}</div>
                                    )}
                                </div>
                                <div className="pt-2 border-t border-white/5 space-y-3">
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Website Quelle</label>
                                        <div className="text-blue-400 bg-blue-500/5 p-2 rounded-lg text-sm flex items-center gap-2">
                                            <i className="fa-solid fa-globe text-xs"></i>
                                            {inquiry.source_website || 'Direkt/Unbekannt'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Absender IP</label>
                                        <div className="text-gray-400 bg-black/10 p-2 rounded-lg text-xs font-mono">
                                            {inquiry.source_ip || 'Nicht erfasst'}
                                        </div>
                                    </div>
                                </div>

                                {isEditing && (
                                    <>
                                        <div>
                                            <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Kategorie</label>
                                            <select
                                                name="category_id"
                                                value={formData.category_id}
                                                onChange={(e) => setFormData({ ...formData, category_id: e.target.value, subcategory_id: '' })}
                                                className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-blue-500"
                                            >
                                                <option value="">-- Keine --</option>
                                                {categories.map(c => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name} ({c.target === 'both' ? 'Beide' : c.target === 'site' ? 'Website' : 'Admin-Panel'})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Unterkategorie</label>
                                            <select
                                                name="subcategory_id"
                                                value={formData.subcategory_id}
                                                onChange={handleChange}
                                                className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white focus:outline-none focus:border-blue-500"
                                                disabled={!formData.category_id}
                                            >
                                                <option value="">-- Keine --</option>
                                                {categories.find(c => String(c.id) === String(formData.category_id))?.subcategories?.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex-1">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                                <i className="fa-regular fa-note-sticky text-yellow-400"></i>
                                Interne Notizen
                            </h3>
                            {isEditing ? (
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleChange}
                                    className="w-full h-32 bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 resize-none custom-scrollbar"
                                    placeholder="Notizen zur Anfrage..."
                                />
                            ) : (
                                <div className="text-white bg-black/10 p-3 rounded-lg min-h-[8rem] whitespace-pre-wrap">
                                    {inquiry.notes || <span className="text-gray-500 italic">Keine Notizen vorhanden.</span>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Answers / Requirements */}
                    <div className="w-full md:w-2/3 bg-white/5 border border-white/10 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
                            <i className="fa-solid fa-list-check text-purple-400"></i>
                            Anforderungen & Antworten
                        </h3>

                        {/* Category Path Header */}
                        {inquiry.category && (
                            <div className="mb-6 pb-4 border-b border-white/10 flex items-center justify-between">
                                <span className="text-gray-400 text-sm uppercase tracking-widest font-semibold flex items-center gap-2">
                                    <i className="fa-solid fa-sitemap text-blue-400"></i>
                                    {inquiry.category.name} {inquiry.subcategory?.name ? `> ${inquiry.subcategory.name}` : ''}
                                </span>
                            </div>
                        )}

                        {(!inquiry.answers || inquiry.answers.length === 0) ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                    <i className="fa-solid fa-folder-open text-2xl text-gray-500"></i>
                                </div>
                                <p className="text-gray-400">Keine spezifischen Antworten hinterlegt.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {inquiry.answers.map((ans, idx) => (
                                    <div key={ans.id || idx} className="bg-black/40 border border-white/5 rounded-xl p-4 transition-all hover:bg-black/60 shadow-lg">
                                        <div className="text-xs text-blue-400/70 mb-1 font-semibold uppercase tracking-tight truncate">{ans.question?.question_text || 'Unbekannte Frage'}</div>
                                        <div className="text-white font-medium text-base leading-tight">
                                            {ans.answer_value || <span className="text-gray-600 italic">Keine Antwort</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 flex justify-between items-center bg-black/20 shrink-0">
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2"
                    >
                        {isDeleting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-regular fa-trash-can"></i>}
                        Anfrage löschen
                    </button>
                    {!isEditing && (
                        <button onClick={onClose} className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">
                            Schließen
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};

export default InquiryDetailsModal;
