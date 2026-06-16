const { Company, Bewerbung } = require('../../domain/models');
const AppError = require('../../utils/appError');

exports.createPublicApplication = async (req, res, next) => {
    try {
        const { companyId } = req.params;
        const { stelle, email, telefon, erfahrung, nachricht } = req.body;

        if (!companyId) {
            return next(new AppError('Company ID is required', 400));
        }

        const company = await Company.findByPk(companyId);
        if (!company) {
            return next(new AppError('Company not found', 404));
        }

        // Verify that the API Key belongs to the company specified in URL
        if (req.body.company_id && req.body.company_id !== companyId) {
            return next(new AppError('API key is not authorized for this company', 403));
        }

        if (!stelle || !email || !telefon || !erfahrung) {
            return next(new AppError('Missing required fields (stelle, email, telefon, erfahrung)', 400));
        }

        const bewerbung = await Bewerbung.create({
            company_id: companyId,
            stelle,
            email,
            telefon,
            erfahrung,
            nachricht,
            status: 'Neu',
            source_website: req.source_website || 'Direkt/Manuell'
        });

        // Send automated confirmation email via Mailgun (non-blocking)
        const { sendAutoReply } = require('../../utils/mailHelper');
        sendAutoReply(email, '', bewerbung.id, stelle, 'bewerbung', companyId).catch(mailErr => {
            console.error('[Mailgun] Bewerbung auto-reply failed:', mailErr);
        });

        res.status(201).json({
            status: 'success',
            data: {
                bewerbung
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.getAllApplications = async (req, res, next) => {
    try {
        const companyId = req.user.company_id;

        const bewerbungen = await Bewerbung.findAll({
            where: { company_id: companyId },
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            status: 'success',
            results: bewerbungen.length,
            data: {
                bewerbungen
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.updateApplication = async (req, res, next) => {
    try {
        const { id } = req.params;
        const companyId = req.user.company_id;

        const bewerbung = await Bewerbung.findOne({
            where: { id, company_id: companyId }
        });

        if (!bewerbung) {
            return next(new AppError('Bewerbung not found', 404));
        }

        const allowedFields = ['stelle', 'email', 'telefon', 'erfahrung', 'nachricht', 'status', 'notizen'];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                bewerbung[field] = req.body[field];
            }
        });

        await bewerbung.save();

        res.status(200).json({
            status: 'success',
            data: {
                bewerbung
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.deleteApplication = async (req, res, next) => {
    try {
        const { id } = req.params;
        const companyId = req.user.company_id;

        const bewerbung = await Bewerbung.findOne({
            where: { id, company_id: companyId }
        });

        if (!bewerbung) {
            return next(new AppError('Bewerbung not found', 404));
        }

        await bewerbung.destroy();

        res.status(204).json({
            status: 'success',
            data: null
        });
    } catch (err) {
        next(err);
    }
};
