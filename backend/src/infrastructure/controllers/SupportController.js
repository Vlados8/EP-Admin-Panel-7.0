const { SupportTicket, SupportResponse, Client, Project, User, Company } = require('../../domain/models');
const { sendAutoReply } = require('../../utils/mailHelper');

exports.getTickets = async (req, res, next) => {
    try {
        const { status, priority } = req.query;
        const cid = (req.user && req.user.company_id) || req.body.company_id || req.query.company_id;

        const whereClause = {};
        if (status) whereClause.status = status;
        if (priority) whereClause.priority = priority;
        if (cid) whereClause.company_id = cid;

        const tickets = await SupportTicket.findAll({
            where: whereClause,
            include: [
                { model: Client, as: 'client', attributes: ['id', 'name', 'email', 'phone', 'company_id'] },
                { model: Project, as: 'project', attributes: ['id', 'title', 'project_number'] },
                { model: User, as: 'assignee', attributes: ['id', 'name'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            status: 'success',
            data: { tickets }
        });
    } catch (err) {
        next(err);
    }
};

exports.getTicketDetails = async (req, res, next) => {
    try {
        const { id } = req.params;
        const ticket = await SupportTicket.findByPk(id, {
            include: [
                { model: Client, as: 'client', attributes: ['id', 'name', 'email', 'phone', 'company_id'] },
                { model: Project, as: 'project', attributes: ['id', 'title', 'project_number'] },
                { model: User, as: 'assignee', attributes: ['id', 'name'] },
                {
                    model: SupportResponse,
                    as: 'responses',
                    include: [{ model: User, as: 'user', attributes: ['id', 'name'] }]
                }
            ],
            order: [[{ model: SupportResponse, as: 'responses' }, 'createdAt', 'ASC']]
        });

        if (!ticket) {
            return res.status(404).json({ status: 'fail', message: 'Ticket not found' });
        }

        // Mark as read if not already
        if (!ticket.is_read) {
            ticket.is_read = true;
            await ticket.save();
        }

        res.status(200).json({
            status: 'success',
            data: { ticket }
        });
    } catch (err) {
        next(err);
    }
};

exports.createTicket = async (req, res, next) => {
    try {
        let { company_id, client_id, client_name, client_email, client_phone, project_id, subject, description, priority, source_website } = req.body;

        if (!company_id && req.user?.company_id) {
            company_id = req.user.company_id;
        }

        if (!company_id) {
            const company = await Company.findOne();
            if (company) company_id = company.id;
        }

        if (!company_id || !subject || !description) {
            return res.status(400).json({ status: 'fail', message: 'company_id, subject, and description are required' });
        }

        const newTicket = await SupportTicket.create({
            company_id,
            client_id: client_id || null,
            client_name: client_name || null,
            client_email: client_email || null,
            client_phone: client_phone || null,
            project_id: project_id || null,
            subject,
            description,
            priority: priority || 'normal',
            source_website: source_website || req.source_website || null // Сохраняем сайт-источник тикета
        });

        res.status(201).json({
            status: 'success',
            data: { ticket: newTicket }
        });

        // --- NEW: Auto-Responder Logic ---
        if (newTicket.client_email) {
            const replyResult = await sendAutoReply(
                newTicket.client_email,
                newTicket.client_name,
                newTicket.id,
                newTicket.subject,
                'support',
                newTicket.company_id
            );

            if (replyResult && replyResult.success) {
                // Log the automated email in the ticket responses so staff can see it was sent
                await SupportResponse.create({
                    ticket_id: newTicket.id,
                    user_id: req.user ? req.user.id : null, // System / unauthenticated
                    message: "Automatische Empfangsbestätigung wurde versendet:\n\n" + replyResult.message.replace(/<[^>]+>/g, ''), // Strip HTML for the local note
                    response_type: 'email'
                });
            }
        }

    } catch (err) {
        next(err);
    }
};

exports.updateTicketStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, assigned_to_id } = req.body;

        const ticket = await SupportTicket.findByPk(id);
        if (!ticket) {
            return res.status(404).json({ status: 'fail', message: 'Ticket not found' });
        }

        if (status) ticket.status = status;
        if (assigned_to_id !== undefined) ticket.assigned_to_id = assigned_to_id;

        await ticket.save();

        res.status(200).json({
            status: 'success',
            data: { ticket }
        });
    } catch (err) {
        next(err);
    }
};

exports.addResponse = async (req, res, next) => {
    try {
        const { id } = req.params; // ticket_id
        const { message, response_type } = req.body;
        const user_id = req.user?.id || req.body.user_id;

        if (!user_id || !message) {
            return res.status(400).json({ status: 'fail', message: 'user_id (from auth or body) and message are required' });
        }

        const user = await User.findByPk(user_id);
        if (!user) {
            return res.status(400).json({ status: 'fail', message: 'Invalid user_id provided.' });
        }

        const ticket = await SupportTicket.findByPk(id);
        if (!ticket) {
            return res.status(404).json({ status: 'fail', message: 'Ticket not found' });
        }

        const newResponse = await SupportResponse.create({
            ticket_id: id,
            user_id,
            message,
            response_type: response_type || 'note'
        });

        res.status(201).json({
            status: 'success',
            data: { response: newResponse }
        });
    } catch (err) {
        next(err);
    }
};

exports.deleteTicket = async (req, res, next) => {
    try {
        const { id } = req.params;
        const ticket = await SupportTicket.findByPk(id);

        if (!ticket) {
            return res.status(404).json({ status: 'fail', message: 'Ticket not found' });
        }

        await ticket.destroy();

        res.status(200).json({
            status: 'success',
            message: 'Ticket deleted successfully'
        });
    } catch (err) {
        next(err);
    }
};
