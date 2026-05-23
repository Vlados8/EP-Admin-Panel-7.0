import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const ProjectWizard = ({ isOpen, onClose, onProjectCreated, initialData = null }) => {
    const [step, setStep] = useState(1);

    // Data lists
    const [clients, setClients] = useState([]);
    const [categories, setCategories] = useState([]);
    const [users, setUsers] = useState([]);
    const [subcontractors, setSubcontractors] = useState([]);
    const [loadingData, setLoadingData] = useState(false);

    // --- FORM STATES ---
    // Step 1: Client
    const [isNewClient, setIsNewClient] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [newClientData, setNewClientData] = useState({
        name: '', type: 'company', contact_person: '', email: '', phone: '', address: '', zip_code: '', city: ''
    });

    // Step 2: Basic Info
    const [basicInfo, setBasicInfo] = useState({
        title: '', address: '', description: '', start_date: '', end_date: '', budget: ''
    });

    // Step 3: Categories & Answers
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [dynamicAnswers, setDynamicAnswers] = useState({});
    const [checkboxSelections, setCheckboxSelections] = useState([]);

    // Helper to know if we are in the main category view, subcategory view, or questioning
    const [catViewLevel, setCatViewLevel] = useState('main'); // main, sub, questions

    // Step 4: Assignments
    const [assignedUsers, setAssignedUsers] = useState([]); // [{ user_id, role }]
    const [assignedSubcontractors, setAssignedSubcontractors] = useState([]); // [id]

    const [treeTopUser, setTreeTopUser] = useState('');
    const [treeGL, setTreeGL] = useState('');
    const [treeWorker, setTreeWorker] = useState('');

    // Step 5: Photos
    const [mainPhoto, setMainPhoto] = useState(null); // Single file
    const [photos, setPhotos] = useState([]); // Files array

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchInitialData();
            // Reset state
            setStep(1);
            setIsNewClient(false); setSelectedClientId(''); setNewClientData({ name: '', type: 'company', contact_person: '', email: '', phone: '', address: '', zip_code: '', city: '' });
            setBasicInfo({ title: '', address: '', description: '', start_date: '', end_date: '', budget: '' });
            setSelectedCategory(null); setSelectedSubcategory(null); setCurrentQuestion(null);
            setDynamicAnswers({}); setCatViewLevel('main');
            setAssignedUsers([]); setAssignedSubcontractors([]);
            setTreeTopUser(''); setTreeGL(''); setTreeWorker('');
            setMainPhoto(null);
            setPhotos([]);
            if (initialData) {
                // Prefill from Inquiry
                setNewClientData({
                    name: initialData.contact_name || '', type: 'company', contact_person: initialData.contact_name || '',
                    email: initialData.contact_email || '', phone: initialData.contact_phone || '',
                    address: initialData.location || '', zip_code: '', city: ''
                });
                setBasicInfo({
                    title: initialData.title || '', address: initialData.location || '',
                    description: initialData.notes || '', start_date: '', end_date: '', budget: ''
                });

                // Set answers if available
                if (initialData.answers && initialData.answers.length > 0) {
                    const presetAnswers = {};
                    initialData.answers.forEach(ans => {
                        presetAnswers[ans.question_id] = { value: ans.answer_value, answerId: ans.answer_id };
                    });
                    setDynamicAnswers(presetAnswers);
                }

                // If inquiry already has a client_id, use it
                if (initialData.client_id) {
                    setSelectedClientId(initialData.client_id);
                    setIsNewClient(false);
                } else {
                    // Otherwise default to new client until we check the list
                    setIsNewClient(true);
                }
            }
        }
    }, [isOpen, initialData]);

    // Secondary effect: once categories load, set the selected category if initialData provides it
    useEffect(() => {
        if (isOpen && initialData && categories.length > 0 && !selectedCategory) {
            if (initialData.category_id) {
                const cat = categories.find(c => c.id === initialData.category_id);
                if (cat) {
                    setSelectedCategory(cat);
                    // Instead of jumping into the questions, we just let them see the summary,
                    // but we need to mark it as answered. We'll set the view level to main so they can review it.
                    setCatViewLevel('main');
                }
            }
        }
    }, [isOpen, initialData, categories, selectedCategory]);

    const fetchInitialData = async () => {
        setLoadingData(true);
        try {
            const [clientRes, catRes, userRes, subRes] = await Promise.all([
                api.get('/clients'),
                api.get('/categories'),
                api.get('/users'),
                api.get('/subcontractors')
            ]);
            setCategories(catRes.data.data.categories || []);
            setUsers(userRes.data.data.users || []);
            setSubcontractors(subRes.data.data.subcontractors || []);

            // Check for existing client if prefilling from inquiry
            const fetchedClients = clientRes.data.data.clients || [];
            setClients(fetchedClients);

            if (initialData && !initialData.client_id) {
                const match = fetchedClients.find(c => {
                    const emailMatch = c.email && initialData.contact_email && c.email.toLowerCase().trim() === initialData.contact_email.toLowerCase().trim();
                    const nameMatch = c.name && initialData.contact_name && c.name.toLowerCase().trim() === initialData.contact_name.toLowerCase().trim();
                    const companyMatch = c.company_name && initialData.contact_name && c.company_name.toLowerCase().trim() === initialData.contact_name.toLowerCase().trim();
                    return emailMatch || nameMatch || companyMatch;
                });

                if (match) {
                    setSelectedClientId(match.id);
                    setIsNewClient(false);
                }
            }
        } catch (error) {
            console.error('Error fetching wizard data:', error);
        } finally {
            setLoadingData(false);
        }
    };

    const handleNextStep1 = async () => {
        if (isNewClient) {
            if (!newClientData.name) { alert('Bitte geben Sie einen Namen ein.'); return; }
            try {
                // Feature constraint: Check if email exists
                if (newClientData.email) {
                    const checkRes = await api.get(`/clients/check-email?email=${encodeURIComponent(newClientData.email)}`);
                    if (checkRes.data.data.exists) {
                        const existingClient = checkRes.data.data.client;
                        setSelectedClientId(existingClient.id);
                        setIsNewClient(false);
                        setStep(2);
                        return;
                    }
                }

                // Create client inline if it doesn't exist
                const res = await api.post('/clients', {
                    name: newClientData.name,
                    contact_person: newClientData.contact_person,
                    email: newClientData.email,
                    phone: newClientData.phone,
                    address: newClientData.address,
                    zip_code: newClientData.zip_code,
                    city: newClientData.city,
                    type: newClientData.type,
                    source: 'admin_panel'
                });
                const freshClient = res.data.data.client;
                setClients(prev => [...prev, freshClient]);
                setSelectedClientId(freshClient.id);
                setIsNewClient(false);
                setStep(2);
            } catch (error) {
                console.error('Error creating client inline:', error);
                alert('Fehler beim Anlegen des Kunden.');
            }
        } else {
            if (!selectedClientId) { alert('Bitte wählen Sie einen Kunden aus.'); return; }
            setStep(2);
        }
    };

    const handleNextStep2 = () => {
        if (!basicInfo.title) { alert('Projekttitel ist erforderlich.'); return; }
        setStep(3);
    };

    // Category Logic
    const handleCategorySelect = (cat) => {
        setSelectedCategory(cat);
        if (cat.subcategories && cat.subcategories.length > 0) {
            setCatViewLevel('sub');
        } else {
            setStep(4); // Skip questions if no subcategories
        }
    };

    const handleSubcategorySelect = (subcat) => {
        setSelectedSubcategory(subcat);
        if (subcat.questions && subcat.questions.length > 0) {
            setCurrentQuestion(subcat.questions[0]);
            setCatViewLevel('questions');
        } else {
            setStep(4); // Skip questions if empty
        }
    };

    const findQuestionRecursive = (questions, idToFind) => {
        if (!questions) return null;
        for (const q of questions) {
            if (q.id === idToFind) return q;
            if (q.answers) {
                for (const ans of q.answers) {
                    if (ans.next_question_id === idToFind) {
                        // We don't have the full tree embedded in answers usually, but the backend 
                        // CategoryController actually returns a flat list of questions per subcategory
                        // wait, let's just search the flat questions array since the backend includes them all!
                    }
                }
            }
        }
        return null;
    };

    const handleAnswerQuestion = (question, answerValue, answerId, nextQuestionId) => {
        setDynamicAnswers(prev => ({ ...prev, [question.id]: { value: answerValue, answerId } }));
        
        // Determine the next question ID
        let targetNextQId = nextQuestionId;
        if (!targetNextQId && question.answers && question.answers.length > 0) {
            // Fallback: use the next_question_id from the first configured answer (common for sliders/inputs)
            targetNextQId = question.answers[0].next_question_id;
        }

        if (targetNextQId) {
            const nextQ = selectedSubcategory?.questions?.find(q => q.id === targetNextQId);
            if (nextQ) {
                setCurrentQuestion(nextQ);
            } else {
                setStep(4);
            }
        } else {
            setStep(4);
        }
    };

    const submitCheckboxes = () => {
        if (checkboxSelections.length === 0) return;
        const values = checkboxSelections.map(a => a.answer_text).join(', ');
        const firstSelected = checkboxSelections[0];
        handleAnswerQuestion(currentQuestion, values, firstSelected?.id, firstSelected?.next_question_id);
        setCheckboxSelections([]);
    };

    const handleBackCat = () => {
        if (catViewLevel === 'questions') {
            setCatViewLevel('sub');
        } else if (catViewLevel === 'sub') {
            setCatViewLevel('main');
        }
    };

    // Assignments Add functions


    const toggleSubcontractor = (id) => {
        if (assignedSubcontractors.includes(id)) setAssignedSubcontractors(assignedSubcontractors.filter(sid => sid !== id));
        else setAssignedSubcontractors([...assignedSubcontractors, id]);
    };

    // Photo uploads
    const handleFileChange = (e) => {
        if (e.target.files) {
            setPhotos([...photos, ...Array.from(e.target.files)]);
        }
    };

    const removePhoto = (index) => {
        setPhotos(photos.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('title', basicInfo.title);
            formData.append('description', basicInfo.description);
            formData.append('address', basicInfo.address);
            if (basicInfo.start_date) formData.append('start_date', basicInfo.start_date);
            if (basicInfo.end_date) formData.append('end_date', basicInfo.end_date);
            formData.append('budget', basicInfo.budget || 0);
            formData.append('client_id', selectedClientId);
            if (selectedCategory) formData.append('category_id', selectedCategory.id);
            if (selectedSubcategory) formData.append('subcategory_id', selectedSubcategory.id);

            // Format assignments
            formData.append('assigned_users', JSON.stringify(assignedUsers));
            formData.append('assigned_subcontractors', JSON.stringify(assignedSubcontractors));

            // Format answers
            const formattedAnswers = Object.keys(dynamicAnswers).map(qId => ({
                question_id: parseInt(qId),
                answer_id: dynamicAnswers[qId].answerId || null,
                custom_value: dynamicAnswers[qId].value
            }));
            formData.append('answers', JSON.stringify(formattedAnswers));

            // Append main photo
            if (mainPhoto) {
                formData.append('mainImage', mainPhoto);
            }

            // Append additional photos
            for (let i = 0; i < photos.length; i++) {
                formData.append('photos', photos[i]);
            }

            await api.post('/projects', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            onProjectCreated();
            onClose();
        } catch (error) {
            console.error('Error saving project:', error);
            alert('Fehler beim Speichern des Projekts.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex justify-center items-center p-0 md:p-6 lg:p-10 animate-[fadeIn_0.3s_ease-out]">
            <div className="bg-slate-900 border border-white/10 rounded-none md:rounded-3xl w-full h-full max-w-5xl overflow-hidden flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)]">

                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div className="w-10" /> {/* Spacer for centering the title */}
                    <div className="text-center flex-1">
                        <h2 className="text-2xl font-bold text-white">Neues Projekt erstellen</h2>
                        <div className="flex justify-center gap-2 mt-3">
                            {[1, 2, 3, 4, 5].map((s) => (
                                <div key={s} className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${step >= s ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-slate-800 border-white/10 text-gray-500'}`}>
                                        {s}
                                    </div>
                                    {s < 5 && <div className={`w-8 h-1 rounded-full ${step > s ? 'bg-blue-600' : 'bg-white/10'}`} />}
                                </div>
                            ))}
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 w-10 h-10 rounded-xl transition-colors flex items-center justify-center">
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto flex-1">
                    {loadingData && step === 1 ? (
                        <div className="text-center py-20 text-gray-400">
                            <i className="fa-solid fa-spinner fa-spin text-3xl mb-4 text-blue-500"></i>
                            <p>Lade Daten...</p>
                        </div>
                    ) : (
                        <>
                            {/* STEP 1: CLIENT */}
                            {step === 1 && (
                                <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] flex flex-col items-center">
                                    <h3 className="text-xl font-bold text-white mb-4 text-center">1. Kunde auswählen oder erstellen</h3>

                                    <div className="flex justify-center gap-4 p-1 bg-white/5 rounded-xl w-fit border border-white/10 mx-auto">
                                        <button onClick={() => setIsNewClient(false)} className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${!isNewClient ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(37,99,235,0.15)]' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>Bestehender Kunde</button>
                                        <button onClick={() => setIsNewClient(true)} className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${isNewClient ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(37,99,235,0.15)]' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>Neuer Kunde</button>
                                    </div>

                                    {!isNewClient ? (
                                        <div className="mt-6 w-full max-w-md mx-auto">
                                            <label className="block text-sm font-medium text-gray-400 mb-2 text-center">Kunde wählen <span className="text-red-400">*</span></label>
                                            <select
                                                value={selectedClientId}
                                                onChange={(e) => setSelectedClientId(e.target.value)}
                                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-center [&>option]:bg-slate-900"
                                            >
                                                <option value="" className="bg-slate-900 text-white">-- Bitte wählen --</option>
                                                {clients.map(c => (
                                                    <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                                                        {c.name} {c.contact_person ? `(${c.contact_person})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-4 mt-6 max-w-2xl mx-auto">
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="block text-sm font-medium text-gray-400 mb-2 text-center">Firma / Name <span className="text-red-400">*</span></label>
                                                <input type="text" value={newClientData.name} onChange={e => setNewClientData({ ...newClientData, name: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none text-center" placeholder="Name..." />
                                            </div>
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="block text-sm font-medium text-gray-400 mb-2 text-center">Kundentyp</label>
                                                <select value={newClientData.type} onChange={e => setNewClientData({ ...newClientData, type: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none text-center [&>option]:bg-slate-900">
                                                    <option value="company" className="bg-slate-900 text-white">Firma</option>
                                                    <option value="private" className="bg-slate-900 text-white">Privatperson</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="block text-sm font-medium text-gray-400 mb-2 text-center">Ansprechpartner</label>
                                                <input type="text" value={newClientData.contact_person} onChange={e => setNewClientData({ ...newClientData, contact_person: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none text-center" placeholder="Herr/Frau..." />
                                            </div>
                                            <div className="col-span-2 md:col-span-1 border border-white/10 bg-white/5 rounded-xl p-4 flex flex-col justify-center items-center gap-2 opacity-70 mt-1">
                                                <div className="text-sm font-medium text-gray-400 mb-1">Kontakt</div>
                                                <div className="flex items-center gap-3 text-sm text-gray-300"><i className="fa-solid fa-phone text-blue-400/70"></i> {newClientData.phone || '-'}</div>
                                                <div className="flex items-center gap-3 text-sm text-gray-300"><i className="fa-solid fa-envelope text-blue-400/70"></i> {newClientData.email || '-'}</div>
                                            </div>
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="block text-sm font-medium text-gray-400 mb-2 text-center">E-Mail</label>
                                                <input type="email" value={newClientData.email} onChange={e => setNewClientData({ ...newClientData, email: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none text-center" placeholder="max@example.com" />
                                            </div>
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="block text-sm font-medium text-gray-400 mb-2 text-center">Telefon</label>
                                                <input type="tel" value={newClientData.phone} onChange={e => setNewClientData({ ...newClientData, phone: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none text-center" placeholder="+49 123 456789" />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-sm font-medium text-gray-400 mb-2 text-center">Adresse</label>
                                                <input type="text" value={newClientData.address} onChange={e => setNewClientData({ ...newClientData, address: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none text-center" placeholder="Musterstraße 1" />
                                            </div>
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="block text-sm font-medium text-gray-400 mb-2 text-center">PLZ</label>
                                                <input type="text" value={newClientData.zip_code} onChange={e => setNewClientData({ ...newClientData, zip_code: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none text-center" placeholder="12345" />
                                            </div>
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="block text-sm font-medium text-gray-400 mb-2 text-center">Stadt</label>
                                                <input type="text" value={newClientData.city} onChange={e => setNewClientData({ ...newClientData, city: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none text-center" placeholder="Musterstadt" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* STEP 2: BASIC INFO */}
                            {step === 2 && (
                                <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] max-w-2xl mx-auto w-full">
                                    <h3 className="text-xl font-bold text-white mb-4 text-center">2. Projektdetails</h3>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2 text-center">Projekttitel <span className="text-red-400">*</span></label>
                                        <input type="text" value={basicInfo.title} onChange={e => setBasicInfo({ ...basicInfo, title: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none text-center" placeholder="Z.B. PV Anlage EFH Huber" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2 text-center">Bauadresse</label>
                                        <input type="text" value={basicInfo.address} onChange={e => setBasicInfo({ ...basicInfo, address: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none text-center" placeholder="Musterstraße 1, 12345 Stadt" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-2 text-center">Geplanter Start</label>
                                            <input type="date" value={basicInfo.start_date} onChange={e => setBasicInfo({ ...basicInfo, start_date: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none text-center" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-2 text-center">Geplantes Ende</label>
                                            <input type="date" value={basicInfo.end_date} onChange={e => setBasicInfo({ ...basicInfo, end_date: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none text-center" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2 text-center">Projekt-Budget (€)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={basicInfo.budget}
                                            onChange={e => setBasicInfo({ ...basicInfo, budget: e.target.value })}
                                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none text-center"
                                            placeholder="0.00"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2 text-center">Notizen / Beschreibung</label>
                                        <textarea value={basicInfo.description} onChange={e => setBasicInfo({ ...basicInfo, description: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none min-h-[100px] text-center" placeholder="Zusätzliche Informationen..."></textarea>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: CATEGORIES & QUESTIONS */}
                            {step === 3 && (
                                <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] flex flex-col items-center">
                                    <h3 className="text-xl font-bold text-white mb-4 text-center">3. Kategorisierung & Spezifikationen</h3>

                                    {initialData && initialData.category_id && catViewLevel === 'main' && (
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl max-w-2xl mx-auto text-center mb-6">
                                            <i className="fa-solid fa-check-circle mr-2"></i>
                                            Die Antworten aus की Anfrage wurden bereits übernommen.
                                            <button
                                                onClick={() => setStep(4)}
                                                className="ml-4 underline hover:text-white transition-colors text-sm font-medium"
                                            >
                                                Direkt zu Schritt 4 (Zuweisungen)
                                            </button>
                                        </div>
                                    )}

                                    {catViewLevel === 'main' && (
                                        <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto">
                                            {categories.map(c => (
                                                <button key={c.id} onClick={() => handleCategorySelect(c)} className="bg-slate-800 border border-white/10 p-6 rounded-xl text-center hover:bg-slate-700 hover:border-blue-500/50 transition-all group flex flex-col items-center gap-3">
                                                    <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 text-2xl group-hover:scale-110 group-hover:bg-blue-500/20 transition-all">
                                                        <i className={`fa-solid ${c.icon || 'fa-folder'}`}></i>
                                                    </div>
                                                    <span className="text-white font-medium text-lg">{c.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {catViewLevel === 'sub' && (
                                        <div className="animate-[fadeIn_0.3s_ease-out]">
                                            <button onClick={handleBackCat} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2 mx-auto"><i className="fa-solid fa-arrow-left"></i> Zurück zu Hauptkategorien</button>
                                            <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto justify-center">
                                                {selectedCategory?.subcategories?.map(s => (
                                                    <button key={s.id} onClick={() => handleSubcategorySelect(s)} className="bg-slate-800 border border-white/10 p-5 rounded-xl text-center hover:bg-slate-700 hover:border-blue-500/50 transition-all group flex flex-col items-center gap-4">
                                                        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-blue-400 transition-colors">
                                                            <i className={`fa-solid ${s.icon || 'fa-layer-group'}`}></i>
                                                        </div>
                                                        <span className="text-white font-medium">{s.name}</span>
                                                    </button>
                                                ))}
                                                {(!selectedCategory?.subcategories || selectedCategory.subcategories.length === 0) && (
                                                    <div className="text-gray-400 text-center py-6 col-span-2">Keine Unterkategorien verfügbar. Sie können zum nächsten Schritt gehen.</div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {catViewLevel === 'questions' && currentQuestion && (
                                        <div className="max-w-xl mx-auto animate-[fadeIn_0.3s_ease-out]">
                                            <h4 className="text-2xl font-bold text-white mb-8 text-center">{currentQuestion.question_text}</h4>

                                            {(!currentQuestion.type || currentQuestion.type === 'buttons' || currentQuestion.type === 'radio') && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {currentQuestion.answers?.map(ans => (
                                                        <button
                                                            key={ans.id}
                                                            onClick={() => handleAnswerQuestion(currentQuestion, ans.answer_text, ans.id, ans.next_question_id)}
                                                            className="bg-slate-800 border-2 border-white/10 rounded-xl p-6 text-center hover:border-blue-500 hover:bg-blue-500/5 hover:-translate-y-1 transition-all shadow-lg min-h-[100px] flex items-center justify-center group"
                                                        >
                                                            <span className="text-lg text-gray-300 font-medium group-hover:text-white transition-colors">{ans.answer_text}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {currentQuestion.type === 'select' && (
                                                <div className="max-w-md mx-auto">
                                                    <select
                                                        onChange={(e) => {
                                                            const selectedAns = currentQuestion.answers?.find(a => a.id === parseInt(e.target.value));
                                                            if (selectedAns) handleAnswerQuestion(currentQuestion, selectedAns.answer_text, selectedAns.id, selectedAns.next_question_id);
                                                        }}
                                                        className="w-full bg-slate-800 border-2 border-white/10 rounded-xl p-4 text-lg text-white appearance-none cursor-pointer hover:border-blue-500/50 transition-colors text-center focus:outline-none focus:border-blue-500 [&>option]:bg-slate-900"
                                                    >
                                                        <option value="" className="bg-slate-900 text-white">-- Bitte wählen --</option>
                                                        {currentQuestion.answers?.map(ans => (
                                                            <option key={ans.id} value={ans.id} className="bg-slate-900 text-white">{ans.answer_text}</option>
                                                        ))}
                                                    </select>
                                                    <div className="mt-4 flex justify-center text-gray-500">
                                                        <i className="fa-solid fa-chevron-down animate-bounce"></i>
                                                    </div>
                                                </div>
                                            )}

                                            {currentQuestion.type === 'slider' && (
                                                <div className="max-w-xl mx-auto bg-slate-800 border border-white/10 p-8 rounded-2xl shadow-lg">
                                                    <input
                                                        type="range"
                                                        min={currentQuestion.config?.min || 0}
                                                        max={currentQuestion.config?.max || 100}
                                                        step={currentQuestion.config?.step || 1}
                                                        defaultValue={currentQuestion.config?.min || 0}
                                                        onChange={(e) => {
                                                            document.getElementById('slider-val-display-proj').innerText = `${e.target.value} ${currentQuestion.unit || ''}`;
                                                        }}
                                                        id="temp-slider-proj"
                                                        className="w-full h-3 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500 mb-6"
                                                    />
                                                    <div id="slider-val-display-proj" className="text-4xl font-bold text-blue-400 mb-8">{currentQuestion.config?.min || 0} {currentQuestion.unit || ''}</div>
                                                    <button
                                                        onClick={() => {
                                                            const val = document.getElementById('temp-slider-proj').value;
                                                            // Pass nulls to trigger the fallback logic in handleAnswerQuestion
                                                            handleAnswerQuestion(currentQuestion, `${val} ${currentQuestion.unit || ''}`, null, null);
                                                        }}
                                                        className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-8 py-3 rounded-xl transition-colors shadow-lg w-full"
                                                    >Weiter</button>
                                                </div>
                                            )}

                                            {currentQuestion.type === 'input' && (
                                                <div className="space-y-4">
                                                    <input type="text" className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-4 text-white text-lg focus:border-blue-500 focus:outline-none text-center" placeholder="Wert eingeben..." onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const fallbackNext = currentQuestion.answers && currentQuestion.answers.length > 0 ? currentQuestion.answers[0].next_question_id : null;
                                                            handleAnswerQuestion(currentQuestion, e.target.value, null, fallbackNext);
                                                        }
                                                    }} />
                                                    <p className="text-center text-gray-500 text-sm">Drücken Sie Enter zum Bestätigen</p>
                                                </div>
                                            )}

                                            {currentQuestion.type === 'checkbox' && (
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-1 gap-3">
                                                        {currentQuestion.answers?.map(ans => {
                                                            const isSelected = checkboxSelections.some(s => s.id === ans.id);
                                                            return (
                                                                <button key={ans.id} onClick={() => {
                                                                    if (isSelected) setCheckboxSelections(prev => prev.filter(s => s.id !== ans.id));
                                                                    else setCheckboxSelections(prev => [...prev, ans]);
                                                                }} className={`p-4 rounded-xl border text-left font-medium transition-all flex items-center gap-3 ${isSelected ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-white/10 text-white hover:bg-slate-700'}`}>
                                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-500'}`}>
                                                                        {isSelected && <i className="fa-solid fa-check text-white text-xs"></i>}
                                                                    </div>
                                                                    {ans.answer_text}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                    <button onClick={submitCheckboxes} disabled={checkboxSelections.length === 0} className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-gray-500 text-white font-bold py-4 rounded-xl transition-all mt-6 shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:shadow-none">
                                                        Weiter
                                                    </button>
                                                </div>
                                            )}

                                            {(!currentQuestion.answers || currentQuestion.answers.length === 0) && currentQuestion.type !== 'input' && (
                                                <div className="text-center text-gray-400 mt-6 bg-white/5 border border-white/10 rounded-xl p-6">
                                                    <p className="mb-4">Es wurden noch keine Antworten für diese Frage konfiguriert.</p>
                                                    <button onClick={() => setStep(4)} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl border border-white/10 transition-colors">
                                                        Frage überspringen
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {catViewLevel !== 'main' && (
                                        <div className="flex justify-between items-center mt-10">
                                            <button onClick={() => setStep(4)} className="text-gray-500 hover:text-white px-4 py-2 text-sm transition-colors">Fragen überspringen</button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* STEP 4: ASSIGNMENTS (Users & Subcontractors) */}
                            {step === 4 && (
                                <div className="space-y-8 animate-[fadeIn_0.3s_ease-out] flex flex-col items-center">
                                    <h3 className="text-xl font-bold text-white mb-4 text-center">4. Projektbesetzung</h3>

                                    {/* INTERNAL USERS: PROJEKTLEITER */}
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 w-full max-w-4xl">
                                        <h4 className="text-lg font-medium text-white mb-4 flex items-center justify-center gap-2">
                                            <i className="fa-solid fa-user-tie text-blue-400"></i> Projektleiter
                                        </h4>
                                        <div className="space-y-4 mb-2 relative">
                                            <div className="bg-[#1e2336] border border-white/5 rounded-2xl p-6">
                                                <div className="flex gap-4 justify-center">
                                                    <div className="flex-1 max-w-md mx-auto">
                                                        <label className="block text-sm font-medium text-gray-400 mb-2 text-center">Person wählen</label>
                                                        <select value={treeTopUser} onChange={e => {
                                                            setTreeTopUser(e.target.value);
                                                            setTreeGL('');
                                                            setTreeWorker('');
                                                        }} className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-center [&>option]:bg-slate-900">
                                                            <option value="" className="bg-slate-900 text-white">-- Person wählen --</option>
                                                            {users.filter(u => u.role?.name?.toLowerCase() === 'projektleiter').map(u => (
                                                                <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                                                                    {u.name} {u.specialty ? `(${u.specialty})` : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="flex justify-center mt-4">
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (treeTopUser) {
                                                                const selectedUserObj = users.find(u => u.id === treeTopUser);
                                                                if (selectedUserObj && !assignedUsers.some(au => au.user_id === selectedUserObj.id)) {
                                                                    setAssignedUsers([...assignedUsers, { user_id: selectedUserObj.id, role: 'projektleiter' }]);
                                                                    setTreeTopUser('');
                                                                }
                                                            }
                                                        }}
                                                        disabled={!treeTopUser}
                                                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
                                                    >
                                                        Zum Projekt hinzufügen
                                                    </button>
                                                </div>
                                            </div>

                                            {/* List of Added Projektleiters */}
                                            {assignedUsers.filter(au => au.role === 'projektleiter').length > 0 && (
                                                <div className="space-y-3 mt-4">
                                                    {assignedUsers.filter(au => au.role === 'projektleiter').map(au => {
                                                        const u = users.find(user => user.id === au.user_id);
                                                        return u ? (
                                                            <div key={u.id} className="flex justify-between items-center bg-[#1e2336] border border-white/5 rounded-xl px-5 py-4">
                                                                <span className="text-white font-medium text-center block w-full">
                                                                    {u.name} {u.specialty && <span className="text-gray-400 font-normal ml-1">({u.specialty})</span>}
                                                                </span>
                                                                <button onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setAssignedUsers(assignedUsers.filter(x => x.user_id !== u.id));
                                                                }} className="text-red-400 hover:text-red-300 p-1 transition-colors">
                                                                    <i className="fa-solid fa-trash-can"></i>
                                                                </button>
                                                            </div>
                                                        ) : null;
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* INTERNAL USERS: GRUPPENLEITER */}
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 w-full max-w-4xl">
                                        <h4 className="text-lg font-medium text-white mb-4 flex items-center justify-center gap-2">
                                            <i className="fa-solid fa-users-gear text-emerald-400"></i> Gruppenleiter
                                        </h4>
                                        <div className="space-y-4 mb-2 relative">
                                            <div className="bg-[#1e2336] border border-white/5 rounded-2xl p-6">
                                                <div className="flex gap-4 justify-center">
                                                    <div className="flex-1 max-w-md mx-auto">
                                                        <label className="block text-sm font-medium text-gray-400 mb-2 text-center">Person wählen</label>
                                                        <select value={treeGL} onChange={e => {
                                                            setTreeGL(e.target.value);
                                                            setTreeWorker('');
                                                        }} className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-center [&>option]:bg-slate-900">
                                                            <option value="" className="bg-slate-900 text-white">-- Person wählen --</option>
                                                            {users.filter(u => u.role?.name?.toLowerCase() === 'gruppenleiter').map(u => (
                                                                <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                                                                    {u.name} {u.specialty ? `(${u.specialty})` : ''} - Manager: {users.find(m => m.id === u.manager_id)?.name || 'N/A'}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="flex justify-center mt-4">
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (treeGL) {
                                                                const selectedUserObj = users.find(u => u.id === treeGL);
                                                                if (selectedUserObj && !assignedUsers.some(au => au.user_id === selectedUserObj.id)) {
                                                                    setAssignedUsers([...assignedUsers, { user_id: selectedUserObj.id, role: 'gruppenleiter' }]);
                                                                    setTreeGL('');
                                                                }
                                                            }
                                                        }}
                                                        disabled={!treeGL}
                                                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
                                                    >
                                                        Zum Projekt hinzufügen
                                                    </button>
                                                </div>
                                            </div>

                                            {/* List of Added Gruppenleiters */}
                                            {assignedUsers.filter(au => au.role === 'gruppenleiter').length > 0 && (
                                                <div className="space-y-3 mt-4">
                                                    {assignedUsers.filter(au => au.role === 'gruppenleiter').map(au => {
                                                        const u = users.find(user => user.id === au.user_id);
                                                        return u ? (
                                                            <div key={u.id} className="flex justify-between items-center bg-[#1e2336] border border-white/5 rounded-xl px-5 py-4">
                                                                <span className="text-white font-medium text-center block w-full">
                                                                    {u.name} {u.specialty && <span className="text-gray-400 font-normal ml-1">({u.specialty})</span>}
                                                                    <span className="text-gray-500 font-normal text-xs block">Manager: {users.find(m => m.id === u.manager_id)?.name || 'N/A'}</span>
                                                                </span>
                                                                <button onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setAssignedUsers(assignedUsers.filter(x => x.user_id !== u.id));
                                                                }} className="text-red-400 hover:text-red-300 p-1 transition-colors">
                                                                    <i className="fa-solid fa-trash-can"></i>
                                                                </button>
                                                            </div>
                                                        ) : null;
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* INTERNAL USERS: MITARBEITER */}
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 w-full max-w-4xl">
                                        <h4 className="text-lg font-medium text-white mb-4 flex items-center justify-center gap-2">
                                            <i className="fa-solid fa-hard-hat text-yellow-500"></i> Mitarbeiter (Worker)
                                        </h4>
                                        <div className="space-y-4 mb-2 relative">
                                            <div className="bg-[#1e2336] border border-white/5 rounded-2xl p-6">
                                                <div className="flex gap-4 justify-center">
                                                    <div className="flex-1 max-w-md mx-auto">
                                                        <label className="block text-sm font-medium text-gray-400 mb-2 text-center">Person wählen</label>
                                                        <select value={treeWorker} onChange={e => setTreeWorker(e.target.value)} className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 text-center [&>option]:bg-slate-900">
                                                            <option value="" className="bg-slate-900 text-white">-- Person wählen --</option>
                                                            {users.filter(u => u.role?.name?.toLowerCase() === 'worker').map(u => (
                                                                <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                                                                    {u.name} {u.specialty ? `(${u.specialty})` : ''} - Manager: {users.find(m => m.id === u.manager_id)?.name || 'N/A'}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="flex justify-center mt-4">
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (treeWorker) {
                                                                const selectedUserObj = users.find(u => u.id === treeWorker);
                                                                if (selectedUserObj && !assignedUsers.some(au => au.user_id === selectedUserObj.id)) {
                                                                    setAssignedUsers([...assignedUsers, { user_id: selectedUserObj.id, role: 'worker' }]);
                                                                    setTreeWorker('');
                                                                }
                                                            }
                                                        }}
                                                        disabled={!treeWorker}
                                                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
                                                    >
                                                        Zum Projekt hinzufügen
                                                    </button>
                                                </div>
                                            </div>

                                            {/* List of Added Workers */}
                                            {assignedUsers.filter(au => au.role === 'worker').length > 0 && (
                                                <div className="space-y-3 mt-4">
                                                    {assignedUsers.filter(au => au.role === 'worker').map(au => {
                                                        const u = users.find(user => user.id === au.user_id);
                                                        return u ? (
                                                            <div key={u.id} className="flex justify-between items-center bg-[#1e2336] border border-white/5 rounded-xl px-5 py-4">
                                                                <span className="text-white font-medium text-center block w-full">
                                                                    {u.name} {u.specialty && <span className="text-gray-400 font-normal ml-1">({u.specialty})</span>}
                                                                    <span className="text-gray-500 font-normal text-xs block">Manager: {users.find(m => m.id === u.manager_id)?.name || 'N/A'}</span>
                                                                </span>
                                                                <button onClick={(e) => {
                                                                    e.preventDefault();
                                                                    setAssignedUsers(assignedUsers.filter(x => x.user_id !== u.id));
                                                                }} className="text-red-400 hover:text-red-300 p-1 transition-colors">
                                                                    <i className="fa-solid fa-trash-can"></i>
                                                                </button>
                                                            </div>
                                                        ) : null;
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* SUBCONTRACTORS */}
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 w-full max-w-4xl">
                                        <h4 className="text-lg font-medium text-white mb-4 flex items-center justify-center gap-2">
                                            <i className="fa-solid fa-helmet-safety text-amber-400"></i> Nachunternehmer
                                        </h4>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 justify-center">
                                            {subcontractors.map(sub => {
                                                const isAssigned = assignedSubcontractors.includes(sub.id);
                                                return (
                                                    <button
                                                        key={sub.id}
                                                        onClick={() => toggleSubcontractor(sub.id)}
                                                        className={`p-3 rounded-xl border text-center transition-all ${isAssigned ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-slate-800 border-white/10 text-gray-400 hover:bg-slate-700 hover:text-white'}`}
                                                    >
                                                        <div className="flex justify-center items-center gap-2 mb-1">
                                                            <span className="font-bold">{sub.name}</span>
                                                            {isAssigned && <i className="fa-solid fa-check-circle text-amber-500"></i>}
                                                        </div>
                                                        <div className="text-xs opacity-70">{sub.trade}</div>
                                                    </button>
                                                );
                                            })}
                                            {subcontractors.length === 0 && <span className="text-gray-500 col-span-3 text-center">Keine Nachunternehmer gefunden.</span>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 5: PHOTOS & DOCS */}
                            {step === 5 && (
                                <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] flex flex-col items-center">
                                    <h3 className="text-xl font-bold text-white mb-4 text-center">5. Fotos & Dokumente (Optional)</h3>

                                    {/* Main/Cover Photo Section */}
                                    <div className="w-full max-w-3xl mb-4 text-center">
                                        <h4 className="text-sm font-medium text-blue-400/80 mb-3 uppercase tracking-wider">Haupt-Vorschaubild (obligatorisch)</h4>
                                        <div
                                            onClick={() => document.getElementById('mainImageUpload').click()}
                                            className={`relative group border-2 border-dashed rounded-2xl p-4 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[180px] overflow-hidden ${mainPhoto ? 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60' : 'border-white/10 bg-white/5 hover:border-blue-500/40 hover:bg-white/[0.07]'}`}
                                        >
                                            <input
                                                type="file"
                                                id="mainImageUpload"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    if (e.target.files && e.target.files[0]) {
                                                        setMainPhoto(e.target.files[0]);
                                                    }
                                                }}
                                            />

                                            {mainPhoto ? (
                                                <div className="flex flex-col items-center">
                                                    <div className="relative">
                                                        <img
                                                            src={URL.createObjectURL(mainPhoto)}
                                                            alt="Hauptbild Vorschau"
                                                            className="max-h-32 rounded-xl shadow-2xl transition-transform group-hover:scale-105"
                                                        />
                                                        <div className="absolute -top-2 -right-2 bg-emerald-500 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-slate-900">
                                                            <i className="fa-solid fa-check text-[10px]"></i>
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 text-emerald-400 text-sm font-medium">{mainPhoto.name}</div>
                                                    <div className="text-xs text-gray-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Klicken zum Ändern</div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 text-xl mb-3 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                                                        <i className="fa-solid fa-image"></i>
                                                    </div>
                                                    <p className="text-white font-medium">Hauptbild für dieses Projekt auswählen</p>
                                                    <p className="text-gray-400 text-xs mt-1 max-w-[200px] leading-relaxed">Dieses Bild wird als Vorschaubild in der Projektliste und auf dem Dashboard verwendet.</p>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="w-full max-w-3xl">
                                        <h4 className="text-sm font-medium text-gray-500 mb-3 text-center uppercase tracking-wider">Weitere Bilder & Dokumente</h4>
                                        <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center bg-white/5 hover:bg-white/[0.07] hover:border-blue-500/30 transition-all cursor-pointer" onClick={() => document.getElementById('fileUpload').click()}>
                                            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 text-xl mx-auto mb-3">
                                                <i className="fa-solid fa-cloud-arrow-up"></i>
                                            </div>
                                            <h4 className="text-white text-sm font-medium mb-1">Mehrere Dateien hinzufügen</h4>
                                            <p className="text-gray-400 text-xs">Standardfotos, Berichte, PDF-Dokumentе.</p>
                                            <input type="file" id="fileUpload" multiple className="hidden" onChange={handleFileChange} />
                                        </div>
                                    </div>

                                    {photos.length > 0 && (
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 w-full max-w-3xl">
                                            <h4 className="text-white font-medium mb-4 text-center">Ausgewählte Dateien ({photos.length})</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                {photos.map((file, i) => (
                                                    <div key={i} className="bg-slate-800 border border-white/10 rounded-lg p-3 flex justify-between items-center group">
                                                        <div className="truncate text-sm text-gray-300 mr-3 flex items-center gap-2">
                                                            <i className="fa-regular fa-image text-gray-500"></i>
                                                            <span className="truncate max-w-[120px]">{file.name}</span>
                                                        </div>
                                                        <button onClick={() => removePhoto(i)} className="text-red-400 hover:text-red-300 w-6 h-6 rounded bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <i className="fa-solid fa-xmark text-xs"></i>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-6 border-t border-white/10 bg-white/5 flex justify-between items-center rounded-b-2xl">
                    {step > 1 ? (
                        <button onClick={() => setStep(step - 1)} className="text-gray-300 hover:text-white px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors font-medium">Zurück</button>
                    ) : <div></div>}

                    {step === 1 && <button onClick={handleNextStep1} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] font-bold">Weiter</button>}
                    {step === 2 && <button onClick={handleNextStep2} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] font-bold">Weiter</button>}
                    {/* Step 3 advances automatically unless they click skip, but we put a manual 'Weiter' if they are stuck or want to skip */}
                    {step === 3 && <button onClick={() => setStep(4)} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] font-bold">Weiter</button>}
                    {step === 4 && <button onClick={() => setStep(5)} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] font-bold">Weiter</button>}

                    {step === 5 && (
                        <button onClick={handleSubmit} disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_25px_rgba(16,185,129,0.6)] font-bold disabled:opacity-50 flex items-center gap-2 text-lg">
                            {isSubmitting ? <><i className="fa-solid fa-spinner fa-spin"></i> Speichere...</> : <><i className="fa-solid fa-check"></i> Projekt anlegen</>}
                        </button>
                    )}
                </div>

            </div >
        </div >
    );
};

export default ProjectWizard;
