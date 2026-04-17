const express = require('express');
const router = express.Router();
const ChatController = require('../controllers/ChatController');
const auth = require('../middlewares/auth');

// Protected routes (require JWT)
router.use(auth.protect);

const { getUploader } = require('../middlewares/uploadMiddleware');
const upload = getUploader('chat');

// Conversations
router.get('/conversations', ChatController.getConversations);
router.get('/unread-count', ChatController.getTotalUnreadCount);
router.post('/conversations/direct', ChatController.getOrCreateDirectChat);
router.post('/conversations/group', ChatController.createGroup);

// Messages
router.get('/conversations/:conversationId/messages', ChatController.getMessages);
router.post('/conversations/:conversationId/messages', ChatController.sendMessage);
router.patch('/conversations/:conversationId/read', ChatController.markAsRead);
router.post('/conversations/:conversationId/upload', upload.array('files', 10), ChatController.uploadChatFile);
router.post('/messages/bulk-delete', ChatController.deleteMessagesBulk);
router.post('/messages/:messageId/react', ChatController.toggleReaction);
router.delete('/messages/:messageId', ChatController.deleteMessage);

module.exports = router;
