import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../services/api';
import usePermission from '../../hooks/usePermission';

const Categories = () => {
    const navigate = useNavigate();
    const { user } = useSelector(state => state.auth);

    useEffect(() => {
        if (user) {
            const role = user.role?.name || user.role;
            if (role !== 'Admin' && role !== 'Büro') {
                navigate('/dashboard');
            }
        }
    }, [user, navigate]);

    // Basic States
    const canManage = usePermission('MANAGE_CATEGORIES');
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [expandedCats, setExpandedCats] = useState({});
    const [expandedSubcats, setExpandedSubcats] = useState({});
    const [expandedQuestions, setExpandedQuestions] = useState({});

    // Modals
    const [modalConfig, setModalConfig] = useState(null); // { type: 'category'|'subcategory'|'question'|'answer', isEdit: boolean, parentId?: number, data?: any, extraOptions?: any }

    const fetchCategories = async () => {
        try {
            const res = await api.get('/categories');
            setCategories(res.data.data.categories);
        } catch (error) {
            console.error('Error fetching categories:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCategories(); }, []);

    const toggleExpand = (setter, id) => {
        setter(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // --- MODAL HANDLERS ---
    const openModal = (type, isEdit, parentId = null, data = null, extraOptions = null) => {
        let initialData = data || getDefaultData(type);
        if (type === 'answer' && !isEdit && extraOptions?.parentQuestion) {
            const parentType = extraOptions.parentQuestion.type;
            if (parentType === 'slider' || parentType === 'input') {
                initialData = { ...initialData, answer_text: 'Weiter' };
            }
        }
        setModalConfig({ type, isEdit, parentId, data: initialData, extraOptions });
    };

    const closeModal = () => setModalConfig(null);

    const getDefaultData = (type) => {
        if (type === 'category') return { name: '', description: '', order_index: 0, icon: '', target: 'both' };
        if (type === 'subcategory') return { name: '', description: '', order_index: 0, icon: '' };
        if (type === 'question') return { question_text: '', field_key: '', type: 'buttons', order_index: 0, unit: '', config: { min: 0, max: 100, step: 1 } };
        if (type === 'answer') return { answer_text: '', next_question_id: '', order_index: 0 };
    };

    const handleSave = async (formData) => {
        try {
            const { type, isEdit, parentId, data } = modalConfig;
            let url = '';
            let payload = { ...formData };

            if (type === 'category') {
                url = isEdit ? `/categories/${data.id}` : '/categories';
            } else if (type === 'subcategory') {
                url = isEdit ? `/categories/subcategories/${data.id}` : '/categories/subcategories';
                if (!isEdit) payload.category_id = parentId;
            } else if (type === 'question') {
                url = isEdit ? `/categories/questions/${data.id}` : '/categories/questions';
                if (!isEdit) payload.subcategory_id = parentId;
            } else if (type === 'answer') {
                url = isEdit ? `/categories/answers/${data.id}` : '/categories/answers';
                if (!isEdit) payload.question_id = parentId;
            }

            if (isEdit) {
                await api.patch(url, payload);
            } else {
                await api.post(url, payload);
            }

            fetchCategories();
            closeModal();
        } catch (error) {
            console.error('Error saving:', error);
            alert('Fehler beim Speichern');
        }
    };

    const handleDelete = async (type, id) => {
        if (!window.confirm('Wirklich löschen?')) return;
        try {
            let url = '';
            if (type === 'category') url = `/categories/${id}`;
            else if (type === 'subcategory') url = `/categories/subcategories/${id}`;
            else if (type === 'question') url = `/categories/questions/${id}`;
            else if (type === 'answer') url = `/categories/answers/${id}`;

            await api.delete(url);
            fetchCategories();
        } catch (error) {
            console.error('Error deleting:', error);
        }
    };

    return (
        <div className="animate-[fadeIn_0.4s_ease-out_forwards]">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white">Gewerke & Formulare (Decision Tree)</h2>
                    <p className="text-gray-400 text-sm mt-1">Bauen Sie Verschachtelungen und Abhängigkeiten für den Anfrage-Wizard.</p>
                </div>
                {canManage && (
                    <button onClick={() => openModal('category', false)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                        + Kategorie
                    </button>
                )}
            </div>

            <div className="glass-card rounded-2xl p-6 border border-white/5">
                {loading ? <div className="text-center text-gray-400">Laden...</div> : categories.length === 0 ? <div className="text-gray-400 text-center">Keine Daten.</div> : (
                    <div className="space-y-4">
                        {categories.map(cat => (
                            <div key={cat.id} className="bg-black/20 border border-white/10 rounded-xl overflow-hidden">
                                {/* CATEGORY HEADER */}
                                <div className="p-4 flex items-center justify-between hover:bg-white/[0.02]">
                                    <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => toggleExpand(setExpandedCats, cat.id)}>
                                        <button className="w-6 h-6 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded text-gray-400 transition-colors">
                                            <i className={`fa-solid fa-chevron-${expandedCats[cat.id] ? 'down' : 'right'} text-xs`}></i>
                                        </button>
                                        <i className={`fa-solid ${cat.icon || 'fa-folder'} text-blue-400 text-xl w-6 text-center`}></i>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-white font-semibold">{cat.name}</h3>
                                                {cat.target === 'admin' && (
                                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1">
                                                        <i className="fa-solid fa-lock text-[8px]"></i> Interne Erfassung (Admin)
                                                    </span>
                                                )}
                                                {cat.target === 'site' && (
                                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20 flex items-center gap-1">
                                                        <i className="fa-solid fa-globe text-[8px]"></i> Kundenportal (Website)
                                                    </span>
                                                )}
                                                {cat.target === 'both' && (
                                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 flex items-center gap-1">
                                                        <i className="fa-solid fa-circle-check text-[8px]"></i> Beide
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400">{cat.description || 'Keine Beschreibung'}</p>
                                        </div>
                                    </div>
                                    {canManage && (
                                        <div className="flex gap-2">
                                            <button onClick={() => openModal('subcategory', false, cat.id)} className="text-xs px-2 py-1 bg-teal-500/20 text-teal-300 rounded hover:bg-teal-500/40 border border-teal-500/30">+ Unterkategorie</button>
                                            <button onClick={() => openModal('category', true, null, cat)} className="text-blue-400 hover:text-white px-2"><i className="fa-solid fa-pen"></i></button>
                                            <button onClick={() => handleDelete('category', cat.id)} className="text-red-400 hover:text-white px-2"><i className="fa-solid fa-trash"></i></button>
                                        </div>
                                    )}
                                </div>

                                {/* SUBCATEGORIES */}
                                {expandedCats[cat.id] && (
                                    <div className="border-t border-white/10">
                                        {cat.subcategories?.length === 0 ? <div className="p-4 pl-14 text-sm text-gray-500">Keine Unterkategorien.</div> : cat.subcategories?.map(subcat => (
                                            <div key={subcat.id} className="border-b border-white/5 last:border-0 bg-black/10">
                                                <div className="p-3 pl-14 flex items-center justify-between hover:bg-white/[0.02]">
                                                    <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => toggleExpand(setExpandedSubcats, subcat.id)}>
                                                        <button className="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded text-gray-400 transition-colors">
                                                            <i className={`fa-solid fa-chevron-${expandedSubcats[subcat.id] ? 'down' : 'right'} text-[10px]`}></i>
                                                        </button>
                                                        <i className="fa-solid fa-diagram-project text-teal-400/70 text-sm"></i>
                                                        <span className="text-gray-200 text-sm font-medium">{subcat.name}</span>
                                                    </div>
                                                    {canManage && (
                                                        <div className="flex gap-2">
                                                            <button onClick={() => openModal('question', false, subcat.id)} className="text-xs px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded hover:bg-indigo-500/40 border border-indigo-500/30">+ Frage</button>
                                                            <button onClick={() => openModal('subcategory', true, cat.id, subcat)} className="text-blue-400 hover:text-white px-2"><i className="fa-solid fa-pen text-xs"></i></button>
                                                            <button onClick={() => handleDelete('subcategory', subcat.id)} className="text-red-400 hover:text-white px-2"><i className="fa-solid fa-trash text-xs"></i></button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* QUESTIONS FOR SUBCATEGORY */}
                                                {expandedSubcats[subcat.id] && (
                                                    <div className="border-t border-white/5">
                                                        {subcat.questions?.length === 0 ? <div className="p-3 pl-24 text-xs text-gray-500">Keine Fragen definiert.</div> : subcat.questions?.map(q => (
                                                            <div key={q.id} className="border-b border-white/5 last:border-0 bg-white/[0.02]">
                                                                <div className="p-3 pl-24 flex justify-between items-center hover:bg-white/[0.02]">
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center gap-2">
                                                                            <button onClick={() => toggleExpand(setExpandedQuestions, q.id)} className="w-4 h-4 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded text-gray-400">
                                                                                <i className={`fa-solid fa-chevron-${expandedQuestions[q.id] ? 'down' : 'right'} text-[8px]`}></i>
                                                                            </button>
                                                                            <span className="text-gray-300 text-sm font-medium">{q.question_text}</span>
                                                                            <span className="text-[10px] bg-white/10 text-gray-400 px-1.5 py-0.5 rounded uppercase tracking-wider">{q.type}</span>
                                                                        </div>
                                                                        {q.field_key && <span className="pl-6 text-xs text-gray-500 mt-0.5 font-mono">{q.field_key}</span>}
                                                                    </div>
                                                                    {canManage && (
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-xs text-gray-500 bg-black/40 px-2 py-0.5 border border-white/5 rounded">ID: {q.id}</span>
                                                                            {(!q.type || ['buttons', 'select', 'radio', 'checkbox', 'slider', 'input', ''].includes(q.type)) && (
                                                                                <button onClick={() => openModal('answer', false, q.id, null, { parentQuestion: q, siblingQuestions: subcat.questions.filter(sq => sq.id !== q.id) })} className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded hover:bg-emerald-500/40 border border-emerald-500/30">+ Antwort</button>
                                                                            )}
                                                                            <button onClick={() => openModal('question', true, subcat.id, q)} className="text-blue-400 hover:text-white px-2"><i className="fa-solid fa-pen text-xs"></i></button>
                                                                            <button onClick={() => handleDelete('question', q.id)} className="text-red-400 hover:text-white px-2"><i className="fa-solid fa-trash text-xs"></i></button>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* ANSWERS FOR QUESTION */}
                                                                {expandedQuestions[q.id] && (
                                                                    <div className="bg-black/20 p-2 pl-[116px]">
                                                                        {q.answers?.length === 0 ? (
                                                                            <div className="text-xs text-gray-500 py-1 flex flex-col gap-1">
                                                                                <span>Keine Antworten definiert.</span>
                                                                                {(q.type === 'slider' || q.type === 'input') && (
                                                                                    <span className="text-teal-400/80">Fügen Sie eine Antwort hinzu (z. B. "Weiter"), um den Übergang zum nächsten Schritt festzulegen.</span>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex flex-col gap-1">
                                                                                {q.answers?.map(ans => {
                                                                                    const nextQ = subcat.questions.find(sq => sq.id === ans.next_question_id);
                                                                                    return (
                                                                                        <div key={ans.id} className="flex items-center justify-between bg-white/5 p-2 rounded border border-white/5 text-xs">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <i className="fa-regular fa-message text-emerald-400/50"></i>
                                                                                                <span className="text-emerald-100 font-medium">{ans.answer_text}</span>
                                                                                                <i className="fa-solid fa-arrow-right text-gray-600 mx-1"></i>
                                                                                                <span className={`px-1.5 py-0.5 rounded ${ans.next_question_id ? 'bg-blue-500/20 text-blue-300' : 'bg-orange-500/20 text-orange-300'}`}>
                                                                                                    {ans.next_question_id && nextQ ? `Frage ${ans.next_question_id}: ${nextQ.question_text}` : 'Ende (Keine weitere Frage)'}
                                                                                                </span>
                                                                                            </div>
                                                                                            {canManage && (
                                                                                                <div className="flex gap-2">
                                                                                                    <button onClick={() => openModal('answer', true, q.id, ans, { parentQuestion: q, siblingQuestions: subcat.questions.filter(sq => sq.id !== q.id) })} className="text-blue-400 hover:text-white"><i className="fa-solid fa-pen"></i></button>
                                                                                                    <button onClick={() => handleDelete('answer', ans.id)} className="text-red-400 hover:text-white"><i className="fa-solid fa-trash"></i></button>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* SHARED MODAL COMPONENT */}
            {modalConfig && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4">
                    <div className="bg-[#111] w-full max-w-md rounded-2xl border border-white/10 shadow-2xl p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-semibold text-white">
                                {modalConfig.isEdit ? 'Bearbeiten: ' : 'Erstellen: '}
                                {modalConfig.type === 'category' && 'Gewerke'}
                                {modalConfig.type === 'subcategory' && 'Unterkategorie'}
                                {modalConfig.type === 'question' && 'Frage'}
                                {modalConfig.type === 'answer' && 'Antwort'}
                            </h2>
                            <button onClick={closeModal} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); handleSave(modalConfig.data); }} className="space-y-4">
                            {(modalConfig.type === 'category' || modalConfig.type === 'subcategory') && (
                                <>
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Name</label>
                                        <input required value={modalConfig.data.name} onChange={e => setModalConfig({ ...modalConfig, data: { ...modalConfig.data, name: e.target.value } })} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Beschreibung (opt.)</label>
                                        <input value={modalConfig.data.description || ''} onChange={e => setModalConfig({ ...modalConfig, data: { ...modalConfig.data, description: e.target.value } })} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" />
                                    </div>
                                    {modalConfig.type === 'category' && (
                                        <div>
                                            <label className="text-xs text-gray-400 mb-1 block">Sichtbarkeit / Zielgruppe</label>
                                            <div className="relative">
                                                <select 
                                                    value={modalConfig.data.target || 'both'} 
                                                    onChange={e => setModalConfig({ ...modalConfig, data: { ...modalConfig.data, target: e.target.value } })} 
                                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-white appearance-none cursor-pointer pr-10 focus:border-blue-500/50 outline-none transition-colors"
                                                >
                                                    <option value="both" className="bg-[#111] text-white">Beide (Website & Admin-Panel)</option>
                                                    <option value="site" className="bg-[#111] text-teal-300">Nur Website (Kundenportal)</option>
                                                    <option value="admin" className="bg-[#111] text-purple-300">Nur Admin-Panel (Interne Erfassung)</option>
                                                </select>
                                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                                                    <i className="fa-solid fa-chevron-down text-xs"></i>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="text-xs text-gray-400 mb-1 block">Reihenfolge</label>
                                            <input type="number" value={modalConfig.data.order_index} onChange={e => setModalConfig({ ...modalConfig, data: { ...modalConfig.data, order_index: Number(e.target.value) } })} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" />
                                        </div>
                                        {modalConfig.type === 'category' && (
                                            <div className="flex-1">
                                                <label className="text-xs text-gray-400 mb-1 block">Icon (FontAwesome)</label>
                                                <input value={modalConfig.data.icon || ''} onChange={e => setModalConfig({ ...modalConfig, data: { ...modalConfig.data, icon: e.target.value } })} placeholder="fa-solar-panel" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" />
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {modalConfig.type === 'question' && (
                                <>
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Frage</label>
                                        <input required value={modalConfig.data.question_text} onChange={e => setModalConfig({ ...modalConfig, data: { ...modalConfig.data, question_text: e.target.value } })} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" placeholder="z.B. Wie groß ist das Dach?" />
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="text-xs text-gray-400 mb-1 block">Interner Schlüssel</label>
                                            <input value={modalConfig.data.field_key || ''} onChange={e => setModalConfig({ ...modalConfig, data: { ...modalConfig.data, field_key: e.target.value } })} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" placeholder="napp.dach_groesse" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs text-gray-400 mb-1 block">Feldtyp</label>
                                            <select value={modalConfig.data.type} onChange={e => setModalConfig({ ...modalConfig, data: { ...modalConfig.data, type: e.target.value } })} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white">
                                                <option value="buttons">Buttons (Funnel)</option>
                                                <option value="radio">Radio</option>
                                                <option value="select">Dropdown</option>
                                                <option value="slider">Slider (Schieberegler)</option>
                                                <option value="input">Textfeld (Eingabe)</option>
                                                <option value="checkbox">Checkboxen</option>
                                            </select>
                                        </div>
                                    </div>
                                    {modalConfig.data.type === 'slider' && (
                                        <div className="bg-white/5 p-3 rounded-lg grid grid-cols-2 gap-3 mt-2">
                                            <div>
                                                <label className="text-[10px] text-gray-400">Min</label>
                                                <input type="number" value={modalConfig.data.config?.min ?? 0} onChange={e => setModalConfig({ ...modalConfig, data: { ...modalConfig.data, config: { ...modalConfig.data.config, min: Number(e.target.value) } } })} className="w-full bg-black/40 text-xs px-2 py-1 rounded" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-400">Max</label>
                                                <input type="number" value={modalConfig.data.config?.max ?? 100} onChange={e => setModalConfig({ ...modalConfig, data: { ...modalConfig.data, config: { ...modalConfig.data.config, max: Number(e.target.value) } } })} className="w-full bg-black/40 text-xs px-2 py-1 rounded" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-400">Schrittweite</label>
                                                <input type="number" value={modalConfig.data.config?.step ?? 1} onChange={e => setModalConfig({ ...modalConfig, data: { ...modalConfig.data, config: { ...modalConfig.data.config, step: Number(e.target.value) } } })} className="w-full bg-black/40 text-xs px-2 py-1 rounded" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-400">Einheit</label>
                                                <input value={modalConfig.data.unit || ''} onChange={e => setModalConfig({ ...modalConfig, data: { ...modalConfig.data, unit: e.target.value } })} className="w-full bg-black/40 text-xs px-2 py-1 rounded" placeholder="z.B. m², kWp" />
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Reihenfolge</label>
                                        <input type="number" value={modalConfig.data.order_index} onChange={e => setModalConfig({ ...modalConfig, data: { ...modalConfig.data, order_index: Number(e.target.value) } })} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" />
                                    </div>
                                </>
                            )}

                            {modalConfig.type === 'answer' && (
                                <>
                                    {(modalConfig.extraOptions?.parentQuestion?.type === 'slider' || modalConfig.extraOptions?.parentQuestion?.type === 'input') && (
                                        <div className="text-xs text-teal-300 bg-teal-500/10 border border-teal-500/20 p-3.5 rounded-lg flex items-start gap-2.5 mb-3 leading-relaxed">
                                            <i className="fa-solid fa-circle-info mt-0.5 text-teal-400 text-sm"></i>
                                            <span>
                                                Dieses Feld ist ein Schieberegler oder ein Textfeld. Die Antwort dient als Beschriftung für den Weiter-Button (z. B. <strong>Weiter</strong>) und definiert die Logik zum nächsten Schritt.
                                            </span>
                                        </div>
                                    )}
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Antwort-Text (Button Label)</label>
                                        <input required value={modalConfig.data.answer_text} onChange={e => setModalConfig({ ...modalConfig, data: { ...modalConfig.data, answer_text: e.target.value } })} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" />
                                    </div>
                                    <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
                                        <label className="text-xs text-blue-300 mb-2 font-semibold block flex items-center gap-2">
                                            <i className="fa-solid fa-code-branch"></i> Logik: Nächster Schritt
                                        </label>
                                        <select value={modalConfig.data.next_question_id || ''} onChange={e => setModalConfig({ ...modalConfig, data: { ...modalConfig.data, next_question_id: e.target.value } })} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white appearance-none">
                                            <option value="">-- [ENDE] Zum Kontaktformular springen --</option>
                                            {modalConfig.extraOptions?.siblingQuestions?.map(sq => (
                                                <option key={sq.id} value={sq.id} className="bg-gray-800">Frage {sq.id}: {sq.question_text}</option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-gray-400 mt-2">Wohin soll der Nutzer geleitet werden, wenn er diese Antwort wählt?</p>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Reihenfolge</label>
                                        <input type="number" value={modalConfig.data.order_index} onChange={e => setModalConfig({ ...modalConfig, data: { ...modalConfig.data, order_index: Number(e.target.value) } })} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" />
                                    </div>
                                </>
                            )}

                            <div className="pt-4 flex justify-end gap-3 border-t border-white/10 mt-6">
                                <button type="button" onClick={closeModal} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300">Abbrechen</button>
                                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg shadow font-medium">Speichern</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Categories;
