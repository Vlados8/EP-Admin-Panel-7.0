const crypto = require('crypto');
const FormData = require('form-data');
const Mailgun = require('mailgun.js');

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
const wrapInMonochromeTemplate = (content, subject, fromName = 'Empire Premium Bau', headerLogoUrl = '', avatarLogoUrl = '') => {
    const year = new Date().getFullYear();
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
        .header-logo { height: 60px; width: auto; }
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
                <img src="${headerLogoUrl}" alt="Empire Premium Logo" class="header-logo">
            </div>
            <div class="content" style="background-color: #ffffff; background-image: linear-gradient(#ffffff, #ffffff);">
                <span class="subject-tag">Thema: ${subject}</span>
                <div style="min-height: 200px;">
                    ${content}
                </div>
                <div class="signature">
                    <img src="${avatarLogoUrl}" alt="EP" class="avatar-logo">
                    <div style="display: inline-block; vertical-align: middle;">
                        <p style="margin: 0; font-weight: bold; font-size: 14px; color: #111111;">${fromName}</p>
                        <p style="margin: 0; font-size: 12px; color: #999999;">Empire Premium Bau</p>
                    </div>
                </div>
            </div>
            <div class="footer">
                <a href="https://www.empire-premium-bau.de" style="color: #ffffff; text-decoration: none; font-size: 14px; letter-spacing: 3px; font-weight: bold;">EMPIRE PREMIUM</a>
                <div style="height: 1px; background-color: #222222; width: 40px; margin: 25px auto;"></div>
                
                <div class="footer-info" style="font-size: 9px; line-height: 2.4; color: #777777; margin-bottom: 25px; text-transform: uppercase; letter-spacing: 1.5px;">
                    <div style="color: #ffffff; font-weight: bold; margin-bottom: 8px;">Empire Premium Bau GmbH</div>
                    <div>Hastedter Heerstraße 63, 28207 Bremen</div>
                    <div style="color: #555555; margin: 10px 0;">&bull; &bull; &bull;</div>
                    <div>Amtsgericht Bremen &bull; HRB 40235</div>
                    <div>Ust-ID: DE36937652</div>
                    <div style="height: 15px;"></div>
                    <div>
                        <a href="mailto:info@empire-premium-bau.de" style="color: #888888; text-decoration: none;">info@empire-premium-bau.de</a>
                    </div>
                    <div style="color: #888888;">+49 176 61951823</div>
                </div>

                <div class="social-links">
                    <a href="https://www.instagram.com/empire_premium_bau" class="social-link">Instagram</a>
                    <a href="https://www.tiktok.com/@empire.premium.bau" class="social-link">TikTok</a>
                </div>
                <div class="copyright">
                    &copy; ${year} Empire Premium Bau. Alle Rechte vorbehalten.
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
const sendAutoReply = async (clientEmail, clientName, itemId, subject, type = 'support') => {
    if (!mg || !process.env.MAILGUN_DOMAIN) {
        console.warn('[Mailgun] Auto-reply not sent. Mailgun not configured.');
        return null;
    }

    const domain = process.env.MAILGUN_DOMAIN;
    const fromEmail = `no-reply@${domain}`;
    const fromName = 'Empire Premium Team';
    
    // Use relative path for production if frontend is served by backend, 
    // but Emails need absolute URLs.
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.empire-premium-bau.de';
    const headerLogoUrl = `${frontendUrl}/assets/Empire%20Premium%20white.png`;
    const avatarLogoUrl = `${frontendUrl}/assets/Logo%20EP.png`;

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
            <p>Empire Premium Bau</p>
        `;
        emailSubject = `Ihre Anfrage: ${subject}`;
        templateSubject = 'Ihre Anfrage';
    }

    const finalHtml = wrapInMonochromeTemplate(rawContent, templateSubject, fromName, headerLogoUrl, avatarLogoUrl);

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
