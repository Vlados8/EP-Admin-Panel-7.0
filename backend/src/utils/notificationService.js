const { Notification, NotificationSetting, User } = require('../domain/models');
const logger = require('./logger');

/**
 * Central Notifications Service
 */
class NotificationService {
    /**
     * Creates and sends a notification to a specific user.
     * Respects user's notification preferences.
     * 
     * @param {string} userId - Target User ID (UUID)
     * @param {string} title - Notification title
     * @param {string} body - Notification description/body
     * @param {'note' | 'task' | 'email' | 'chat' | 'call'} type - Type category
     * @param {Object} [data] - Contextual data (routing parameters, details, etc.)
     * @returns {Promise<Notification|null>} The created notification model, or null if disabled
     */
    static async createNotification(userId, title, body, type, data = {}) {
        try {
            // 1. Fetch user and notification settings in parallel
            const [user, setting] = await Promise.all([
                User.findByPk(userId),
                NotificationSetting.findOne({ where: { user_id: userId, type } })
            ]);

            if (!user) {
                logger.warn(`[NotificationService] Target user ${userId} not found.`);
                return null;
            }

            // 2. Determine if the channel is enabled (default fallback: true)
            const isEnabled = setting ? setting.enabled : true;
            if (!isEnabled) {
                logger.info(`[NotificationService] Notification of type '${type}' is disabled for User ${userId}. Skipping.`);
                return null;
            }

            // 3. Save notification record to the database
            const notification = await Notification.create({
                user_id: userId,
                title,
                body,
                type,
                data: data || {},
                is_read: false
            });

            logger.info(`[NotificationService] Created database notification ${notification.id} for User ${userId}.`);

            // 4. Emit real-time WebSocket event to the user's private socket room
            try {
                const { getIO } = require('../infrastructure/websocket');
                const io = getIO();
                io.to(`user_${userId}`).emit('new_notification', notification.toJSON());
                logger.info(`[NotificationService] Dispatched WebSocket event 'new_notification' to room user_${userId}.`);
            } catch (wsErr) {
                logger.warn(`[NotificationService] WebSocket dispatch bypassed (likely socket.io not initialized yet): ${wsErr.message}`);
            }

            // 5. Trigger Expo push notification if push token is registered
            if (user.expo_push_token && user.expo_push_token.trim() !== '') {
                // Ensure token is formatted correctly (Expo expects ExponentPushToken[...] or similar)
                const pushToken = user.expo_push_token.trim();
                
                // Native Node.js global fetch (Node 18+) handles outbound HTTP requests elegantly
                if (typeof fetch !== 'undefined') {
                    try {
                        const response = await fetch('https://exp.host/--/api/v2/push/send', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            body: JSON.stringify({
                                to: pushToken,
                                sound: 'default',
                                title,
                                body,
                                data: data || {}
                            })
                        });

                        const result = await response.json();
                        if (result.errors) {
                            logger.error(`[NotificationService] Expo Push API returned errors: ${JSON.stringify(result.errors)}`);
                        } else {
                            logger.info(`[NotificationService] Sent Expo Push notification successfully to ${pushToken}.`);
                        }
                    } catch (pushErr) {
                        logger.error(`[NotificationService] Failed to make request to Expo Push API: ${pushErr.message}`);
                    }
                } else {
                    logger.warn('[NotificationService] global fetch is undefined; skipping Expo push call.');
                }
            }

            return notification;
        } catch (err) {
            logger.error(`[NotificationService] Error creating notification: ${err.message}`, { stack: err.stack });
            return null;
        }
    }
}

module.exports = NotificationService;
