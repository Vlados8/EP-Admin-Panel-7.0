const { CallLog, User, Client } = require('../../domain/models');

exports.getCallLogs = async (req, res, next) => {
    try {
        const logs = await CallLog.findAll({
            where: { user_id: req.user.id },
            order: [['created_at', 'DESC']],
            limit: 50
        });

        // Match with clients
        const clients = await Client.findAll({
            where: { company_id: req.user.company_id },
            attributes: ['name', 'phone']
        });

        const clientMap = {};
        clients.forEach(c => {
            if (c.phone) {
                // Remove non-numeric characters for matching
                const cleanPhone = c.phone.replace(/\D/g, '');
                if (cleanPhone) clientMap[cleanPhone] = c.name;
            }
        });

        const enhancedLogs = logs.map(log => {
            const rawLog = log.toJSON();
            const cleanRemote = rawLog.remote_number ? rawLog.remote_number.replace(/\D/g, '') : '';
            return {
                ...rawLog,
                customer_name: clientMap[cleanRemote] || null
            };
        });

        res.status(200).json({
            status: 'success',
            data: { logs: enhancedLogs }
        });
    } catch (err) {
        next(err);
    }
};

exports.getAllCallLogs = async (req, res, next) => {
    try {
        const logs = await CallLog.findAll({
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'name', 'sip_user']
            }],
            order: [['created_at', 'DESC']],
            limit: 200
        });

        // Match with clients for the company
        const clients = await Client.findAll({
            where: { company_id: req.user.company_id },
            attributes: ['name', 'phone']
        });

        const clientMap = {};
        clients.forEach(c => {
            if (c.phone) {
                const cleanPhone = c.phone.replace(/\D/g, '');
                if (cleanPhone) clientMap[cleanPhone] = c.name;
            }
        });

        const enhancedLogs = logs.map(log => {
            const rawLog = log.toJSON();
            const cleanRemote = rawLog.remote_number ? rawLog.remote_number.replace(/\D/g, '') : '';
            return {
                ...rawLog,
                customer_name: clientMap[cleanRemote] || null
            };
        });

        res.status(200).json({
            status: 'success',
            data: { logs: enhancedLogs }
        });
    } catch (err) {
        next(err);
    }
};

exports.getUserLogs = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const logs = await CallLog.findAll({
            where: { user_id: userId },
            order: [['created_at', 'DESC']],
            limit: 50
        });

        // Match with clients
        const clients = await Client.findAll({
            where: { company_id: req.user.company_id },
            attributes: ['name', 'phone']
        });

        const clientMap = {};
        clients.forEach(c => {
            if (c.phone) {
                const cleanPhone = c.phone.replace(/\D/g, '');
                if (cleanPhone) clientMap[cleanPhone] = c.name;
            }
        });

        const enhancedLogs = logs.map(log => {
            const rawLog = log.toJSON();
            const cleanRemote = rawLog.remote_number ? rawLog.remote_number.replace(/\D/g, '') : '';
            return {
                ...rawLog,
                customer_name: clientMap[cleanRemote] || null
            };
        });

        res.status(200).json({
            status: 'success',
            data: { logs: enhancedLogs }
        });
    } catch (err) {
        next(err);
    }
};

exports.getNumberHistory = async (req, res, next) => {
    try {
        const { number } = req.params;
        const logs = await CallLog.findAll({
            where: { remote_number: number },
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'name', 'sip_user']
            }],
            order: [['created_at', 'DESC']],
            limit: 5
        });

        res.status(200).json({
            status: 'success',
            data: { logs }
        });
    } catch (err) {
        next(err);
    }
};

exports.createLog = async (req, res, next) => {
    try {
        const { direction, remote_number, duration_seconds, status } = req.body;

        const log = await CallLog.create({
            user_id: req.user.id,
            direction,
            remote_number,
            duration_seconds: duration_seconds || 0,
            status: status || 'completed'
        });

        res.status(201).json({
            status: 'success',
            data: { log }
        });
    } catch (err) {
        next(err);
    }
};

exports.updateSettings = async (req, res, next) => {
    try {
        const { sip_user, sip_password, sip_domain, wss_url } = req.body;

        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'User not found' });
        }

        user.sip_user = sip_user !== undefined ? sip_user : user.sip_user;
        user.sip_password = sip_password !== undefined ? sip_password : user.sip_password;
        user.sip_domain = sip_domain !== undefined ? sip_domain : user.sip_domain;
        user.wss_url = wss_url !== undefined ? wss_url : user.wss_url;
        user.mobile_phone = req.body.mobile_phone !== undefined ? req.body.mobile_phone : user.mobile_phone;
        user.extension_id = req.body.extension_id !== undefined ? req.body.extension_id : user.extension_id;

        await user.save();

        res.status(200).json({
            status: 'success',
            data: {
                sip_user: user.sip_user,
                sip_domain: user.sip_domain,
                wss_url: user.wss_url
                // Password omitted for security
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.getSettings = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.user.id);
        
        res.status(200).json({
            status: 'success',
            data: {
                sip_user: user.sip_user,
                sip_password: user.sip_password,
                sip_domain: user.sip_domain,
                wss_url: user.wss_url,
                is_receiving_calls: user.is_receiving_calls,
                mobile_phone: user.mobile_phone,
                extension_id: user.extension_id
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.updateCallStatus = async (req, res, next) => {
    try {
        const { is_receiving_calls } = req.body;
        const user = await User.findByPk(req.user.id);
        
        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'User not found' });
        }

        user.is_receiving_calls = is_receiving_calls;
        await user.save();

        // Broadcast status change to all tabs of the user
        const { getIO } = require('../websocket');
        const io = getIO();
        if (io) {
            io.to(`user_${user.id}`).emit('PHONE_STATUS_CHANGED', {
                is_receiving_calls: user.is_receiving_calls
            });
        }

        res.status(200).json({
            status: 'success',
            data: { is_receiving_calls: user.is_receiving_calls }
        });
    } catch (err) {
        next(err);
    }
};

exports.handleWebhook = async (req, res, next) => {
    try {
        // Security check for O2 Webhook
        const token = req.headers['x-api-token'];
        if (token !== process.env.TELEPHONY_W_TOKEN) {
            return res.status(401).json({ status: 'fail', message: 'Unauthorized' });
        }

        const { event, call_id, from, to } = req.body;
        console.log(`[Phone] Webhook received: ${event} for call ${call_id}`);

        // O2 Logic: Check if any agent is available in browser
        const availableUsers = await User.findAll({
            where: { is_receiving_calls: true },
            attributes: ['id', 'sip_user', 'mobile_phone']
        });

        if (availableUsers.length > 0) {
            // Pick an available user (round robin or random for now)
            const agent = availableUsers[0];
            
            // Response to O2: Dial the WebRTC extension
            return res.json({
                action: 'dial',
                target: agent.sip_user,
                type: 'webrtc'
            });
        } else {
            // Fallback: Dial mobile
            // We can pick a default mobile or the mobile of the intended recipient if 'to' matches extension
            const targetExtension = await User.findOne({ where: { extension_id: to } });
            const fallbackMobile = targetExtension?.mobile_phone || process.env.DEFAULT_FALLBACK_PHONE;

            return res.json({
                action: 'dial',
                target: fallbackMobile,
                type: 'pstn'
            });
        }
    } catch (err) {
        next(err);
    }
};

exports.transferCall = async (req, res, next) => {
    try {
        const { target_user_id, call_id } = req.body;
        const targetUser = await User.findByPk(target_user_id);

        if (!targetUser || !targetUser.mobile_phone) {
            return res.status(400).json({ status: 'fail', message: 'Target user has no mobile phone configured' });
        }

        // Logic to notify O2 Business API to transfer the call
        // This is a placeholder for the actual O2 API call
        console.log(`[Phone] Transferring call ${call_id} to ${targetUser.mobile_phone}`);
        
        // Example O2 API call:
        // await o2Api.transfer(call_id, targetUser.mobile_phone);

        res.status(200).json({
            status: 'success',
            message: `Call transferred to ${targetUser.mobile_phone}`
        });
    } catch (err) {
        next(err);
    }
};
