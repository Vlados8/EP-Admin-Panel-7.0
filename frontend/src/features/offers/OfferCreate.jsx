import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

const OfferCreate = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user: currentUser } = useSelector(state => state.auth);
    const { companyData, getAssetUrl } = useCompany();
    const [clients, setClients] = useState([]);
    const [loadingClients, setLoadingClients] = useState(true);
    const [companySettings, setCompanySettings] = useState(null);

    // Send Modal State
    const [sendModalOpen, setSendModalOpen] = useState(false);
    const [emailAccounts, setEmailAccounts] = useState([]);
    const [emailForm, setEmailForm] = useState({
        from: '',
        to: '',
        subject: '',
        message: 'Guten Tag,\n\nanbei erhalten Sie unser Angebot.\n\nMit freundlichen Grüßen\nEmpire Premium Bau GmbH'
    });
    const [currentFileUrl, setCurrentFileUrl] = useState(null);
    const [isSending, setIsSending] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    // Tax Toggle
    const [includeTax, setIncludeTax] = useState(true);

    // New Client Modal State
    const [clientModalOpen, setClientModalOpen] = useState(
        !!location.state?.inquiry && !location.state?.inquiry?.client_id && !location.state?.clientId
    );
    const [newClientForm, setNewClientForm] = useState({
        type: 'company',
        company_name: '',
        name: location.state?.inquiry?.contact_name || '',
        email: location.state?.inquiry?.contact_email || '',
        phone: location.state?.inquiry?.contact_phone || '',
        address: location.state?.inquiry?.location || '',
        zip_code: '',
        city: ''
    });
    const [isSavingClient, setIsSavingClient] = useState(false);

    // Helper to format inquiry answers for notes
    const getInquiryNotes = () => {
        const inq = location.state?.inquiry;
        if (!inq) return '';
        
        let notes = `AUTOTEXT AUS ANFRAGE:\n`;
        if (inq.answers && inq.answers.length > 0) {
            inq.answers.forEach(ans => {
                notes += `- ${ans.question?.question_text || 'Detail'}: ${ans.answer_value || '-'}\n`;
            });
        }
        if (inq.notes) {
            notes += `\nZusätzliche Infos:\n${inq.notes}`;
        }
        return notes;
    };

    // Offer Data
    const [offerData, setOfferData] = useState({
        title: location.state?.inquiry?.title || (location.state?.projectTitle ? `Zusatzangebot: ${location.state.projectTitle}` : ''),
        client_id: location.state?.clientId || location.state?.inquiry?.client_id || '',
        project_number: 'Laden...',
        parent_project_number: location.state?.parentProjectNumber || '',
        date: new Date().toISOString().split('T')[0],
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: [
            { id: 1, description: '', quantity: 1, unit: 'Stk', price: 0, total: 0 }
        ],
        notes: getInquiryNotes(),
        terms: 'Zahlbar innerhalb von 14 Tagen nach Erhalt der Rechnung.'
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [clientsRes, numRes, emailsRes, companyRes] = await Promise.all([
                    api.get('/clients'),
                    api.get('/offers/next-number'),
                    api.get('/emails'),
                    api.get('/company')
                ]);

                if (emailsRes.data?.status === 'success') {
                    setEmailAccounts(emailsRes.data.data.accounts || []);
                    if (emailsRes.data.data.accounts?.length > 0) {
                        setEmailForm(prev => ({ ...prev, from: emailsRes.data.data.accounts[0].email }));
                    }
                }

                if (clientsRes.data?.status === 'success') {
                    const fetchedClients = clientsRes.data.data.clients;
                    setClients(fetchedClients);

                    // Check for existing client if we have an inquiry but no client_id yet
                    const inq = location.state?.inquiry;
                    if (inq && !location.state?.clientId && !inq.client_id) {
                        const match = fetchedClients.find(c => {
                            const emailMatch = c.email && inq.contact_email && c.email.toLowerCase().trim() === inq.contact_email.toLowerCase().trim();
                            const nameMatch = c.name && inq.contact_name && c.name.toLowerCase().trim() === inq.contact_name.toLowerCase().trim();
                            const companyMatch = c.company_name && inq.contact_name && c.company_name.toLowerCase().trim() === inq.contact_name.toLowerCase().trim();
                            return emailMatch || nameMatch || companyMatch;
                        });

                        if (match) {
                            setOfferData(prev => ({ ...prev, client_id: match.id }));
                            setClientModalOpen(false);
                        }
                    }
                }
                if (numRes.data?.status === 'success') {
                    setOfferData(prev => ({ ...prev, project_number: numRes.data.data.nextNumber }));
                }

                if (companyRes.data?.status === 'success') {
                    const settings = companyRes.data.data.settings || {};
                    setCompanySettings(settings);
                    // Update default email message
                    if (settings.firmName) {
                        setEmailForm(prev => ({
                            ...prev,
                            message: `Guten Tag,\n\nanbei erhalten Sie unser Angebot.\n\nMit freundlichen Grüßen\n${settings.firmName}`
                        }));
                    }
                }
            } catch (err) {
                console.error('Error fetching initial offer data:', err);
            } finally {
                setLoadingClients(false);
            }
        };
        fetchInitialData();
    }, []);

    const handleAddItem = () => {
        const newItem = {
            id: Date.now(),
            description: '',
            quantity: 1,
            unit: 'Stk',
            price: 0,
            total: 0
        };
        setOfferData(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
    };

    const handleRemoveItem = (id) => {
        if (offerData.items.length === 1) return;
        setOfferData(prev => ({
            ...prev,
            items: prev.items.filter(item => item.id !== id)
        }));
    };

    const updateItem = (id, field, value) => {
        setOfferData(prev => {
            const newItems = prev.items.map(item => {
                if (item.id === id) {
                    const updatedItem = { ...item, [field]: value };
                    if (field === 'quantity' || field === 'price') {
                        updatedItem.total = updatedItem.quantity * updatedItem.price;
                    }
                    return updatedItem;
                }
                return item;
            });
            return { ...prev, items: newItems };
        });
    };

    const subtotal = offerData.items.reduce((sum, item) => sum + item.total, 0);
    const tax = includeTax ? subtotal * 0.19 : 0;
    const total = subtotal + tax;

    const handleCreateClient = async () => {
        if (!newClientForm.company_name && !newClientForm.name) {
            alert('Bitte Firmenname oder Name angeben.');
            return;
        }
        setIsSavingClient(true);
        try {
            const payload = {
                name: newClientForm.company_name || newClientForm.name,
                contact_person: newClientForm.name,
                email: newClientForm.email,
                phone: newClientForm.phone,
                address: newClientForm.address,
                zip_code: newClientForm.zip_code,
                city: newClientForm.city,
                type: newClientForm.type,
                status: 'active'
            };
            const res = await api.post('/clients', payload);
            if (res.data?.status === 'success') {
                const newClient = res.data.data.client;
                setClients(prev => [...prev, newClient]);
                setOfferData(prev => ({ ...prev, client_id: newClient.id }));
                setClientModalOpen(false);
                setNewClientForm({ type: 'company', company_name: '', name: '', email: '', phone: '', address: '', zip_code: '', city: '' });
            }
        } catch (error) {
            console.error('Error creating client:', error);
            alert('Fehler beim Erstellen des Kunden.');
        } finally {
            setIsSavingClient(false);
        }
    };

    const handleSave = async (status = 'angebot') => {
        setIsGeneratingPDF(true);
        try {
            const selectedClient = clients.find(c => c.id == offerData.client_id);
            const clientName = selectedClient ? (selectedClient.company_name || selectedClient.name) : 'Unbekannter Kunde';
            const clientAddress = selectedClient?.address || '';
            const clientEmail = selectedClient?.email || '';

            const itemsHtml = offerData.items.map((item, index) => `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 12px 8px; color: #666;">${(index + 1).toString().padStart(2, '0')}</td>
                    <td style="padding: 12px 8px; font-weight: 500;">${item.description || ''}</td>
                    <td style="padding: 12px 8px; text-align: center;">${item.quantity}</td>
                    <td style="padding: 12px 8px; text-align: center;">${item.unit}</td>
                    <td style="padding: 12px 8px; text-align: right;">${item.price.toLocaleString('de-DE', { minimumFractionDigits: 2 })} &euro;</td>
                    <td style="padding: 12px 8px; text-align: right; font-weight: bold;">${item.total.toLocaleString('de-DE', { minimumFractionDigits: 2 })} &euro;</td>
                </tr>
            `).join('');

            const htmlContent = `
                <html>
                    <head>
                        <meta charset="utf-8">
                        <style>
                            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
                            body { font-family: 'Inter', sans-serif; color: #111; line-height: 1.5; padding: 40px; margin: 0; background: white; }
                            h1 { font-size: 48px; text-transform: uppercase; margin: 0 0 10px 0; color: #eee; text-align: right; letter-spacing: -2px; }
                            .header { display: flex; justify-content: space-between; margin-bottom: 60px; }
                            .logo { width: 64px; height: 64px; background: #f8f9fa; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
                            .logo img { max-width: 40px; max-height: 40px; }
                            .company-details p { margin: 2px 0; font-size: 12px; color: #666; }
                            .offer-meta { text-align: right; font-size: 14px; }
                            .offer-meta table { margin-left: auto; }
                            .offer-meta td { padding: 4px 8px; color: #666; }
                            .offer-meta td.val { color: #111; font-weight: bold; }
                            .addresses { display: flex; justify-content: space-between; margin-bottom: 60px; }
                            .address-block h3 { font-size: 12px; text-transform: uppercase; color: #0066cc; margin: 0 0 10px 0; letter-spacing: 1px; }
                            .client-name { font-size: 18px; font-weight: bold; margin: 0 0 5px 0; }
                            .subject { font-size: 20px; font-weight: bold; margin: 0; }
                            table.items { width: 100%; border-collapse: collapse; margin-bottom: 40px; font-size: 14px; }
                            table.items th { text-align: left; padding: 12px 8px; color: #999; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #eee; }
                            table.items th.center { text-align: center; }
                            table.items th.right { text-align: right; }
                            .totals { width: 300px; margin-left: auto; margin-right: 0; }
                            .totals table { width: 100%; border-collapse: collapse; font-size: 14px; }
                            .totals td { padding: 8px 0; }
                            .totals td.right { text-align: right; }
                            .totals tr.total { font-weight: bold; font-size: 18px; border-top: 2px solid #111; }
                            .totals tr.total td { padding-top: 12px; color: #0066cc; }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <div>
                                <div class="logo">
                                    ${companyData?.settings?.logoLarge || companyData?.settings?.logoSmall ? 
                                        `<img src="${getAssetUrl(companyData.settings.logoLarge || companyData.settings.logoSmall)}" alt="Logo">` :
                                        `<div style="font-weight: 900; color: #111;">EP</div>`
                                    }
                                </div>
                                <div class="company-details">
                                    <p style="color: #111; font-weight: bold; font-size: 14px;">${companySettings?.firmName || 'Empire Premium Bau GmbH'}</p>
                                    <p>${companySettings?.address || 'Musterstraße 123'}</p>
                                    <p>${companySettings?.zipCity || '12345 Berlin'}</p>
                                </div>
                            </div>
                            <div class="offer-meta">
                                <h1>Angebot</h1>
                                <table>
                                    <tr><td>Angebotsnummer:</td><td class="val" style="color: #0066cc;">${offerData.project_number}</td></tr>
                                    ${offerData.parent_project_number ? `<tr><td>Projektnummer:</td><td class="val">${offerData.parent_project_number}</td></tr>` : ''}
                                    <tr><td>Datum:</td><td class="val">${offerData.date}</td></tr>
                                    <tr><td>G&uuml;ltig bis:</td><td class="val">${offerData.validUntil}</td></tr>
                                    <tr><td>Ansprechpartner:</td><td class="val">${currentUser?.name || 'Mitarbeiter'}</td></tr>
                                </table>
                            </div>
                        </div>

                        <div class="addresses">
                            <div class="address-block">
                                <h3>Empf&auml;nger</h3>
                                <p class="client-name">${clientName}</p>
                                ${clientAddress ? `<p style="margin: 2px 0; font-size: 14px; color: #444;">${clientAddress}</p>` : ''}
                                ${clientEmail ? `<p style="margin: 2px 0; font-size: 14px; color: #444;">${clientEmail}</p>` : ''}
                            </div>
                            <div class="address-block" style="text-align: right; width: 50%;">
                                <h3>Betreff</h3>
                                <p class="subject">${offerData.title || '-'}</p>
                            </div>
                        </div>

                        ${offerData.terms ? `
                        <div style="margin-bottom: 30px; text-align: right;">
                            <h3 style="font-size: 12px; text-transform: uppercase; color: #0066cc; margin: 0 0 5px 0; letter-spacing: 1px;">Konditionen</h3>
                            <p style="font-size: 14px; margin: 0; white-space: pre-wrap;">${offerData.terms.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                        </div>
                        ` : ''}

                        <table class="items">
                            <thead>
                                <tr>
                                    <th>Pos</th>
                                    <th>Beschreibung</th>
                                    <th class="center">Anzahl</th>
                                    <th class="center">Einh</th>
                                    <th class="right">Einzelpreis</th>
                                    <th class="right">Gesamt</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                        </table>

                        <div class="totals">
                            <table>
                                <tr>
                                    <td>Zwischensumme netto:</td>
                                    <td class="right">${subtotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })} &euro;</td>
                                </tr>
                                ${includeTax ? `
                                <tr>
                                    <td style="color: #666;">Zzgl. 19% MwSt.:</td>
                                    <td class="right" style="color: #666;">${tax.toLocaleString('de-DE', { minimumFractionDigits: 2 })} &euro;</td>
                                </tr>
                                ` : ''}
                                <tr class="total">
                                    <td>Gesamtbetrag brutto:</td>
                                    <td class="right">${total.toLocaleString('de-DE', { minimumFractionDigits: 2 })} &euro;</td>
                                </tr>
                            </table>
                        </div>

                        ${offerData.notes ? `
                        <div style="margin-top: 40px;">
                            <h3 style="font-size: 12px; text-transform: uppercase; color: #0066cc; margin: 0 0 5px 0; letter-spacing: 1px;">Anmerkungen</h3>
                            <p style="font-size: 14px; margin: 0; white-space: pre-wrap;">${offerData.notes.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                        </div>
                        ` : ''}
                    </body>
                </html>
            `;

            const footerContent = `
                <style>
                    .footer-container { font-family: 'Inter', sans-serif, Arial; font-size: 8px; color: #666; width: 100%; border-top: 1px solid #eee; padding-top: 15px; margin: 0 40px; display: flex; flex-direction: column; box-sizing: border-box; }
                    .footer-columns { display: flex; justify-content: space-between; width: 100%; margin-bottom: 5px; }
                    .col { flex: 1; line-height: 1.4; font-size: 8px; }
                    .col.center { text-align: center; }
                    .col.right { text-align: right; }
                    strong { color: #444; }
                    .page-info { text-align: right; font-size: 8px; color: #999; margin-top: 10px; }
                </style>
                <div class="footer-container">
                    <div class="footer-columns">
                        <div class="col left">
                            <strong>${companyData?.settings?.firmName || companyData?.name || 'Empire Premium Bau GmbH'}</strong><br>
                            ${companyData?.settings?.address || ''}<br>
                            ${companyData?.settings?.zipCity || ''}<br>
                            ${companyData?.settings?.phone ? `Tel: ${companyData.settings.phone}<br>` : ''}
                            ${companyData?.settings?.email ? `E-Mail: ${companyData.settings.email}` : ''}
                        </div>
                        <div class="col center">
                            ${companyData?.settings?.bankName ? `Kreditinstitut: ${companyData.settings.bankName}<br>` : ''}
                            ${companyData?.settings?.iban ? `IBAN: ${companyData.settings.iban}<br>` : ''}
                            ${companyData?.settings?.bic ? `BIC: ${companyData.settings.bic}<br>` : ''}
                            ${companyData?.settings?.accountHolder ? `Kto. Inh.: ${companyData.settings.accountHolder}` : (companyData?.settings?.ceo ? `Kto. Inh.: ${companyData.settings.ceo}` : '')}
                        </div>
                        <div class="col right">
                            ${companyData?.settings?.vatId ? `USt-ID: ${companyData.settings.vatId}<br>` : ''}
                            ${companyData?.settings?.hrb ? `Amtsgericht: ${companyData.settings.hrb}<br>` : (companyData?.settings?.court ? `Amtsgericht: ${companyData.settings.court}<br>` : '')}
                            ${companyData?.settings?.ceo ? `Gesch&auml;ftsf&uuml;hrer: ${companyData.settings.ceo}<br>` : ''}
                            ${companyData?.settings?.website ? `Webseite: ${companyData.settings.website}` : ''}
                        </div>
                    </div>
                    <div class="page-info">
                        Seite <span class="pageNumber"></span> von <span class="totalPages"></span>
                    </div>
                </div>
            `;

            const payload = {
                title: offerData.title || `Angebot für ${clients.find(c => c.id == offerData.client_id)?.name || 'Kunde'}`,
                client_id: offerData.client_id,
                project_number: offerData.project_number,
                budget: total,
                items: offerData.items,
                htmlContent: htmlContent,
                footerContent: footerContent,
                parent_project_id: location.state?.parentProjectId || null,
                inquiry_id: location.state?.inquiry?.id || null
            };

            const res = await api.post('/offers/save', payload);
            if (res.data?.status === 'success') {
                const generatedFileUrl = res.data.data?.fileUrl;
                if (status === 'preview' && generatedFileUrl) {
                    window.open(generatedFileUrl, '_blank');
                    navigate('/angebote');
                } else if (status === 'send' && generatedFileUrl) {
                    setCurrentFileUrl(generatedFileUrl);
                    setEmailForm(prev => ({
                        ...prev,
                        to: selectedClient?.email || '',
                        subject: offerData.title || `Angebot ${offerData.project_number}`
                    }));
                    setSendModalOpen(true);
                } else {
                    alert('Angebot wurde erfolgreich gespeichert!');
                    if (location.state?.parentProjectId) {
                        navigate(`/projekte/${location.state.parentProjectId}`);
                    } else {
                        navigate('/angebote');
                    }
                }
            }
        } catch (error) {
            console.error('Error saving offer:', error);
            const errorMsg = error.response?.data?.message || error.message || 'Unbekannter Fehler';
            alert(`Fehler beim Speichern des Angebots: ${errorMsg}`);
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const handleSendEmail = async () => {
        if (!emailForm.from || !emailForm.to) {
            alert('Bitte Absender und Empfänger angeben.');
            return;
        }
        setIsSending(true);
        try {
            // Fetch PDF to attach as File
            const pdfRes = await fetch(currentFileUrl);
            const blob = await pdfRes.blob();
            const file = new File([blob], `${offerData.project_number}.pdf`, { type: 'application/pdf' });

            const formData = new FormData();
            formData.append('from', emailForm.from);
            formData.append('to', emailForm.to);
            formData.append('subject', emailForm.subject);
            formData.append('text', emailForm.message);
            formData.append('attachments', file);

            const res = await api.post('/emails/send', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data?.status === 'success') {
                setSendModalOpen(false);
                alert('Angebot wurde erfolgreich per E-Mail versendet!');
                
                if (location.state?.parentProjectId) {
                    navigate(`/projekte/${location.state.parentProjectId}`);
                } else {
                    navigate('/angebote');
                }
            }
        } catch (error) {
            console.error('Fehler beim Senden:', error);
            const errorMsg = error.response?.data?.message || error.message || 'Unbekannter Fehler';
            alert(`Das Angebot konnte nicht gesendet werden: ${errorMsg}`);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="animate-[slideUp_0.4s_ease-out] flex-1 flex flex-col p-3 sm:p-6 overflow-y-auto custom-scrollbar bg-gradient-to-b from-transparent to-blue-500/5">
            {/* Action Bar */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/angebote')}
                        className="w-10 h-10 rounded-xl glass-panel hover:bg-white/10 flex items-center justify-center transition-all active:scale-90"
                    >
                        <i className="fa-solid fa-arrow-left text-gray-400"></i>
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-white">Neues Angebot erstellen</h2>
                        <span className="text-xs text-blue-400 font-mono tracking-widest">{offerData.project_number}</span>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <button
                        onClick={() => handleSave('preview')}
                        className="glass-panel border-white/5 hover:bg-white/10 text-white px-6 py-2.5 rounded-xl transition-all font-medium text-sm active:scale-95 flex items-center gap-2"
                    >
                        <i className="fa-solid fa-eye text-blue-400"></i>
                        Vorschau
                    </button>
                    <button
                        onClick={() => handleSave('send')}
                        className="glass-panel border-white/5 hover:bg-white/10 text-white px-6 py-2.5 rounded-xl transition-all font-medium text-sm active:scale-95 flex items-center gap-2"
                    >
                        <i className="fa-regular fa-paper-plane text-blue-400"></i>
                        Senden
                    </button>
                    <button
                        onClick={() => handleSave('angebot')}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl transition-all font-bold text-sm shadow-xl shadow-blue-600/20 active:scale-95"
                    >
                        Speichern
                    </button>
                </div>
            </div>

            {/* The "Sheet" (Document) */}
            <div id="offer-sheet" className="max-w-5xl mx-auto w-full glass-panel rounded-3xl md:rounded-[2.5rem] p-5 sm:p-8 md:p-12 border-white/10 shadow-2xl relative overflow-hidden mb-20">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] -mr-48 -mt-48 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-[80px] -ml-32 -mb-32 pointer-events-none"></div>

                {/* Offer Header */}
                <div className="flex flex-col md:flex-row justify-between gap-8 mb-16 relative z-10">
                    <div className="space-y-6">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden shadow-inner">
                            {companyData?.settings?.logoLargeWhite || companyData?.settings?.logoLarge || companyData?.settings?.logoSmallWhite || companyData?.settings?.logoSmall ? (
                                <img 
                                    src={getAssetUrl(companyData?.settings?.logoLargeWhite || companyData?.settings?.logoLarge || companyData?.settings?.logoSmallWhite || companyData?.settings?.logoSmall)} 
                                    alt="Logo" 
                                    className="w-full h-full object-contain p-2" 
                                />
                            ) : (
                                <img src="/assets/Logo EP white.png" alt="Logo" className="w-full h-full object-contain p-2" />
                            )}
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest">Absender</h3>
                            <p className="text-white text-sm font-medium">{companySettings?.firmName || 'Empire Premium Bau GmbH'}</p>
                            <p className="text-gray-400 text-xs">{companySettings?.address || 'Musterstraße 123'}</p>
                            <p className="text-gray-400 text-xs">{companySettings?.zipCity || '12345 Berlin'}</p>
                        </div>
                    </div>

                    <div className="text-left md:text-right space-y-4">
                        <h1 className="text-4xl md:text-6xl font-black text-white/10 uppercase tracking-tighter select-none">Angebot</h1>
                        <div className="inline-grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-left">
                            <span className="text-gray-500 font-medium">Angebotsnummer:</span>
                            <span className="text-white font-mono font-bold text-blue-400">{offerData.project_number}</span>
                            {offerData.parent_project_number && (
                                <>
                                    <span className="text-gray-500 font-medium">Projektnummer:</span>
                                    <span className="text-white font-mono font-bold">{offerData.parent_project_number}</span>
                                </>
                            )}
                            <span className="text-gray-500 font-medium">Datum:</span>
                            <span className="text-white font-medium">{offerData.date}</span>
                            <span className="text-gray-500 font-medium">Gültig bis:</span>
                            <span className="text-white font-medium">{offerData.validUntil}</span>
                        </div>
                    </div>
                </div>

                {/* Recipient Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16 relative z-10">
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest pl-1">Empfänger</h3>
                        <div className="glass-panel bg-black/20 rounded-2xl p-4 border-white/5 hover:border-blue-500/30 transition-all group relative">
                            <div className="flex gap-2 items-center">
                                <select
                                    className="bg-transparent border-none outline-none text-white w-full text-lg font-bold appearance-none cursor-pointer flex-1"
                                    value={offerData.client_id}
                                    onChange={(e) => setOfferData(prev => ({ ...prev, client_id: e.target.value }))}
                                >
                                    <option value="" className="bg-[#1a1a1c]">Kunde auswählen...</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id} className="bg-[#1a1a1c]">
                                            {c.company_name || c.name}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => setClientModalOpen(true)}
                                    className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center flex-shrink-0"
                                    title="Neuen Kunden hinzufügen"
                                >
                                    <i className="fa-solid fa-user-plus"></i>
                                </button>
                            </div>
                            <div className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                                <i className="fa-solid fa-circle-info opacity-50"></i>
                                {offerData.client_id ? 'Kundendetails werden automatisch übernommen.' : 'Wählen Sie einen Kunden aus oder erstellen Sie einen neuen.'}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest pl-1">Betreff</h3>
                        <input
                            type="text"
                            placeholder="z.B. Sanierung Berlin-Mitte"
                            className="glass-panel bg-black/20 rounded-2xl p-4 border-white/5 w-full text-lg font-bold text-white placeholder:text-white/10 outline-none focus:border-blue-500/50 transition-all font-sans"
                            value={offerData.title}
                            onChange={(e) => setOfferData(prev => ({ ...prev, title: e.target.value }))}
                        />
                    </div>
                </div>

                {/* Items Table */}
                <div className="mb-12 relative z-10 w-full overflow-x-auto pb-4 custom-scrollbar">
                    <div className="min-w-[800px]">
                        <div className="grid grid-cols-12 gap-4 px-4 mb-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                            <div className="col-span-1 text-center">Pos</div>
                            <div className="col-span-5">Beschreibung</div>
                            <div className="col-span-1 text-center">Anzahl</div>
                            <div className="col-span-1 text-center">Einh</div>
                            <div className="col-span-2 text-right text-blue-400/80">Einzelpreis</div>
                            <div className="col-span-2 text-right">Gesamt</div>
                        </div>

                        <div className="space-y-3">
                        {offerData.items.map((item, index) => (
                            <div key={item.id} className="grid grid-cols-12 gap-4 items-center glass-panel bg-white/5 p-4 rounded-2xl border-white/5 group hover:border-blue-500/20 transition-all">
                                <div className="col-span-1 text-center font-mono text-gray-500 text-sm">{(index + 1).toString().padStart(2, '0')}</div>
                                <div className="col-span-5">
                                    <input
                                        type="text"
                                        className="bg-transparent border-none outline-none text-white w-full text-sm font-medium placeholder:text-gray-600"
                                        placeholder="Leistungsbeschreibung..."
                                        value={item.description}
                                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                    />
                                </div>
                                <div className="col-span-1 flex justify-center">
                                    <input
                                        type="number"
                                        className="bg-transparent border-none outline-none text-white w-12 text-center text-sm font-mono"
                                        value={item.quantity}
                                        onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="col-span-1 text-center">
                                    <input
                                        type="text"
                                        className="bg-transparent border-none outline-none text-gray-400 w-10 text-center text-[10px] font-bold uppercase"
                                        value={item.unit}
                                        onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                    />
                                </div>
                                <div className="col-span-2 text-right">
                                    <input
                                        type="number"
                                        className="bg-transparent border-none outline-none text-blue-400 w-full text-right text-sm font-mono font-bold"
                                        value={item.price}
                                        onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="col-span-2 text-right flex items-center justify-end gap-3 text-white font-mono text-sm font-bold">
                                    {item.total.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                                    <button
                                        onClick={() => handleRemoveItem(item.id)}
                                        className="w-6 h-6 rounded-lg bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/20 active:scale-90"
                                    >
                                        <i className="fa-solid fa-xmark text-[10px]"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <button
                        onClick={handleAddItem}
                        className="mt-6 w-full py-4 rounded-2xl border border-dashed border-white/10 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-gray-500 hover:text-blue-400 text-sm font-medium flex items-center justify-center gap-2 group"
                    >
                        <i className="fa-solid fa-plus-circle transition-transform group-hover:rotate-90"></i>
                        Neue Position hinzufügen
                    </button>
                    </div>
                </div>

                {/* Calculation Area */}
                <div className="flex justify-end mb-16 relative z-10">
                    <div className="w-full md:w-80 glass-panel bg-white/5 rounded-[2rem] p-8 border-white/10 shadow-xl space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-400 uppercase tracking-widest text-[10px] font-bold">Zwischensumme</span>
                            <span className="text-white font-mono font-medium">{subtotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                        </div>
                        <div className="flex justify-between items-center text-sm group">
                            <span className="text-gray-400 uppercase tracking-widest text-[10px] font-bold flex items-center gap-2 cursor-pointer select-none" onClick={() => setIncludeTax(!includeTax)}>
                                MwSt (19%)
                                <button className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors ${includeTax ? 'bg-blue-500' : 'bg-gray-600'}`}>
                                    <div className={`w-3 h-3 rounded-full bg-white transition-transform ${includeTax ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                </button>
                            </span>
                            <span className={`text-white font-mono font-medium transition-opacity ${includeTax ? 'opacity-100' : 'opacity-30 line-through'}`}>
                                {tax.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                            </span>
                        </div>
                        <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                            <span className="text-blue-400 uppercase tracking-widest text-xs font-black">Gesamtbetrag</span>
                            <span className="text-3xl font-black text-white font-mono tabular-nums leading-none">
                                {total.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer Notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest">Anmerkungen</h3>
                        <textarea
                            className="glass-panel bg-black/20 rounded-2xl p-4 border-white/5 w-full h-32 text-sm text-gray-300 placeholder:text-white/5 outline-none focus:border-blue-500/50 transition-all font-sans resize-none"
                            placeholder="Zusätzliche Infos für den Kunden..."
                            value={offerData.notes}
                            onChange={(e) => setOfferData(prev => ({ ...prev, notes: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest">Konditionen</h3>
                        <textarea
                            className="glass-panel bg-black/20 rounded-2xl p-4 border-white/5 w-full h-32 text-sm text-gray-400 outline-none focus:border-blue-500/50 transition-all font-sans resize-none"
                            value={offerData.terms}
                            onChange={(e) => setOfferData(prev => ({ ...prev, terms: e.target.value }))}
                        />
                    </div>
                </div>
            </div>

            {/* Floating Hint Overlay */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 glass-panel rounded-full border-blue-500/20 flex items-center gap-3 shadow-2xl z-[100] animate-[fadeIn_1s_ease-out] pointer-events-none">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                <span className="text-xs font-medium text-gray-300">Autosave ist in diesem Modus deaktiviert. Bitte manuell speichern.</span>
            </div>

            {/* Add Client Modal */}
            {clientModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-[#121214] border border-white/10 shadow-2xl rounded-3xl p-6 w-full max-w-lg animate-[slideUp_0.3s_ease-out]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Neuen Kunden anlegen</h3>
                            <button onClick={() => setClientModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                <i className="fa-solid fa-xmark text-xl"></i>
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Kunden-Typ</label>
                                <select
                                    className="glass-panel bg-black/20 rounded-xl p-3 border-white/5 w-full text-sm text-white focus:border-blue-500/50 outline-none"
                                    value={newClientForm.type}
                                    onChange={e => setNewClientForm(prev => ({ ...prev, type: e.target.value }))}
                                >
                                    <option value="company" className="bg-[#1a1a1c]">Firma</option>
                                    <option value="private" className="bg-[#1a1a1c]">Privatkunde</option>
                                </select>
                            </div>
                            
                            {newClientForm.type === 'company' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Firmenname</label>
                                    <input
                                        type="text"
                                        className="glass-panel bg-black/20 rounded-xl p-3 border-white/5 w-full text-sm text-white focus:border-blue-500/50 outline-none"
                                        value={newClientForm.company_name}
                                        onChange={e => setNewClientForm(prev => ({ ...prev, company_name: e.target.value }))}
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                                    {newClientForm.type === 'company' ? 'Ansprechpartner / Name' : 'Vor- und Nachname'}
                                </label>
                                <input
                                    type="text"
                                    className="glass-panel bg-black/20 rounded-xl p-3 border-white/5 w-full text-sm text-white focus:border-blue-500/50 outline-none"
                                    value={newClientForm.name}
                                    onChange={e => setNewClientForm(prev => ({ ...prev, name: e.target.value }))}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">E-Mail</label>
                                    <input
                                        type="email"
                                        className="glass-panel bg-black/20 rounded-xl p-3 border-white/5 w-full text-sm text-white focus:border-blue-500/50 outline-none"
                                        value={newClientForm.email}
                                        onChange={e => setNewClientForm(prev => ({ ...prev, email: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Telefon</label>
                                    <input
                                        type="text"
                                        className="glass-panel bg-black/20 rounded-xl p-3 border-white/5 w-full text-sm text-white focus:border-blue-500/50 outline-none"
                                        value={newClientForm.phone}
                                        onChange={e => setNewClientForm(prev => ({ ...prev, phone: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Straße & Hausnummer</label>
                                <input
                                    type="text"
                                    className="glass-panel bg-black/20 rounded-xl p-3 border-white/5 w-full text-sm text-white focus:border-blue-500/50 outline-none"
                                    value={newClientForm.address}
                                    onChange={e => setNewClientForm(prev => ({ ...prev, address: e.target.value }))}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">PLZ</label>
                                    <input
                                        type="text"
                                        className="glass-panel bg-black/20 rounded-xl p-3 border-white/5 w-full text-sm text-white focus:border-blue-500/50 outline-none"
                                        value={newClientForm.zip_code}
                                        onChange={e => setNewClientForm(prev => ({ ...prev, zip_code: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Stadt</label>
                                    <input
                                        type="text"
                                        className="glass-panel bg-black/20 rounded-xl p-3 border-white/5 w-full text-sm text-white focus:border-blue-500/50 outline-none"
                                        value={newClientForm.city}
                                        onChange={e => setNewClientForm(prev => ({ ...prev, city: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleCreateClient}
                                disabled={isSavingClient}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white py-3 rounded-xl transition-all font-bold text-sm shadow-xl shadow-blue-600/20 mt-4 flex items-center justify-center gap-2"
                            >
                                {isSavingClient ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <><i className="fa-solid fa-check"></i> Kunde speichern</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Senden Modal */}
            {sendModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-[#121214] border border-white/10 shadow-2xl rounded-3xl p-6 w-full max-w-5xl flex gap-6 animate-[slideUp_0.3s_ease-out] max-h-[90vh]">

                        {/* PDF Preview Pane */}
                        <div className="flex-1 bg-white rounded-2xl overflow-hidden glass-panel border-white/5 relative">
                            {currentFileUrl ? (
                                <iframe src={currentFileUrl} className="w-full h-full min-h-[600px] border-none" title="PDF Vorschau" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
                                </div>
                            )}
                        </div>

                        {/* Email Form Pane */}
                        <div className="w-96 flex flex-col gap-5">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-xl font-bold text-white">Angebot senden</h3>
                                <button onClick={() => setSendModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                    <i className="fa-solid fa-xmark text-xl"></i>
                                </button>
                            </div>

                            <div className="space-y-4 flex-1">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Von</label>
                                    <select
                                        className="glass-panel bg-black/20 rounded-xl p-3 border-white/5 w-full text-sm text-white outline-none focus:border-blue-500/50"
                                        value={emailForm.from}
                                        onChange={e => setEmailForm(prev => ({ ...prev, from: e.target.value }))}
                                    >
                                        <option value="" className="bg-[#1a1a1c]">Wählen Sie einen Absender...</option>
                                        {emailAccounts.map(acc => (
                                            <option key={acc.id} value={acc.email} className="bg-[#1a1a1c]">
                                                {acc.display_name || acc.assigned_user?.name} ({acc.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">An</label>
                                    <input
                                        type="text"
                                        className="glass-panel bg-black/20 rounded-xl p-3 border-white/5 w-full text-sm text-white placeholder:text-gray-600 outline-none focus:border-blue-500/50"
                                        placeholder="Kunden-E-Mail"
                                        value={emailForm.to}
                                        onChange={e => setEmailForm(prev => ({ ...prev, to: e.target.value }))}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Betreff</label>
                                    <input
                                        type="text"
                                        className="glass-panel bg-black/20 rounded-xl p-3 border-white/5 w-full text-sm text-white placeholder:text-gray-600 outline-none focus:border-blue-500/50"
                                        value={emailForm.subject}
                                        onChange={e => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                                    />
                                </div>

                                <div className="flex-1 flex flex-col">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nachricht</label>
                                    <textarea
                                        className="glass-panel bg-black/20 rounded-xl p-3 border-white/5 w-full flex-1 min-h-[150px] text-sm text-white outline-none focus:border-blue-500/50 resize-none"
                                        value={emailForm.message}
                                        onChange={e => setEmailForm(prev => ({ ...prev, message: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSendEmail}
                                disabled={isSending}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white py-3 rounded-xl transition-all font-bold text-sm shadow-xl shadow-blue-600/20 flex justify-center items-center gap-2 mt-4"
                            >
                                {isSending ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <><i className="fa-regular fa-paper-plane"></i> Jetzt Senden</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PDF Generation Overlay */}
            {isGeneratingPDF && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                        <p className="text-white font-medium animate-pulse tracking-widest uppercase text-sm">Dokument wird erstellt...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OfferCreate;
