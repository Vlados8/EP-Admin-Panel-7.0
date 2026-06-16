const crypto = require('crypto');
const FormData = require('form-data');
const Mailgun = require('mailgun.js');
const { Company } = require('../domain/models');

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
 * Clean monochrome HTML wrapper
 */
const wrapInMonochromeTemplate = (content, subject, fromName = 'Empire Premium Team', settings = {}, frontendUrl = '') => {
    const year = new Date().getFullYear();
    
    // Asset URL Helper
    const getAssetUrl = (path) => {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        const apiBase = process.env.BACKEND_URL || 'http://localhost:3001';
        return `${apiBase}${path.startsWith('/') ? '' : '/'}${path}`;
    };

    // Firm Name Standardized
    const firmName = settings.firmName || 'Empire Premium Bau GmbH';

    // Header Logo (White)
    const headerLogoSrc = settings.logoLargeWhite || settings.logoSmallWhite;
    const headerLogoUrl = getAssetUrl(headerLogoSrc || settings.logoLarge || settings.logoSmall) || `${frontendUrl}/assets/Empire%20Premium%20white.png`;
    
    // Avatar Logo (Dark)
    const avatarLogoSrc = settings.logoLarge || settings.logoSmall;
    const avatarLogoUrl = getAssetUrl(avatarLogoSrc || settings.logoLargeWhite || settings.logoSmallWhite) || `${frontendUrl}/assets/Logo%20EP.png`;

    const needsHeaderFilter = !headerLogoSrc && (settings.logoLarge || settings.logoSmall);
    const needsAvatarFilter = !avatarLogoSrc && (settings.logoLargeWhite || settings.logoSmallWhite);

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
 * Sends an automated confirmation email to a client when a ticket or inquiry is created.
 */
const sendAutoReply = async (clientEmail, clientName, itemId, subject, type = 'support', companyId = null) => {
    if (!mg || !process.env.MAILGUN_DOMAIN) {
        console.warn('[Mailgun] Auto-reply not sent. Mailgun not configured.');
        return null;
    }

    // --- Dynamic Branding ---
    let settings = {};
    try {
        const company = companyId ? await Company.findByPk(companyId) : await Company.findOne();
        settings = company?.settings || {};
    } catch (dbErr) {
        console.error('[Mailgun] Error fetching company settings for auto-reply:', dbErr);
    }

    const firmName = settings.firmName || 'Empire Premium Bau GmbH';
    const domain = process.env.MAILGUN_DOMAIN;
    const fromEmail = type === 'bewerbung' ? `info@${domain}` : `no-reply@${domain}`;
    const fromName = `${firmName} Team`;
    
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.empire-premium-bau.de';
    const headerLogoUrl = settings.logoLargeWhite || settings.logoSmallWhite || `${frontendUrl}/assets/Empire%20Premium%20white.png`;
    const avatarLogoUrl = settings.logoLarge || settings.logoSmall || `${frontendUrl}/assets/Logo%20EP.png`;

    const greeting = clientName && clientName.trim() ? `Sehr geehrte(r) ${clientName},` : 'Sehr geehrte Damen und Herren,';
    const paddedItemId = String(itemId).padStart(3, '0');
    
    let rawContent = '';
    let emailSubject = '';
    let templateSubject = '';

    if (type === 'support') {
        rawContent = `
            <p>${greeting}</p>
            <p>Vielen Dank für Ihre Anfrage. Wir haben Ihr Ticket <strong>#SUP-${paddedItemId}</strong> bezüglich "${subject}" erhalten.</p>
            <p>Unser Support-Team wird Ihr Anliegen schnellstmöglich bearbeiten. Wir melden uns in Kürze bei Ihnen.</p>
            <p>Mit freundlichen Grüßen,</p>
            <p>Ihr Support-Team</p>
        `;
        emailSubject = `Ticket erhalten: ${subject}`;
        templateSubject = 'Ihre Support-Anfrage';
    } else if (type === 'inquiry') {
        rawContent = `
            <p>${greeting}</p>
            <p>Vielen Dank für Ihre Anfrage bezüglich "${subject}". Wir haben Ihre Daten erfolgreich erhalten (Anfragenummer: <strong>#INQ-${paddedItemId}</strong>).</p>
            <p>Unser Team wird Ihre Anfrage umgehend prüfen und sich in Kürze mit Ihnen in Verbindung setzen.</p>
            <p>Mit freundlichen Grüßen,</p>
            <p>${firmName}</p>
        `;
        emailSubject = `Ihre Anfrage: ${subject}`;
        templateSubject = 'Ihre Anfrage';
    } else if (type === 'bewerbung') {
        rawContent = `
            <p>${greeting}</p>
            <p>Vielen Dank für Ihre Bewerbung für die Stelle als <strong>${subject}</strong>. Wir haben Ihre Bewerbungsdaten erfolgreich erhalten (Bewerbungsnummer: <strong>#BEW-${paddedItemId}</strong>).</p>
            <p>Unser Recruiting-Team wird Ihre Bewerbungsunterlagen sorgfältig prüfen. Wir werden uns so schnell wie möglich mit Ihnen in Verbindung setzen, um die nächsten Schritte zu besprechen.</p>
            <p>Mit freundlichen Grüßen,</p>
            <p>Ihr Recruiting-Team</p>
        `;
        emailSubject = `Bewerbung erhalten: ${subject}`;
        templateSubject = 'Ihre Bewerbung';
    }

    const finalHtml = wrapInMonochromeTemplate(rawContent, templateSubject, fromName, settings, frontendUrl);

    const messageData = {
        from: `"${fromName}" <${fromEmail}>`,
        to: [clientEmail],
        subject: emailSubject,
        html: finalHtml
    };

    try {
        const result = await mg.messages.create(domain, messageData);
        return { success: true, id: result.id, message: rawContent };
    } catch (error) {
        console.error('[Mailgun] Auto-reply Send Error:', error);
        return { success: false, error };
    }
};

module.exports = {
    mg,
    wrapInMonochromeTemplate,
    sendAutoReply
};
