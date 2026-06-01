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
    const [selectedCategories, setSelectedCategories] = useState([]); // [{ category_id, subcategory_id }]
    const [dynamicAnswers, setDynamicAnswers] = useState({});
    const [checkboxSelections, setCheckboxSelections] = useState([]);
    const [expandedCategoryQuestions, setExpandedCategoryQuestions] = useState({}); // { [category_id]: boolean }

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
    const [isClientSelectOpen, setIsClientSelectOpen] = useState(false);
    const [isClientTypeSelectOpen, setIsClientTypeSelectOpen] = useState(false);
    const [isTopUserSelectOpen, setIsTopUserSelectOpen] = useState(false);
    const [isGLSelectOpen, setIsGLSelectOpen] = useState(false);
    const [isWorkerSelectOpen, setIsWorkerSelectOpen] = useState(false);

    // Dynamic Client-Custom Project Fields
    const [showAdditionalClient, setShowAdditionalClient] = useState(false);
    const [clientFirstName, setClientFirstName] = useState('');
    const [clientLastName, setClientLastName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [clientAddress, setClientAddress] = useState('');
    const [clientNotes, setClientNotes] = useState('');

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
            setSelectedCategories([]);
            setExpandedCategoryQuestions({});
            setMainPhoto(null);
            setPhotos([]);
            
            setShowAdditionalClient(false);
            setClientFirstName('');
            setClientLastName('');
            setClientPhone('');
            setClientEmail('');
            setClientAddress('');
            setClientNotes('');
            setIsClientSelectOpen(false);
            setIsClientTypeSelectOpen(false);
            setIsTopUserSelectOpen(false);
            setIsGLSelectOpen(false);
            setIsWorkerSelectOpen(false);

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

                let fName = '';
                let lName = '';
                if (initialData.contact_name) {
                    const nameParts = initialData.contact_name.trim().split(/\s+/);
                    if (nameParts.length > 1) {
                        fName = nameParts[0];
                        lName = nameParts.slice(1).join(' ');
                    } else {
                        fName = nameParts[0];
                    }
                    setShowAdditionalClient(true);
                }
                setClientFirstName(fName);
                setClientLastName(lName);
                setClientPhone(initialData.contact_phone || '');
                setClientEmail(initialData.contact_email || '');
                setClientAddress(initialData.location || '');
                setClientNotes('');

                // Set answers if available
                if (initialData.answers && initialData.answers.length > 0) {
                    const presetAnswers = {};
                    initialData.answers.forEach(ans => {
                        presetAnswers[ans.question_id] = { value: ans.answer_value, answerId: ans.answer_id };
                    });
                    setDynamicAnswers(presetAnswers);
                }

                if (initialData.category_id) {
                    setSelectedCategories([{
                        category_id: parseInt(initialData.category_id),
                        subcategory_id: initialData.subcategory_id ? parseInt(initialData.subcategory_id) : ''
                    }]);
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
            
            const firstCategory = selectedCategories[0];
            formData.append('category_id', firstCategory?.category_id || '');
            formData.append('subcategory_id', firstCategory?.subcategory_id || '');
            formData.append('categories_json', JSON.stringify(selectedCategories));

            // Append custom client fields
            formData.append('client_first_name', showAdditionalClient ? (clientFirstName || '') : '');
            formData.append('client_last_name', showAdditionalClient ? (clientLastName || '') : '');
            formData.append('client_phone', showAdditionalClient ? (clientPhone || '') : '');
            formData.append('client_email', showAdditionalClient ? (clientEmail || '') : '');
            formData.append('client_address', showAdditionalClient ? (clientAddress || '') : '');
            formData.append('client_notes', showAdditionalClient ? (clientNotes || '') : '');

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
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsClientSelectOpen(!isClientSelectOpen)}
                                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors flex items-center justify-between text-center"
                                                >
                                                    <span className="w-full text-center">
                                                        {selectedClientId 
                                                            ? (() => {
                                                                const c = clients.find(cl => String(cl.id) === String(selectedClientId));
                                                                return c ? `${c.name} ${c.contact_person ? `(${c.contact_person})` : ''}` : '-- Bitte wählen --';
                                                              })()
                                                            : '-- Bitte wählen --'}
                                                    </span>
                                                    <i className={`fa-solid fa-chevron-down text-gray-500 text-xs transition-transform duration-200 ${isClientSelectOpen ? 'rotate-180' : ''}`}></i>
                                                </button>

                                                {isClientSelectOpen && (
                                                    <>
                                                        <div 
                                                            className="fixed inset-0 z-40" 
                                                            onClick={() => setIsClientSelectOpen(false)}
                                                        />
                                                        <div className="absolute left-0 right-0 mt-2 bg-[#121212]/95 border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto py-1.5 backdrop-blur-md animate-[fadeIn_0.15s_ease-out] custom-scrollbar text-left">
                                                            {clients.map(c => (
                                                                <button
                                                                    key={c.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedClientId(c.id.toString());
                                                                        setIsClientSelectOpen(false);
                                                                    }}
                                                                    className={`w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors truncate ${String(selectedClientId) === String(c.id) ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                                >
                                                                    {c.name} {c.contact_person ? `(${c.contact_person})` : ''}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-4 mt-6 max-w-2xl mx-auto">
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="block text-sm font-medium text-gray-400 mb-2 text-center">Firma / Name <span className="text-red-400">*</span></label>
                                                <input type="text" value={newClientData.name} onChange={e => setNewClientData({ ...newClientData, name: e.target.value })} className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none text-center" placeholder="Name..." />
                                            </div>
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="block text-sm font-medium text-gray-400 mb-2 text-center">Kundentyp</label>
                                                <div className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsClientTypeSelectOpen(!isClientTypeSelectOpen)}
                                                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors flex items-center justify-between text-center"
                                                    >
                                                        <span className="w-full text-center">
                                                            {newClientData.type === 'company' ? 'Firma' : 'Privatperson'}
                                                        </span>
                                                        <i className={`fa-solid fa-chevron-down text-gray-500 text-xs transition-transform duration-200 ${isClientTypeSelectOpen ? 'rotate-180' : ''}`}></i>
                                                    </button>

                                                    {isClientTypeSelectOpen && (
                                                        <>
                                                            <div 
                                                                className="fixed inset-0 z-40" 
                                                                onClick={() => setIsClientTypeSelectOpen(false)}
                                                            />
                                                            <div className="absolute left-0 right-0 mt-2 bg-[#121212]/95 border border-white/10 rounded-xl shadow-2xl z-50 py-1.5 backdrop-blur-md animate-[fadeIn_0.15s_ease-out] text-left">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setNewClientData({ ...newClientData, type: 'company' });
                                                                        setIsClientTypeSelectOpen(false);
                                                                    }}
                                                                    className={`w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors ${newClientData.type === 'company' ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                                >
                                                                    Firma
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setNewClientData({ ...newClientData, type: 'private' });
                                                                        setIsClientTypeSelectOpen(false);
                                                                    }}
                                                                    className={`w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors ${newClientData.type === 'private' ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                                >
                                                                    Privatperson
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
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

                                    {/* Toggle Additional Client Form */}
                                    <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 mt-6 select-none w-full max-w-2xl mx-auto">
                                        <div className="flex flex-col text-left">
                                            <span className="text-sm font-semibold text-white">Abweichender Ansprechpartner / Endkunde</span>
                                            <span className="text-xs text-gray-400">Falls die Arbeit für einen abweichenden Endkunden ausgeführt wird</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const nextState = !showAdditionalClient;
                                                setShowAdditionalClient(nextState);
                                            }}
                                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${showAdditionalClient ? 'bg-emerald-500' : 'bg-white/10'}`}
                                        >
                                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${showAdditionalClient ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>

                                    {/* Per-Project Client / Auftraggeber Details */}
                                    {showAdditionalClient && (
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4 mt-4 animate-[fadeIn_0.3s_ease-out] w-full max-w-2xl mx-auto text-left">
                                            <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                                <h4 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                                                    <i className="fa-solid fa-user-tie"></i> Ansprechpartner & Endkunde für dieses Projekt
                                                </h4>
                                                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full uppercase tracking-wider">Spezifisch</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs text-gray-400 block mb-1">Vorname</label>
                                                    <input
                                                        type="text"
                                                        value={clientFirstName}
                                                        onChange={e => setClientFirstName(e.target.value)}
                                                        className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:border-emerald-500 transition-colors"
                                                        placeholder="z.B. Max"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-400 block mb-1">Nachname</label>
                                                    <input
                                                        type="text"
                                                        value={clientLastName}
                                                        onChange={e => setClientLastName(e.target.value)}
                                                        className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:border-emerald-500 transition-colors"
                                                        placeholder="z.B. Mustermann"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-400 block mb-1">Telefonnummer</label>
                                                    <input
                                                        type="text"
                                                        value={clientPhone}
                                                        onChange={e => setClientPhone(e.target.value)}
                                                        className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:border-emerald-500 transition-colors"
                                                        placeholder="z.B. +49 123 456789"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-400 block mb-1">E-Mail-Adresse</label>
                                                    <input
                                                        type="email"
                                                        value={clientEmail}
                                                        onChange={e => setClientEmail(e.target.value)}
                                                        className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:border-emerald-500 transition-colors"
                                                        placeholder="z.B. info@firma.de"
                                                    />
                                                </div>
                                                <div className="col-span-1 md:col-span-2">
                                                    <label className="text-xs text-gray-400 block mb-1">Adresse</label>
                                                    <input
                                                        type="text"
                                                        value={clientAddress}
                                                        onChange={e => setClientAddress(e.target.value)}
                                                        className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:border-emerald-500 transition-colors"
                                                        placeholder="Straße, Hausnummer, PLZ, Ort"
                                                    />
                                                </div>
                                                <div className="col-span-1 md:col-span-2">
                                                    <label className="text-xs text-gray-400 block mb-1">Kunden-Notizen / Bemerkungen (intern)</label>
                                                    <textarea
                                                        value={clientNotes}
                                                        onChange={e => setClientNotes(e.target.value)}
                                                        rows="2"
                                                        className="w-full bg-slate-800 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:border-emerald-500 transition-colors resize-none"
                                                        placeholder="Besondere Absprachen, Wünsche oder Anforderungen des Auftraggebers..."
                                                    />
                                                </div>
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

                            {/* STEP 3: CATEGORIES & SPECIFICATIONS */}
                            {step === 3 && (
                                <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] w-full max-w-4xl mx-auto text-left">
                                    <h3 className="text-xl font-bold text-white mb-4 text-center">3. Kategorisierung & Spezifikationen</h3>

                                    {/* Multi-Category Selection Grid */}
                                    <div className="space-y-4">
                                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block text-center md:text-left">Kategorien auswählen</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                            {categories.map(c => {
                                                const isSelected = selectedCategories.some(sc => sc.category_id === c.id);
                                                return (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setSelectedCategories(prev => prev.filter(sc => sc.category_id !== c.id));
                                                            } else {
                                                                setSelectedCategories(prev => [...prev, { category_id: c.id, subcategory_id: '' }]);
                                                            }
                                                        }}
                                                        className={`p-4 rounded-xl border text-left font-medium transition-all flex items-start gap-3 ${isSelected ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800/40 border-white/10 text-white hover:bg-slate-800'}`}
                                                    >
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 mt-0.5 ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-500'}`}>
                                                            {isSelected && <i className="fa-solid fa-check text-white text-xs"></i>}
                                                        </div>
                                                        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <i className={`fa-solid ${c.icon || 'fa-folder'} text-base shrink-0 ${isSelected ? 'text-blue-400' : 'text-gray-400'}`}></i>
                                                                <span className="text-sm font-semibold text-gray-200 truncate">{c.name}</span>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                {c.target === 'admin' && (
                                                                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1 w-fit">
                                                                        <i className="fa-solid fa-lock text-[8px]"></i> Admin-Panel
                                                                    </span>
                                                                )}
                                                                {c.target === 'site' && (
                                                                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20 flex items-center gap-1 w-fit">
                                                                        <i className="fa-solid fa-globe text-[8px]"></i> Website
                                                                    </span>
                                                                )}
                                                                {c.target === 'both' && (
                                                                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 flex items-center gap-1 w-fit">
                                                                        <i className="fa-solid fa-circle-check text-[8px]"></i> Beide
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Selected Categories with Subcategory Dropdowns */}
                                    {selectedCategories.length > 0 && (
                                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 animate-[fadeIn_0.3s_ease-out] mt-6">
                                            <h4 className="text-sm font-semibold text-blue-400 flex items-center gap-2 border-b border-white/10 pb-2">
                                                <i className="fa-solid fa-layer-group"></i> Unterkategorien zuweisen
                                            </h4>
                                            <div className="space-y-4">
                                                {Array.from(new Set(selectedCategories.map(sc => sc.category_id))).map(catId => {
                                                    const category = categories.find(c => c.id === catId);
                                                    if (!category) return null;

                                                    const items = selectedCategories.filter(sc => sc.category_id === catId);
                                                    const selectedSubIds = items.map(item => item.subcategory_id).filter(id => id !== '');

                                                    // Helper to get questions for this category and all selected subcategories combo
                                                    const getCategoryQuestions = () => {
                                                        let qList = [...(category.questions || [])];
                                                        selectedSubIds.forEach(subId => {
                                                            const sub = category.subcategories?.find(s => s.id === subId);
                                                            if (sub && sub.questions) {
                                                                qList = [...qList, ...sub.questions];
                                                            }
                                                        });
                                                        const seen = new Set();
                                                        return qList.filter(q => {
                                                            if (seen.has(q.id)) return false;
                                                            seen.add(q.id);
                                                            return true;
                                                        });
                                                    };

                                                    const qList = getCategoryQuestions();
                                                    const answeredCount = qList.filter(q => !!dynamicAnswers[q.id]?.value).length;
                                                    const isExpanded = !!expandedCategoryQuestions[catId];

                                                    return (
                                                        <div key={catId} className="bg-slate-800/40 p-4 rounded-xl border border-white/5 space-y-4 animate-[fadeIn_0.2s_ease-out]">
                                                            {/* Card Header Row */}
                                                            <div className="flex flex-col gap-4">
                                                                <div className="flex justify-between items-center">
                                                                    <div className="font-semibold text-white flex items-center gap-2 text-sm">
                                                                        <i className={`fa-solid ${category.icon || 'fa-folder'} text-blue-400`}></i>
                                                                        {category.name}
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setSelectedCategories(prev => prev.filter(item => item.category_id !== catId))}
                                                                        className="text-gray-400 hover:text-red-400 transition-colors p-1"
                                                                    >
                                                                        <i className="fa-solid fa-trash-can text-sm"></i>
                                                                    </button>
                                                                </div>

                                                                {/* Subcategories checklist */}
                                                                {category.subcategories && category.subcategories.length > 0 && (
                                                                    <div className="space-y-2">
                                                                        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Unterkategorien auswählen:</label>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {category.subcategories.map(sub => {
                                                                                const isSubSelected = selectedSubIds.includes(sub.id);
                                                                                return (
                                                                                    <button
                                                                                        key={sub.id}
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            if (isSubSelected) {
                                                                                                // Toggle off
                                                                                                setSelectedCategories(prev => {
                                                                                                    const filtered = prev.filter(sc => !(sc.category_id === catId && sc.subcategory_id === sub.id));
                                                                                                    const hasOtherSubs = filtered.some(sc => sc.category_id === catId);
                                                                                                    if (!hasOtherSubs) {
                                                                                                        return [...filtered, { category_id: catId, subcategory_id: '' }];
                                                                                                    }
                                                                                                    return filtered;
                                                                                                });
                                                                                            } else {
                                                                                                // Toggle on
                                                                                                setSelectedCategories(prev => {
                                                                                                    const clean = prev.filter(sc => !(sc.category_id === catId && sc.subcategory_id === ''));
                                                                                                    return [...clean, { category_id: catId, subcategory_id: sub.id }];
                                                                                                });
                                                                                            }
                                                                                        }}
                                                                                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all flex items-center gap-2 ${isSubSelected ? 'bg-teal-500/20 border-teal-500 text-teal-300' : 'bg-black/40 border-white/10 text-gray-300 hover:border-teal-500/30'}`}
                                                                                    >
                                                                                        <i className={`fa-solid ${isSubSelected ? 'fa-square-check text-teal-400' : 'fa-square text-gray-500'}`}></i>
                                                                                        {sub.name}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Accordion Toggle (only show if there are questions) */}
                                                            {qList.length > 0 && (
                                                                <div className="pt-2 border-t border-white/5 flex items-center justify-center gap-4">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setExpandedCategoryQuestions(prev => ({ ...prev, [catId]: !isExpanded }))}
                                                                        className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1.5 transition-colors"
                                                                    >
                                                                        <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                                                                        {isExpanded ? 'Spezifische Fragen schließen' : `Spezifische Fragen beantworten (${answeredCount}/${qList.length} beantwortet)`}
                                                                    </button>
                                                                    {answeredCount > 0 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                if (window.confirm("Möchten Sie wirklich alle Antworten für diese Kategorie zurücksetzen?")) {
                                                                                    setDynamicAnswers(prev => {
                                                                                        const copy = { ...prev };
                                                                                        qList.forEach(q => delete copy[q.id]);
                                                                                        return copy;
                                                                                    });
                                                                                }
                                                                            }}
                                                                            className="text-[10px] text-red-400 hover:text-red-300 font-bold flex items-center gap-1.5 transition-colors border border-red-500/20 bg-red-500/5 px-2.5 py-1 rounded-lg"
                                                                        >
                                                                            <i className="fa-solid fa-trash-can"></i>
                                                                            Antworten zurücksetzen
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Expanded Questions Form */}
                                                            {isExpanded && qList.length > 0 && (
                                                                <div className="space-y-4 pt-3 border-t border-white/5 animate-[slideDown_0.2s_ease-out]">
                                                                    {qList.map(q => {
                                                                        return (
                                                                            <div key={q.id} className="bg-slate-900 border border-white/5 p-3.5 rounded-lg space-y-2">
                                                                                <div className="flex justify-between items-center mb-1">
                                                                                    <label className="block text-xs font-bold text-gray-300">{q.question_text}</label>
                                                                                    {dynamicAnswers[q.id] && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => setDynamicAnswers(prev => {
                                                                                                const copy = { ...prev };
                                                                                                delete copy[q.id];
                                                                                                return copy;
                                                                                            })}
                                                                                            className="text-[10px] text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1 font-semibold"
                                                                                        >
                                                                                            <i className="fa-solid fa-rotate-left"></i> Auswahl aufheben
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                                
                                                                                {/* 1. BUTTONS/RADIO (Default) */}
                                                                                {(!q.type || q.type === 'buttons' || q.type === 'radio') && (
                                                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                                                                                        {q.answers?.map(ans => {
                                                                                            const isSelected = dynamicAnswers[q.id]?.answerId === ans.id;
                                                                                            return (
                                                                                                <button
                                                                                                    key={ans.id}
                                                                                                    type="button"
                                                                                                    onClick={() => setDynamicAnswers(prev => ({ ...prev, [q.id]: { value: ans.answer_text, answerId: ans.id } }))}
                                                                                                    className={`p-2 rounded-lg border text-[10px] text-center font-medium transition-all ${isSelected ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.15)]' : 'bg-black/40 border-white/10 text-gray-300 hover:border-blue-500/30'}`}
                                                                                                >
                                                                                                    {ans.answer_text}
                                                                                                </button>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                )}

                                                                                {/* 2. SELECT */}
                                                                                {q.type === 'select' && (
                                                                                    <select
                                                                                        value={dynamicAnswers[q.id]?.answerId || ''}
                                                                                        onChange={e => {
                                                                                            const ansId = parseInt(e.target.value);
                                                                                            const ans = q.answers?.find(a => a.id === ansId);
                                                                                            if (ans) {
                                                                                                setDynamicAnswers(prev => ({ ...prev, [q.id]: { value: ans.answer_text, answerId: ansId } }));
                                                                                            } else {
                                                                                                setDynamicAnswers(prev => {
                                                                                                    const copy = { ...prev };
                                                                                                    delete copy[q.id];
                                                                                                    return copy;
                                                                                                });
                                                                                            }
                                                                                        }}
                                                                                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 mt-2 [&>option]:bg-slate-900"
                                                                                    >
                                                                                        <option value="">-- Bitte wählen --</option>
                                                                                        {q.answers?.map(ans => (
                                                                                            <option key={ans.id} value={ans.id}>{ans.answer_text}</option>
                                                                                        ))}
                                                                                    </select>
                                                                                )}

                                                                                {/* 3. SLIDER */}
                                                                                {q.type === 'slider' && (
                                                                                    <div className="space-y-2 mt-2">
                                                                                        <div className="flex justify-between items-center text-xs">
                                                                                            <span className="text-gray-400">Wert wählen:</span>
                                                                                            <span className="text-blue-400 font-bold font-mono">
                                                                                                {dynamicAnswers[q.id]?.value || `${q.config?.min || 0} ${q.unit || ''}`}
                                                                                            </span>
                                                                                        </div>
                                                                                        <input
                                                                                            type="range"
                                                                                            min={q.config?.min || 0}
                                                                                            max={q.config?.max || 100}
                                                                                            step={q.config?.step || 1}
                                                                                            value={parseInt(dynamicAnswers[q.id]?.value) || q.config?.min || 0}
                                                                                            onChange={e => {
                                                                                                const val = e.target.value;
                                                                                                setDynamicAnswers(prev => ({ ...prev, [q.id]: { value: `${val} ${q.unit || ''}`, answerId: null } }));
                                                                                            }}
                                                                                            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                                                        />
                                                                                    </div>
                                                                                )}

                                                                                {/* 4. INPUT */}
                                                                                {q.type === 'input' && (
                                                                                    <input
                                                                                        type="text"
                                                                                        value={dynamicAnswers[q.id]?.value || ''}
                                                                                        onChange={e => {
                                                                                            const val = e.target.value;
                                                                                            setDynamicAnswers(prev => ({ ...prev, [q.id]: { value: val, answerId: null } }));
                                                                                        }}
                                                                                        placeholder="Wert eingeben..."
                                                                                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 mt-2"
                                                                                    />
                                                                                )}

                                                                                {/* 5. CHECKBOX */}
                                                                                {q.type === 'checkbox' && (
                                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                                                                        {q.answers?.map(ans => {
                                                                                            const currentVal = dynamicAnswers[q.id]?.value || '';
                                                                                            const selectedValues = currentVal ? currentVal.split(', ') : [];
                                                                                            const isChecked = selectedValues.includes(ans.answer_text);
                                                                                            return (
                                                                                                <button
                                                                                                    key={ans.id}
                                                                                                    type="button"
                                                                                                    onClick={() => {
                                                                                                        let nextValues;
                                                                                                        if (isChecked) {
                                                                                                            nextValues = selectedValues.filter(v => v !== ans.answer_text);
                                                                                                        } else {
                                                                                                            nextValues = [...selectedValues, ans.answer_text];
                                                                                                        }
                                                                                                        if (nextValues.length > 0) {
                                                                                                            setDynamicAnswers(prev => ({ ...prev, [q.id]: { value: nextValues.join(', '), answerId: null } }));
                                                                                                        } else {
                                                                                                            setDynamicAnswers(prev => {
                                                                                                                const copy = { ...prev };
                                                                                                                delete copy[q.id];
                                                                                                                return copy;
                                                                                                            });
                                                                                                        }
                                                                                                    }}
                                                                                                    className={`p-2 rounded-lg border text-left text-[10px] transition-all flex items-center gap-2 ${isChecked ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-black/40 border-white/10 text-gray-300'}`}
                                                                                                >
                                                                                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-blue-500 border-blue-500' : 'border-gray-500'}`}>
                                                                                                        {isChecked && <i className="fa-solid fa-check text-white text-[8px]"></i>}
                                                                                                    </div>
                                                                                                    <span className="truncate">{ans.answer_text}</span>
                                                                                                </button>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Summary of Questions from Inquiry */}
                                    {Object.keys(dynamicAnswers).length > 0 && (
                                        <div className="bg-purple-900/20 border border-purple-500/30 p-6 rounded-2xl mt-6">
                                            <h4 className="text-purple-300 font-semibold mb-2 flex items-center gap-2">
                                                <i className="fa-solid fa-check-circle"></i> Antworten aus der Anfrage übernommen
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                                {Object.keys(dynamicAnswers).map(qId => {
                                                    let qText = "Frage " + qId;
                                                    let subName = "";
                                                    categories.forEach(c => {
                                                        c.questions?.forEach(q => { if (q.id === parseInt(qId)) qText = q.question_text });
                                                        c.subcategories?.forEach(s => {
                                                            s.questions?.forEach(q => {
                                                                if (q.id === parseInt(qId)) {
                                                                    qText = q.question_text;
                                                                    subName = s.name;
                                                                }
                                                            });
                                                        });
                                                    })
                                                    return (
                                                        <div key={qId} className="bg-black/30 p-3 rounded-xl text-sm border border-white/5">
                                                            <div className="text-gray-400 text-xs mb-1 flex justify-between items-center">
                                                                <span className="truncate max-w-[70%]">{qText}</span>
                                                                {subName && <span className="bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">{subName}</span>}
                                                            </div>
                                                            <div className="text-white font-medium">{dynamicAnswers[qId].value}</div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {selectedCategories.length === 0 && (
                                        <div className="text-center py-10 text-gray-500 text-sm">
                                            <i className="fa-solid fa-circle-info text-blue-400 mr-2 text-base"></i>
                                            Wählen Sie mindestens eine Kategorie aus, um fortzufahren.
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
                                                        <div className="relative">
                                                            <button
                                                                type="button"
                                                                onClick={() => setIsTopUserSelectOpen(!isTopUserSelectOpen)}
                                                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors flex items-center justify-between text-center"
                                                            >
                                                                <span className="w-full text-center">
                                                                    {treeTopUser
                                                                        ? (() => {
                                                                            const u = users.find(usr => String(usr.id) === String(treeTopUser));
                                                                            return u ? `${u.name} ${u.specialty ? `(${u.specialty})` : ''} (${u.role?.name || 'Keine Rolle'})` : '-- Person wählen --';
                                                                          })()
                                                                        : '-- Person wählen --'}
                                                                </span>
                                                                <i className={`fa-solid fa-chevron-down text-gray-500 text-xs transition-transform duration-200 ${isTopUserSelectOpen ? 'rotate-180' : ''}`}></i>
                                                            </button>

                                                            {isTopUserSelectOpen && (
                                                                <>
                                                                    <div 
                                                                        className="fixed inset-0 z-40" 
                                                                        onClick={() => setIsTopUserSelectOpen(false)}
                                                                    />
                                                                    <div className="absolute left-0 right-0 mt-2 bg-[#121212]/95 border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto py-1.5 backdrop-blur-md animate-[fadeIn_0.15s_ease-out] custom-scrollbar text-left">
                                                                        {users.filter(u => {
                                                                            const roleName = u.role?.name?.toLowerCase();
                                                                            return roleName === 'projektleiter' || roleName === 'pl' || roleName === 'admin' || roleName === 'büro' || roleName === 'buero';
                                                                        }).map(u => (
                                                                            <button
                                                                                key={u.id}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setTreeTopUser(u.id.toString());
                                                                                    setTreeGL('');
                                                                                    setTreeWorker('');
                                                                                    setIsTopUserSelectOpen(false);
                                                                                }}
                                                                                className={`w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors truncate ${String(treeTopUser) === String(u.id) ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                                            >
                                                                                {u.name} {u.specialty ? `(${u.specialty})` : ''} ({u.role?.name || 'Keine Rolle'})
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
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
                                                        <div className="relative">
                                                            <button
                                                                type="button"
                                                                onClick={() => setIsGLSelectOpen(!isGLSelectOpen)}
                                                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors flex items-center justify-between text-center"
                                                            >
                                                                <span className="w-full text-center">
                                                                    {treeGL
                                                                        ? (() => {
                                                                            const u = users.find(usr => String(usr.id) === String(treeGL));
                                                                            return u ? `${u.name} ${u.specialty ? `(${u.specialty})` : ''}` : '-- Person wählen --';
                                                                          })()
                                                                        : '-- Person wählen --'}
                                                                </span>
                                                                <i className={`fa-solid fa-chevron-down text-gray-500 text-xs transition-transform duration-200 ${isGLSelectOpen ? 'rotate-180' : ''}`}></i>
                                                            </button>

                                                            {isGLSelectOpen && (
                                                                <>
                                                                    <div 
                                                                        className="fixed inset-0 z-40" 
                                                                        onClick={() => setIsGLSelectOpen(false)}
                                                                    />
                                                                    <div className="absolute left-0 right-0 mt-2 bg-[#121212]/95 border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto py-1.5 backdrop-blur-md animate-[fadeIn_0.15s_ease-out] custom-scrollbar text-left">
                                                                        {users.filter(u => u.role?.name?.toLowerCase() === 'gruppenleiter').map(u => (
                                                                            <button
                                                                                key={u.id}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setTreeGL(u.id.toString());
                                                                                    setTreeWorker('');
                                                                                    setIsGLSelectOpen(false);
                                                                                }}
                                                                                className={`w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors truncate ${String(treeGL) === String(u.id) ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                                            >
                                                                                {u.name} {u.specialty ? `(${u.specialty})` : ''} - Manager: {users.find(m => m.id === u.manager_id)?.name || 'N/A'}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
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
                                                        <div className="relative">
                                                            <button
                                                                type="button"
                                                                onClick={() => setIsWorkerSelectOpen(!isWorkerSelectOpen)}
                                                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors flex items-center justify-between text-center"
                                                            >
                                                                <span className="w-full text-center">
                                                                    {treeWorker
                                                                        ? (() => {
                                                                            const u = users.find(usr => String(usr.id) === String(treeWorker));
                                                                            return u ? `${u.name} ${u.specialty ? `(${u.specialty})` : ''}` : '-- Person wählen --';
                                                                          })()
                                                                        : '-- Person wählen --'}
                                                                </span>
                                                                <i className={`fa-solid fa-chevron-down text-gray-500 text-xs transition-transform duration-200 ${isWorkerSelectOpen ? 'rotate-180' : ''}`}></i>
                                                            </button>

                                                            {isWorkerSelectOpen && (
                                                                <>
                                                                    <div 
                                                                        className="fixed inset-0 z-40" 
                                                                        onClick={() => setIsWorkerSelectOpen(false)}
                                                                    />
                                                                    <div className="absolute left-0 right-0 mt-2 bg-[#121212]/95 border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto py-1.5 backdrop-blur-md animate-[fadeIn_0.15s_ease-out] custom-scrollbar text-left">
                                                                        {users.filter(u => u.role?.name?.toLowerCase() === 'worker').map(u => (
                                                                            <button
                                                                                key={u.id}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setTreeWorker(u.id.toString());
                                                                                    setIsWorkerSelectOpen(false);
                                                                                }}
                                                                                className={`w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors truncate ${String(treeWorker) === String(u.id) ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                                            >
                                                                                {u.name} {u.specialty ? `(${u.specialty})` : ''} - Manager: {users.find(m => m.id === u.manager_id)?.name || 'N/A'}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
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
