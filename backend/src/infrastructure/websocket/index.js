const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const redisClient = require('../../config/redis');
const logger = require('../../utils/logger');
const jwt = require('jsonwebtoken');
const { User, Message, Participant, Conversation, Subcontractor } = require('../../domain/models');

let io;

const initWebSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();

    // duplicated clients need their own error handlers
    pubClient.on('error', (err) => logger.error(`Redis PubClient Error: ${err.message}`));
    subClient.on('error', (err) => logger.error(`Redis SubClient Error: ${err.message}`));

    io.adapter(createAdapter(pubClient, subClient));

    // Middleware for Auth
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.query.token;
            if (!token) {
                return next(new Error('Authentication error: No token provided'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            let user = null;
            let isSubcontractor = false;

            if (decoded.isSubcontractor) {
                user = await Subcontractor.findByPk(decoded.id);
                if (user) {
                    isSubcontractor = true;
                    // Add a virtual role for compatibility
                    user.role = 'Subcontractor';
                }
            } else {
                user = await User.findByPk(decoded.id);
            }

            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }

            socket.userId = user.id;
            socket.companyId = user.company_id;
            socket.isSubcontractor = isSubcontractor;
            next();
        } catch (err) {
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', async (socket) => {
        const userId = socket.userId;
        logger.info(`${socket.isSubcontractor ? 'Subcontractor' : 'User'} Connected: ${userId} (Socket: ${socket.id})`);

        if (socket.isSubcontractor) {
            // Join private subcontractor room to prevent ID collisions with regular users
            socket.join(`subcontractor_${userId}`);
        } else {
            // Join private user room for direct notifications
            socket.join(`user_${userId}`);
            
            // Mark user as online in Redis
            await redisClient.sadd(`online_users_${socket.companyId}`, userId);
            
            // Broadcast online status to company
            io.to(`company_${socket.companyId}`).emit('user_online', { userId });

            // Join Company Room
            socket.join(`company_${socket.companyId}`);
        }

        // Handle sending regular message
        socket.on('send_message', async (data) => {
            try {
                const { conversationId, text, type = 'text' } = data;
                
                // Save to Database
                const message = await Message.create({
                    conversationId,
                    senderId: userId,
                    text,
                    type
                });

                // Update Conversation modified time
                await Conversation.update({ updatedAt: new Date() }, { where: { id: conversationId } });

                // Get all participants to notify them
                const participants = await Participant.findAll({
                    where: { conversationId }
                });

                // Emit to all participants' private rooms
                participants.forEach(p => {
                    io.to(`user_${p.userId}`).emit('new_message', {
                        conversationId,
                        message: {
                            ...message.toJSON(),
                            sender: { id: userId }
                        }
                    });
                });

            } catch (err) {
                logger.error(`Socket Error (send_message): ${err.message}`);
                socket.emit('error', { message: 'Nachricht konnte nicht gesendet werden' });
            }
        });

        // Handle Typing indicator
        socket.on('typing', (data) => {
            const { conversationId, isTyping } = data;
            // Broadcast to conversation except sender
            socket.to(`conversation_${conversationId}`).emit('user_typing', {
                conversationId,
                userId,
                isTyping
            });
        });

        socket.on('join_conversation', (conversationId) => {
            socket.join(`conversation_${conversationId}`);
        });

        socket.on('leave_conversation', (conversationId) => {
            socket.leave(`conversation_${conversationId}`);
        });

        socket.on('disconnect', async () => {
            logger.info(`${socket.isSubcontractor ? 'Subcontractor' : 'User'} Disconnected: ${userId}`);
            
            if (socket.isSubcontractor) {
                return; // Subcontractors don't use phone calls or online status lists
            }
            
            // Check if user has other active sockets
            const userSockets = await io.in(`user_${userId}`).fetchSockets();
            if (userSockets.length === 0) {
                // User is truly offline
                await redisClient.srem(`online_users_${socket.companyId}`, userId);
                io.to(`company_${socket.companyId}`).emit('user_online_status', { userId, status: 'offline' });

                // Also turn off phone reception if it was on
                const user = await User.findByPk(userId);
                if (user && user.is_receiving_calls) {
                    user.is_receiving_calls = false;
                    await user.save();
                    console.log(`[Phone] Disabled reception for User ${userId} due to disconnect`);
                }
            }
        });

        // --- Call Signaling ---
        socket.on('call:request', (data) => {
            const { targetUserId, peerId, type, callerName } = data; // type: 'audio' | 'video'
            logger.info(`Call Request: from ${userId} to ${targetUserId} (${type})`);
            io.to(`user_${targetUserId}`).emit('call:incoming', {
                callerId: userId,
                callerName: callerName || 'Unbekannt',
                peerId,
                type
            });

            // Trigger call push notification so offline mobile users get it
            const NotificationService = require('../../utils/notificationService');
            NotificationService.createNotification(
                targetUserId,
                'Eingehender Anruf 📞',
                `${callerName || 'Jemand'} ruft Sie an...`,
                'call',
                { callerId: userId, peerId, type }
            );
        });

        socket.on('call:response', (data) => {
            const { targetUserId, accepted, peerId } = data;
            logger.info(`Call Response: from ${userId} to ${targetUserId} (Accepted: ${accepted})`);
            io.to(`user_${targetUserId}`).emit('call:answered', {
                responderId: userId,
                accepted,
                peerId
            });
        });

        socket.on('call:end', (data) => {
            const { targetUserId } = data;
            logger.info(`Call Ended: by ${userId} for ${targetUserId}`);
            io.to(`user_${targetUserId}`).emit('call:finished', {
                endedById: userId
            });
        });
        // -----------------------
    });

    return io;
};

const getIO = () => {
    if (!io) throw new Error('Socket.io not initialized');
    return io;
};

const emitToCompany = (companyId, event, data) => {
    if (!io) return;
    io.to(`company_${companyId}`).emit(event, data);
};

module.exports = {
    initWebSocket,
    getIO,
    emitToCompany
};
