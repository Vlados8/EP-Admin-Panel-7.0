import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import usePermission from '../../hooks/usePermission';
import InquiryDetailsModal from './InquiryDetailsModal';
import ProjectCreateModal from '../projects/ProjectCreateModal';
import ProjectWizard from '../projects/ProjectWizard';
import { usePhone } from '../../context/PhoneContext';
import CallHistoryModal from '../communication/CallHistoryModal';

const COLUMNS = [
    { id: 'new', title: 'Neu', icon: 'fa-star', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { id: 'contacted', title: 'Kontaktiert', icon: 'fa-phone-volume', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { id: 'qualified', title: 'Qualifiziert', icon: 'fa-user-check', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { id: 'proposal', title: 'Angebot', icon: 'fa-file-signature', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { id: 'won', title: 'Gewonnen', icon: 'fa-trophy', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { id: 'lost', title: 'Verloren', icon: 'fa-xmark', color: 'text-red-400', bg: 'bg-red-500/10' }
];

const Inquiries = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user: currentUser } = useSelector(state => state.auth);

    useEffect(() => {
        if (currentUser) {
            const role = currentUser.role?.name || currentUser.role;
            if (role !== 'Admin' && role !== 'Büro') {
                navigate('/dashboard');
            }
        }
    }, [currentUser, navigate]);
    const [inquiries, setInquiries] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedInquiry, setSelectedInquiry] = useState(null);
    const [isProjectWizardOpen, setIsProjectWizardOpen] = useState(false);
    const [projectWizardData, setProjectWizardData] = useState(null);

    // --- FUNNEL WIZARD STATE ---
    const [wizardStep, setWizardStep] = useState(1);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [dynamicAnswers, setDynamicAnswers] = useState({});
    const [wizardFormData, setWizardFormData] = useState({
        title: '', contact_name: '', contact_email: '', contact_phone: '', location: '', notes: ''
    });
    const [checkboxSelections, setCheckboxSelections] = useState([]);
    const [viewMode, setViewMode] = useState('board'); // 'board' or 'list'
    const { makeCall, callState } = usePhone();
    
    const [historyNumber, setHistoryNumber] = useState(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    const canManageInquiries = usePermission('MANAGE_INQUIRIES');
    const canDeleteInquiryPerm = usePermission('MANAGE_USERS'); // Proxy for Admin/Office

    const fetchData = async () => {
        try {
            setLoading(true);
            const [inqRes, catRes] = await Promise.all([
                api.get('/inquiries'),
                api.get('/categories')
            ]);
            setInquiries(inqRes.data.data.inquiries);
            setCategories(catRes.data.data.categories);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Auto-open inquiry from navigation state
    useEffect(() => {
        if (location.state?.openInquiryId && inquiries.length > 0) {
            const inq = inquiries.find(i => i.id === location.state.openInquiryId);
            if (inq) {
                setSelectedInquiry(inq);
            }
        }
    }, [location.state, inquiries]);

    const handleStatusChange = async (inquiryId, newStatus) => {
        try {
            setInquiries(prev => prev.map(inq => inq.id === inquiryId ? { ...inq, status: newStatus } : inq));
            await api.patch(`/inquiries/${inquiryId}`, { status: newStatus });
        } catch (error) {
            console.error('Error updating status:', error);
            fetchData();
        }
    };

    const deleteInquiry = async (id) => {
        if (!window.confirm('Möchten Sie diese Anfrage wirklich löschen?')) return;
        try {
            await api.delete(`/inquiries/${id}`);
            fetchData();
            if (selectedInquiry?.id === id) setSelectedInquiry(null);
        } catch (error) {
            console.error('Error deleting inquiry:', error);
        }
    };

    // --- WIZARD LOGIC ---
    const openWizard = () => {
        setWizardStep(1);
        setSelectedCategory(null);
        setSelectedSubcategory(null);
        setCurrentQuestion(null);
        setDynamicAnswers({});
        setWizardFormData({
            title: '', contact_name: '', contact_email: '', contact_phone: '', location: '', notes: ''
        });
        setCheckboxSelections([]);
        setIsWizardOpen(true);
    };

    const handleCategorySelect = (cat) => {
        setSelectedCategory(cat);
        if (cat.subcategories && cat.subcategories.length > 0) {
            setWizardStep(2);
        } else {
            setWizardStep(4);
        }
    };

    const handleSubcategorySelect = (subcat) => {
        setSelectedSubcategory(subcat);
        if (subcat.questions && subcat.questions.length > 0) {
            setCurrentQuestion(subcat.questions[0]);
            setWizardStep(3);
        } else {
            setWizardStep(4);
        }
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
                setWizardStep(4);
            }
        } else {
            setWizardStep(4);
        }
    };

    const submitCheckboxes = () => {
        if (checkboxSelections.length === 0) return;
        const values = checkboxSelections.map(a => a.answer_text).join(', ');
        const firstSelected = checkboxSelections[0];
        handleAnswerQuestion(currentQuestion, values, firstSelected?.id, firstSelected?.next_question_id);
        setCheckboxSelections([]);
    };

    const handleBackQuestion = () => {
        setCheckboxSelections([]);
        if (wizardStep === 4) {
            if (selectedSubcategory?.questions?.length > 0) { setWizardStep(3); setCurrentQuestion(selectedSubcategory.questions[0]); }
            else if (selectedCategory?.subcategories?.length > 0) setWizardStep(2);
            else setWizardStep(1);
        } else if (wizardStep === 5) setWizardStep(4);
        else if (wizardStep === 3) setWizardStep(2);
        else if (wizardStep === 2) setWizardStep(1);
    };

    const submitWizard = async () => {
        const finalData = {
            title: wizardFormData.title,
            category_id: selectedCategory?.id,
            subcategory_id: selectedSubcategory?.id,
            contact_name: wizardFormData.contact_name,
            contact_email: wizardFormData.contact_email,
            contact_phone: wizardFormData.contact_phone,
            location: wizardFormData.location,
            notes: wizardFormData.notes,
            status: 'new',
            answers: Object.keys(dynamicAnswers).map(qId => ({
                question_id: parseInt(qId),
                answer_id: dynamicAnswers[qId].answerId || null,
                answer_value: dynamicAnswers[qId].value
            }))
        };
        try {
            await api.post('/inquiries', finalData);
            fetchData();
            setIsWizardOpen(false);
        } catch (error) {
            console.error('Error saving inquiry:', error);
            alert('Fehler beim Speichern der Anfrage.');
        }
    };

    const filteredInquiries = inquiries.filter(inq => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const formattedId = `inq-${String(inq.id).padStart(3, '0')}`;
        const rawId = String(inq.id);
        
        return (
            inq.title?.toLowerCase().includes(q) || 
            inq.contact_name?.toLowerCase().includes(q) || 
            inq.category?.name?.toLowerCase().includes(q) ||
            formattedId.includes(q) ||
            rawId.includes(q)
        );
    });

    // Sub-components
    const InquiryCard = ({ inquiry }) => (
        <div
            className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors shadow-sm group cursor-pointer"
            onClick={() => setSelectedInquiry(inquiry)}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <div className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 truncate max-w-[150px]">
                        {inquiry.category?.name || 'Allgemein'}
                    </div>
                    <div className="text-xs font-mono px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-400">
                        #INQ-{String(inquiry.id).padStart(3, '0')}
                    </div>
                    {!inquiry.is_read && (
                        <div className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500 text-white animate-pulse">
                            NEU
                        </div>
                    )}
                </div>
                {canDeleteInquiryPerm && (
                    <button onClick={(e) => { e.stopPropagation(); deleteInquiry(inquiry.id); }} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                        <i className="fa-solid fa-trash-can text-xs"></i>
                    </button>
                )}
            </div>
            <h4 className="font-semibold text-white mb-1 line-clamp-2">{inquiry.title}</h4>
            <div className="flex items-center justify-between gap-2 text-xs text-gray-400 mb-3">
                <div className="flex items-center gap-2 truncate">
                    <i className="fa-solid fa-user text-[10px]"></i>
                    <span className="truncate">{inquiry.contact_name}</span>
                </div>
                {inquiry.contact_phone && (
                    <button
                        onClick={(e) => { e.stopPropagation(); makeCall(inquiry.contact_phone); }}
                        className="w-8 h-8 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center hover:bg-green-500 hover:text-white transition-all shadow-sm"
                        title="Anrufen"
                    >
                        <i className="fa-solid fa-phone text-[10px]"></i>
                    </button>
                )}
            </div>

            {inquiry.answers && inquiry.answers.length > 0 && (
                <div className="space-y-1 mt-3 pt-3 border-t border-white/5">
                    {inquiry.answers.slice(0, 2).map(ans => (
                        <div key={ans.id} className="text-xs flex flex-col">
                            <span className="text-gray-500">{ans.question?.question_text || 'Frage'}:</span>
                            <span className="text-gray-300 truncate">{ans.answer_value || ans.answer?.answer_text || '-'}</span>
                        </div>
                    ))}
                    {inquiry.answers.length > 2 && <div className="text-[10px] text-gray-500 italic">+{inquiry.answers.length - 2} weitere Details</div>}
                </div>
            )}

            <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                <span>{new Date(inquiry.createdAt).toLocaleDateString('de-DE')}</span>
                <select
                    value={inquiry.status}
                    onChange={(e) => { e.stopPropagation(); handleStatusChange(inquiry.id, e.target.value); }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-black/30 border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                    {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
            </div>
        </div>
    );

    return (
        <div className="animate-[fadeIn_0.4s_ease-out_forwards] h-[calc(100vh-80px)] flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-white">Anfragen (Leads)</h2>
                    <p className="text-gray-400 text-sm mt-1">Erfassen und verwalten Sie Kundenanfragen mit dem Funnel-Builder.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input type="text" placeholder="Suchen..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-black/20 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors w-full md:w-48 lg:w-64" />
                    </div>
                    {canManageInquiries && (
                        <button onClick={openWizard} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_25px_rgba(37,99,235,0.6)] hover:-translate-y-0.5 flex items-center gap-2 text-sm font-medium whitespace-nowrap">
                            <i className="fa-solid fa-plus"></i> Neue Anfrage
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-gray-400">Lade Anfragen...</div>
            ) : (
                <>
                    {/* Mobile Card List */}
                    <div className="md:hidden space-y-4 overflow-y-auto flex-1 mt-2 pb-20">
                        {filteredInquiries.length === 0 ? (
                            <div className="text-center py-20 text-gray-500 italic bg-white/5 rounded-2xl border border-white/10">Keine Anfragen gefunden.</div>
                        ) : (
                            filteredInquiries.map(inq => (
                                <InquiryCard key={inq.id} inquiry={inq} />
                            ))
                        )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block glass-card rounded-2xl overflow-hidden mt-2">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-white/5 border-b border-white/10">
                                    <tr>
                                        <th className="p-4">Anfrage / Details</th>
                                        <th className="p-4">Kategorie</th>
                                        <th className="p-4">Kontakt / Kunde</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Aktionen</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredInquiries.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="p-8 text-center text-gray-400 bg-white/5">Keine Anfragen gefunden.</td>
                                        </tr>
                                    ) : (
                                        filteredInquiries.map(inq => (
                                            <tr key={inq.id} className="hover:bg-white/5 transition-colors">
                                                {/* Column 1: Title & Details */}
                                                <td className="p-4 align-top max-w-[300px]">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded border border-white/10 shrink-0">
                                                            #INQ-{String(inq.id).padStart(3, '0')}
                                                        </span>
                                                        <div className="font-semibold text-white text-base truncate">{inq.title}</div>
                                                        {!inq.is_read && (
                                                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)] animate-pulse uppercase">
                                                                Neu
                                                            </span>
                                                        )}
                                                    </div>
                                                    {inq.notes && <div className="text-xs text-gray-400 mt-1 line-clamp-2">{inq.notes}</div>}
                                                    {inq.answers && inq.answers.length > 0 && (
                                                        <div className="text-xs text-gray-500 mt-1.5 space-y-0.5">
                                                            {inq.answers.slice(0, 3).map((ans, i) => (
                                                                <div key={ans.id} className="truncate">
                                                                    <span className="text-gray-400">{ans.question?.question_text}:</span> {ans.answer_value || ans.answer?.answer_text}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Column 2: Category */}
                                                <td className="p-4 align-top">
                                                    <div className="text-gray-300 text-sm">
                                                        {inq.category?.name || '-'}
                                                    </div>
                                                </td>

                                                {/* Column 3: Contact */}
                                                <td className="p-4 align-top">
                                                    <div className="text-sm">
                                                        <div className="text-gray-300 font-medium">{inq.contact_name}</div>
                                                        <div className="flex items-center gap-2 text-gray-500 text-xs mt-0.5 max-w-[200px]">
                                                            <span className="truncate">{inq.contact_email || inq.contact_phone}</span>
                                                            {inq.contact_phone && (
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        onClick={() => makeCall(inq.contact_phone)}
                                                                        disabled={callState !== 'idle' || !inq.contact_phone}
                                                                        className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                                                                            callState !== 'idle' ? 'bg-gray-500/10 text-gray-500 cursor-not-allowed' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white'
                                                                        }`}
                                                                        title="Anrufen"
                                                                    >
                                                                        <i className="fa-solid fa-phone text-[8px]"></i>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setHistoryNumber(inq.contact_phone);
                                                                            setIsHistoryOpen(true);
                                                                        }}
                                                                        className="shrink-0 w-6 h-6 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-all"
                                                                        title="Anrufverlauf"
                                                                    >
                                                                        <i className="fa-solid fa-clock-rotate-left text-[8px]"></i>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Column 4: Status */}
                                                <td className="p-4 align-top">
                                                    <select
                                                        value={inq.status}
                                                        onChange={e => handleStatusChange(inq.id, e.target.value)}
                                                        className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer w-full max-w-[150px] appearance-none"
                                                    >
                                                        {COLUMNS.map(c => <option key={c.id} value={c.id} className="bg-gray-900">{c.title}</option>)}
                                                    </select>
                                                    <div className="text-xs text-gray-600 mt-2">{new Date(inq.createdAt).toLocaleDateString('de-DE')}</div>
                                                </td>

                                                {/* Column 5: Actions */}
                                                <td className="p-4 align-top hidden md:table-cell w-[100px]">
                                                    <div className="flex items-center justify-end gap-3">
                                                        <button
                                                            onClick={() => setSelectedInquiry(inq)}
                                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors"
                                                            title="Details anzeigen"
                                                        >
                                                            <i className="fa-solid fa-eye"></i>
                                                        </button>                                                        {canDeleteInquiryPerm && (
                                                            <button
                                                                onClick={() => deleteInquiry(inq.id)}
                                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                                                                title="Anfrage löschen"
                                                            >
                                                                <i className="fa-solid fa-trash-can"></i>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* FULLSCREEN FUNNEL WIZARD */}
            {isWizardOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070b14] px-4 py-8 overflow-y-auto">
                    <div className="w-full max-w-4xl h-full flex flex-col relative animate-[fadeIn_0.3s_ease-out]">

                        {/* Header Controls */}
                        <div className="absolute top-4 right-4 z-10">
                            <button onClick={() => setIsWizardOpen(false)} className="w-10 h-10 rounded-full bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors border border-white/10 backdrop-blur-md">
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>

                        {/* Progress Bar */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
                            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${(wizardStep / 5) * 100}%` }}></div>
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center p-8">

                            {/* STEP 1: Main Categories */}
                            {wizardStep === 1 && (
                                <div className="text-center w-full max-w-2xl animate-[slideUp_0.4s_ease-out]">
                                    <h3 className="text-blue-400 font-medium tracking-widest text-sm uppercase mb-3">Schritt 1</h3>
                                    <h2 className="text-3xl md:text-4xl font-semibold text-white mb-12">Wie können wir Ihnen helfen?</h2>

                                    {categories.length === 0 ? (
                                        <div className="bg-white/5 border border-white/10 p-8 rounded-2xl text-gray-400">
                                            Es wurden noch keine Kategorien angelegt. Bitte richten Sie diese zuerst im Bereich "Kategorien & Fragen" ein.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                            {categories.map(cat => (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => handleCategorySelect(cat)}
                                                    className="aspect-square bg-[#0a101d] border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-blue-500 hover:bg-blue-500/5 hover:-translate-y-1 transition-all group shadow-lg"
                                                >
                                                    <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                                        <i className={`fa-solid ${cat.icon || 'fa-folder'} text-2xl`}></i>
                                                    </div>
                                                    <span className="text-gray-300 font-medium group-hover:text-white transition-colors">{cat.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* STEP 2: Subcategories */}
                            {wizardStep === 2 && selectedCategory && (
                                <div className="text-center w-full max-w-2xl animate-[slideUp_0.4s_ease-out]">
                                    <h3 className="text-blue-400 font-medium tracking-widest text-sm uppercase mb-3">{selectedCategory.name}</h3>
                                    <h2 className="text-3xl md:text-4xl font-semibold text-white mb-12">Welchen Bereich genau betrifft Ihre Anfrage?</h2>

                                    {selectedCategory.subcategories?.length === 0 ? (
                                        <div className="bg-white/5 border border-white/10 p-8 rounded-2xl text-gray-400">
                                            Keine Unterkategorien konfiguriert.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {selectedCategory.subcategories?.map(subcat => (
                                                <button
                                                    key={subcat.id}
                                                    onClick={() => handleSubcategorySelect(subcat)}
                                                    className="bg-[#0a101d] border border-white/10 rounded-xl p-6 text-left flex items-center justify-between hover:border-blue-500 hover:bg-blue-500/5 transition-all group shadow-lg"
                                                >
                                                    <span className="text-lg text-gray-300 font-medium group-hover:text-white transition-colors">{subcat.name}</span>
                                                    <i className="fa-solid fa-arrow-right text-gray-600 group-hover:text-blue-400 transition-colors"></i>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <button onClick={() => setWizardStep(1)} className="mt-8 text-gray-500 hover:text-white text-sm font-medium transition-colors">
                                        <i className="fa-solid fa-arrow-left mr-2"></i> Zurück
                                    </button>
                                </div>
                            )}

                            {/* STEP 3: The Interactive Tree */}
                            {wizardStep === 3 && currentQuestion && (
                                <div className="text-center w-full max-w-3xl animate-[slideUp_0.4s_ease-out]">
                                    <h3 className="text-blue-400 font-medium tracking-widest text-sm uppercase mb-3">{selectedSubcategory?.name}</h3>
                                    <h2 className="text-3xl md:text-4xl font-semibold text-white mb-12">{currentQuestion.question_text}</h2>

                                    {(!currentQuestion.type || currentQuestion.type === 'buttons' || currentQuestion.type === 'radio') ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {currentQuestion.answers?.map(ans => (
                                                <button
                                                    key={ans.id}
                                                    onClick={() => handleAnswerQuestion(currentQuestion, ans.answer_text, ans.id, ans.next_question_id)}
                                                    className="bg-[#0a101d] border-2 border-white/10 rounded-xl p-6 text-center hover:border-blue-500 hover:bg-blue-500/5 hover:-translate-y-1 transition-all shadow-lg min-h-[100px] flex items-center justify-center"
                                                >
                                                    <span className="text-lg text-gray-300 font-medium">{ans.answer_text}</span>
                                                </button>
                                            ))}
                                            {currentQuestion.answers?.length === 0 && <p className="text-gray-500 italic col-span-full">Keine Antworten konfiguriert.</p>}
                                        </div>
                                    ) : currentQuestion.type === 'checkbox' ? (
                                        <div className="w-full">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 text-left">
                                                {currentQuestion.answers?.map(ans => {
                                                    const isSelected = checkboxSelections.some(s => s.id === ans.id);
                                                    return (
                                                        <button
                                                            key={ans.id}
                                                            onClick={() => {
                                                                setCheckboxSelections(prev => isSelected ? prev.filter(s => s.id !== ans.id) : [...prev, ans]);
                                                            }}
                                                            className={`border-2 rounded-xl p-6 transition-all shadow-lg min-h-[100px] flex gap-4 items-center ${isSelected ? 'bg-blue-500/10 border-blue-500 text-white' : 'bg-[#0a101d] border-white/10 text-gray-300 hover:border-blue-500/50 hover:bg-blue-500/5'}`}
                                                        >
                                                            <div className={`w-6 h-6 shrink-0 rounded flex items-center justify-center border transition-colors ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'bg-black/30 border-white/20'}`}>
                                                                {isSelected && <i className="fa-solid fa-check text-xs"></i>}
                                                            </div>
                                                            <span className="text-lg font-medium">{ans.answer_text}</span>
                                                        </button>
                                                    );
                                                })}
                                                {currentQuestion.answers?.length === 0 && <p className="text-gray-500 italic col-span-full text-center">Keine Antworten konfiguriert.</p>}
                                            </div>
                                            <button
                                                onClick={submitCheckboxes}
                                                disabled={checkboxSelections.length === 0}
                                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-8 py-3 rounded-xl transition-colors shadow-lg"
                                            >
                                                Weiter <i className="fa-solid fa-arrow-right ml-2"></i>
                                            </button>
                                        </div>
                                    ) : currentQuestion.type === 'select' ? (
                                        <div className="max-w-md mx-auto">
                                            <select
                                                onChange={(e) => {
                                                    const selectedAns = currentQuestion.answers?.find(a => a.id === parseInt(e.target.value));
                                                    if (selectedAns) handleAnswerQuestion(currentQuestion, selectedAns.answer_text, selectedAns.id, selectedAns.next_question_id);
                                                }}
                                                className="w-full bg-[#0a101d] border-2 border-white/10 rounded-xl p-4 text-lg text-white appearance-none cursor-pointer hover:border-blue-500/50 transition-colors text-center focus:outline-none focus:border-blue-500"
                                                defaultValue=""
                                            >
                                                <option value="" disabled>Bitte wählen...</option>
                                                {currentQuestion.answers?.map(ans => <option key={ans.id} value={ans.id}>{ans.answer_text}</option>)}
                                            </select>
                                        </div>
                                    ) : currentQuestion.type === 'slider' ? (
                                        <div className="max-w-xl mx-auto bg-[#0a101d] border border-white/10 p-8 rounded-2xl shadow-lg">
                                            <input
                                                type="range"
                                                min={currentQuestion.config?.min || 0}
                                                max={currentQuestion.config?.max || 100}
                                                step={currentQuestion.config?.step || 1}
                                                defaultValue={currentQuestion.config?.min || 0}
                                                onChange={(e) => {
                                                    document.getElementById('slider-val-display').innerText = `${e.target.value} ${currentQuestion.unit || ''}`;
                                                }}
                                                id="temp-slider"
                                                className="w-full h-3 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500 mb-6"
                                            />
                                            <div id="slider-val-display" className="text-4xl font-bold text-blue-400 mb-8">{currentQuestion.config?.min || 0} {currentQuestion.unit || ''}</div>
                                            <button
                                                onClick={() => {
                                                    const val = document.getElementById('temp-slider').value;
                                                    // Pass nulls to trigger the fallback logic in handleAnswerQuestion
                                                    handleAnswerQuestion(currentQuestion, `${val} ${currentQuestion.unit || ''}`, null, null);
                                                }}
                                                className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-8 py-3 rounded-xl transition-colors shadow-lg"
                                            >Weiter</button>
                                        </div>
                                    ) : currentQuestion.type === 'input' ? (
                                        <div className="max-w-xl mx-auto bg-[#0a101d] border border-white/10 p-8 rounded-2xl shadow-lg">
                                            <input
                                                type="text"
                                                placeholder="Ihre Antwort..."
                                                id="temp-input"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-lg focus:outline-none focus:border-blue-500 mb-6"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const val = e.target.value;
                                                        if (val.trim()) handleAnswerQuestion(currentQuestion, val, null, null);
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={() => {
                                                    const val = document.getElementById('temp-input').value;
                                                    if (val.trim()) handleAnswerQuestion(currentQuestion, val, null, null);
                                                }}
                                                className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-8 py-3 rounded-xl transition-colors shadow-lg"
                                            >Weiter</button>
                                        </div>
                                    ) : null}

                                    <button onClick={handleBackQuestion} className="mt-12 text-gray-500 hover:text-white text-sm font-medium transition-colors">
                                        <i className="fa-solid fa-arrow-left mr-2"></i> Zurück
                                    </button>
                                </div>
                            )}

                            {/* STEP 4: Contact Info */}
                            {wizardStep === 4 && (
                                <div className="text-center w-full max-w-2xl animate-[slideUp_0.4s_ease-out]">
                                    <h3 className="text-emerald-400 font-medium tracking-widest text-sm uppercase mb-3">Fast geschafft</h3>
                                    <h2 className="text-3xl md:text-4xl font-semibold text-white mb-8">Wie dürfen wir Sie kontaktieren?</h2>

                                    <form onSubmit={(e) => { e.preventDefault(); setWizardStep(5); }} className="bg-[#0a101d] border border-white/10 p-8 rounded-2xl shadow-lg space-y-5 text-left">
                                        <div>
                                            <label className="text-sm font-medium text-gray-400 mb-1 block">Kurztitel / Projektname <span className="text-blue-500">*</span></label>
                                            <input required value={wizardFormData.title} onChange={e => setWizardFormData({ ...wizardFormData, title: e.target.value })} className="w-full bg-white/5 border border-white/10 focus:bg-black/40 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 text-lg transition-colors" placeholder="z.B. Heizungssanierung Müller" />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div>
                                                <label className="text-sm font-medium text-gray-400 mb-1 block">Name <span className="text-blue-500">*</span></label>
                                                <input required value={wizardFormData.contact_name} onChange={e => setWizardFormData({ ...wizardFormData, contact_name: e.target.value })} className="w-full bg-white/5 border border-white/10 focus:bg-black/40 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 text-lg transition-colors" />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-400 mb-1 block">Wohnort / PLZ</label>
                                                <input value={wizardFormData.location} onChange={e => setWizardFormData({ ...wizardFormData, location: e.target.value })} className="w-full bg-white/5 border border-white/10 focus:bg-black/40 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 text-lg transition-colors" />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-400 mb-1 block">E-Mail</label>
                                                <input type="email" value={wizardFormData.contact_email} onChange={e => setWizardFormData({ ...wizardFormData, contact_email: e.target.value })} className="w-full bg-white/5 border border-white/10 focus:bg-black/40 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 text-lg transition-colors" />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-400 mb-1 block">Telefon</label>
                                                <input type="tel" value={wizardFormData.contact_phone} onChange={e => setWizardFormData({ ...wizardFormData, contact_phone: e.target.value })} className="w-full bg-white/5 border border-white/10 focus:bg-black/40 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 text-lg transition-colors" />
                                            </div>
                                        </div>

                                        <div className="pt-4 flex justify-between items-center mt-6">
                                            <button type="button" onClick={handleBackQuestion} className="text-gray-500 hover:text-white font-medium">Zurück</button>
                                            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-8 py-3 rounded-xl transition-colors shadow-lg">Zusammenfassung <i className="fa-solid fa-arrow-right ml-2"></i></button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* STEP 5: Summary */}
                            {wizardStep === 5 && (
                                <div className="text-center w-full max-w-2xl animate-[slideUp_0.4s_ease-out]">
                                    <h3 className="text-emerald-400 font-medium tracking-widest text-sm uppercase mb-3">Letzter Schritt</h3>
                                    <h2 className="text-3xl md:text-4xl font-semibold text-white mb-8">Angaben überprüfen & absenden</h2>

                                    <div className="bg-[#0a101d] border border-white/10 p-8 rounded-2xl shadow-lg text-left">
                                        <div className="mb-6 pb-6 border-b border-white/10">
                                            <h4 className="text-blue-400 font-semibold mb-4 text-lg">Kontakt</h4>
                                            <div className="text-white text-lg mb-1">{wizardFormData.contact_name}</div>
                                            <div className="text-gray-400 text-sm">
                                                {wizardFormData.contact_email} {wizardFormData.contact_phone && `| ${wizardFormData.contact_phone}`} {wizardFormData.location && `| ${wizardFormData.location}`}
                                            </div>
                                        </div>

                                        <div className="mb-8">
                                            <h4 className="text-blue-400 font-semibold mb-4 text-lg">Konfiguration</h4>
                                            <ul className="space-y-3">
                                                <li className="flex justify-between border-b border-white/5 pb-2">
                                                    <span className="text-gray-400">Bereich:</span>
                                                    <span className="text-white font-medium">{selectedCategory?.name} / {selectedSubcategory?.name || '-'}</span>
                                                </li>
                                                {Object.keys(dynamicAnswers).map(qId => {
                                                    const q = selectedSubcategory?.questions?.find(sq => sq.id === parseInt(qId));
                                                    if (!q) return null;
                                                    return (
                                                        <li key={qId} className="flex flex-col border-b border-white/5 pb-2">
                                                            <span className="text-gray-400 text-sm">{q.question_text}</span>
                                                            <span className="text-emerald-300 font-medium">{dynamicAnswers[qId].value}</span>
                                                        </li>
                                                    )
                                                })}
                                            </ul>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-gray-400 mb-2 block">Notizen hinzufügen (optional)</label>
                                            <textarea value={wizardFormData.notes} onChange={e => setWizardFormData({ ...wizardFormData, notes: e.target.value })} rows="3" className="w-full bg-white/5 border border-white/10 focus:bg-black/40 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none mb-6"></textarea>
                                        </div>

                                        <div className="flex justify-between items-center bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                                            <button type="button" onClick={() => setWizardStep(4)} className="text-blue-300 hover:text-white font-medium">Zurück</button>
                                            <button onClick={submitWizard} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-8 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-2">
                                                <i className="fa-solid fa-paper-plane"></i> Jetzt Anfragen
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

            <InquiryDetailsModal
                inquiry={selectedInquiry}
                isOpen={!!selectedInquiry}
                onClose={() => {
                    // Update local state is_read when closing, so list reflects it
                    if (selectedInquiry && !selectedInquiry.is_read) {
                        setInquiries(prev => prev.map(inq => inq.id === selectedInquiry.id ? { ...inq, is_read: true } : inq));
                    }
                    setSelectedInquiry(null);
                }}
                onProjectCreate={(inq) => {
                    setProjectWizardData(inq);
                    setIsProjectWizardOpen(true);
                    setSelectedInquiry(null); // Close inquiry modal
                }}
                onInquiryUpdated={(updatedInquiry) => {
                    setInquiries(prev => prev.map(i => i.id === updatedInquiry.id ? updatedInquiry : i));
                    setSelectedInquiry(updatedInquiry);
                }}
                onInquiryDeleted={(deletedId) => {
                    fetchData();
                }}
            />

            <ProjectCreateModal
                isOpen={isProjectWizardOpen}
                onClose={() => {
                    setIsProjectWizardOpen(false);
                    setProjectWizardData(null);
                }}
                onProjectCreated={() => {
                    alert('Projekt успешно создано и привязано!');
                    fetchData(); // Refresh inquiries to see status 'won'
                    setIsProjectWizardOpen(false);
                    setProjectWizardData(null);
                }}
                initialData={projectWizardData}
            />
            <CallHistoryModal 
                isOpen={isHistoryOpen} 
                onClose={() => setIsHistoryOpen(false)} 
                number={historyNumber} 
            />
        </div>
    );
};

export default Inquiries;
