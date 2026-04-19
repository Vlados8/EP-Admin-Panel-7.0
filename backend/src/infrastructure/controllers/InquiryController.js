const { Inquiry, InquiryAnswer, Category, Subcategory, Client, Company, Question, Project } = require('../../domain/models');
const { sendAutoReply } = require('../../utils/mailHelper');
const AppError = require('../../utils/appError');
const { hasPermission } = require('../../utils/permissions');

exports.getAllInquiries = async (req, res, next) => {
    try {
        const whereClause = {};
        const cid = (req.user && req.user.company_id) || req.body.company_id || req.query.company_id;
        
        if (cid) {
            whereClause.company_id = cid;
        }

        const inquiries = await Inquiry.findAll({
            where: whereClause,
            include: [
                { model: Category, as: 'category', attributes: ['id', 'name'] },
                { model: Subcategory, as: 'subcategory', attributes: ['id', 'name'] },
                { model: Client, as: 'client', attributes: ['id', 'name'] },
                { model: Project, as: 'project', attributes: ['id', 'project_number'] },
                {
                    model: InquiryAnswer,
                    as: 'answers',
                    include: [{ model: Question, as: 'question', attributes: ['id', 'question_text'] }]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            status: 'success',
            results: inquiries.length,
            data: { inquiries }
        });
    } catch (err) {
        next(err);
    }
};

exports.getInquiry = async (req, res, next) => {
    try {
        const inquiry = await Inquiry.findByPk(req.params.id, {
            include: [
                { model: Category, as: 'category', attributes: ['id', 'name'] },
                { model: Subcategory, as: 'subcategory', attributes: ['id', 'name'] },
                { model: Client, as: 'client', attributes: ['id', 'name'] },
                { model: Project, as: 'project', attributes: ['id', 'project_number'] },
                {
                    model: InquiryAnswer,
                    as: 'answers',
                    include: [{ model: Question, as: 'question', attributes: ['id', 'question_text'] }]
                }
            ]
        });

        if (!inquiry) return next(new AppError('Inquiry not found', 404));
        
        // Mark as read if not already
        if (!inquiry.is_read) {
            inquiry.is_read = true;
            await inquiry.save();
        }

        res.status(200).json({
            status: 'success',
            data: { inquiry }
        });
    } catch (err) {
        next(err);
    }
}

// Creation endpoint handles the nested answers structure
exports.createInquiry = async (req, res, next) => {
    try {
        const {
            title, category_id, subcategory_id, client_id,
            contact_name, contact_email, contact_phone,
            location, status, notes, company_id,
            source_website, // Источник (с какого сайта пришел лид)
            answers // Array of { category_id, answer_value }
        } = req.body;

        let cid = company_id;
        if (!cid && req.user?.company_id) {
            cid = req.user.company_id;
        }
        if (!cid) {
            const company = await Company.findOne();
            if (company) cid = company.id;
        }

        const newInquiry = await Inquiry.create({
            title,
            category_id: category_id,
            subcategory_id: subcategory_id || null,
            client_id: client_id || null,
            contact_name,
            contact_email: contact_email || null,
            contact_phone: contact_phone || null,
            location: location || null,
            status: status || 'new',
            notes: notes || null,
            company_id: cid,
            source_website: source_website || null,
            source_ip: req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket.remoteAddress
        });

        // Insert answers if provided
        if (answers && Array.isArray(answers) && answers.length > 0) {
            const answersData = answers.map(ans => ({
                inquiry_id: newInquiry.id,
                question_id: ans.question_id,
                answer_id: ans.answer_id || null,
                answer_value: ans.answer_value || null
            }));
            await InquiryAnswer.bulkCreate(answersData);
        }

        const createdInquiry = await Inquiry.findByPk(newInquiry.id, {
            include: [
                { model: Category, as: 'category', attributes: ['id', 'name'] },
                { model: Subcategory, as: 'subcategory', attributes: ['id', 'name'] },
                { model: Client, as: 'client', attributes: ['id', 'name'] },
                { model: Project, as: 'project', attributes: ['id', 'project_number'] },
                {
                    model: InquiryAnswer,
                    as: 'answers',
                    include: [{ model: Question, as: 'question', attributes: ['id', 'question_text'] }]
                }
            ]
        });

        res.status(201).json({
            status: 'success',
            data: { inquiry: createdInquiry }
        });

        // --- NEW: Auto-Responder Logic ---
        if (createdInquiry.contact_email) {
            const replyResult = await sendAutoReply(
                createdInquiry.contact_email,
                createdInquiry.contact_name,
                createdInquiry.id,
                createdInquiry.title,
                'inquiry',
                createdInquiry.company_id
            );

            if (replyResult && replyResult.success) {
                const noteAppend = "\n--------------------\n[" + new Date().toLocaleString('de-DE') + "] Automatische Empfangsbestätigung wurde an " + createdInquiry.contact_email + " versendet.";
                const newNotes = createdInquiry.notes ? createdInquiry.notes + noteAppend : noteAppend.trim();
                await createdInquiry.update({ notes: newNotes });
            }
        }

    } catch (err) {
        next(err);
    }
};

exports.updateInquiryStatus = async (req, res, next) => {
    try {
        const inquiry = await Inquiry.findByPk(req.params.id);
        if (!inquiry) return next(new AppError('Inquiry not found', 404));

        const { status } = req.body;
        if (status) {
            inquiry.status = status;
            await inquiry.save();
        }

        const updatedInquiry = await Inquiry.findByPk(inquiry.id, {
            include: [
                { model: Category, as: 'category', attributes: ['id', 'name'] },
                { model: Subcategory, as: 'subcategory', attributes: ['id', 'name'] },
                { model: Client, as: 'client', attributes: ['id', 'name'] },
                { model: Project, as: 'project', attributes: ['id', 'project_number'] },
                {
                    model: InquiryAnswer,
                    as: 'answers',
                    include: [{ model: Question, as: 'question', attributes: ['id', 'question_text'] }]
                }
            ]
        });

        res.status(200).json({
            status: 'success',
            data: { inquiry: updatedInquiry }
        });
    } catch (err) {
        next(err);
    }
};

exports.deleteInquiry = async (req, res, next) => {
    // Only Admin and Office can delete inquiries
    if (!hasPermission(req.user, 'MANAGE_USERS')) { // Proxy for Admin/Office
        return next(new AppError('Nur Administratoren können Anfragen löschen', 403));
    }
    try {
        const inquiry = await Inquiry.findByPk(req.params.id);
        if (!inquiry) return next(new AppError('Inquiry not found', 404));

        await inquiry.destroy(); // Answers will cascade delete if configured in DB, or paranoid soft-delete

        res.status(204).json({
            status: 'success',
            data: null
        });
    } catch (err) {
        next(err);
    }
};

exports.updateInquiry = async (req, res, next) => {
    const t = await Inquiry.sequelize.transaction();
    try {
        const inquiry = await Inquiry.findByPk(req.params.id, { transaction: t });
        if (!inquiry) {
            await t.rollback();
            return next(new AppError('Inquiry not found', 404));
        }

        const {
            title, category_id, subcategory_id, client_id,
            contact_name, contact_email, contact_phone,
            location, status, notes,
            answers // Array of { question_id, answer_id, answer_value }
        } = req.body;

        // Update main fields if provided
        await inquiry.update({
            title: title !== undefined ? title : inquiry.title,
            category_id: category_id !== undefined ? category_id : inquiry.category_id,
            subcategory_id: subcategory_id !== undefined ? subcategory_id : inquiry.subcategory_id,
            client_id: client_id !== undefined ? client_id : inquiry.client_id,
            contact_name: contact_name !== undefined ? contact_name : inquiry.contact_name,
            contact_email: contact_email !== undefined ? contact_email : inquiry.contact_email,
            contact_phone: contact_phone !== undefined ? contact_phone : inquiry.contact_phone,
            location: location !== undefined ? location : inquiry.location,
            status: status !== undefined ? status : inquiry.status,
            notes: notes !== undefined ? notes : inquiry.notes,
        }, { transaction: t });

        // Update answers if provided
        if (answers && Array.isArray(answers)) {
            // Delete old answers
            await InquiryAnswer.destroy({
                where: { inquiry_id: inquiry.id },
                transaction: t
            });

            // Insert new answers
            if (answers.length > 0) {
                const answersData = answers.map(ans => ({
                    inquiry_id: inquiry.id,
                    question_id: ans.question_id,
                    answer_id: ans.answer_id || null,
                    answer_value: ans.answer_value || null
                }));
                await InquiryAnswer.bulkCreate(answersData, { transaction: t });
            }
        }

        await t.commit();

        const updatedInquiry = await Inquiry.findByPk(inquiry.id, {
            include: [
                { model: Category, as: 'category', attributes: ['id', 'name'] },
                { model: Subcategory, as: 'subcategory', attributes: ['id', 'name'] },
                { model: Client, as: 'client', attributes: ['id', 'name'] },
                { model: Project, as: 'project', attributes: ['id', 'project_number'] },
                {
                    model: InquiryAnswer,
                    as: 'answers',
                    include: [{ model: Question, as: 'question', attributes: ['id', 'question_text'] }]
                }
            ]
        });

        res.status(200).json({
            status: 'success',
            data: { inquiry: updatedInquiry }
        });
    } catch (err) {
        await t.rollback();
        next(err);
    }
};
