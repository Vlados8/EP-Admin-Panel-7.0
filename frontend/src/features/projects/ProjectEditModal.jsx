import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const ProjectEditModal = ({ isOpen, onClose, project, onProjectUpdated }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        address: '',
        status: '',
        progress: 0,
        start_date: '',
        end_date: '',
        category_id: '',
        subcategory_id: '',
        budget: '',
        estimated_costs: '',
        client_first_name: '',
        client_last_name: '',
        client_phone: '',
        client_email: '',
        client_address: '',
        client_notes: ''
    });
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState([]);
    const [subcontractors, setSubcontractors] = useState([]);
    const [categories, setCategories] = useState([]);
    const [assignedUsers, setAssignedUsers] = useState([]); // [{ user_id, role }]
    const [assignedSubcontractors, setAssignedSubcontractors] = useState([]); // [id]
    const [selectedCategories, setSelectedCategories] = useState([]); // [{ category_id, subcategory_id }]
    const [expandedCategoryQuestions, setExpandedCategoryQuestions] = useState({}); // { [category_id]: boolean }

    const [treeTopUser, setTreeTopUser] = useState('');
    const [treeGL, setTreeGL] = useState('');
    const [treeWorker, setTreeWorker] = useState('');
    const [showAdditionalClient, setShowAdditionalClient] = useState(false);

    // --- Survey Logic State ---
    const [catViewLevel, setCatViewLevel] = useState('main'); // 'main', 'sub', 'questions'
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [dynamicAnswers, setDynamicAnswers] = useState({}); // { question_id: { value: string, answerId: number|null } }
    const [checkboxSelections, setCheckboxSelections] = useState([]); // [{ id, answer_text, ... }]

    // Track original answers so we know if any changed
    const [originalAnswers, setOriginalAnswers] = useState({});

    // Dropdown open/close states
    const [isStatusSelectOpen, setIsStatusSelectOpen] = useState(false);
    const [openSubcategorySelect, setOpenSubcategorySelect] = useState(null);
    const [isPlSelectOpen, setIsPlSelectOpen] = useState(false);
    const [isGlSelectOpen, setIsGlSelectOpen] = useState(false);
    const [isWorkerSelectOpen, setIsWorkerSelectOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchLists();
        }
    }, [isOpen]);

    const fetchLists = async () => {
        try {
            const [userRes, subRes, catRes] = await Promise.all([
                api.get('/users'),
                api.get('/subcontractors'),
                api.get('/categories')
            ]);
            setUsers(userRes.data.data.users || []);
            setSubcontractors(subRes.data.data.subcontractors || []);
            setCategories(catRes.data.data.categories || []);
        } catch (error) {
            console.error('Error fetching lists for edit modal:', error);
        }
    };

    useEffect(() => {
        if (project && isOpen) {
            const hasClientDetails = !!(project.client_first_name || project.client_last_name || project.client_phone || project.client_email || project.client_address || project.client_notes);
            setShowAdditionalClient(hasClientDetails);

            setIsStatusSelectOpen(false);
            setOpenSubcategorySelect(null);
            setIsPlSelectOpen(false);
            setIsGlSelectOpen(false);
            setIsWorkerSelectOpen(false);

            setFormData({
                title: project.title || '',
                description: project.description || '',
                address: project.address || '',
                status: project.status || 'Aktiv',
                progress: project.progress || 0,
                start_date: project.start_date ? project.start_date.split('T')[0] : '',
                end_date: project.end_date ? project.end_date.split('T')[0] : '',
                category_id: project.category_id || '',
                subcategory_id: project.subcategory_id || '',
                budget: project.budget || '',
                estimated_costs: project.estimated_costs || '',
                client_first_name: project.client_first_name || '',
                client_last_name: project.client_last_name || '',
                client_phone: project.client_phone || '',
                client_email: project.client_email || '',
                client_address: project.client_address || '',
                client_notes: project.client_notes || ''
            });

            // Parse categories_json or fallback to legacy category_id/subcategory_id
            let parsedCats = [];
            if (project.categories_json) {
                try {
                    parsedCats = typeof project.categories_json === 'string' ? JSON.parse(project.categories_json) : project.categories_json;
                } catch (e) {
                    console.error("Failed to parse categories_json", e);
                }
            }
            if (!parsedCats || parsedCats.length === 0) {
                if (project.category_id) {
                    parsedCats = [{
                        category_id: parseInt(project.category_id),
                        subcategory_id: project.subcategory_id ? parseInt(project.subcategory_id) : ''
                    }];
                }
            }
            setSelectedCategories(parsedCats || []);

            // Initialize assignments
            if (project.assigned_personnel) {
                setAssignedUsers(project.assigned_personnel.map(ap => ({
                    user_id: ap.user_id,
                    role: ap.role
                })));
            } else {
                setAssignedUsers([]);
            }

            if (project.assigned_subcontractors) {
                setAssignedSubcontractors(project.assigned_subcontractors.map(as => as.subcontractor_id));
            } else {
                setAssignedSubcontractors([]);
            }
        }
        // Initialize survey answers
        if (project.answers && project.answers.length > 0) {
            const initAnswers = {};
            project.answers.forEach(ans => {
                initAnswers[ans.question_id] = {
                    value: ans.custom_value || ans.answer?.answer_text || '',
                    answerId: ans.answer_id || null
                };
            });
            setDynamicAnswers(initAnswers);
            setOriginalAnswers(initAnswers);
        } else {
            setDynamicAnswers({});
            setOriginalAnswers({});
        }
    }, [project, isOpen]);

    // --- Survey Handlers ---
    const handleCategorySelect = (category) => {
        setFormData({ ...formData, category_id: category.id, subcategory_id: '' });
        if (category.subcategories && category.subcategories.length > 0) {
            setCatViewLevel('sub');
        } else {
            setCatViewLevel('questions');
            if (category.questions && category.questions.length > 0) {
                setCurrentQuestion(category.questions[0]);
            } else {
                setCurrentQuestion(null);
            }
        }
    };

    const handleSubcategorySelect = (subcategory) => {
        setFormData({ ...formData, subcategory_id: subcategory.id });
        setCatViewLevel('questions');
        if (subcategory.questions && subcategory.questions.length > 0) {
            setCurrentQuestion(subcategory.questions[0]);
        } else {
            setCurrentQuestion(null);
        }
    };

    const handleAnswerQuestion = (question, answerValue, answerId, nextQuestionId) => {
        setDynamicAnswers(prev => ({ ...prev, [question.id]: { value: answerValue, answerId } }));

        let nextQ = null;
        if (nextQuestionId) {
            // Find next question in current category or subcategory
            const selectedCat = categories.find(c => String(c.id) === String(formData.category_id));
            if (formData.subcategory_id && selectedCat) {
                const selectedSub = selectedCat.subcategories?.find(s => String(s.id) === String(formData.subcategory_id));
                nextQ = selectedSub?.questions?.find(q => q.id === nextQuestionId);
            } else if (selectedCat) {
                nextQ = selectedCat?.questions?.find(q => q.id === nextQuestionId);
            }
        }

        if (nextQ) {
            setCurrentQuestion(nextQ);
        } else {
            setCurrentQuestion(null); // Finished questions
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
            const hasSubcategories = categories.find(c => String(c.id) === String(formData.category_id))?.subcategories?.length > 0;
            if (hasSubcategories) {
                setCatViewLevel('sub');
            } else {
                setCatViewLevel('main');
            }
        } else if (catViewLevel === 'sub') {
            setCatViewLevel('main');
        }
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Format answers array
            const formattedAnswers = Object.keys(dynamicAnswers).map(qId => ({
                question_id: parseInt(qId),
                answer_id: dynamicAnswers[qId].answerId || null,
                custom_value: dynamicAnswers[qId].value
            }));

            const firstCategory = selectedCategories[0];
            const payload = {
                ...formData,
                category_id: firstCategory?.category_id || '',
                subcategory_id: firstCategory?.subcategory_id || '',
                categories_json: JSON.stringify(selectedCategories),
                client_first_name: showAdditionalClient ? formData.client_first_name : '',
                client_last_name: showAdditionalClient ? formData.client_last_name : '',
                client_phone: showAdditionalClient ? formData.client_phone : '',
                client_email: showAdditionalClient ? formData.client_email : '',
                client_address: showAdditionalClient ? formData.client_address : '',
                client_notes: showAdditionalClient ? formData.client_notes : '',
                assigned_users: assignedUsers,
                assigned_subcontractors: assignedSubcontractors,
                answers: formattedAnswers
            };
            console.log('[FRONTEND] Sending Project Update Payload:', payload);
            const res = await api.patch(`/projects/${project.id}`, payload);
            console.log('Update response:', res.data);

            if (onProjectUpdated) {
                onProjectUpdated();
            }
            onClose();
        } catch (error) {
            console.error('Error updating project:', error);
            const errorMsg = error.response?.data?.error || 'Fehler beim Aktualisieren des Projekts.';
            alert(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const toggleSubcontractor = (id) => {
        if (assignedSubcontractors.includes(id)) {
            setAssignedSubcontractors(assignedSubcontractors.filter(sid => sid !== id));
        } else {
            setAssignedSubcontractors([...assignedSubcontractors, id]);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/60 backdrop-blur-md flex justify-center items-start p-4 pt-28 pb-8">
            <div className="glass-card w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl animate-[slideUp_0.3s_ease-out] overflow-hidden flex flex-col my-0 max-h-none md:max-h-[90vh]">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <h2 className="text-xl font-semibold text-white flex items-center gap-3">
                        <i className="fa-solid fa-pen-to-square text-blue-400"></i> Projekt bearbeiten
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Projekttitel</label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>

                        <div className="col-span-2 md:col-span-1">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Status</label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsStatusSelectOpen(!isStatusSelectOpen)}
                                    className="w-full bg-[#0a101d]/50 border border-white/10 rounded-xl px-4 py-3 text-white text-left focus:outline-none focus:border-blue-500 transition-colors flex items-center justify-between"
                                >
                                    <span>{formData.status || 'Aktiv'}</span>
                                    <i className={`fa-solid fa-chevron-down text-gray-500 text-xs transition-transform duration-200 ${isStatusSelectOpen ? 'rotate-180' : ''}`}></i>
                                </button>

                                {isStatusSelectOpen && (
                                    <>
                                        <div 
                                            className="fixed inset-0 z-40" 
                                            onClick={() => setIsStatusSelectOpen(false)}
                                        />
                                        <div className="absolute left-0 right-0 mt-2 bg-[#121212]/95 border border-white/10 rounded-xl shadow-2xl z-50 py-1.5 backdrop-blur-md animate-[fadeIn_0.15s_ease-out]">
                                            {['Aktiv', 'Pausiert', 'Abgeschlossen'].map(st => (
                                                <button
                                                    key={st}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData({ ...formData, status: st });
                                                        setIsStatusSelectOpen(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors ${formData.status === st ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                >
                                                    {st}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Multi-Category Selection */}
                        <div className="col-span-2 space-y-4">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Kategorien auswählen</label>
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
                                            className={`p-3 rounded-xl border text-left font-medium transition-all flex items-center gap-3 ${isSelected ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-black/20 border-white/10 text-white hover:bg-slate-800'}`}
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-500'}`}>
                                                {isSelected && <i className="fa-solid fa-check text-white text-[10px]"></i>}
                                            </div>
                                            <span className="text-sm text-gray-200">{c.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Selected Categories with Subcategory Dropdowns */}
                        {selectedCategories.length > 0 && (
                            <div className="col-span-2 bg-white/5 border border-white/10 rounded-xl p-5 space-y-4 animate-[fadeIn_0.3s_ease-out]">
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
                                            <div key={catId} className="bg-black/20 p-4 rounded-xl border border-white/5 space-y-4 animate-[fadeIn_0.2s_ease-out]">
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
                                                            <i className="fa-solid fa-trash-can"></i>
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
                                                                <div key={q.id} className="bg-white/[0.03] border border-white/5 p-3.5 rounded-lg space-y-2">
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
                                                                        <div className="relative mt-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setOpenSubcategorySelect(openSubcategorySelect === q.id ? null : q.id)}
                                                                                className="w-full bg-[#0a101d] border border-white/10 rounded-xl px-3 py-2 text-xs text-white text-left focus:border-blue-500 transition-colors flex items-center justify-between"
                                                                            >
                                                                                <span>
                                                                                    {dynamicAnswers[q.id]?.value || '-- Bitte wählen --'}
                                                                                </span>
                                                                                <i className={`fa-solid fa-chevron-down text-gray-500 text-[10px] transition-transform duration-200 ${openSubcategorySelect === q.id ? 'rotate-180' : ''}`}></i>
                                                                            </button>

                                                                            {openSubcategorySelect === q.id && (
                                                                                <>
                                                                                    <div 
                                                                                        className="fixed inset-0 z-40" 
                                                                                        onClick={() => setOpenSubcategorySelect(null)}
                                                                                    />
                                                                                    <div className="absolute left-0 right-0 mt-1 bg-[#121212]/95 border border-white/10 rounded-xl shadow-2xl z-50 max-h-40 overflow-y-auto py-1 backdrop-blur-md animate-[fadeIn_0.15s_ease-out] custom-scrollbar">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                setDynamicAnswers(prev => {
                                                                                                    const copy = { ...prev };
                                                                                                    delete copy[q.id];
                                                                                                    return copy;
                                                                                                });
                                                                                                setOpenSubcategorySelect(null);
                                                                                            }}
                                                                                            className={`w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors ${!dynamicAnswers[q.id] ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                                                        >
                                                                                            -- Bitte wählen --
                                                                                        </button>
                                                                                        {q.answers?.map(ans => (
                                                                                            <button
                                                                                                key={ans.id}
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    setDynamicAnswers(prev => ({ ...prev, [q.id]: { value: ans.answer_text, answerId: ans.id } }));
                                                                                                    setOpenSubcategorySelect(null);
                                                                                                }}
                                                                                                className={`w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-white/5 transition-colors ${dynamicAnswers[q.id]?.answerId === ans.id ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                                                            >
                                                                                                {ans.answer_text}
                                                                                            </button>
                                                                                        ))}
                                                                                    </div>
                                                                                </>
                                                                            )}
                                                                        </div>
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
                                                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 mt-2"
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

                        {/* --- Dynamic Survey Questions --- */}
                        {catViewLevel === 'questions' && currentQuestion && (
                            <div className="col-span-2 bg-white/5 border border-white/10 p-6 rounded-xl space-y-6">
                                <h4 className="text-lg font-bold text-white text-center mb-4">{currentQuestion.question_text}</h4>

                                {(!currentQuestion.type || currentQuestion.type === 'buttons' || currentQuestion.type === 'radio') && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        {currentQuestion.answers?.map(ans => {
                                            const isSelected = dynamicAnswers[currentQuestion.id]?.answerId === ans.id;
                                            return (
                                                <button
                                                    key={ans.id}
                                                    type="button"
                                                    onClick={() => handleAnswerQuestion(currentQuestion, ans.answer_text, ans.id, ans.next_question_id)}
                                                    className={`border-2 rounded-xl p-4 text-center transition-all ${isSelected ? 'bg-blue-500/20 border-blue-500 text-white' : 'bg-slate-800 border-white/10 text-gray-300 hover:border-blue-500/50 hover:bg-slate-700'}`}
                                                >
                                                    <span className="text-sm font-medium">{ans.answer_text}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}

                                {currentQuestion.type === 'select' && (
                                    <div className="max-w-md mx-auto relative">
                                        <button
                                            type="button"
                                            onClick={() => setOpenSubcategorySelect(openSubcategorySelect === currentQuestion.id ? null : currentQuestion.id)}
                                            className="w-full bg-[#0a101d] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 transition-colors flex items-center justify-between text-center"
                                        >
                                            <span className="w-full text-center">
                                                {dynamicAnswers[currentQuestion.id]?.value || '-- Bitte wählen --'}
                                            </span>
                                            <i className={`fa-solid fa-chevron-down text-gray-500 text-xs transition-transform duration-200 ${openSubcategorySelect === currentQuestion.id ? 'rotate-180' : ''}`}></i>
                                        </button>

                                        {openSubcategorySelect === currentQuestion.id && (
                                            <>
                                                <div 
                                                    className="fixed inset-0 z-40" 
                                                    onClick={() => setOpenSubcategorySelect(null)}
                                                />
                                                <div className="absolute left-0 right-0 mt-2 bg-[#121212]/95 border border-white/10 rounded-xl shadow-2xl z-50 max-h-40 overflow-y-auto py-1 backdrop-blur-md animate-[fadeIn_0.15s_ease-out] custom-scrollbar text-left">
                                                    {currentQuestion.answers?.map(ans => (
                                                        <button
                                                            key={ans.id}
                                                            type="button"
                                                            onClick={() => {
                                                                handleAnswerQuestion(currentQuestion, ans.answer_text, ans.id, ans.next_question_id);
                                                                setOpenSubcategorySelect(null);
                                                            }}
                                                            className={`w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors truncate ${dynamicAnswers[currentQuestion.id]?.answerId === ans.id ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                        >
                                                            {ans.answer_text}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {currentQuestion.type === 'input' && (
                                    <div className="space-y-4 max-w-md mx-auto">
                                        <input
                                            type="text"
                                            defaultValue={dynamicAnswers[currentQuestion.id]?.value || ''}
                                            className="w-full bg-[#0a101d] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none text-center"
                                            placeholder="Wert eingeben..."
                                            onBlur={(e) => {
                                                const fallbackNext = currentQuestion.answers && currentQuestion.answers.length > 0 ? currentQuestion.answers[0].next_question_id : null;
                                                handleAnswerQuestion(currentQuestion, e.target.value, null, fallbackNext);
                                            }}
                                        />
                                        <p className="text-center text-gray-500 text-xs">Klicken Sie außerhalb des Feldes zum Bestätigen</p>
                                    </div>
                                )}

                                {currentQuestion.type === 'checkbox' && (
                                    <div className="space-y-4 max-w-md mx-auto">
                                        <div className="grid grid-cols-1 gap-2">
                                            {currentQuestion.answers?.map(ans => {
                                                const isRecentlySelected = checkboxSelections.some(s => s.id === ans.id);
                                                // Pre-fill check simply based on if the saved text includes this answer
                                                const isSaved = dynamicAnswers[currentQuestion.id]?.value?.includes(ans.answer_text);
                                                const isSelected = isRecentlySelected || isSaved;

                                                return (
                                                    <button
                                                        key={ans.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setCheckboxSelections(prev => prev.filter(s => s.id !== ans.id));
                                                                // If removing a pre-saved value, we have to rebuild the text.
                                                                if (isSaved) {
                                                                    const currentParts = dynamicAnswers[currentQuestion.id].value.split(', ').filter(v => v !== ans.answer_text);
                                                                    setDynamicAnswers(prev => ({ ...prev, [currentQuestion.id]: { value: currentParts.join(', '), answerId: null } }));
                                                                }
                                                            } else {
                                                                setCheckboxSelections(prev => [...prev, ans]);
                                                            }
                                                        }}
                                                        className={`p-3 rounded-xl border text-left font-medium transition-all flex items-center gap-3 ${isSelected ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-[#0a101d] border-white/10 text-white hover:bg-slate-800'}`}>
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-500'}`}>
                                                            {isSelected && <i className="fa-solid fa-check text-white text-[10px]"></i>}
                                                        </div>
                                                        <span className="text-sm">{ans.answer_text}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={submitCheckboxes}
                                            disabled={checkboxSelections.length === 0 && !dynamicAnswers[currentQuestion.id]?.value}
                                            className="w-full bg-blue-600/20 text-blue-400 border border-blue-500/50 hover:bg-blue-600/40 disabled:opacity-50 font-medium py-2 rounded-xl transition-all mt-4 text-sm"
                                        >
                                            Auswahl bestätigen & Weiter
                                        </button>
                                    </div>
                                )}

                                <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/5">
                                    <button type="button" onClick={handleBackCat} className="text-gray-400 hover:text-white px-4 py-2 text-xs transition-colors"><i className="fa-solid fa-arrow-left mr-2"></i> Zurück zur Kategorie</button>
                                    <button type="button" onClick={() => setCurrentQuestion(null)} className="text-gray-400 hover:text-white px-4 py-2 text-xs transition-colors">Fragen überspringen <i className="fa-solid fa-arrow-right ml-2"></i></button>
                                </div>
                            </div>
                        )}
                        {/* --- End Dynamic Survey Questions --- */}

                        <div className="col-span-2 md:col-span-1">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Fortschritt ({formData.progress}%)</label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={formData.progress}
                                onChange={e => setFormData({ ...formData, progress: parseInt(e.target.value) })}
                                className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500 my-4"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Adresse</label>
                            <input
                                type="text"
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>

                        {/* Toggle Additional Client Form */}
                        <div className="col-span-2 flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 select-none">
                            <div className="flex flex-col">
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
                            <div className="col-span-2 bg-white/5 border border-white/10 rounded-xl p-5 space-y-4 animate-[fadeIn_0.3s_ease-out]">
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
                                            value={formData.client_first_name}
                                            onChange={e => setFormData({ ...formData, client_first_name: e.target.value })}
                                            className="w-full bg-black/35 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:border-emerald-500 transition-colors"
                                            placeholder="z.B. Max"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">Nachname</label>
                                        <input
                                            type="text"
                                            value={formData.client_last_name}
                                            onChange={e => setFormData({ ...formData, client_last_name: e.target.value })}
                                            className="w-full bg-black/35 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:border-emerald-500 transition-colors"
                                            placeholder="z.B. Mustermann"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">Telefonnummer</label>
                                        <input
                                            type="text"
                                            value={formData.client_phone}
                                            onChange={e => setFormData({ ...formData, client_phone: e.target.value })}
                                            className="w-full bg-black/35 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:border-emerald-500 transition-colors"
                                            placeholder="z.B. +49 123 456789"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">E-Mail-Adresse</label>
                                        <input
                                            type="email"
                                            value={formData.client_email}
                                            onChange={e => setFormData({ ...formData, client_email: e.target.value })}
                                            className="w-full bg-black/35 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:border-emerald-500 transition-colors"
                                            placeholder="z.B. info@firma.de"
                                        />
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="text-xs text-gray-400 block mb-1">Adresse</label>
                                        <input
                                            type="text"
                                            value={formData.client_address}
                                            onChange={e => setFormData({ ...formData, client_address: e.target.value })}
                                            className="w-full bg-black/35 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:border-emerald-500 transition-colors"
                                            placeholder="Straße, Hausnummer, PLZ, Ort"
                                        />
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="text-xs text-gray-400 block mb-1">Kunden-Notizen / Bemerkungen (intern)</label>
                                        <textarea
                                            value={formData.client_notes}
                                            onChange={e => setFormData({ ...formData, client_notes: e.target.value })}
                                            rows="2"
                                            className="w-full bg-black/35 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:border-emerald-500 transition-colors resize-none"
                                            placeholder="Besondere Absprachen, Wünsche oder Anforderungen des Auftraggebers..."
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="col-span-1">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Startdatum</label>
                            <input
                                type="date"
                                value={formData.start_date}
                                onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>

                        <div className="col-span-1">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Enddatum</label>
                            <input
                                type="date"
                                value={formData.end_date}
                                onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>

                        <div className="col-span-2 md:col-span-1">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Projekt-Budget (€)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.budget}
                                onChange={e => setFormData({ ...formData, budget: e.target.value })}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder="0.00"
                            />
                        </div>

                        <div className="col-span-2 md:col-span-1">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Geschätzte Kosten (€)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.estimated_costs}
                                onChange={e => setFormData({ ...formData, estimated_costs: e.target.value })}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder="0.00"
                            />
                        </div>

                        {formData.budget && formData.estimated_costs && (
                            <div className="col-span-2 bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10 flex items-center justify-between animate-[fadeInUp_0.3s_ease-out]">
                                <div>
                                    <div className="text-[10px] text-emerald-500/70 uppercase tracking-widest font-bold mb-0.5">Berechnete Marge</div>
                                    <div className="text-base font-black text-emerald-400">
                                        {new Number(formData.budget - formData.estimated_costs).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-0.5">Marge in %</div>
                                    <div className="text-sm font-bold text-gray-300">
                                        {Math.round(((formData.budget - formData.estimated_costs) / formData.budget) * 100)}%
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="col-span-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Beschreibung</label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                rows="3"
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
                            ></textarea>
                        </div>



                        {/* Personnel Management */}
                        <div className="col-span-2 space-y-6 pt-4 border-t border-white/5">
                            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                <i className="fa-solid fa-users text-blue-400"></i> Team & Besetzung
                            </h3>

                            {/* Projektleiter */}
                            <div className="space-y-3">
                                <label className="text-xs font-semibold text-gray-400 uppercase">Projektleiter</label>
                                <div className="flex gap-3">
                                    <div className="relative flex-1">
                                        <button
                                            type="button"
                                            onClick={() => setIsPlSelectOpen(!isPlSelectOpen)}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white text-left text-sm focus:outline-none focus:border-blue-500 transition-colors flex items-center justify-between"
                                        >
                                            <span>
                                                {treeTopUser
                                                    ? (() => {
                                                        const u = users.find(usr => String(usr.id) === String(treeTopUser));
                                                        return u ? `${u.name} (${u.role?.name || 'Keine Rolle'})` : '-- Person wählen --';
                                                      })()
                                                    : '-- Person wählen --'}
                                            </span>
                                            <i className={`fa-solid fa-chevron-down text-gray-500 text-xs transition-transform duration-200 ${isPlSelectOpen ? 'rotate-180' : ''}`}></i>
                                        </button>

                                        {isPlSelectOpen && (
                                            <>
                                                <div 
                                                    className="fixed inset-0 z-40" 
                                                    onClick={() => setIsPlSelectOpen(false)}
                                                />
                                                <div className="absolute left-0 right-0 mt-2 bg-[#121212]/95 border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto py-1.5 backdrop-blur-md animate-[fadeIn_0.15s_ease-out] custom-scrollbar">
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
                                                                setIsPlSelectOpen(false);
                                                            }}
                                                            className={`w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors truncate ${String(treeTopUser) === String(u.id) ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                        >
                                                            {u.name} ({u.role?.name || 'Keine Rolle'})
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (treeTopUser) {
                                                if (!assignedUsers.some(au => au.user_id === treeTopUser)) {
                                                    setAssignedUsers([...assignedUsers, { user_id: treeTopUser, role: 'projektleiter' }]);
                                                }
                                                setTreeTopUser('');
                                            }
                                        }}
                                        className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-600/30 transition-all"
                                    >
                                        Hinzufügen
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {assignedUsers.filter(au => au.role === 'projektleiter').map(au => {
                                        const u = users.find(user => user.id === au.user_id);
                                        return u && (
                                            <div key={u.id} className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-1 flex items-center gap-2">
                                                <span className="text-xs text-blue-300">{u.name}</span>
                                                <button type="button" onClick={() => setAssignedUsers(assignedUsers.filter(x => x.user_id !== u.id))} className="text-blue-400 hover:text-red-400 transition-colors">
                                                    <i className="fa-solid fa-xmark text-[10px]"></i>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Gruppenleiter */}
                            <div className="space-y-3 animate-[fadeIn_0.3s_ease-out]">
                                <label className="text-xs font-semibold text-gray-400 uppercase">Gruppenleiter</label>
                                <div className="flex gap-3">
                                    <div className="relative flex-1">
                                        <button
                                            type="button"
                                            onClick={() => setIsGlSelectOpen(!isGlSelectOpen)}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white text-left text-sm focus:outline-none focus:border-blue-500 transition-colors flex items-center justify-between"
                                        >
                                            <span>
                                                {treeGL
                                                    ? (() => {
                                                        const u = users.find(usr => String(usr.id) === String(treeGL));
                                                        return u ? `${u.name} ${u.specialty ? `(${u.specialty})` : ''}` : '-- Person wählen --';
                                                      })()
                                                    : '-- Person wählen --'}
                                            </span>
                                            <i className={`fa-solid fa-chevron-down text-gray-500 text-xs transition-transform duration-200 ${isGlSelectOpen ? 'rotate-180' : ''}`}></i>
                                        </button>

                                        {isGlSelectOpen && (
                                            <>
                                                <div 
                                                    className="fixed inset-0 z-40" 
                                                    onClick={() => setIsGlSelectOpen(false)}
                                                />
                                                <div className="absolute left-0 right-0 mt-2 bg-[#121212]/95 border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto py-1.5 backdrop-blur-md animate-[fadeIn_0.15s_ease-out] custom-scrollbar">
                                                    {users.filter(u => u.role?.name?.toLowerCase() === 'gruppenleiter').map(u => (
                                                        <button
                                                            key={u.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setTreeGL(u.id.toString());
                                                                setTreeWorker('');
                                                                setIsGlSelectOpen(false);
                                                            }}
                                                            className={`w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors truncate ${String(treeGL) === String(u.id) ? 'bg-white/5 text-blue-400 font-medium' : ''}`}
                                                        >
                                                            {u.name} {u.specialty ? `(${u.specialty})` : ''}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (treeGL) {
                                                if (!assignedUsers.some(au => au.user_id === treeGL)) {
                                                    setAssignedUsers([...assignedUsers, { user_id: treeGL, role: 'gruppenleiter' }]);
                                                }
                                                setTreeGL('');
                                            }
                                        }}
                                        className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-600/30 transition-all"
                                    >
                                        Hinzufügen
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {assignedUsers.filter(au => au.role === 'gruppenleiter').map(au => {
                                        const u = users.find(user => user.id === au.user_id);
                                        return u && (
                                            <div key={u.id} className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1 flex items-center gap-2">
                                                <span className="text-xs text-emerald-300">{u.name}</span>
                                                <button type="button" onClick={() => setAssignedUsers(assignedUsers.filter(x => x.user_id !== u.id))} className="text-emerald-400 hover:text-red-400 transition-colors">
                                                    <i className="fa-solid fa-xmark text-[10px]"></i>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Worker */}
                            <div className="space-y-3 animate-[fadeIn_0.3s_ease-out]">
                                <label className="text-xs font-semibold text-gray-400 uppercase">Mitarbeiter (Worker)</label>
                                <div className="flex gap-3">
                                    <div className="relative flex-1">
                                        <button
                                            type="button"
                                            onClick={() => setIsWorkerSelectOpen(!isWorkerSelectOpen)}
                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white text-left text-sm focus:outline-none focus:border-blue-500 transition-colors flex items-center justify-between"
                                        >
                                            <span>
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
                                                <div className="absolute left-0 right-0 mt-2 bg-[#121212]/95 border border-white/10 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto py-1.5 backdrop-blur-md animate-[fadeIn_0.15s_ease-out] custom-scrollbar">
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
                                                            {u.name} {u.specialty ? `(${u.specialty})` : ''}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (treeWorker) {
                                                if (!assignedUsers.some(au => au.user_id === treeWorker)) {
                                                    setAssignedUsers([...assignedUsers, { user_id: treeWorker, role: 'worker' }]);
                                                }
                                                setTreeWorker('');
                                            }
                                        }}
                                        className="bg-amber-600/20 text-amber-400 border border-amber-500/30 px-4 py-2 rounded-xl text-sm font-medium hover:bg-amber-600/30 transition-all"
                                    >
                                        Hinzufügen
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {assignedUsers.filter(au => au.role === 'worker').map(au => {
                                        const u = users.find(user => user.id === au.user_id);
                                        return u && (
                                            <div key={u.id} className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1 flex items-center gap-2">
                                                <span className="text-xs text-amber-300">{u.name}</span>
                                                <button type="button" onClick={() => setAssignedUsers(assignedUsers.filter(x => x.user_id !== u.id))} className="text-amber-400 hover:text-red-400 transition-colors">
                                                    <i className="fa-solid fa-xmark text-[10px]"></i>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Subcontractors */}
                            <div className="space-y-3">
                                <label className="text-xs font-semibold text-gray-400 uppercase">Nachunternehmer</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {subcontractors.map(sub => {
                                        const isAssigned = assignedSubcontractors.includes(sub.id);
                                        return (
                                            <button
                                                key={sub.id}
                                                type="button"
                                                onClick={() => toggleSubcontractor(sub.id)}
                                                className={`p-2 rounded-xl border text-center transition-all ${isAssigned ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-[0_0_10px_rgba(245,158,11,0.1)]' : 'bg-slate-800/50 border-white/10 text-gray-400 hover:bg-slate-700/50 hover:text-white'}`}
                                            >
                                                <div className="text-[10px] font-bold">{sub.name}</div>
                                                <div className="text-[9px] opacity-70">{sub.trade}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            Abbrechen
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-8 py-2.5 rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                        >
                            {loading ? 'Speichere...' : 'Änderungen speichern'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProjectEditModal;
