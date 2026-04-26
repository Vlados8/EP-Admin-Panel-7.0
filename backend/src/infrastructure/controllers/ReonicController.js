const { Company, ReonicLead } = require('../../domain/models');
const axios = require('axios');

const REONIC_BASE_URL = 'https://api.reonic.de';

const ReonicController = {
    // 1. Get Settings
    getSettings: async (req, res) => {
        try {
            const company = await Company.findByPk(req.user.company_id);
            if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

            const settings = company.settings || {};
            
            // Mask the API key for security
            let maskedKey = '';
            if (settings.reonicApiKey) {
                const key = settings.reonicApiKey;
                maskedKey = key.substring(0, 4) + '*'.repeat(key.length - 8) + key.substring(key.length - 4);
            }

            res.json({
                success: true,
                data: {
                    hasApiKey: !!settings.reonicApiKey,
                    maskedKey,
                    clientId: settings.reonicClientId || '',
                    webhookSecret: settings.reonicWebhookSecret || ''
                }
            });
        } catch (error) {
            console.error('Error fetching Reonic settings:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    },

    // 2. Save Settings
    saveSettings: async (req, res) => {
        try {
            const { apiKey, clientId, webhookSecret } = req.body;
            
            const company = await Company.findByPk(req.user.company_id);
            if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

            const settings = company.settings ? { ...company.settings } : {};
            
            // Only update if a new key is provided (not empty and not masked)
            if (apiKey && !apiKey.includes('****')) {
                settings.reonicApiKey = apiKey;
            }
            if (clientId !== undefined) {
                settings.reonicClientId = clientId;
            }
            if (webhookSecret !== undefined) {
                settings.reonicWebhookSecret = webhookSecret;
            }

            // Some SQL dialects have trouble updating JSON columns through model instances.
            // Using a direct update query ensures it writes correctly.
            await Company.update(
                { settings }, 
                { where: { id: req.user.company_id } }
            );

            res.json({ success: true, message: 'Reonic settings saved successfully' });
        } catch (error) {
            console.error('Error saving Reonic settings:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    },

    // 3. Get Leads from DB
    getLeads: async (req, res) => {
        try {
            const leads = await ReonicLead.findAll({
                where: { company_id: req.user.company_id },
                order: [['createdAt', 'DESC']]
            });
            res.json({ success: true, data: leads });
        } catch (error) {
            console.error('Error fetching Reonic leads:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    },

    // 4. Update Lead Status
    updateLeadStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const lead = await ReonicLead.findOne({
                where: { id, company_id: req.user.company_id }
            });

            if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

            lead.status = status;
            await lead.save();

            res.json({ success: true, message: 'Lead status updated', data: lead });
        } catch (error) {
            console.error('Error updating Reonic lead:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    },

    // 5. Sync Leads from Reonic API
    syncLeads: async (req, res) => {
        try {
            const company = await Company.findByPk(req.user.company_id);
            const apiKey = company.settings?.reonicApiKey;
            const clientId = company.settings?.reonicClientId;

            if (!apiKey || !clientId) {
                return res.status(400).json({ success: false, message: 'Reonic API Key oder Client ID nicht konfiguriert' });
            }

            let reonicResponse;
            try {
                // Determine whether to use Basic auth (Base64) or direct token based on Reonic docs.
                // The prompt suggests X-Authorization: API_KEY, while REST docs suggest Basic base64. 
                // We'll use the API key directly as per user's prompt.
                reonicResponse = await axios.get(`${REONIC_BASE_URL}/rest/v2/clients/${clientId}/h360/offers`, {
                    headers: {
                        'Accept': 'application/json',
                        'X-Authorization': apiKey
                    }
                });
            } catch (apiErr) {
                console.error('Reonic API Error:', apiErr.response?.data || apiErr.message);
                return res.status(400).json({ 
                    success: false, 
                    message: 'Failed to connect to Reonic API. Please check your API key.' 
                });
            }

            const offers = reonicResponse.data?.data || [];
            let importedCount = 0;

            for (const offer of offers) {
                // Check if already imported
                const existing = await ReonicLead.findOne({
                    where: { 
                        company_id: req.user.company_id,
                        reonicId: String(offer.id || offer.reonicId)
                    }
                });

                if (!existing) {
                    await ReonicLead.create({
                        company_id: req.user.company_id,
                        reonicId: String(offer.id || offer.reonicId),
                        status: 'Bereit für Angebot',
                        customerData: offer.customer || {},
                        systemData: offer.system || {},
                        rawJson: offer
                    });
                    importedCount++;
                }
            }

            res.json({ 
                success: true, 
                message: `Sync complete. Imported ${importedCount} new leads.`,
                importedCount
            });

        } catch (error) {
            console.error('Error syncing Reonic leads:', error);
            res.status(500).json({ success: false, message: 'Server error during sync' });
        }
    },

    // 6. Webhook Handler
    webhookHandler: async (req, res) => {
        try {
            const payload = req.body;
            const companyId = req.params.companyId;

            if (!companyId || !payload || !payload.id) {
                return res.status(400).json({ success: false, message: 'Invalid payload' });
            }

            // Verify Webhook Secret if configured
            const company = await Company.findByPk(companyId);
            if (!company) {
                return res.status(404).json({ success: false, message: 'Company not found' });
            }

            const secret = company.settings?.reonicWebhookSecret;
            if (secret) {
                const signatureHeader = req.headers['x-reonic-signature'] || req.headers['x-signature'];
                
                if (!signatureHeader) {
                    return res.status(401).json({ success: false, message: 'Missing signature header' });
                }

                const crypto = require('crypto');
                // Reonic's specific signature algorithm might differ (e.g. base64 vs hex). 
                // Adjust if their documentation specifies otherwise.
                const expectedSignature = crypto.createHmac('sha256', secret)
                    .update(JSON.stringify(payload))
                    .digest('hex');
                
                if (signatureHeader !== expectedSignature) {
                    console.warn(`Webhook signature mismatch for company ${companyId}. Expected: ${expectedSignature}, Got: ${signatureHeader}`);
                    return res.status(403).json({ success: false, message: 'Invalid signature' });
                }
            }

            // Save or update the incoming lead
            const [lead, created] = await ReonicLead.findOrCreate({
                where: { company_id: companyId, reonicId: String(payload.id) },
                defaults: {
                    status: payload.status || 'new',
                    customerData: payload.customer || {},
                    systemData: payload.system || {},
                    rawJson: payload
                }
            });

            if (!created) {
                // Update existing lead status and raw JSON
                lead.status = payload.status || lead.status;
                if (payload.customer) lead.customerData = payload.customer;
                lead.rawJson = payload;
                await lead.save();
            }

            console.log(`Reonic Webhook: Lead ${payload.id} ${created ? 'created' : 'updated'} for company ${companyId}`);
            res.status(200).send('OK');
        } catch (error) {
            console.error('Reonic Webhook Error:', error);
            res.status(500).send('Internal Server Error');
        }
    },

    // 7. Create Lead (Send to Reonic)
    createLead: async (req, res) => {
        try {
            const company = await Company.findByPk(req.user.company_id);
            const apiKey = company.settings?.reonicApiKey;
            const clientId = company.settings?.reonicClientId;

            if (!apiKey || !clientId) {
                return res.status(400).json({ success: false, message: 'Reonic API Key oder Client ID nicht konfiguriert' });
            }

            const leadData = req.body;
            
            // Basic validation based on Reonic requirements
            if (!leadData.firstName || !leadData.lastName) {
                return res.status(400).json({ success: false, message: 'Vorname und Nachname sind erforderlich' });
            }

            // Send to Reonic
            let reonicResponse;
            try {
                reonicResponse = await axios.post(
                    `${REONIC_BASE_URL}/integrations/${clientId}/h360/request/create`,
                    leadData,
                    {
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            'X-Authorization': apiKey
                        }
                    }
                );
            } catch (apiErr) {
                console.error('Reonic Create Lead Error:', apiErr.response?.data || apiErr.message);
                return res.status(400).json({ 
                    success: false, 
                    message: 'Fehler beim Senden an Reonic.',
                    details: apiErr.response?.data 
                });
            }

            // We return success. The actual lead data will come back via the Webhook, 
            // or we could save a local copy right here if needed.
            res.json({ 
                success: true, 
                message: 'Lead erfolgreich an Reonic gesendet!',
                data: reonicResponse.data
            });

        } catch (error) {
            console.error('Error creating Reonic lead:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
};

module.exports = ReonicController;
