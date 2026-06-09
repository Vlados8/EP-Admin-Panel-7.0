import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

const PortalSettings = () => {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form inputs for a new contact
    const [newLabel, setNewLabel] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newEmail, setNewEmail] = useState('');

    // Editing state
    const [editingId, setEditingId] = useState(null);
    const [editingLabel, setEditingLabel] = useState('');
    const [editingPhone, setEditingPhone] = useState('');
    const [editingEmail, setEditingEmail] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.get('/company');
            if (res.data?.status === 'success') {
                const settings = res.data.data.settings || {};
                const dashboardContacts = settings.subcontractorDashboardContacts || [];
                setContacts(dashboardContacts);
            }
        } catch (err) {
            console.error('Failed to fetch portal settings:', err);
            toast.error('Fehler beim Laden der Portal-Einstellungen');
        } finally {
            setLoading(false);
        }
    };

    const handleAddContact = (e) => {
        e.preventDefault();
        if (!newLabel.trim() || !newPhone.trim()) {
            toast.error('Bitte geben Sie Name/Rolle und Telefonnummer an.');
            return;
        }

        const newContact = {
            id: Math.random().toString(36).substring(7),
            label: newLabel.trim(),
            phone: newPhone.trim(),
            email: newEmail.trim()
        };

        setContacts(prev => [...prev, newContact]);
        setNewLabel('');
        setNewPhone('');
        setNewEmail('');
        toast.success('Kontakt zur Liste hinzugefügt');
    };

    const handleDeleteContact = (id) => {
        setContacts(prev => prev.filter(c => c.id !== id));
        toast.success('Kontakt entfernt');
    };

    const startEditing = (contact) => {
        setEditingId(contact.id);
        setEditingLabel(contact.label);
        setEditingPhone(contact.phone);
        setEditingEmail(contact.email || '');
    };

    const handleSaveEdit = (id) => {
        if (!editingLabel.trim() || !editingPhone.trim()) {
            toast.error('Name/Rolle und Telefonnummer dürfen nicht leer sein.');
            return;
        }

        setContacts(prev => prev.map(c => 
            c.id === id 
                ? { ...c, label: editingLabel.trim(), phone: editingPhone.trim(), email: editingEmail.trim() }
                : c
        ));
        setEditingId(null);
        toast.success('Kontakt aktualisiert');
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            // Get current settings first to preserve other fields
            const currentRes = await api.get('/company');
            const currentSettings = currentRes.data?.data?.settings || {};

            const updatedSettings = {
                ...currentSettings,
                subcontractorDashboardContacts: contacts
            };

            const res = await api.patch('/company/settings', { settings: updatedSettings });
            if (res.data?.status === 'success') {
                toast.success('Portal-Einstellungen erfolgreich gespeichert');
            }
        } catch (err) {
            console.error('Failed to save portal settings:', err);
            toast.error('Fehler beim Speichern der Einstellungen');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="animate-[fadeIn_0.4s_ease-out_forwards] p-6 max-w-4xl mx-auto space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 text-blue-400">
                        <i className="fa-solid fa-user-gear"></i>
                    </div>
                    Partner- & Subunternehmer-Portal Einstellungen
                </h2>
                <p className="text-gray-400 text-sm mt-2">
                    Verwalten Sie hier die Kontaktdaten, die auf der Startseite (Dashboard) für Ihre externen Partner und Subunternehmer angezeigt werden.
                </p>
            </div>

            {loading ? (
                <div className="glass-card rounded-2xl border border-white/10 p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3 bg-white/5">
                    <i className="fa-solid fa-circle-notch animate-spin text-2xl text-blue-500"></i>
                    <span>Einstellungen werden geladen...</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Add Contact Form */}
                    <div className="md:col-span-1 space-y-6">
                        <div className="glass-card p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <i className="fa-solid fa-plus text-blue-400 text-sm"></i>
                                Kontakt hinzufügen
                            </h3>
                            <form onSubmit={handleAddContact} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Name / Rolle</label>
                                    <input 
                                        type="text" 
                                        value={newLabel}
                                        onChange={(e) => setNewLabel(e.target.value)}
                                        placeholder="z.B. Elektrikermeister, Büro"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Telefonnummer</label>
                                    <input 
                                        type="text" 
                                        value={newPhone}
                                        onChange={(e) => setNewPhone(e.target.value)}
                                        placeholder="z.B. +49 170 1234567"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">E-Mail (Optional)</label>
                                    <input 
                                        type="email" 
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        placeholder="z.B. support@firma.de"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                                >
                                    <i className="fa-solid fa-plus"></i> Hinzufügen
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Contacts List */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="glass-card p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md flex flex-col justify-between min-h-[300px]">
                            <div>
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <i className="fa-solid fa-address-book text-blue-400 text-sm"></i>
                                    Aktive Portal-Kontakte
                                </h3>

                                {contacts.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500 italic">
                                        <i className="fa-solid fa-address-card text-4xl mb-3 opacity-30"></i>
                                        <p>Keine Kontakte hinterlegt. Externe Benutzer sehen standardmäßig die allgemeinen Firmendaten.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {contacts.map((contact) => (
                                            <div 
                                                key={contact.id}
                                                className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex items-center justify-between gap-4 group hover:bg-white/[0.04] transition-all"
                                            >
                                                {editingId === contact.id ? (
                                                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                        <input 
                                                            type="text" 
                                                            value={editingLabel} 
                                                            onChange={(e) => setEditingLabel(e.target.value)}
                                                            placeholder="Name / Rolle"
                                                            className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white"
                                                        />
                                                        <input 
                                                            type="text" 
                                                            value={editingPhone} 
                                                            onChange={(e) => setEditingPhone(e.target.value)}
                                                            placeholder="Telefon"
                                                            className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white"
                                                        />
                                                        <input 
                                                            type="email" 
                                                            value={editingEmail} 
                                                            onChange={(e) => setEditingEmail(e.target.value)}
                                                            placeholder="E-Mail"
                                                            className="bg-black/60 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white col-span-1"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="flex items-start gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                                                            <i className="fa-solid fa-user-shield"></i>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-bold text-white">{contact.label}</h4>
                                                            <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-0.5 mt-1">
                                                                <span className="text-xs text-gray-400 flex items-center gap-1.5">
                                                                    <i className="fa-solid fa-phone text-[10px] text-gray-500"></i> {contact.phone}
                                                                </span>
                                                                {contact.email && (
                                                                    <span className="text-xs text-gray-400 flex items-center gap-1.5">
                                                                        <i className="fa-solid fa-envelope text-[10px] text-gray-500"></i> {contact.email}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-2">
                                                    {editingId === contact.id ? (
                                                        <>
                                                            <button 
                                                                onClick={() => handleSaveEdit(contact.id)}
                                                                className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors"
                                                                title="Speichern"
                                                            >
                                                                <i className="fa-solid fa-check text-xs"></i>
                                                            </button>
                                                            <button 
                                                                onClick={() => setEditingId(null)}
                                                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors border border-white/10"
                                                                title="Abbrechen"
                                                            >
                                                                <i className="fa-solid fa-xmark text-xs"></i>
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button 
                                                                onClick={() => startEditing(contact)}
                                                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors border border-white/10 opacity-0 group-hover:opacity-100"
                                                                title="Bearbeiten"
                                                            >
                                                                <i className="fa-solid fa-pen text-xs"></i>
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteContact(contact.id)}
                                                                className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-colors border border-red-500/20 opacity-0 group-hover:opacity-100"
                                                                title="Löschen"
                                                            >
                                                                <i className="fa-solid fa-trash text-xs"></i>
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 pt-4 border-t border-white/5 flex justify-end">
                                <button
                                    onClick={handleSaveSettings}
                                    disabled={saving}
                                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                                >
                                    {saving ? (
                                        <>
                                            <i className="fa-solid fa-circle-notch animate-spin"></i> Speichert...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-floppy-disk"></i> Einstellungen speichern
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PortalSettings;
