import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const CompanyContext = createContext();

export const useCompany = () => {
    const context = useContext(CompanyContext);
    if (!context) {
        throw new Error('useCompany must be used within a CompanyProvider');
    }
    return context;
};

export const CompanyProvider = ({ children }) => {
    const [companyData, setCompanyData] = useState({
        name: 'Empire Premium Bau',
        settings: {
            logoLarge: null,
            logoSmall: null,
            adminBackground: null,
            firmName: 'Empire Premium Bau'
        }
    });
    const [loading, setLoading] = useState(true);

    const refreshCompanyData = async () => {
        try {
            // Using public endpoint to work on login page as well
            const response = await api.get('/company/public');
            if (response.data && response.data.status === 'success') {
                setCompanyData(response.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch company data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshCompanyData();
    }, []);

    // Helper to get asset URL
    const getAssetUrl = (path) => {
        if (!path) return null;
        
        // If it's already a full URL (R2), return it
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }
        
        // Otherwise, it's a local path
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    };

    return (
        <CompanyContext.Provider value={{ 
            companyData, 
            loading, 
            refreshCompanyData,
            getAssetUrl
        }}>
            {children}
        </CompanyContext.Provider>
    );
};
