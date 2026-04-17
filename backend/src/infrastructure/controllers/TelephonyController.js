const { CallLog, User } = require('../../domain/models');

/**
 * Controller for handling external telephony webhooks (O2 Business)
 */
exports.handleWebhook = async (req, res, next) => {
    try {
        // 1. Security check
        const token = req.headers['x-api-token'];
        if (token !== process.env.TELEPHONY_W_TOKEN) {
            return res.status(401).json({ status: 'fail', message: 'Unauthorized' });
        }

        const { event, call_id, from_number, to_number, duration, status } = req.body;
        console.log(`[Telephony Webhook] Event: ${event}, CallID: ${call_id}`);

        // 2. Identify user (Secretary is often extension 100)
        // We look for a user assigned to this extension/number
        let targetUser = await User.findOne({ 
            where: { sip_user: '100' } // Example extension
        });

        // Fail-safe: If no secretary user found, try to find by identifying numbers (O2 often provides these)
        if (!targetUser) {
            // Logic to find user by their assigned phone number if provided
        }

        const logData = {
            call_id,
            remote_number: from_number, // Default to from_number
            direction: 'inbound',
            status: status || 'completed'
        };

        // Determine direction and remote number
        if (from_number === '100' || from_number.includes(targetUser?.sip_user)) {
            logData.direction = 'outbound';
            logData.remote_number = to_number;
        }

        // 3. Handle Events
        switch (event) {
            case 'CallStarted':
                await CallLog.upsert({
                    ...logData,
                    user_id: targetUser?.id || null, // Might be null if extension not mapped
                    duration_seconds: 0,
                    status: 'busy'
                });
                break;

            case 'CallAnswered':
                await CallLog.update(
                    { status: 'completed' },
                    { where: { call_id } }
                );
                break;

            case 'CallEnded':
                await CallLog.update(
                    { 
                        duration_seconds: duration || 0,
                        status: status || 'completed'
                    },
                    { where: { call_id } }
                );
                break;

            default:
                console.warn(`[Telephony Webhook] Unknown event: ${event}`);
        }

        res.status(200).json({ status: 'success' });
    } catch (err) {
        console.error('[Telephony Webhook Error]', err);
        next(err);
    }
};
