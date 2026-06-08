const { Notification, NotificationSetting, User } = require('../../domain/models');
const AppError = require('../../utils/appError');
const { Op } = require('sequelize');

/**
 * Fetch all notifications for the authenticated user
 */
exports.getNotifications = async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        // Fetch up to 50 recent notifications
        const notifications = await Notification.findAll({
            where: { user_id: userId },
            order: [['createdAt', 'DESC']],
            limit: 50
        });

        res.status(200).json({
            status: 'success',
            results: notifications.length,
            data: { notifications }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Mark all or specific notifications as read
 */
exports.markNotificationsRead = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { notificationIds } = req.body || {}; // Optional array of specific notification IDs

        const whereClause = { user_id: userId, is_read: false };
        if (Array.isArray(notificationIds) && notificationIds.length > 0) {
            whereClause.id = { [Op.in]: notificationIds };
        }

        await Notification.update(
            { is_read: true },
            { where: whereClause }
        );

        res.status(200).json({
            status: 'success',
            message: 'Notifications marked as read successfully'
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Fetch channel-specific notification settings/toggles
 */
exports.getSettings = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const settings = await NotificationSetting.findAll({
            where: { user_id: userId }
        });

        res.status(200).json({
            status: 'success',
            data: { settings }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Update one or more notification channel toggles
 */
exports.updateSettings = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { type, enabled, settings } = req.body;

        // Support bulk update of array: [{ type, enabled }]
        if (Array.isArray(settings)) {
            for (const item of settings) {
                if (!item.type) continue;
                
                let record = await NotificationSetting.findOne({
                    where: { user_id: userId, type: item.type }
                });

                if (record) {
                    await record.update({ enabled: !!item.enabled });
                } else {
                    await NotificationSetting.create({
                        user_id: userId,
                        type: item.type,
                        enabled: !!item.enabled
                    });
                }
            }
        } else if (type) {
            // Support single toggle update
            let record = await NotificationSetting.findOne({
                where: { user_id: userId, type }
            });

            if (record) {
                await record.update({ enabled: !!enabled });
            } else {
                await NotificationSetting.create({
                    user_id: userId,
                    type,
                    enabled: !!enabled
                });
            }
        } else {
            return next(new AppError('Invalid payload: specify a type or settings array', 400));
        }

        // Fetch and return the updated set of preferences
        const updatedSettings = await NotificationSetting.findAll({
            where: { user_id: userId }
        });

        res.status(200).json({
            status: 'success',
            data: { settings: updatedSettings }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Register user's Expo Mobile Push Token
 */
exports.registerPushToken = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { token } = req.body;

        if (token === undefined) {
            return next(new AppError('Push token is required', 400));
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return next(new AppError('User not found', 404));
        }

        await user.update({ expo_push_token: token ? token.trim() : null });

        res.status(200).json({
            status: 'success',
            message: 'Expo push token registered successfully'
        });
    } catch (err) {
        next(err);
    }
};
