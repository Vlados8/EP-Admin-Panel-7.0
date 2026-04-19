const fs = require('fs');
const { Op } = require('sequelize');
const path = require('path');
const crypto = require('crypto');
const FormData = require('form-data');
const Mailgun = require('mailgun.js');
const { EmailAccount, Email, Attachment, Company, User, Client } = require('../../domain/models');
const { emitToCompany } = require('../websocket');
const AppError = require('../../utils/appError');
const { hasPermission } = require('../../utils/permissions');
const { uploadToR2, deleteFromR2 } = require('../utils/storage');

// Initialize Mailgun
const mailgun = new Mailgun(FormData);
let mg = null;

if (process.env.MAILGUN_API_KEY) {
    mg = mailgun.client({
        username: 'api',
        key: process.env.MAILGUN_API_KEY,
        url: process.env.MAILGUN_URL || 'https://api.mailgun.net'
    });
}

/**
 * Extract clean email address from a string (e.g., "Name <email@domain.com>" -> "email@domain.com")
 */
const extractEmail = (str) => {
    if (!str) return '';
    const match = str.match(/<([^>]+)>/);
    return match ? match[1].toLowerCase().trim() : str.toLowerCase().trim();
};

/**
 * Clean monochrome HTML wrapper
 */
/**
 * Clean monochrome HTML wrapper
 */
const wrapInMonochromeTemplate = (content, subject, fromName = '', settings = {}, frontendUrl = '') => {
    const year = new Date().getFullYear();
    
    // Asset URL Helper
    const getAssetUrl = (path) => {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        const apiBase = process.env.BACKEND_URL || 'http://localhost:3001';
        return `${apiBase}${path.startsWith('/') ? '' : '/'}${path}`;
    };

    // В хедере (черный фон) приоритетно используем БЕЛЫЙ логотип
    const headerLogoSrc = settings.logoLargeWhite || settings.logoSmallWhite;
    const headerLogoUrl = getAssetUrl(headerLogoSrc || settings.logoLarge || settings.logoSmall) || `${frontendUrl}/assets/Empire%20Premium%20white.png`;
    
    // В подписи (белый фон) приоритетно используем ТЕМНЫЙ логотип
    const avatarLogoSrc = settings.logoLarge || settings.logoSmall;
    const avatarLogoUrl = getAssetUrl(avatarLogoSrc || settings.logoLargeWhite || settings.logoSmallWhite) || `${frontendUrl}/assets/Logo%20EP.png`;

    // Определяем, нужно ли применять фильтр (если в хедере используется темный логотип из-за отсутствия белого)
    const needsHeaderFilter = !headerLogoSrc && (settings.logoLarge || settings.logoSmall);
    // И наоборот для аватара
    const needsAvatarFilter = !avatarLogoSrc && (settings.logoLargeWhite || settings.logoSmallWhite);
    const firmName = settings.firmName || 'Empire Premium Bau GmbH';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light only">
    <style>
        :root { color-scheme: light only; supported-color-schemes: light only; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0; color: #333333; }
        .wrapper { width: 100%; background-color: #f5f5f5; background-image: linear-gradient(#f5f5f5, #f5f5f5); padding: 40px 0; }
        .main { background-color: #ffffff; background-image: linear-gradient(#ffffff, #ffffff); margin: 0 auto; width: 90%; max-width: 600px; border: 1px solid #dddddd; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
        .header { padding: 45px 20px; text-align: center; background-color: #111111; }
        .content { padding: 60px 40px; color: #222222; line-height: 1.8; font-size: 16px; background-color: #ffffff; background-image: linear-gradient(#ffffff, #ffffff); }
        .footer { padding: 60px 20px; background-color: #111111; text-align: center; color: #888888; font-size: 12px; }
        .header-logo { height: 50px; width: auto; max-width: 200px; }
        .avatar-logo { width: 40px; height: 40px; border-radius: 50%; border: 1px solid #eeeeee; vertical-align: middle; margin-right: 12px; }
        .subject-tag { color: #999999; font-size: 10px; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 25px; display: block; font-weight: bold; }
        .signature { margin-top: 40px; padding-top: 30px; border-top: 1px solid #f0f0f0; display: flex; align-items: center; }
        .social-links { margin-bottom: 30px; }
        .social-link { color: #ffffff; text-decoration: none; margin: 0 15px; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; opacity: 0.8; }
        .social-link:hover { opacity: 1; }
        .website-link { color: #ffffff; text-decoration: none; font-size: 13px; display: block; margin-bottom: 25px; letter-spacing: 2px; font-weight: bold; }
        .copyright { color: #555555; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; margin-top: 25px; }
        a { color: #111111; text-decoration: underline; }

        /* Gmail Dark Mode Hacks */
        u + .body .wrapper { background-color: #f5f5f5 !important; background-image: linear-gradient(#f5f5f5, #f5f5f5) !important; }
        u + .body .main { background-color: #ffffff !important; background-image: linear-gradient(#ffffff, #ffffff) !important; }
        u + .body .content { background-color: #ffffff !important; background-image: linear-gradient(#ffffff, #ffffff) !important; color: #222222 !important; }
        u + .body .subject-tag { color: #999999 !important; }
        u + .body a { color: #111111 !important; }
        u + .body .footer a { color: #ffffff !important; }
        u + .body .footer-info { color: #777777 !important; }
    </style>
</head>
<body class="body">
    <div class="wrapper" style="background-color: #f5f5f5; background-image: linear-gradient(#f5f5f5, #f5f5f5);">
        <div class="main" style="background-color: #ffffff; background-image: linear-gradient(#ffffff, #ffffff);">
            <div class="header">
                ${headerLogoUrl ? `<img src="${headerLogoUrl}" alt="${firmName}" class="header-logo" style="${needsHeaderFilter ? 'filter: brightness(0) invert(1);' : ''}">` : `<div style="color: #fff; font-size: 24px; font-weight: bold;">${firmName}</div>`}
            </div>
            <div class="content" style="background-color: #ffffff; background-image: linear-gradient(#ffffff, #ffffff);">
                <span class="subject-tag">Thema: ${subject}</span>
                <div style="min-height: 200px;">
                    ${content}
                </div>
                <div class="signature">
                    ${avatarLogoUrl ? `<img src="${avatarLogoUrl}" alt="EP" class="avatar-logo" style="${needsAvatarFilter ? 'filter: brightness(0) invert(1);' : ''}">` : ''}
                    <div style="display: inline-block; vertical-align: middle;">
                        <p style="margin: 0; font-weight: bold; font-size: 14px; color: #111111;">${fromName}</p>
                        <p style="margin: 0; font-size: 12px; color: #999999;">${firmName}</p>
                    </div>
                </div>
            </div>
            <div class="footer">
                <a href="${settings.website || '#'}" style="color: #ffffff; text-decoration: none; font-size: 14px; letter-spacing: 3px; font-weight: bold; text-transform: uppercase;">${firmName}</a>
                <div style="height: 1px; background-color: #222222; width: 40px; margin: 25px auto;"></div>
                
                <div class="footer-info" style="font-size: 9px; line-height: 2.4; color: #777777; margin-bottom: 25px; text-transform: uppercase; letter-spacing: 1.5px;">
                    <div style="color: #ffffff; font-weight: bold; margin-bottom: 8px;">${firmName}</div>
                    <div>${settings.address || ''} ${settings.zipCity || ''}</div>
                    <div style="color: #555555; margin: 10px 0;">&bull; &bull; &bull;</div>
                    <div>${settings.hrb ? `HRB: ${settings.hrb}` : (settings.court ? `Amtsgericht: ${settings.court}` : '')}</div>
                    ${settings.vatId ? `<div>Ust-ID: ${settings.vatId}</div>` : ''}
                    <div style="height: 15px;"></div>
                    <div>
                        <a href="mailto:${settings.email || ''}" style="color: #888888; text-decoration: none;">${settings.email || ''}</a>
                    </div>
                    <div style="color: #888888;">${settings.phone || ''}</div>
                </div>

                <div class="social-links">
                    ${settings.instagram ? `<a href="${settings.instagram}" class="social-link">Instagram</a>` : ''}
                    ${settings.tiktok ? `<a href="${settings.tiktok}" class="social-link">TikTok</a>` : ''}
                </div>
                <div class="copyright">
                    &copy; ${year} ${firmName}. Alle Rechte vorbehalten.
                </div>
            </div>
        </div>
    </div>
</body>
</html>
    `.trim();
};

/**
 * Get all managed email accounts for the company
 */
exports.getEmailAccounts = async (req, res, next) => {
    try {
        const company_id = req.user.company_id;

        let accountWhere = { company_id };
        const userRole = req.user.role?.name || req.user.role;
        if (!hasPermission(req.user, 'MANAGE_EMAIL_ACCOUNTS')) {
            if (userRole === 'Projektleiter') {
                // Projektleiter sees personal + shared
                accountWhere[Op.or] = [
                    { user_id: req.user.id },
                    { is_shared: true }
                ];
            } else {
                // Workers and Gruppenleiter see ONLY personal
                accountWhere.user_id = req.user.id;
                accountWhere.is_shared = false;
            }
        }

        const accounts = await EmailAccount.findAll({
            where: accountWhere,
            include: [
                { model: User, as: 'assigned_user', attributes: ['id', 'name', 'email'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        // --- NEW: Add unread counts ---
        const accountsWithCounts = await Promise.all(accounts.map(async (acc) => {
            const unreadCount = await Email.count({
                where: {
                    recipient_email: acc.email,
                    direction: 'inbound',
                    is_read: false,
                    company_id
                }
            });
            const accData = acc.toJSON();
            accData.unread_count = unreadCount;
            return accData;
        }));

        res.status(200).json({
            status: 'success',
            data: { accounts: accountsWithCounts }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Create a new email account (Mailgun Route)
 */
exports.createEmailAccount = async (req, res, next) => {
    try {
        const { email, type, forward_to, user_id, is_shared, display_name } = req.body;
        const company_id = req.user.company_id;

        if (!email) {
            return next(new AppError('E-Mail-Adresse ist erforderlich.', 400));
        }

        // Logic check: email should be part of the configured domain
        const domain = process.env.MAILGUN_DOMAIN || 'example.com';
        if (!email.endsWith(`@${domain}`)) {
            return next(new AppError(`E-Mail muss auf @${domain} enden.`, 400));
        }

        let mailgun_id = null;

        // Create in Mailgun if client is initialized
        if (mg && type === 'forward' && forward_to) {
            try {
                const route = await mg.routes.create({
                    priority: 0,
                    description: `Forwarding for ${email}`,
                    expression: `match_recipient("${email}")`,
                    action: [`forward("${forward_to}")`, 'stop()']
                });
                mailgun_id = route.id;
            } catch (mgErr) {
                console.error('[Mailgun] Route Creation Error:', mgErr);
            }
        }

        const newAccount = await EmailAccount.create({
            company_id,
            email,
            type: type || 'forward',
            forward_to: forward_to || null,
            mailgun_id,
            display_name,
            status: 'active',
            user_id: user_id || null,
            is_shared: is_shared !== undefined ? is_shared : (user_id ? false : true)
        });

        // --- NEW: Sync User Email ---
        if (newAccount.user_id && !newAccount.is_shared) {
            try {
                const user = await User.findByPk(newAccount.user_id);
                if (user) {
                    user.email = newAccount.email;
                    await user.save();
                    console.log(`[Sync] Updated User ${user.id} email to ${newAccount.email}`);
                }
            } catch (syncErr) {
                console.error('[Sync] Error updating user email:', syncErr);
            }
        }
        // -------------------------

        res.status(201).json({
            status: 'success',
            data: { account: newAccount }
        });
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
            return next(new AppError('Diese E-Mail-Adresse wird bereits verwaltet.', 400));
        }
        next(err);
    }
};

exports.deleteEmailAccount = async (req, res, next) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;

        const account = await EmailAccount.findOne({ where: { id, company_id } });
        if (!account) {
            return next(new AppError('E-Mail-Konto nicht gefunden.', 404));
        }

        // Find all emails linked to this account
        const emails = await Email.findAll({
            where: {
                [Op.or]: [
                    { sender: account.email },
                    { recipient: account.email }
                ],
                company_id
            },
            include: [{ model: Attachment, as: 'attachments' }]
        });

        // Cleanup physical files and messages
        for (const email of emails) {
            if (email.attachments && email.attachments.length > 0) {
                for (const attr of email.attachments) {
                    try {
                        const relativePath = attr.file_url.startsWith('/') ? attr.file_url.substring(1) : attr.file_url;
                        const filePath = path.join(__dirname, '../../../../', relativePath);
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                        }
                    } catch (fsErr) {
                        console.error('[Account Delete] Attachment cleanup error:', fsErr);
                    }
                }
            }
            // Hard delete email record
            await email.destroy({ force: true });
        }

        // Delete from Mailgun if applicable
        if (mg && account.mailgun_id) {
            try {
                await mg.routes.destroy(account.mailgun_id);
            } catch (mgErr) {
                console.error('[Mailgun] Route Deletion Error:', mgErr);
            }
        }

        // Hard delete the account
        await account.destroy({ force: true });

        res.status(200).json({
            status: 'success',
            data: null
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Fetch stats from Mailgun
 */
exports.getMailgunStats = async (req, res, next) => {
    try {
        const companyId = req.user.company_id;
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // 1. DB Metrics
        const totalAccounts = await EmailAccount.count({ where: { company_id: companyId } });
        const activeAccounts = await EmailAccount.count({ where: { company_id: companyId, status: 'active' } });

        const sent24h = await Email.count({
            where: {
                company_id: companyId,
                direction: 'outbound',
                createdAt: { [Op.gte]: last24h }
            }
        });

        const received24h = await Email.count({
            where: {
                company_id: companyId,
                direction: 'inbound',
                createdAt: { [Op.gte]: last24h }
            }
        });

        // 2. Mailgun API Metrics
        let mailgunStats = [];
        let mgError = null;

        if (mg) {
            try {
                const domainSource = process.env.MAILGUN_DOMAIN;
                mailgunStats = await mg.stats.getDomain(domainSource, { limit: 10 });
            } catch (err) {
                console.error('[Mailgun] API Stats Error:', err);
                mgError = 'Mailgun API data unavailable.';
            }
        }

        res.status(200).json({
            status: 'success',
            data: {
                stats: {
                    totalAccounts,
                    activeAccounts,
                    sent24h,
                    received24h,
                    mailgunStats,
                    mgError
                }
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Get the configured Mailgun domain
 */
exports.getDomain = async (req, res, next) => {
    try {
        const domain = process.env.MAILGUN_DOMAIN || 'empire-premium.de';
        res.status(200).json({
            status: 'success',
            data: { domain }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Update an email account (shared name only)
 */
exports.updateEmailAccount = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { display_name, status } = req.body;
        const company_id = req.user.company_id;

        const account = await EmailAccount.findOne({ where: { id, company_id } });
        if (!account) {
            return next(new AppError('E-Mail-Konto nicht gefunden.', 404));
        }

        // Restriction: Only shared accounts can have their display_name updated
        if (!account.is_shared && display_name !== undefined) {
            return next(new AppError('Anzeigename kann nur für öffentliche Konten geändert werden.', 400));
        }

        if (display_name !== undefined) account.display_name = display_name;
        if (status !== undefined) account.status = status;

        await account.save();

        res.status(200).json({
            status: 'success',
            data: { account }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Send an email via Mailgun
 */
exports.sendEmail = async (req, res, next) => {
    try {
        const { from, to, subject, text, html } = req.body;

        if (!from) {
            return next(new AppError('E-Mail-Inhalt fehlt (Sender ist erforderlich).', 400));
        }

        if (!mg) {
            return next(new AppError('Mailgun is not configured.', 500));
        }

        const domain = process.env.MAILGUN_DOMAIN;
        if (!domain) {
            return next(new AppError('MAILGUN_DOMAIN is not configured.', 500));
        }

        // --- NEW: Handle Sender Name ---
        let senderName = '';
        const account = await EmailAccount.findOne({
            where: { email: from, company_id: req.user.company_id },
            include: [{ model: User, as: 'assigned_user', attributes: ['name'] }]
        });

        if (!account) {
            return next(new AppError(`Absender-Konto (${from}) nicht gefunden.`, 404));
        }

        if (account) {
            if (account.is_shared) {
                senderName = account.display_name || '';
            } else if (account.assigned_user) {
                senderName = account.assigned_user.name || '';
            }
        }

        const fromHeader = senderName ? `"${senderName.replace(/"/g, '')}" <${from}>` : from;

        // --- Branding ---
        const company = await Company.findByPk(req.user.company_id);
        const settings = company?.settings || {};
        const frontendUrl = process.env.FRONTEND_URL || 'https://www.empire-premium-bau.de';

        const rawContent = html || (text ? text.replace(/\n/g, '<br>') : '');
        const finalHtml = wrapInMonochromeTemplate(rawContent, subject, senderName || settings.firmName || 'Empire Premium Bau GmbH', settings, frontendUrl);

        const inlineAttachments = [];

        const messageData = {
            from: fromHeader,
            to: [to],
            subject,
            text: text || '',
            html: finalHtml,
            inline: inlineAttachments
        };

        // Add attachments if present
        if (req.files && req.files.length > 0) {
            messageData.attachment = req.files.map(file => ({
                data: fs.createReadStream(file.path),
                filename: file.originalname
            }));
        }

        // --- NEW: Recipient Identity Lookup ---
        let recipientName = extractName(to);
        let client = null;
        if (to) {
            client = await Client.findOne({
                where: { email: to, company_id: req.user.company_id }
            });
            if (client) {
                recipientName = client.name;
            }
        }

        let result;
        try {
            result = await mg.messages.create(domain, messageData);
        } catch (mgError) {
            console.error('[Mailgun] Send Error Details:', mgError);
            return next(new AppError(`Mailgun Fehler: ${mgError.message}`, 500));
        }

        // --- NEW: Persist to DB ---
        const savedEmail = await Email.create({
            mailgun_id: result.id,
            sender: messageData.from,
            sender_name: senderName || 'Empire Premium Bau GmbH',
            sender_email: from,
            recipient: to,
            recipient_name: recipientName,
            recipient_email: to,
            client_id: client ? client.id : null,
            subject: subject,
            body_html: html || null,
            body_plain: text || null,
            company_id: req.user.company_id,
            received_at: new Date(),
            is_read: true, // Sent items are already read by sender
            direction: 'outbound'
        });

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    const r2Key = `emails/${file.filename}`;
                    const fileUrl = await uploadToR2(file.path, r2Key, file.mimetype);

                    await Attachment.create({
                        email_id: savedEmail.id,
                        file_name: file.originalname,
                        file_url: fileUrl,
                        file_size: file.size,
                        content_type: file.mimetype
                    });

                    // Cleanup local file after Mailgun send and R2 upload
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                } catch (uploadErr) {
                    console.error(`Failed to upload email attachment ${file.originalname} to R2:`, uploadErr);
                }
            }
        }
        // -------------------------

        res.status(200).json({
            status: 'success',
            data: { result, email: savedEmail }
        });
    } catch (err) {
        console.error('[Mailgun] Send Error:', err);
        // If MG succeeded but DB failed, the email is already gone. We log it.
        next(new AppError(`Fehler beim Senden/Speichern der E-Mail: ${err.message}`, 500));
    }
};

/**
 * Webhook handler for inbound emails from Mailgun
 */
const extractName = (str) => {
    if (!str) return null;
    const match = str.match(/^([^<]+)/);
    if (match) {
        const name = match[1].trim().replace(/^"|"$/g, '');
        return name || null;
    }
    return null;
};

/**
 * Webhook handler for inbound emails from Mailgun
 */
exports.receiveWebhook = async (req, res, next) => {
    try {
        const signatureData = req.body['signature'] || {};
        const { timestamp, token, signature } = signatureData;

        // Mailgun inbound format varies; we try common fields
        const fromRaw = req.body.sender || req.body.from || req.body.From || 'unknown@sender.com';
        const toRaw = req.body.recipient || req.body.To || 'unknown@recipient.com';

        const senderEmail = extractEmail(fromRaw);
        const recipientEmail = extractEmail(toRaw);

        // Extract name from "Name <email>" format
        let senderName = extractName(fromRaw);
        let recipientName = extractName(toRaw);

        const subject = req.body.subject || '(No Subject)';
        const body_html = req.body['body-html'] || null;
        const body_plain = req.body['body-plain'] || null;
        const mailgun_id = req.body['Message-Id'] || null;

        // Verify Mailgun Signature (if configured)
        if (process.env.MAILGUN_API_KEY && timestamp && token && signature) {
            const value = timestamp + token;
            const hash = crypto.createHmac('sha256', process.env.MAILGUN_API_KEY)
                .update(value)
                .digest('hex');
            if (hash !== signature) {
                console.error('[Mailgun Webhook] Invalid signature');
                return res.status(406).json({ status: 'fail', message: 'Invalid signature' });
            }
        }

        // Try to find the company_id and account
        let company_id = null;
        const account = await EmailAccount.findOne({ where: { email: recipientEmail } });
        if (account) {
            company_id = account.company_id;
            recipientName = recipientName || account.display_name;
        }

        // --- NEW: Client Identity Lookup ---
        let client = null;
        // If we have a company_id, try to find a matching client for the sender
        if (company_id && senderEmail) {
            client = await Client.findOne({
                where: { email: senderEmail, company_id }
            });
            if (client) {
                senderName = client.name; // Higher priority than the header name
            }
        }

        // Save Email to DB
        const savedEmail = await Email.create({
            mailgun_id: mailgun_id,
            sender: fromRaw,
            sender_name: senderName,
            sender_email: senderEmail,
            recipient: toRaw,
            recipient_name: recipientName,
            recipient_email: recipientEmail,
            client_id: client ? client.id : null,
            subject: subject,
            body_html: body_html,
            body_plain: body_plain,
            received_at: new Date(),
            direction: 'inbound',
            company_id: company_id
        });

        // 7. Emit WebSocket notification for real-time UI updates
        if (company_id) {
            emitToCompany(company_id, 'new_email', {
                email_id: savedEmail.id,
                account: recipientEmail,
                sender_name: senderName
            });
        }

        // Handle attachments if any
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    const r2Key = `emails/${file.filename}`;
                    const fileUrl = await uploadToR2(file.path, r2Key, file.mimetype);

                    await Attachment.create({
                        email_id: savedEmail.id,
                        file_name: file.originalname,
                        file_url: fileUrl,
                        file_size: file.size,
                        content_type: file.mimetype
                    });

                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                } catch (uploadErr) {
                    console.error(`Failed to upload inbound attachment ${file.originalname} to R2:`, uploadErr);
                }
            }
        }

        res.status(200).json({ status: 'success' });
    } catch (err) {
        console.error('[Mailgun Webhook] Error:', err);
        res.status(200).json({ status: 'error', message: err.message });
    }
};

/**
 * Get all email messages for the user's company and assigned accounts
 */
exports.getEmailMessages = async (req, res, next) => {
    try {
        const companyId = req.user.company_id;

        // 1. Get allowed email accounts for this user
        const accountWhere = { company_id: companyId };
        const userRole = req.user.role?.name || req.user.role;
        if (!hasPermission(req.user, 'MANAGE_EMAIL_ACCOUNTS')) {
            if (userRole === 'Projektleiter') {
                // Projektleiter sees personal + shared
                accountWhere[Op.or] = [
                    { user_id: req.user.id },
                    { is_shared: true }
                ];
            } else {
                // Workers and Gruppenleiter see ONLY personal
                accountWhere.user_id = req.user.id;
                accountWhere.is_shared = false;
            }
        }

        const accounts = await EmailAccount.findAll({ where: accountWhere });
        const allowedEmails = accounts.map(a => a.email);

        if (allowedEmails.length === 0) {
            return res.status(200).json({
                status: 'success',
                data: { messages: [] }
            });
        }

        // 2. Fetch emails involving these accounts
        const whereClause = { company_id: companyId };

        if (!hasPermission(req.user, 'MANAGE_EMAIL_ACCOUNTS')) {
            whereClause[Op.or] = [
                { sender_email: { [Op.in]: allowedEmails } },
                { recipient_email: { [Op.in]: allowedEmails } }
            ];
        }

        const messages = await Email.findAll({
            where: whereClause,
            include: [{ model: Attachment, as: 'attachments' }],
            order: [['received_at', 'DESC']]
        });

        const unreadCount = await Email.count({
            where: {
                ...whereClause,
                direction: 'inbound',
                is_read: false
            }
        });

        res.status(200).json({
            status: 'success',
            data: { messages, unreadCount }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Mark a message as read
 */
exports.markAsRead = async (req, res, next) => {
    try {
        const message = await Email.findOne({
            where: { id: req.params.id, company_id: req.user.company_id }
        });

        if (!message) {
            return next(new AppError('E-Mail nicht gefunden.', 404));
        }

        await message.update({ is_read: true });

        res.status(200).json({
            status: 'success',
            data: { message }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Delete a message (soft delete)
 */
exports.deleteMessage = async (req, res, next) => {
    try {
        const message = await Email.findOne({
            where: { id: req.params.id, company_id: req.user.company_id },
            include: [{ model: Attachment, as: 'attachments' }]
        });

        if (!message) {
            return next(new AppError('E-Mail nicht gefunden.', 404));
        }

        // Cleanup physical files and Attachment records
        if (message.attachments && message.attachments.length > 0) {
            for (const attr of message.attachments) {
                try {
                    if (attr.file_url.startsWith('http')) {
                        // R2 File
                        const urlObj = new URL(attr.file_url);
                        const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                        await deleteFromR2(key);
                    } else {
                        // Local File
                        const relativePath = attr.file_url.startsWith('/') ? attr.file_url.substring(1) : attr.file_url;
                        const filePath = path.join(__dirname, '../../../../', relativePath);
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                        }
                    }
                    await attr.destroy();
                } catch (err) {
                    console.error('[Message Delete] Attachment cleanup error:', err);
                }
            }
        }

        await message.destroy(); // soft delete because paranoid: true

        res.status(204).json({
            status: 'success',
            data: null
        });
    } catch (err) {
        next(err);
    }
};
