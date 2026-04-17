const { Project, ProjectFolder, ProjectFile, Client, EmailAccount, Email, Attachment, User, Inquiry, InquiryAnswer, ProjectAnswer } = require('../../domain/models');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const puppeteer = require('puppeteer'); // Use full puppeteer to access embedded browsers if system path fails
const FormData = require('form-data');
const Mailgun = require('mailgun.js');
const { uploadToR2 } = require('../utils/storage');
const logger = require('../../utils/logger');
const sequelize = require('../../config/database');

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

exports.getNextOfferNumber = async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        const prefix = `ANG-${currentYear}-`;

        // Find the latest project number starting with this year's prefix
        const lastProject = await Project.findOne({
            where: {
                project_number: {
                    [Op.like]: `${prefix}%`
                }
            },
            order: [['project_number', 'DESC']],
            paranoid: false
        });

        const lastFile = await ProjectFile.findOne({
            where: {
                name: {
                    [Op.like]: `${prefix}%.pdf`
                }
            },
            order: [['name', 'DESC']]
        });

        let nextNumber = 1;
        
        if (lastProject) {
            const parts = lastProject.project_number.split('-');
            if (parts.length >= 3) {
                const num = parseInt(parts[2]);
                if (!isNaN(num)) nextNumber = Math.max(nextNumber, num + 1);
            }
        }
        
        if (lastFile) {
            const parts = lastFile.name.replace('.pdf', '').split('-');
            if (parts.length >= 3) {
                const num = parseInt(parts[2]);
                if (!isNaN(num)) nextNumber = Math.max(nextNumber, num + 1);
            }
        }

        const formattedNumber = `${prefix}${nextNumber.toString().padStart(3, '0')}`;
        
        res.status(200).json({
            status: 'success',
            data: { nextNumber: formattedNumber }
        });
    } catch (error) {
        logger.error('Error fetching next offer number:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.saveOffer = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { title, client_id, project_number, budget, items, htmlContent, footerContent, inquiry_id } = req.body;
        let finalProjectNumber = project_number;
        const currentYear = new Date().getFullYear();
        const prefix = `ANG-${currentYear}-`;

        // Check if project_number exists or is missing (including soft-deleted)
        let isDuplicateProject = await Project.findOne({ 
            where: { project_number: finalProjectNumber },
            paranoid: false 
        });
        let isDuplicateFile = await ProjectFile.findOne({ 
            where: { name: `${finalProjectNumber}.pdf` }
        });
        
        if (isDuplicateProject || isDuplicateFile || !finalProjectNumber) {
            const lastProject = await Project.findOne({
                where: { project_number: { [Op.like]: `${prefix}%` } },
                order: [['project_number', 'DESC']],
                paranoid: false,
                transaction: t
            });
            const lastFile = await ProjectFile.findOne({
                where: { name: { [Op.like]: `${prefix}%.pdf` } },
                order: [['name', 'DESC']],
                transaction: t
            });
            
            let nextNumber = 1;

            if (lastProject) {
                const parts = lastProject.project_number.split('-');
                if (parts.length >= 3) {
                    const num = parseInt(parts[2]);
                    if (!isNaN(num)) nextNumber = Math.max(nextNumber, num + 1);
                }
            }
            if (lastFile) {
                const parts = lastFile.name.replace('.pdf', '').split('-');
                if (parts.length >= 3) {
                    const num = parseInt(parts[2]);
                    if (!isNaN(num)) nextNumber = Math.max(nextNumber, num + 1);
                }
            }
            finalProjectNumber = `${prefix}${nextNumber.toString().padStart(3, '0')}`;
        }

        let targetProjectId;

        if (req.body.parent_project_id) {
            targetProjectId = req.body.parent_project_id;
        } else {
            // 1. Create Project as 'angebot'
            const project = await Project.create({
                title,
                client_id,
                project_number: finalProjectNumber,
                budget,
                status: 'angebot',
                created_by: req.user.id
            }, { transaction: t });
            targetProjectId = project.id;
        }

        // --- Handle Inquiry Conversion if applicable ---
        if (inquiry_id) {
            const inquiry = await Inquiry.findByPk(inquiry_id, {
                include: [{ model: InquiryAnswer, as: 'answers' }],
                transaction: t
            });

            if (inquiry) {
                // Link Inquiry to new project
                await inquiry.update({
                    project_id: targetProjectId,
                    status: 'proposal'
                }, { transaction: t });

                // Sync category/subcategory to the Project if not already set
                const currentProject = await Project.findByPk(targetProjectId, { transaction: t });
                if (currentProject) {
                    await currentProject.update({
                        category_id: inquiry.category_id,
                        subcategory_id: inquiry.subcategory_id
                    }, { transaction: t });
                }

                // Transfer Answers
                if (inquiry.answers && inquiry.answers.length > 0) {
                    // Clear any existing project answers to avoid duplicates on re-save
                    await ProjectAnswer.destroy({ where: { project_id: targetProjectId }, transaction: t });

                    const projectAnswers = inquiry.answers.map(ans => ({
                        project_id: targetProjectId,
                        question_id: ans.question_id,
                        answer_id: ans.answer_id,
                        custom_value: ans.answer_value // InquiryAnswer naming is answer_value, ProjectAnswer is custom_value
                    }));
                    await ProjectAnswer.bulkCreate(projectAnswers, { transaction: t });
                }
            }
        }

        logger.info(`Saving offer: finalProjectNumber=${finalProjectNumber}, targetProjectId=${targetProjectId}, parent_project_id=${req.body.parent_project_id}`);

        // 2. Create 'Angebote' folder
        const [folder] = await ProjectFolder.findOrCreate({
            where: { project_id: targetProjectId, name: 'Angebote', path: '' },
            defaults: { created_by_id: req.user.id },
            transaction: t
        });

        // 3. Generate PDF using Puppeteer
        const pdfFileName = `${finalProjectNumber}.pdf`;
        const localPath = path.join(__dirname, '../../temp', pdfFileName);
        
        // Ensure temp dir exists
        if (!fs.existsSync(path.join(__dirname, '../../temp'))) {
            fs.mkdirSync(path.join(__dirname, '../../temp'));
        }

        let executablePath = process.env.CHROME_PATH;
        if (!executablePath) {
            const possiblePaths = [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
                '/usr/bin/google-chrome',
                '/usr/bin/chromium',
                '/usr/bin/chromium-browser'
            ];
            executablePath = possiblePaths.find(p => fs.existsSync(p));
        }

        const launchOptions = {
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        };

        if (executablePath) {
            launchOptions.executablePath = executablePath;
        }

        const browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        await page.pdf({
            path: localPath,
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: !!footerContent,
            footerTemplate: footerContent || '<span></span>',
            headerTemplate: '<span></span>',
            margin: { top: '20px', right: '20px', bottom: footerContent ? '140px' : '20px', left: '20px' }
        });
        await browser.close();

        // 4. Upload to R2
        const r2Key = `projects/${targetProjectId}/Angebote/${pdfFileName}`;
        const fileUrl = await uploadToR2(localPath, r2Key, 'application/pdf');

        // 5. Upsert ProjectFile record
        const [projectFile, created] = await ProjectFile.findOrCreate({
            where: {
                project_id: targetProjectId,
                path: 'Angebote',
                name: pdfFileName
            },
            defaults: {
                file_url: fileUrl,
                mime_type: 'application/pdf',
                size: fs.statSync(localPath).size,
                folder_id: folder.id,
                created_by_id: req.user.id
            },
            transaction: t
        });

        if (!created) {
            await projectFile.update({
                file_url: fileUrl,
                size: fs.statSync(localPath).size
            }, { transaction: t });
        }

        await t.commit();

        // Cleanup local file - using a delay and try-catch to avoid EBUSY on Windows
        setTimeout(() => {
            try {
                if (fs.existsSync(localPath)) {
                    fs.unlinkSync(localPath);
                    logger.info(`Successfully cleaned up temp PDF: ${pdfFileName}`);
                }
            } catch (err) {
                logger.warn(`Failed to cleanup temp PDF ${pdfFileName}: ${err.message}`);
                // Not a fatal error, the file will eventually be overwriten or can be cleared manually
            }
        }, 5000); // 5 second delay is very safe for Windows file locking

        res.status(201).json({
            status: 'success',
            data: { project_id: targetProjectId, fileUrl }
        });
    } catch (error) {
        if (t) await t.rollback();
        logger.error('Error saving offer:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.confirmOffer = async (req, res) => {
    try {
        const { id } = req.params;

        const project = await Project.findByPk(id);
        if (!project) {
            return res.status(404).json({ status: 'error', message: 'Project not found' });
        }

        if (project.status !== 'angebot') {
            return res.status(400).json({ status: 'error', message: 'Only offers can be confirmed' });
        }

        // 1. Update status and start date
        await project.update({
            status: 'aktiv',
            start_date: new Date()
        });

        // 2. Update linked inquiry to 'won'
        const inquiry = await Inquiry.findOne({ where: { project_id: id } });
        if (inquiry) {
            await inquiry.update({ status: 'won' });
        }

        // 3. Create default project folders if they don't exist
        const defaultFolders = ['Bilder', 'Dokumente', 'Abnahmeprotokoll', 'Rechnungen'];
        for (const folderName of defaultFolders) {
            const existingFolder = await ProjectFolder.findOne({
                where: { project_id: id, name: folderName, path: '' }
            });
            if (!existingFolder) {
                await ProjectFolder.create({
                    name: folderName,
                    project_id: id,
                    path: '',
                    created_by_id: req.user.id
                });
            }
        }

        res.status(200).json({
            status: 'success',
            message: 'Angebot erfolgreich bestätigt и Project aktiviert.',
            data: { project }
        });
    } catch (error) {
        logger.error('Error confirming offer:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.sendOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const { fromEmail, toEmail, subject, message } = req.body;

        if (!mg) {
            return res.status(500).json({ status: 'error', message: 'Mailgun is not configured' });
        }

        // 1. Get project and its PDF
        const project = await Project.findByPk(id, {
            include: [{ model: Client, as: 'client' }]
        });
        if (!project) return res.status(404).json({ status: 'error', message: 'Project not found' });

        const pdfFile = await ProjectFile.findOne({
            where: { project_id: id, name: { [Op.like]: '%.pdf' } },
            order: [['createdAt', 'DESC']]
        });
        if (!pdfFile) return res.status(404).json({ status: 'error', message: 'No PDF found for this offer' });

        // 2. Prepare Sender
        const account = await EmailAccount.findOne({
            where: { email: fromEmail, company_id: req.user.company_id }
        });
        if (!account) return res.status(404).json({ status: 'error', message: 'Sender account not found' });

        const senderName = account.display_name || req.user.name || 'Empire Premium Bau';
        const fromHeader = `"${senderName.replace(/"/g, '')}" <${fromEmail}>`;

        // 3. Download PDF from R2 to stream for sending
        const pdfResponse = await axios.get(pdfFile.file_path, { responseType: 'stream' });
        
        // 4. Construct and Send Email
        const domain = process.env.MAILGUN_DOMAIN;
        const messageData = {
            from: fromHeader,
            to: [toEmail],
            subject: subject || `Angebot: ${project.title} (${project.project_number})`,
            text: message || `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie das gewünschte Angebot.\n\nMit freundlichen Grüßen,\n${senderName}`,
            attachment: [{
                data: pdfResponse.data,
                filename: pdfFile.name
            }]
        };

        const result = await mg.messages.create(domain, messageData);

        // 5. Persist to Email History
        const savedEmail = await Email.create({
            mailgun_id: result.id,
            sender: fromHeader,
            sender_name: senderName,
            sender_email: fromEmail,
            recipient: toEmail,
            recipient_email: toEmail,
            client_id: project.client_id,
            subject: messageData.subject,
            body_plain: messageData.text,
            company_id: req.user.company_id,
            received_at: new Date(),
            is_read: true,
            direction: 'outbound'
        });

        // Add attachment record
        await Attachment.create({
            email_id: savedEmail.id,
            file_name: pdfFile.name,
            file_url: pdfFile.file_path,
            file_size: pdfFile.size,
            content_type: 'application/pdf'
        });

        res.status(200).json({
            status: 'success',
            message: 'Angebot успешно отправлено.',
            data: { result, email: savedEmail }
        });
    } catch (error) {
        logger.error('Error sending offer:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};
