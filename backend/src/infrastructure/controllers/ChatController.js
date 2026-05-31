const { Conversation, Message, Participant, User, Role } = require('../../domain/models');
const { Op } = require('sequelize');
const logger = require('../../utils/logger');
const redisClient = require('../../config/redis');
const socketService = require('../websocket');
const fs = require('fs');
const path = require('path');
const { uploadToR2, deleteFromR2 } = require('../utils/storage');
const { processUploadedFile } = require('../../utils/imageConverter');

// Base chat uploads directory
const CHAT_UPLOADS_DIR = path.join(__dirname, '../../../../uploads/chat');

const ChatController = {
    // Get all conversations for current user
    getConversations: async (req, res) => {
        try {
            const { id: userId, company_id: companyId } = req.user;

            // 1. Get IDs of conversations where the current user is a participant
            const myParticipants = await Participant.findAll({
                where: { userId },
                attributes: ['conversationId', 'lastReadAt']
            });
            const userConversationIds = myParticipants.map(p => p.conversationId);

            if (userConversationIds.length === 0) {
                return res.json({ success: true, data: { conversations: [] } });
            }

            // 2. Fetch those conversations with ALL their participants and latest message
            const conversations = await Conversation.findAll({
                where: {
                    id: { [Op.in]: userConversationIds },
                    companyId
                },
                include: [
                    {
                        model: Participant,
                        as: 'participants',
                        include: [
                            {
                                model: User,
                                as: 'user',
                                attributes: ['id', 'name', 'email', 'phone', 'status', 'last_seen_at'],
                                include: [{ model: Role, as: 'role', attributes: ['name'] }]
                            }
                        ]
                    },
                    {
                        model: Message,
                        as: 'messages',
                        limit: 1,
                        order: [['createdAt', 'DESC']]
                    }
                ],
                order: [['updatedAt', 'DESC']]
            });

            // 3. Enrich with unread counts and online status
            const onlineUsers = await redisClient.smembers(`online_users_${companyId}`) || [];

            const results = await Promise.all(conversations.map(async (conv) => {
                const plainConv = conv.get({ plain: true });

                // Calculate unread
                const myPart = myParticipants.find(p => p.conversationId === conv.id);
                const unreadCount = await Message.count({
                    where: {
                        conversationId: conv.id,
                        senderId: { [Op.ne]: userId },
                        createdAt: { [Op.gt]: myPart.lastReadAt || new Date(0) }
                    }
                });

                // Calculate online status for 1v1
                let isOnline = false;
                if (!conv.isGroup) {
                    const otherPart = conv.participants.find(p => p.userId !== userId);
                    if (otherPart) {
                        isOnline = onlineUsers.includes(otherPart.userId);
                    }
                }

                return {
                    ...plainConv,
                    unreadCount,
                    isOnline
                };
            }));

            res.json({
                success: true,
                data: { conversations: results }
            });
        } catch (error) {
            logger.error(`Error fetching conversations: ${error.message}`);
            res.status(500).json({ success: false, message: 'Fehler beim Laden der Unterhaltungen' });
        }
    },

    // Get messages for a specific conversation
    getMessages: async (req, res) => {
        try {
            const { conversationId } = req.params;
            const { id: userId } = req.user;

            // Verify participation
            const participant = await Participant.findOne({
                where: { conversationId, userId }
            });

            if (!participant) {
                return res.status(403).json({ success: false, message: 'Zugriff verweigert' });
            }

            const messages = await Message.findAll({
                where: { conversationId },
                include: [
                    { model: User, as: 'sender', attributes: ['id', 'name'] },
                    {
                        model: Message,
                        as: 'repliedTo',
                        attributes: ['id', 'text', 'type', 'senderId'],
                        include: [{ model: User, as: 'sender', attributes: ['id', 'name'] }]
                    }
                ],
                order: [['createdAt', 'ASC']]
            });

            res.json({
                success: true,
                data: { messages }
            });
        } catch (error) {
            logger.error(`Error fetching messages: ${error.message}`);
            res.status(500).json({ success: false, message: 'Fehler beim Laden der Nachrichten' });
        }
    },

    // Send a text message
    sendMessage: async (req, res) => {
        try {
            const { conversationId } = req.params;
            const { text, replyToId, type, caption } = req.body;
            const { id: userId } = req.user;

            if (!text) {
                return res.status(400).json({ success: false, message: 'Nachrichtentext fehlt' });
            }

            // Verify participation
            const participant = await Participant.findOne({
                where: { conversationId, userId }
            });

            if (!participant) {
                return res.status(403).json({ success: false, message: 'Zugriff verweigert' });
            }

            const message = await Message.create({
                conversationId,
                senderId: userId,
                text: text.trim(),
                type: type || 'text',
                replyToId: replyToId || null,
                caption: caption || null
            });

            const fullMessage = await Message.findByPk(message.id, {
                include: [
                    { model: User, as: 'sender', attributes: ['id', 'name'] },
                    {
                        model: Message,
                        as: 'repliedTo',
                        include: [{ model: User, as: 'sender', attributes: ['id', 'name'] }]
                    }
                ]
            });

            // Update Conversation modified time
            await Conversation.update({ updatedAt: new Date() }, { where: { id: conversationId } });

            // Broadcast via Socket.io and trigger notifications
            try {
                const io = socketService.getIO();
                const participants = await Participant.findAll({ where: { conversationId } });

                participants.forEach(p => {
                    io.to(`user_${p.userId}`).emit('new_message', {
                        conversationId,
                        message: fullMessage
                    });
                });

                // Trigger in-app and push notification for other participants
                const NotificationService = require('../../utils/notificationService');
                const senderName = req.user.name || 'Ein Benutzer';
                const notificationBody = fullMessage.type === 'text' ? fullMessage.text : 'Datei empfangen';

                participants.forEach(p => {
                    if (p.userId !== userId) {
                        NotificationService.createNotification(
                            p.userId,
                            `Neue Nachricht von ${senderName}`,
                            notificationBody.substring(0, 100),
                            'chat',
                            { conversationId: parseInt(conversationId) }
                        );
                    }
                });
            } catch (err) {
                logger.error(`Socket broadcast or notification failed: ${err.message}`);
            }

            res.status(201).json({
                success: true,
                data: { message: fullMessage }
            });
        } catch (error) {
            logger.error(`Error sending message: ${error.message}`);
            res.status(500).json({ success: false, message: 'Fehler beim Senden der Nachricht' });
        }
    },

    // Get aggregate unread count for sidebar
    getTotalUnreadCount: async (req, res) => {
        try {
            const { id: userId } = req.user;

            // 1. Get all user's participant records
            const myParticipants = await Participant.findAll({
                where: { userId },
                attributes: ['conversationId', 'lastReadAt']
            });

            if (myParticipants.length === 0) {
                return res.json({ success: true, data: { count: 0 } });
            }

            // 2. Sum up unread messages across all those conversations
            let totalUnread = 0;
            for (const part of myParticipants) {
                const count = await Message.count({
                    where: {
                        conversationId: part.conversationId,
                        senderId: { [Op.ne]: userId },
                        createdAt: { [Op.gt]: part.lastReadAt || new Date(0) }
                    }
                });
                totalUnread += count;
            }

            res.json({
                success: true,
                data: { count: totalUnread }
            });
        } catch (error) {
            logger.error(`Error getting total unread count: ${error.message}`);
            res.status(500).json({ success: false, message: 'Fehler' });
        }
    },

    // Mark messages as read
    markAsRead: async (req, res) => {
        try {
            const { conversationId } = req.params;
            const { id: userId } = req.user;

            await Participant.update(
                { lastReadAt: new Date() },
                { where: { conversationId, userId } }
            );

            await Message.update(
                { isRead: true },
                {
                    where: {
                        conversationId,
                        senderId: { [Op.ne]: userId },
                        isRead: false
                    }
                }
            );

            // Notify participants that messages were read
            try {
                const io = socketService.getIO();
                io.to(`conversation_${conversationId}`).emit('messages_read', {
                    conversationId,
                    readerId: userId
                });
            } catch (err) {
                logger.error(`Socket notification failed (messages_read): ${err.message}`);
            }

            res.json({ success: true });
        } catch (error) {
            logger.error(`Error marking messages as read: ${error.message}`);
            res.status(500).json({ success: false, message: 'Fehler beim Aktualisieren des Status' });
        }
    },

    // Create or get 1v1 conversation
    getOrCreateDirectChat: async (req, res) => {
        try {
            const { id: currentUserId, company_id: companyId } = req.user;
            const { targetUserId } = req.body;

            if (currentUserId === targetUserId) {
                return res.status(400).json({ success: false, message: 'Selbstgespräche sind nicht erlaubt' });
            }

            // Look for existing 1:1 chat
            const conversations = await Conversation.findAll({
                where: { isGroup: false, companyId },
                include: [{
                    model: Participant,
                    as: 'participants',
                    required: true
                }]
            });

            const existing = conversations.find(conv => {
                const pIds = conv.participants.map(p => p.userId);
                return pIds.length === 2 && pIds.includes(currentUserId) && pIds.includes(targetUserId);
            });

            if (existing) {
                logger.info(`Found existing conversation: ${existing.id}`);
                return res.json({ success: true, data: { conversation: existing } });
            }

            // Create new
            logger.info(`Creating new conversation for company: ${companyId}`);
            const conversation = await Conversation.create({
                companyId,
                isGroup: false
            });

            logger.info(`New conversation created: ${conversation.id}. Creating participants...`);

            await Participant.bulkCreate([
                { conversationId: conversation.id, userId: currentUserId },
                { conversationId: conversation.id, userId: targetUserId }
            ]);

            const fullConversation = await Conversation.findByPk(conversation.id, {
                include: [{
                    model: Participant,
                    as: 'participants',
                    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'status'] }]
                }]
            });

            logger.info(`Direct chat established: ${fullConversation.id}`);

            res.status(201).json({
                success: true,
                data: { conversation: fullConversation }
            });
        } catch (error) {
            logger.error(`Error in getOrCreateDirectChat: ${error.message}`);
            res.status(500).json({ success: false, message: 'Fehler beim Erstellen des Chats' });
        }
    },

    createGroup: async (req, res) => {
        try {
            const { name, userIds, avatar } = req.body;
            const { id: currentUserId, company_id: companyId } = req.user;

            if (!name || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
                return res.status(400).json({ success: false, message: 'Name und Teilnehmer sind erforderlich' });
            }

            // Create Conversation
            const conversation = await Conversation.create({
                name,
                isGroup: true,
                avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`,
                companyId
            });

            // Add participants (including creator)
            const allParticipants = [...new Set([...userIds, currentUserId])];
            const participantData = allParticipants.map(uid => ({
                conversationId: conversation.id,
                userId: uid,
                lastReadAt: new Date()
            }));

            await Participant.bulkCreate(participantData);

            const fullConversation = await Conversation.findByPk(conversation.id, {
                include: [{
                    model: Participant,
                    as: 'participants',
                    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'status'] }]
                }]
            });

            // Notify all participants via Socket.io
            try {
                const io = socketService.getIO();
                allParticipants.forEach(uid => {
                    io.to(`user_${uid}`).emit('new_conversation', { conversation: fullConversation });
                });
            } catch (err) {
                logger.error(`Socket broadcast failed (new_conversation): ${err.message}`);
            }

            res.status(201).json({ success: true, data: { conversation: fullConversation } });
        } catch (error) {
            logger.error(`Error creating group chat: ${error.message}`);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Upload file in chat
    uploadChatFile: async (req, res) => {
        try {
            const { conversationId } = req.params;
            const { id: userId } = req.user;

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ success: false, message: 'Keine Dateien hochgeladen' });
            }

            // Ensure destination directory exists
            if (!fs.existsSync(CHAT_UPLOADS_DIR)) {
                fs.mkdirSync(CHAT_UPLOADS_DIR, { recursive: true });
                logger.info(`Created missing CHAT_UPLOADS_DIR: ${CHAT_UPLOADS_DIR}`);
            }

            const createdMessages = [];
            const { caption, replyToId } = req.body;

            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                await processUploadedFile(file);

                let fileUrl;
                let type = 'file';
                const mime = file.mimetype;
                if (mime.startsWith('image/')) {
                    type = 'image';
                } else if (mime.startsWith('video/')) {
                    type = 'video';
                } else if (mime.startsWith('audio/')) {
                    type = 'voice';
                }

                try {
                    // Upload directly to R2
                    const r2Key = `chat/${file.filename}`;
                    fileUrl = await uploadToR2(file.path, r2Key, file.mimetype);

                    // Remove local temp file
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                } catch (uploadError) {
                    logger.error(`R2 upload failed for file ${file.originalname}: ${uploadError.message}`);
                    continue; // Skip this file and try next
                }

                // Create Message record
                const message = await Message.create({
                    conversationId,
                    senderId: userId,
                    text: fileUrl,
                    type,
                    caption: (req.files.length === 1 && caption) ? caption : (type === 'file' ? file.originalname : null),
                    replyToId: replyToId || null
                });

                const fullMessage = await Message.findByPk(message.id, {
                    include: [
                        { model: User, as: 'sender', attributes: ['id', 'name'] },
                        { model: Message, as: 'repliedTo', include: [{ model: User, as: 'sender', attributes: ['id', 'name'] }] }
                    ]
                });

                createdMessages.push(fullMessage);

                // Update Conversation modified time
                await Conversation.update({ updatedAt: new Date() }, { where: { id: conversationId } });

                // Broadcast via Socket.io and trigger notifications
                try {
                    const io = socketService.getIO();
                    const participants = await Participant.findAll({ where: { conversationId } });

                    participants.forEach(p => {
                        io.to(`user_${p.userId}`).emit('new_message', {
                            conversationId,
                            message: fullMessage
                        });
                    });

                    // Trigger in-app and push notification for other participants
                    const NotificationService = require('../../utils/notificationService');
                    const senderName = req.user.name || 'Ein Benutzer';
                    const fileDescription = type === 'image' ? 'Bild gesendet' : (type === 'video' ? 'Video gesendet' : 'Datei gesendet');

                    participants.forEach(p => {
                        if (p.userId !== userId) {
                            NotificationService.createNotification(
                                p.userId,
                                `Neue Datei von ${senderName}`,
                                fileDescription,
                                'chat',
                                { conversationId: parseInt(conversationId) }
                            );
                        }
                    });
                } catch (err) {
                    logger.error(`Socket broadcast or notification failed for batch item ${i}: ${err.message}`);
                }
            }

            res.status(201).json({
                success: true,
                data: { messages: createdMessages }
            });

        } catch (error) {
            // Cleanup any remaining temp files on error
            if (req.files) {
                req.files.forEach(file => {
                    try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (e) { }
                });
            }
            logger.error(`Critical error in uploadChatFile batch: ${error.message} - ${error.stack}`);
            res.status(500).json({
                success: false,
                message: 'Fehler beim Hochladen der Dateien',
                error: error.message
            });
        }
    },


    /**
     * Delete multiple messages at once
     */
    deleteMessagesBulk: async (req, res) => {
        try {
            const { messageIds } = req.body;
            const { id: userId } = req.user;

            if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
                return res.status(400).json({ success: false, message: 'Keine Nachrichten-IDs angegeben' });
            }

            // 1. Fetch only messages owned by the user to ensure authorization
            const messages = await Message.findAll({
                where: {
                    id: messageIds,
                    senderId: userId
                }
            });

            if (messages.length === 0) {
                return res.status(404).json({ success: false, message: 'Keine löschbaren Nachrichten gefunden' });
            }

            const conversationId = messages[0].conversationId;

            // 2. File cleanup
            for (const msg of messages) {
                if (msg.type !== 'text') {
                    if (msg.text.startsWith('http')) {
                        // R2 File
                        try {
                            const urlObj = new URL(msg.text);
                            const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                            await deleteFromR2(key);
                        } catch (err) {
                            logger.error(`Failed to delete from R2 during bulk deletion: ${err.message}`);
                        }
                    } else {
                        // Local File cleanup (legacy)
                        try {
                            const fileName = path.basename(msg.text);
                            const filePath = path.join(CHAT_UPLOADS_DIR, fileName);
                            if (fs.existsSync(filePath)) {
                                fs.unlinkSync(filePath);
                            }
                        } catch (err) {
                            logger.error(`Failed to delete local file during bulk deletion: ${err.message}`);
                        }
                    }
                }
            }

            // 3. Database cleanup
            const deletedCount = await Message.destroy({
                where: {
                    id: messages.map(m => m.id),
                    senderId: userId
                }
            });

            // 4. Real-time sync via Socket.io
            try {
                const io = socketService.getIO();
                const participants = await Participant.findAll({ where: { conversationId } });
                participants.forEach(p => {
                    io.to(`user_${p.userId}`).emit('messages_bulk_deleted', {
                        messageIds: messages.map(m => m.id),
                        conversationId
                    });
                });
            } catch (err) {
                logger.error(`Socket broadcast failed for bulk deletion: ${err.message}`);
            }

            res.json({
                success: true,
                message: `${deletedCount} Nachrichten erfolgreich gelöscht`
            });
        } catch (error) {
            logger.error(`Error in deleteMessagesBulk: ${error.message} - ${error.stack}`);
            res.status(500).json({ success: false, message: 'Interner Serverfehler', error: error.message });
        }
    },

    /**
     * Delete message and its associated physical file if it exists
     */
    deleteMessage: async (req, res) => {
        try {
            const { messageId } = req.params;
            const { id: userId } = req.user;

            const message = await Message.findByPk(messageId);
            if (!message) {
                return res.status(404).json({ success: false, message: 'Nachricht nicht gefunden' });
            }

            // Authorization check: only the sender can delete their message
            if (message.senderId !== userId) {
                return res.status(403).json({ success: false, message: 'Keine Berechtigung zum Löschen' });
            }

            const { conversationId, type, text: fileUrl } = message;

            // File cleanup
            if (type !== 'text') {
                if (fileUrl.startsWith('http')) {
                    // R2 File
                    try {
                        const urlObj = new URL(fileUrl);
                        const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                        await deleteFromR2(key);
                        logger.info(`Successfully deleted R2 file with key: ${key}`);
                    } catch (err) {
                        logger.error(`Failed to delete from R2 during message deletion: ${err.message}`);
                    }
                } else {
                    // Local File cleanup (legacy)
                    try {
                        const fileName = path.basename(fileUrl);
                        const filePath = path.join(CHAT_UPLOADS_DIR, fileName);

                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                            logger.info(`Successfully deleted local file: ${filePath}`);
                        }
                    } catch (err) {
                        logger.error(`Failed to delete local file during message deletion: ${err.message}`);
                    }
                }
            }

            // Remove message from Database
            await message.destroy();
            logger.info(`Message ${messageId} deleted from database by user ${userId}`);

            // Real-time synchronization
            try {
                const io = socketService.getIO();
                const participants = await Participant.findAll({ where: { conversationId } });
                participants.forEach(p => {
                    io.to(`user_${p.userId}`).emit('message_deleted', {
                        messageId: parseInt(messageId),
                        conversationId
                    });
                });
            } catch (err) {
                logger.error(`Socket broadcast failed for message deletion: ${err.message}`);
            }

            res.json({ success: true, message: 'Nachricht erfolgreich gelöscht' });
        } catch (error) {
            logger.error(`Error in deleteMessage controller: ${error.message} - ${error.stack}`);
            res.status(500).json({
                success: false,
                message: 'Interner Serverfehler при удалении сообщения',
                error: error.message
            });
        }
    },

    toggleReaction: async (req, res) => {
        try {
            const { messageId } = req.params;
            const { emoji } = req.body;
            const { id: userId } = req.user;

            const message = await Message.findByPk(messageId);
            if (!message) {
                return res.status(404).json({ success: false, message: 'Nachricht не найдена' });
            }

            let reactions = message.reactions || {};
            // Sequelize might return it as string or object depending on config
            if (typeof reactions === 'string') reactions = JSON.parse(reactions);
            else reactions = { ...reactions }; // Clone to avoid mutation issues

            if (reactions[userId] === emoji) {
                delete reactions[userId];
            } else {
                reactions[userId] = emoji;
            }

            await message.update({ reactions });

            // Broadcast via Socket.io
            try {
                const io = socketService.getIO();
                const participants = await Participant.findAll({ where: { conversationId: message.conversationId } });
                participants.forEach(p => {
                    io.to(`user_${p.userId}`).emit('message_reaction_updated', {
                        messageId,
                        reactions
                    });
                });
            } catch (err) {
                logger.error(`Socket broadcast failed for reaction: ${err.message}`);
            }

            res.json({ success: true, data: { reactions } });
        } catch (error) {
            logger.error(`Error toggling reaction: ${error.message}`);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    },

    leaveGroup: async (req, res) => {
        try {
            const { conversationId } = req.params;
            const { id: userId } = req.user;

            const conversation = await Conversation.findByPk(conversationId);
            if (!conversation || !conversation.isGroup) {
                return res.status(404).json({ success: false, message: 'Gruppe nicht gefunden' });
            }

            // Verify participation before leaving
            const participant = await Participant.findOne({
                where: { conversationId, userId }
            });

            if (!participant) {
                return res.status(403).json({ success: false, message: 'Nicht Teil der Gruppe' });
            }

            // Remove participant
            await participant.destroy();
            logger.info(`User ${userId} left group ${conversationId}`);

            // Broadcast to remaining participants that user left
            try {
                const io = socketService.getIO();
                const remainingParticipants = await Participant.findAll({ where: { conversationId } });
                
                remainingParticipants.forEach(p => {
                    io.to(`user_${p.userId}`).emit('user_left_group', {
                        conversationId: parseInt(conversationId),
                        userId
                    });
                });
            } catch (err) {
                logger.error(`Socket broadcast failed for user leaving group: ${err.message}`);
            }

            // Check if group is empty now, if so, delete the group and its messages
            const participantsCount = await Participant.count({ where: { conversationId } });
            if (participantsCount === 0) {
                // Delete messages associated with conversation
                await Message.destroy({ where: { conversationId } });
                // Delete conversation
                await conversation.destroy();
                logger.info(`Deleted empty group ${conversationId}`);
            }

            res.json({ success: true, message: 'Gruppe verlassen' });
        } catch (error) {
            logger.error(`Error leaving group: ${error.message}`);
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

module.exports = ChatController;
