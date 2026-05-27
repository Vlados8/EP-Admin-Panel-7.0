const { Note, Task } = require('../domain/models');
const NotificationService = require('./notificationService');
const { Op } = require('sequelize');
const logger = require('./logger');

/**
 * Periodically scans the database every 60 seconds for Notes and Tasks due today.
 * Triggers socket/push notifications and flags `reminder_notified = true`.
 */
const startReminderDaemon = () => {
    logger.info('[ReminderDaemon] Initialized 60-second periodic Task & Note due scanner daemon.');
    
    setInterval(async () => {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const todayDateStr = `${year}-${month}-${day}`;

            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const currentHHMM = `${hours}:${minutes}`;

            logger.info(`[ReminderDaemon] Scanning for due reminders. Server Date: ${todayDateStr}, Server Time: ${currentHHMM}`);

            // 1. Scan unnotified Notes for today
            const notes = await Note.findAll({
                where: {
                    reminder_notified: false,
                    date: todayDateStr,
                    time: { [Op.ne]: null }
                }
            });

            for (const note of notes) {
                if (note.time && note.time.trim() !== '') {
                    // Match if scheduled time has arrived or passed in this minute check
                    if (note.time <= currentHHMM) {
                        logger.info(`[ReminderDaemon] Reminding Note ${note.id} (Scheduled: ${note.time}, Current: ${currentHHMM})`);
                        
                        await NotificationService.createNotification(
                            note.user_id,
                            'Bautagebuch Erinnerung 📝',
                            `Erinnerung für Ihre Notiz: "${note.title}"`,
                            'note',
                            { noteId: note.id }
                        );

                        await note.update({ reminder_notified: true });
                    }
                }
            }

            // 2. Scan unnotified Tasks for today
            const tasks = await Task.findAll({
                where: {
                    reminder_notified: false,
                    due_date: todayDateStr,
                    time: { [Op.ne]: null }
                }
            });

            for (const task of tasks) {
                if (task.time && task.time.trim() !== '') {
                    if (task.time <= currentHHMM) {
                        const targetUserId = task.assigned_to_id || task.created_by_id;
                        if (targetUserId) {
                            logger.info(`[ReminderDaemon] Reminding Task ${task.id} (Scheduled: ${task.time}, Current: ${currentHHMM})`);
                            
                            await NotificationService.createNotification(
                                targetUserId,
                                'Aufgabe fällig 📋',
                                `Ihre Aufgabe "${task.title}" ist jetzt fällig.`,
                                'task',
                                { taskId: task.id }
                            );
                        }

                        await task.update({ reminder_notified: true });
                    }
                }
            }

        } catch (err) {
            logger.error(`[ReminderDaemon] Error during due scanner cycle: ${err.message}`, { stack: err.stack });
        }
    }, 60 * 1000); // Run once every minute
};

module.exports = startReminderDaemon;
