import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Download, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import api from '../../services/api';

const DatabaseSettings = () => {
    const [downloading, setDownloading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleDownload = async () => {
        setDownloading(true);
        setMessage({ type: '', text: '' });

        try {
            const response = await api.get('/system/database/backup', {
                responseType: 'blob'
            });

            // Extract filename from Content-Disposition if present, or generate a fallback
            let filename = `empire-crm-backup-${new Date().toISOString().split('T')[0]}.sql`;
            const disposition = response.headers['content-disposition'];
            if (disposition && disposition.indexOf('filename=') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) { 
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            // Create blob link to download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            
            setMessage({ type: 'success', text: 'Backup erfolgreich heruntergeladen!' });
            setTimeout(() => setMessage({ type: '', text: '' }), 5000);
        } catch (err) {
            console.error('Backup download error:', err);
            setMessage({ type: 'error', text: 'Fehler beim Herunterladen des Backups. Bitte überprüfen Sie die Server-Logs.' });
        } finally {
            setDownloading(false);
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 max-w-4xl mx-auto"
        >
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                    <Database className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Datenbank-Backup</h1>
                    <p className="text-white/60">Hier können Sie ein vollständiges Backup Ihrer Datenbank (.sql Format) herunterladen.</p>
                </div>
            </div>

            {message.text && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                    {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    {message.text}
                </div>
            )}

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex-1">
                        <h2 className="text-xl font-semibold text-white mb-2">Vollständiger SQL-Dump</h2>
                        <p className="text-white/60 text-sm mb-4">
                            Laden Sie eine exakte Kopie aller aktuellen Daten (inklusive Struktur, Benutzer, Projekte, Chats usw.) herunter. 
                            Dieser Vorgang kann bei großen Datenbanken einige Sekunden dauern.
                        </p>
                        
                        <div className="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                            <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-orange-200">
                                Bewahren Sie diese Datei sicher auf. Sie enthält sensible Kundendaten und Passwörter (gehasht). 
                                Mit dieser Datei können Sie Ihr gesamtes System auf einem neuen Server wiederherstellen.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="flex flex-col items-center justify-center w-full md:w-64 h-32 gap-3 bg-gradient-to-br from-blue-600/20 to-indigo-600/20 hover:from-blue-600/40 hover:to-indigo-600/40 border border-blue-500/30 rounded-xl transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                        {downloading ? (
                            <>
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                <span className="text-sm font-medium text-white">Generiere Backup...</span>
                            </>
                        ) : (
                            <>
                                <Download className="w-8 h-8 text-blue-400 group-hover:text-white transition-colors" />
                                <span className="text-sm font-medium text-blue-100 group-hover:text-white transition-colors">Backup Herunterladen</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default DatabaseSettings;
