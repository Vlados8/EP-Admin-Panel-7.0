import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
    Save, 
    Briefcase, 
    MapPin, 
    Mail, 
    Globe, 
    Phone, 
    CreditCard, 
    User,
    CheckCircle,
    XCircle,
    Image as ImageIcon,
    Upload,
    Trash2,
    Palette
} from 'lucide-react';
import api from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

const ImageUploadField = ({ label, value, onUpload, onRemove, getAssetUrl, folder = 'logos' }) => {
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('asset', file);

        try {
            const response = await api.post('/company/upload-asset', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data && response.data.status === 'success') {
                onUpload(response.data.data.url);
            }
        } catch (err) {
            console.error('Upload error:', err);
            alert('Fehler beim Hochladen des Bildes');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <label className="block text-sm font-medium text-white/50 ml-1">{label}</label>
            <div className="relative group overflow-hidden rounded-xl bg-white/5 border border-white/10 aspect-video flex items-center justify-center transition-all duration-300 hover:border-blue-500/50">
                {value ? (
                    <>
                        <img 
                            src={getAssetUrl(value)} 
                            alt={label} 
                            className="w-full h-full object-contain p-2" 
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            <button 
                                type="button"
                                onClick={() => fileInputRef.current.click()}
                                className="p-2 bg-blue-500 rounded-lg text-white hover:bg-blue-600 transition-colors"
                            >
                                <Upload className="w-5 h-5" />
                            </button>
                            <button 
                                type="button"
                                onClick={onRemove}
                                className="p-2 bg-red-500 rounded-lg text-white hover:bg-red-600 transition-colors"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </>
                ) : (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current.click()}
                        disabled={uploading}
                        className="flex flex-col items-center gap-2 text-white/30 group-hover:text-blue-400 transition-colors"
                    >
                        {uploading ? (
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        ) : (
                            <>
                                <ImageIcon className="w-10 h-10" />
                                <span className="text-sm font-medium">Bild hochladen</span>
                            </>
                        )}
                    </button>
                )}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*" 
                    className="hidden" 
                />
            </div>
        </div>
    );
};

const CompanySettings = () => {
    const { refreshCompanyData, getAssetUrl } = useCompany();
    const [settings, setSettings] = useState({
        firmName: '',
        address: '',
        zipCity: '',
        email: '',
        website: '',
        phone: '',
        taxId: '',
        vatId: '',
        bankName: '',
        iban: '',
        bic: '',
        ceo: '',
        court: '',
        hrb: '',
        accountHolder: '',
        logoLarge: '',
        logoSmall: '',
        logoLargeWhite: '',
        logoSmallWhite: '',
        adminBackground: '',
        logoUpperText: '',
        logoLowerText: '',
        instagram: '',
        tiktok: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await api.get('/company');
            if (response.data && response.data.status === 'success') {
                const combined = {
                    ...response.data.data.settings,
                    firmName: response.data.data.name || response.data.data.settings?.firmName || ''
                };
                setSettings(combined);
            }
        } catch (err) {
            console.error('Fetch error:', err);
            setMessage({ type: 'error', text: 'Fehler beim Laden der Einstellungen' });
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleAssetChange = (name, url) => {
        setSettings(prev => ({ ...prev, [name]: url }));
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const response = await api.patch('/company/settings', { settings });

            if (response.data && response.data.status === 'success') {
                setMessage({ type: 'success', text: 'Einstellungen успешно gespeichert!' });
                refreshCompanyData(); // Update global branding
                setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            }
        } catch (err) {
            console.error('Save error:', err);
            setMessage({ type: 'error', text: 'Fehler beim Speichern' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
    );

    const inputClasses = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-300";
    const labelClasses = "block text-sm font-medium text-white/50 mb-2 ml-1";
    const sectionClasses = "grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl mb-8";

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 max-w-6xl mx-auto"
        >
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Firmenangaben</h1>
                    <p className="text-white/60">Verwalten Sie Ihre Firmendaten und das Erscheinungsbild.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-blue-500/25 transition-all duration-300 disabled:opacity-50"
                >
                    {saving ? 'Speichere...' : <><Save className="w-5 h-5" /> Speichern</>}
                </button>
            </div>

            {message.text && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                    {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSave}>
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-blue-400" /> Design & Branding
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className={labelClasses}>Logo Text (Oben) - z.B. EMPIRE</label>
                        <input name="logoUpperText" value={settings.logoUpperText || ''} onChange={handleChange} className={inputClasses} placeholder="EMPIRE" />
                    </div>
                    <div>
                        <label className={labelClasses}>Logo Text (Unten) - z.B. PREMIUM BAU</label>
                        <input name="logoLowerText" value={settings.logoLowerText || ''} onChange={handleChange} className={inputClasses} placeholder="PREMIUM BAU" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {/* Standard Logos */}
                    <ImageUploadField 
                        label="Logo Standard (Groß)" 
                        value={settings.logoLarge}
                        onUpload={(url) => handleAssetChange('logoLarge', url)}
                        onRemove={() => handleAssetChange('logoLarge', '')}
                        getAssetUrl={getAssetUrl}
                    />
                    <ImageUploadField 
                        label="Logo Standard (Klein)" 
                        value={settings.logoSmall}
                        onUpload={(url) => handleAssetChange('logoSmall', url)}
                        onRemove={() => handleAssetChange('logoSmall', '')}
                        getAssetUrl={getAssetUrl}
                    />

                    {/* Background */}
                    <div className="md:row-span-2">
                        <ImageUploadField 
                            label="Dashboard Background" 
                            value={settings.adminBackground}
                            onUpload={(url) => handleAssetChange('adminBackground', url)}
                            onRemove={() => handleAssetChange('adminBackground', '')}
                            getAssetUrl={getAssetUrl}
                        />
                    </div>

                    {/* White Logos */}
                    <ImageUploadField 
                        label="Logo Weiß (Groß)" 
                        value={settings.logoLargeWhite}
                        onUpload={(url) => handleAssetChange('logoLargeWhite', url)}
                        onRemove={() => handleAssetChange('logoLargeWhite', '')}
                        getAssetUrl={getAssetUrl}
                    />
                    <ImageUploadField 
                        label="Logo Weiß (Klein)" 
                        value={settings.logoSmallWhite}
                        onUpload={(url) => handleAssetChange('logoSmallWhite', url)}
                        onRemove={() => handleAssetChange('logoSmallWhite', '')}
                        getAssetUrl={getAssetUrl}
                    />
                </div>

                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-blue-400" /> Basis-Informationen
                </h2>
                <div className={sectionClasses}>
                    <div>
                        <label className={labelClasses}>Firmenname</label>
                        <input name="firmName" value={settings.firmName} onChange={handleChange} className={inputClasses} placeholder="z.B. Empire Premium Bau GmbH" />
                    </div>
                    <div>
                        <label className={labelClasses}>Geschäftsführer</label>
                        <input name="ceo" value={settings.ceo} onChange={handleChange} className={inputClasses} placeholder="Vollständiger Name" />
                    </div>
                    <div>
                        <label className={labelClasses}>Straße / Hausnummer</label>
                        <input name="address" value={settings.address} onChange={handleChange} className={inputClasses} placeholder="Musterstraße 123" />
                    </div>
                    <div>
                        <label className={labelClasses}>PLZ / Ort</label>
                        <input name="zipCity" value={settings.zipCity} onChange={handleChange} className={inputClasses} placeholder="12345 Berlin" />
                    </div>
                </div>

                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-400" /> Kontakt & Rechtliches
                </h2>
                <div className={sectionClasses}>
                    <div>
                        <label className={labelClasses}>E-Mail Adresse</label>
                        <input name="email" value={settings.email} onChange={handleChange} className={inputClasses} placeholder="info@example.com" />
                    </div>
                    <div>
                        <label className={labelClasses}>Webseite</label>
                        <input name="website" value={settings.website} onChange={handleChange} className={inputClasses} placeholder="www.example.com" />
                    </div>
                    <div>
                        <label className={labelClasses}>Telefon</label>
                        <input name="phone" value={settings.phone} onChange={handleChange} className={inputClasses} placeholder="+49 30 123456" />
                    </div>
                    <div>
                        <label className={labelClasses}>Amtsgericht</label>
                        <input name="court" value={settings.court} onChange={handleChange} className={inputClasses} placeholder="z.B. Charlottenburg" />
                    </div>
                    <div>
                        <label className={labelClasses}>Steuernummer</label>
                        <input name="taxId" value={settings.taxId} onChange={handleChange} className={inputClasses} />
                    </div>
                    <div>
                        <label className={labelClasses}>USt-IdNr.</label>
                        <input name="vatId" value={settings.vatId} onChange={handleChange} className={inputClasses} />
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelClasses}>Handelsregisternummer (HRB)</label>
                        <input name="hrb" value={settings.hrb || ''} onChange={handleChange} className={inputClasses} placeholder="z.B. 1234567B" />
                    </div>
                    <div>
                        <label className={labelClasses}>Instagram Link</label>
                        <input name="instagram" value={settings.instagram || ''} onChange={handleChange} className={inputClasses} placeholder="https://www.instagram.com/ihr_konto" />
                    </div>
                    <div>
                        <label className={labelClasses}>TikTok Link</label>
                        <input name="tiktok" value={settings.tiktok || ''} onChange={handleChange} className={inputClasses} placeholder="https://www.tiktok.com/@ihr_konto" />
                    </div>
                </div>

                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-400" /> Bankverbindung
                </h2>
                <div className={sectionClasses}>
                    <div className="md:col-span-2">
                        <label className={labelClasses}>Kontoinhaber</label>
                        <input name="accountHolder" value={settings.accountHolder || ''} onChange={handleChange} className={inputClasses} placeholder="z.B. Max Mustermann" />
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelClasses}>Bankname</label>
                        <input name="bankName" value={settings.bankName} onChange={handleChange} className={inputClasses} />
                    </div>
                    <div>
                        <label className={labelClasses}>IBAN</label>
                        <input name="iban" value={settings.iban} onChange={handleChange} className={inputClasses} />
                    </div>
                    <div>
                        <label className={labelClasses}>BIC</label>
                        <input name="bic" value={settings.bic} onChange={handleChange} className={inputClasses} />
                    </div>
                </div>
            </form>
        </motion.div>
    );
};

export default CompanySettings;
