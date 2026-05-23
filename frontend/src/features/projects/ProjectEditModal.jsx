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
        estimated_costs: ''
    });
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState([]);
    const [subcontractors, setSubcontractors] = useState([]);
    const [categories, setCategories] = useState([]);
    const [assignedUsers, setAssignedUsers] = useState([]); // [{ user_id, role }]
    const [assignedSubcontractors, setAssignedSubcontractors] = useState([]); // [id]

    const [treeTopUser, setTreeTopUser] = useState('');
    const [treeGL, setTreeGL] = useState('');
    const [treeWorker, setTreeWorker] = useState('');

    // --- Survey Logic State ---
    const [catViewLevel, setCatViewLevel] = useState('main'); // 'main', 'sub', 'questions'
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [dynamicAnswers, setDynamicAnswers] = useState({}); // { question_id: { value: string, answerId: number|null } }
    const [checkboxSelections, setCheckboxSelections] = useState([]); // [{ id, answer_text, ... }]

    // Track original answers so we know if any changed
    const [originalAnswers, setOriginalAnswers] = useState({});

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
                estimated_costs: project.estimated_costs || ''
            });

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

            const payload = {
                ...formData,
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
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/60 backdrop-blur-md flex justify-center p-4">
            <div className="glass-card w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl animate-[slideUp_0.3s_ease-out] overflow-hidden flex flex-col my-auto max-h-none md:max-h-[90vh]">
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
                            <select
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                                className="w-full bg-[#0a101d] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors [&>option]:bg-slate-900"
                            >
                                <option value="Aktiv" className="bg-slate-900 text-white">Aktiv</option>
                                <option value="Pausiert" className="bg-slate-900 text-white">Pausiert</option>
                                <option value="Abgeschlossen" className="bg-slate-900 text-white">Abgeschlossen</option>
                            </select>
                        </div>

                        <div className="col-span-2 md:col-span-1">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Kategorie</label>
                            <select
                                value={formData.category_id}
                                onChange={e => setFormData({ ...formData, category_id: e.target.value, subcategory_id: '' })}
                                className="w-full bg-[#0a101d] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors [&>option]:bg-slate-900"
                            >
                                <option value="" className="bg-slate-900 text-white">-- Keine --</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-span-2 md:col-span-1">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Unterkategorie</label>
                            <select
                                value={formData.subcategory_id}
                                onChange={e => handleSubcategorySelect(categories.find(c => String(c.id) === String(formData.category_id))?.subcategories?.find(s => String(s.id) === e.target.value) || { id: e.target.value })}
                                className="w-full bg-[#0a101d] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors [&>option]:bg-slate-900"
                                disabled={!formData.category_id}
                            >
                                <option value="" className="bg-slate-900 text-white">-- Keine --</option>
                                {categories.find(c => String(c.id) === String(formData.category_id))?.subcategories?.map(s => (
                                    <option key={s.id} value={s.id} className="bg-slate-900 text-white">{s.name}</option>
                                ))}
                            </select>
                        </div>

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
                                    <div className="max-w-md mx-auto">
                                        <select
                                            value={dynamicAnswers[currentQuestion.id]?.answerId || ''}
                                            onChange={(e) => {
                                                const selectedAns = currentQuestion.answers?.find(a => a.id === parseInt(e.target.value));
                                                if (selectedAns) handleAnswerQuestion(currentQuestion, selectedAns.answer_text, selectedAns.id, selectedAns.next_question_id);
                                            }}
                                            className="w-full bg-[#0a101d] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 transition-colors text-center [&>option]:bg-slate-900"
                                        >
                                            <option value="" className="bg-slate-900 text-white">-- Bitte wählen --</option>
                                            {currentQuestion.answers?.map(ans => (
                                                <option key={ans.id} value={ans.id} className="bg-slate-900 text-white">{ans.answer_text}</option>
                                            ))}
                                        </select>
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
                                    <select
                                        value={treeTopUser}
                                        onChange={e => {
                                            setTreeTopUser(e.target.value);
                                            setTreeGL('');
                                            setTreeWorker('');
                                        }}
                                        className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500 [&>option]:bg-slate-900"
                                    >
                                        <option value="" className="bg-slate-900 text-white">-- Person wählen --</option>
                                        {users.filter(u => u.role?.name?.toLowerCase() === 'projektleiter').map(u => (
                                            <option key={u.id} value={u.id} className="bg-slate-900 text-white">{u.name}</option>
                                        ))}
                                    </select>
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
                                    <select
                                        value={treeGL}
                                        onChange={e => {
                                            setTreeGL(e.target.value);
                                            setTreeWorker('');
                                        }}
                                        className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500 [&>option]:bg-slate-900"
                                    >
                                        <option value="" className="bg-slate-900 text-white">-- Person wählen --</option>
                                        {users.filter(u => u.role?.name?.toLowerCase() === 'gruppenleiter').map(u => (
                                            <option key={u.id} value={u.id} className="bg-slate-900 text-white">{u.name} {u.specialty ? `(${u.specialty})` : ''}</option>
                                        ))}
                                    </select>
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
                                    <select
                                        value={treeWorker}
                                        onChange={e => setTreeWorker(e.target.value)}
                                        className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500 [&>option]:bg-slate-900"
                                    >
                                        <option value="" className="bg-slate-900 text-white">-- Person wählen --</option>
                                        {users.filter(u => u.role?.name?.toLowerCase() === 'worker').map(u => (
                                            <option key={u.id} value={u.id} className="bg-slate-900 text-white">{u.name} {u.specialty ? `(${u.specialty})` : ''}</option>
                                        ))}
                                    </select>
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
