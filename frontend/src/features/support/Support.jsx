import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const Support = () => {
    const [tickets, setTickets] = useState([]);
    const [selectedTicketId, setSelectedTicketId] = useState(null);
    const [ticketDetails, setTicketDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [responseMessage, setResponseMessage] = useState('');
    const [responseType, setResponseType] = useState('note');
    const [searchQuery, setSearchQuery] = useState('');
    const [showListOnMobile, setShowListOnMobile] = useState(true); // Toggle for mobile view
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTicket, setNewTicket] = useState({ subject: '', description: '', priority: 'normal', first_name: '', last_name: '', client_email: '', client_phone: '' });

    const currentUser = JSON.parse(localStorage.getItem('user'));

    useEffect(() => {
        fetchTickets();
    }, []);

    useEffect(() => {
        if (selectedTicketId) {
            fetchTicketDetails(selectedTicketId);
            setShowListOnMobile(false); // Hide list on mobile when a ticket is selected
        } else {
            setTicketDetails(null);
            setShowListOnMobile(true);
        }
    }, [selectedTicketId]);

    const fetchTickets = async () => {
        try {
            setLoading(true);
            const response = await api.get('/support');
            setTickets(response.data.data.tickets || []);
            setError(null);
        } catch (err) {
            console.error('API Error details:', err);
            setError(err.response?.data?.message || err.message || 'Fehler beim Laden der Support-Tickets');
        } finally {
            setLoading(false);
        }
    };

    const fetchTicketDetails = async (id) => {
        try {
            const response = await api.get(`/support/${id}`);
            const ticket = response.data.data.ticket;
            setTicketDetails(ticket);
            
            // Mark as read in the main list as well (local update)
            setTickets(prev => prev.map(t => t.id === id ? { ...t, is_read: true } : t));
        } catch (err) {
            console.error('Error fetching ticket details:', err);
        }
    };

    const handleStatusChange = async (newStatus) => {
        if (!ticketDetails) return;
        try {
            await api.patch(`/support/${ticketDetails.id}/status`, { status: newStatus });
            // Update local state
            setTicketDetails({ ...ticketDetails, status: newStatus });
            setTickets(tickets.map(t => t.id === ticketDetails.id ? { ...t, status: newStatus } : t));
        } catch (err) {
            console.error('Error updating status:', err);
        }
    };

    const handleAddResponse = async () => {
        if (!responseMessage.trim() || !ticketDetails || !currentUser) {
            setError('Bitte geben Sie eine Nachricht ein.');
            return;
        }

        try {
            const payload = {
                user_id: currentUser.id, // Using real current user derived from generic auth
                message: responseMessage,
                response_type: responseType
            };
            const response = await api.post(`/support/${ticketDetails.id}/responses`, payload);

            // Assuming response returns the newly created response object with user info attached via eager loading 
            // Since it might not have the attached user right away, we fetch details again
            setResponseMessage('');
            setError(null);
            fetchTicketDetails(ticketDetails.id);
        } catch (err) {
            console.error('Error adding response:', err);
            const errMsg = err.response?.data?.message || 'Fehler beim Hinzufügen der Antwort.';
            setError(errMsg);

            // Helpful hint regarding invalid users from database reset
            if (errMsg.includes('Invalid user_id')) {
                alert('Ihre Benutzersitzung ist ungültig geworden (wahrscheinlich durch Datenbank-Reset). Bitte loggen Sie sich aus und wieder ein.');
            }
        }
    };

    const handleCreateTicket = async (e) => {
        e.preventDefault();
        if (!newTicket.subject.trim() || !newTicket.description.trim()) {
            setError('Bitte füllen Sie den Betreff und die Beschreibung aus.');
            return;
        }

        try {
            const payload = {
                ...newTicket,
                client_name: newTicket.first_name || newTicket.last_name ? `${newTicket.first_name} ${newTicket.last_name}`.trim() : '',
                company_id: currentUser.company_id // associate with current admin's company
            };
            await api.post('/support', payload);

            setShowAddModal(false);
            setNewTicket({ subject: '', description: '', priority: 'normal', first_name: '', last_name: '', client_email: '', client_phone: '' });
            setError(null);
            fetchTickets();
        } catch (err) {
            console.error('Error creating ticket:', err);
            setError(err.response?.data?.message || 'Fehler beim Erstellen des Tickets.');
        }
    };

    const handleDeleteTicket = async () => {
        if (!ticketDetails) return;
        if (!window.confirm(`Möchten Sie dieses Ticket (#SUP-${String(ticketDetails.id).padStart(3, '0')}) wirklich WIRKLICH löschen?\n\nAlle zugehörigen Antworten и история будут удалены навсегда.`)) {
            return;
        }

        try {
            await api.delete(`/support/${ticketDetails.id}`);
            // Success
            setTickets(prev => prev.filter(t => t.id !== ticketDetails.id));
            setSelectedTicketId(null);
            setTicketDetails(null);
            setError(null);
            setShowListOnMobile(true);
        } catch (err) {
            console.error('Error deleting ticket:', err);
            setError(err.response?.data?.message || 'Fehler beim Löschen des Tickets.');
        }
    };

    const filteredTickets = tickets.filter(ticket => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();

        // Search by ID, Subject, Client Name, Client Email, Client Phone, Project Title
        const matchId = ticket.id.toString().includes(query);
        const matchFormattedId = `sup-${String(ticket.id).padStart(3, '0')}`.includes(query);
        const matchSubject = ticket.subject.toLowerCase().includes(query);
        const matchClientName = (ticket.client?.name || ticket.client_name) ? String(ticket.client?.name || ticket.client_name).toLowerCase().includes(query) : false;
        const matchClientEmail = (ticket.client?.email || ticket.client_email) ? String(ticket.client?.email || ticket.client_email).toLowerCase().includes(query) : false;
        const matchClientPhone = (ticket.client?.phone || ticket.client_phone) ? String(ticket.client?.phone || ticket.client_phone).toLowerCase().includes(query) : false;
        const matchProjectTitle = ticket.project?.title ? ticket.project.title.toLowerCase().includes(query) : false;

        return matchId || matchFormattedId || matchSubject || matchClientName || matchClientEmail || matchClientPhone || matchProjectTitle;
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'new': return 'border-blue-500 text-blue-500';
            case 'open': return 'border-yellow-500 text-yellow-500';
            case 'in_progress': return 'border-orange-500 text-orange-500';
            case 'resolved': return 'border-green-500 text-green-500';
            case 'closed': return 'border-gray-500 text-gray-500';
            default: return 'border-gray-500 text-gray-500';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'new': return 'Neu';
            case 'open': return 'Offen';
            case 'in_progress': return 'In Bearbeitung';
            case 'resolved': return 'Gelöst';
            case 'closed': return 'Geschlossen';
            default: return status;
        }
    };

    const getPriorityBadge = (priority) => {
        switch (priority) {
            case 'urgent': return <span className="bg-red-500/20 text-red-300 px-2 py-1 rounded text-xs border border-red-500/30">Dringend</span>;
            case 'high': return <span className="bg-orange-500/20 text-orange-300 px-2 py-1 rounded text-xs border border-orange-500/30">Hoch</span>;
            case 'normal': return <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-xs border border-blue-500/30">Normal</span>;
            case 'low': return <span className="bg-gray-500/20 text-gray-300 px-2 py-1 rounded text-xs border border-gray-500/30">Niedrig</span>;
            default: return null;
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return encodeURIComponent(dateString) === 'Invalid%20Date' ? '' : date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="animate-[fadeIn_0.4s_ease-out_forwards]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <p className="text-gray-300">Support-Tickets und Mängelmeldungen von der Website.</p>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input
                            type="text"
                            placeholder="Suchen (ID, Name, Email, Tel...)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="glass-input w-full pl-10 pr-4 py-2 rounded-xl text-sm"
                        />
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-colors flex items-center justify-center gap-2"
                    >
                        <i className="fa-solid fa-plus"></i> Neues Ticket
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-100 p-4 rounded-xl mb-6">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
                {/* Ticket List */}
                <div className={`lg:col-span-1 glass-card overflow-hidden rounded-2xl flex-col h-[600px] ${!showListOnMobile ? 'hidden lg:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                        <h4 className="font-semibold">Support Tickets</h4>
                        <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-xs">{filteredTickets.length} Gesamt</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {loading ? (
                            <p className="text-center text-sm text-gray-400 p-4">Laden...</p>
                        ) : filteredTickets.length === 0 ? (
                            <p className="text-center text-sm text-gray-400 p-4">Keine Tickets gefunden.</p>
                        ) : (
                            filteredTickets.map(ticket => (
                                <div
                                    key={ticket.id}
                                    onClick={() => setSelectedTicketId(ticket.id)}
                                    className={`p-3 rounded-xl cursor-pointer border-l-4 transition-colors ${getStatusColor(ticket.status)} ${selectedTicketId === ticket.id ? 'bg-white/10' : 'hover:bg-white/5 bg-black/20'}`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-[10px] text-gray-400">#SUP-{String(ticket.id).padStart(3, '0')}</span>
                                            {!ticket.is_read && (
                                                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.6)]"></div>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-gray-500">{new Date(ticket.createdAt).toLocaleDateString('de-DE')}</span>
                                    </div>
                                    <h5 className={`font-semibold text-sm truncate ${!ticket.is_read ? 'text-white' : 'text-gray-400'}`}>{ticket.subject}</h5>
                                    <p className="text-xs text-gray-400 truncate">
                                        {ticket.project ? `Projekt: ${ticket.project.title}` : (ticket.client?.name || ticket.client_name) ? `Kunde: ${ticket.client?.name || ticket.client_name}` : 'Unzugewiesen'}
                                    </p>
                                    {ticket.source_website && (
                                        <div className="mt-1 flex items-center gap-1">
                                            <i className="fa-solid fa-globe text-[10px] text-blue-400"></i>
                                            <span className="text-[10px] text-blue-400 truncate">{ticket.source_website}</span>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Ticket Detail */}
                <div className={`lg:col-span-2 glass-card overflow-hidden rounded-2xl flex-col h-[600px] ${showListOnMobile ? 'hidden lg:flex' : 'flex'}`}>
                    {!ticketDetails ? (
                        <div className="flex-1 flex items-center justify-center text-gray-400">
                            Bitte wählen Sie ein Ticket aus der Liste.
                        </div>
                    ) : (
                        <>
                            <div className="p-4 lg:p-6 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start gap-4">
                                <div className="w-full">
                                    <div className="flex items-center gap-3 mb-2">
                                        <button
                                            onClick={() => { setSelectedTicketId(null); setShowListOnMobile(true); }}
                                            className="lg:hidden text-gray-400 hover:text-white mr-2"
                                        >
                                            <i className="fa-solid fa-arrow-left"></i>
                                        </button>
                                        <h3 className="text-lg lg:text-xl font-bold truncate pr-2">{ticketDetails.subject}</h3>
                                        {getPriorityBadge(ticketDetails.priority)}
                                        
                                        {/* Action Button: Delete */}
                                        <button 
                                            onClick={handleDeleteTicket}
                                            className="ml-auto text-gray-500 hover:text-red-500 transition-colors p-2"
                                            title="Ticket löschen"
                                        >
                                            <i className="fa-solid fa-trash-can"></i>
                                        </button>
                                    </div>
                                    <p className="text-sm text-gray-400 mb-1 lg:pl-8 flex items-center gap-2">
                                        <span>Ticket #SUP-{String(ticketDetails.id).padStart(3, '0')} • Gemeldet von: {(ticketDetails.client?.name || ticketDetails.client_name) ? (ticketDetails.client?.name || ticketDetails.client_name) : 'Unbekannt'}</span>
                                        {ticketDetails.source_website && (
                                            <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full text-[10px] border border-blue-500/20 flex items-center gap-1">
                                                <i className="fa-solid fa-globe"></i> {ticketDetails.source_website}
                                            </span>
                                        )}
                                    </p>
                                    {((ticketDetails.client?.email || ticketDetails.client_email) || (ticketDetails.client?.phone || ticketDetails.client_phone)) && (
                                        <p className="text-xs text-gray-300 lg:pl-8 break-all">
                                            Kontakt: {(ticketDetails.client?.email || ticketDetails.client_email)} {(ticketDetails.client?.phone || ticketDetails.client_phone) ? `| ${(ticketDetails.client?.phone || ticketDetails.client_phone)}` : ''}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 w-full sm:w-auto self-start sm:self-auto ml-8 sm:ml-0 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
                                    <select
                                        className="bg-black/40 border border-white/10 rounded pr-8 pl-3 py-1 text-sm text-white appearance-none md:appearance-auto"
                                        value={ticketDetails.status}
                                        onChange={(e) => handleStatusChange(e.target.value)}
                                        style={{ minWidth: "120px" }}
                                    >
                                        <option className="bg-slate-800 text-white" value="new">Neu</option>
                                        <option className="bg-slate-800 text-white" value="open">Offen</option>
                                        <option className="bg-slate-800 text-white" value="in_progress">In Bearbeitung</option>
                                        <option className="bg-slate-800 text-white" value="resolved">Gelöst</option>
                                        <option className="bg-slate-800 text-white" value="closed">Geschlossen</option>
                                    </select>
                                    <span className={`text-xs px-2 py-1 rounded border bg-black/20 ${getStatusColor(ticketDetails.status)}`}>
                                        Status: {getStatusLabel(ticketDetails.status)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex-1 p-6 overflow-y-auto">
                                <div className="bg-white/5 border border-white/10 p-4 rounded-xl mb-6">
                                    <h5 className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Beschreibung des Problems</h5>
                                    <p className="text-sm whitespace-pre-wrap">{ticketDetails.description}</p>
                                </div>

                                <hr className="border-white/10 mb-6" />

                                <h5 className="font-semibold mb-4">Verlauf & Antworten</h5>
                                {(!ticketDetails.responses || ticketDetails.responses.length === 0) ? (
                                    <p className="text-sm text-gray-400 italic">Noch keine Antworten oder Notizen.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {ticketDetails.responses.map(res => (
                                            <div key={res.id} className="flex gap-4">
                                                <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold text-xs shrink-0">
                                                    {res.user ? res.user.name.charAt(0) : 'S'}
                                                </div>
                                                <div className={`border p-3 rounded-xl rounded-tl-none flex-1 ${res.response_type === 'note' ? 'bg-gray-500/10 border-gray-500/20' : res.response_type === 'phone' ? 'bg-green-500/10 border-green-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="text-xs text-gray-400">
                                                            {res.user ? res.user.name : 'System'}
                                                            {res.response_type === 'note' ? ' (Interne Notiz)' : res.response_type === 'phone' ? ' (Telefonprotokoll)' : ' (Email an Kunde)'}
                                                        </span>
                                                        <span className="text-xs text-gray-300">{formatDate(res.createdAt)}</span>
                                                    </div>
                                                    <p className="text-sm whitespace-pre-wrap">{res.message}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-white/10 bg-black/20">
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <select
                                        className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white sm:w-auto w-full"
                                        value={responseType}
                                        onChange={(e) => setResponseType(e.target.value)}
                                    >
                                        <option className="bg-slate-800 text-white" value="note">Notiz (Intern)</option>
                                        <option className="bg-slate-800 text-white" value="email">Email</option>
                                        <option className="bg-slate-800 text-white" value="phone">Anrufprotokoll</option>
                                    </select>
                                    <div className="flex gap-2 flex-1">
                                        <input
                                            type="text"
                                            placeholder={responseType === 'note' ? 'Interne Notiz hinzufügen...' : responseType === 'email' ? 'Email-Antwort verfassen...' : 'Zusammenfassung des Anrufs...'}
                                            className="glass-input flex-1 rounded-xl px-4 py-2 text-sm min-w-0"
                                            value={responseMessage}
                                            onChange={(e) => setResponseMessage(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddResponse()}
                                        />
                                        <button
                                            onClick={handleAddResponse}
                                            disabled={!currentUser}
                                            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white px-4 py-2 rounded-xl transition-colors shrink-0"
                                        >
                                            <i className="fa-solid fa-paper-plane"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Add Ticket Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Neues Ticket erstellen</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                                <i className="fa-solid fa-xmark text-xl"></i>
                            </button>
                        </div>

                        <form onSubmit={handleCreateTicket} className="space-y-4">
                            <h4 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-2">Kundendaten</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Vorname</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                                        value={newTicket.first_name}
                                        onChange={(e) => setNewTicket({ ...newTicket, first_name: e.target.value })}
                                        placeholder="Max"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Nachname</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                                        value={newTicket.last_name}
                                        onChange={(e) => setNewTicket({ ...newTicket, last_name: e.target.value })}
                                        placeholder="Mustermann"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Email</label>
                                    <input
                                        type="email"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                                        value={newTicket.client_email}
                                        onChange={(e) => setNewTicket({ ...newTicket, client_email: e.target.value })}
                                        placeholder="ma@beispiel.de"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Telefon</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                                        value={newTicket.client_phone}
                                        onChange={(e) => setNewTicket({ ...newTicket, client_phone: e.target.value })}
                                        placeholder="+49 123 4567"
                                    />
                                </div>
                            </div>

                            <hr className="border-white/10 my-4" />
                            <h4 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-2">Ticketdetails</h4>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Betreff *</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                                    value={newTicket.subject}
                                    onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                                    placeholder="Kurze Zusammenfassung des Problems"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Priorität</label>
                                <select
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                                    value={newTicket.priority}
                                    onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                                >
                                    <option className="bg-slate-800 text-white" value="low">Niedrig</option>
                                    <option className="bg-slate-800 text-white" value="normal">Normal</option>
                                    <option className="bg-slate-800 text-white" value="high">Hoch</option>
                                    <option className="bg-slate-800 text-white" value="urgent">Dringend</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Beschreibung *</label>
                                <textarea
                                    required
                                    rows="5"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-blue-500 focus:outline-none resize-none"
                                    value={newTicket.description}
                                    onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                                    placeholder="Detaillierte Fehlerbeschreibung..."
                                ></textarea>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 rounded-xl border border-white/20 hover:bg-white/5 transition-colors"
                                >
                                    Abbrechen
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                                >
                                    Ticket erstellen
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Support;
