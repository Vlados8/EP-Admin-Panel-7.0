const { Task, User, Project, Attachment } = require('../../domain/models');
const AppError = require('../../utils/appError');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { hasPermission } = require('../../utils/permissions');
const { uploadToR2, deleteFromR2 } = require('../utils/storage');
const sharp = require('sharp');

// Get all tasks
exports.getTasks = async (req, res, next) => {
    try {
        const whereClause = {};
        if (!hasPermission(req.user, 'MANAGE_USERS')) {
            const role = req.user.role?.name || req.user.role;
            if (role === 'Worker') {
                whereClause.assigned_to_id = req.user.id;
            } else if (role === 'Gruppenleiter' || role === 'Projektleiter') {
                whereClause[Op.or] = [
                    { assigned_to_id: req.user.id },
                    { created_by_id: req.user.id }
                ];
            } else {
                whereClause.assigned_to_id = req.user.id; // Fallback
            }
        }

        const tasks = await Task.findAll({
            where: whereClause,
            include: [
                { model: User, as: 'assignee', attributes: ['id', 'name'] },
                { model: User, as: 'creator', attributes: ['id', 'name'] },
                { model: Attachment, as: 'attachments' },
                { model: Project, as: 'project', attributes: ['id', 'project_number', 'title'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            status: 'success',
            results: tasks.length,
            data: { tasks }
        });
    } catch (err) {
        next(err);
    }
};

// Create a new task
exports.createTask = async (req, res, next) => {
    try {
        const { title, description, assigned_to_id, status, project_id, due_date, time } = req.body;

        let created_by_id = req.user?.id;
        if (!created_by_id) {
            const firstUser = await User.findOne();
            created_by_id = firstUser?.id;
        }

        if (!title) {
            return next(new AppError('Bitte geben Sie einen Titel an', 400));
        }

        const newTask = await Task.create({
            title,
            description,
            status: status || 'In Arbeit',
            assigned_to_id: assigned_to_id || null,
            project_id: project_id || null,
            due_date: due_date || null,
            time: time || null,
            created_by_id
        });

        // Handle uploaded images: upload to R2 with tiered quality (Original, Compressed, Thumbnail)
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    let fileUrl = null;
                    let thumbUrl = null;
                    let originalUrl = null;

                    // 1. Upload Original File
                    const originalR2Key = `tasks/original_${file.filename}`;
                    originalUrl = await uploadToR2(file.path, originalR2Key, file.mimetype);

                    if (file.mimetype.startsWith('image/')) {
                        // 2. Create Compressed Version (High resolution, 75% quality)
                        const compressedPath = file.path + '_compressed.jpg';
                        await sharp(file.path)
                            .jpeg({ quality: 75, progressive: true })
                            .toFile(compressedPath);
                        
                        const compressedR2Key = `tasks/${file.filename}`;
                        fileUrl = await uploadToR2(compressedPath, compressedR2Key, 'image/jpeg');
                        if (fs.existsSync(compressedPath)) fs.unlinkSync(compressedPath);
                    } else {
                        // For non-images, fileUrl is the same as originalUrl
                        fileUrl = originalUrl;
                    }

                    await Attachment.create({
                        task_id: newTask.id,
                        file_name: file.originalname,
                        file_url: fileUrl,
                        thumb_url: null, // No longer creating thumbnails
                        original_url: originalUrl,
                        file_size: file.size,
                        content_type: file.mimetype
                    });

                    // Remove local file after successful R2 upload
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                } catch (uploadErr) {
                    console.error(`Failed to upload task attachment ${file.originalname} to R2:`, uploadErr);
                    // We don't fail the whole request, but log the error
                }
            }
        }

        const taskWithData = await Task.findByPk(newTask.id, {
            include: [
                { model: User, as: 'assignee', attributes: ['id', 'name'] },
                { model: User, as: 'creator', attributes: ['id', 'name'] },
                { model: Attachment, as: 'attachments' },
                { model: Project, as: 'project', attributes: ['id', 'project_number', 'title'] }
            ]
        });

        res.status(201).json({
            status: 'success',
            data: { task: taskWithData }
        });
    } catch (err) {
        console.error('Error in createTask:', err);
        next(err);
    }
};

// Update task
exports.updateTask = async (req, res, next) => {
    try {
        const task = await Task.findByPk(req.params.id);
        if (!task) return next(new AppError('Aufgabe nicht gefunden', 404));

        if (!hasPermission(req.user, 'MANAGE_USERS')) {
            const role = req.user.role?.name || req.user.role;
            if (role === 'Worker' && task.assigned_to_id !== req.user.id) {
                return next(new AppError('Keine Berechtigung zum Bearbeiten dieser Aufgabe', 403));
            } else if ((role === 'Gruppenleiter' || role === 'Projektleiter') && task.created_by_id !== req.user.id && task.assigned_to_id !== req.user.id) {
                return next(new AppError('Keine Berechtigung zum Bearbeiten dieser Aufgabe', 403));
            }
        }

        const { status, title, description, assigned_to_id, project_id, due_date, time } = req.body;

        if (status !== undefined) task.status = status;
        if (title !== undefined) task.title = title;
        if (description !== undefined) task.description = description;
        if (assigned_to_id !== undefined) task.assigned_to_id = assigned_to_id || null;
        if (project_id !== undefined) task.project_id = project_id || null;
        if (due_date !== undefined) task.due_date = due_date || null;
        if (time !== undefined) task.time = time || null;

        await task.save();

        // Handle New File Uploads in Update with tiered quality
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    let fileUrl = null;
                    let thumbUrl = null;
                    let originalUrl = null;

                    // 1. Upload Original File
                    const originalR2Key = `tasks/original_${file.filename}`;
                    originalUrl = await uploadToR2(file.path, originalR2Key, file.mimetype);

                    if (file.mimetype.startsWith('image/')) {
                        // 2. Create Compressed Version
                        const compressedPath = file.path + '_compressed.jpg';
                        await sharp(file.path)
                            .jpeg({ quality: 75, progressive: true })
                            .toFile(compressedPath);
                        
                        const compressedR2Key = `tasks/${file.filename}`;
                        fileUrl = await uploadToR2(compressedPath, compressedR2Key, 'image/jpeg');
                        if (fs.existsSync(compressedPath)) fs.unlinkSync(compressedPath);
                    } else {
                        fileUrl = originalUrl;
                    }

                    await Attachment.create({
                        task_id: task.id,
                        file_name: file.originalname,
                        file_url: fileUrl,
                        thumb_url: null, // No longer creating thumbnails
                        original_url: originalUrl,
                        file_size: file.size,
                        content_type: file.mimetype
                    });

                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                } catch (uploadErr) {
                    console.error(`Failed to upload task attachment ${file.originalname} to R2:`, uploadErr);
                }
            }
        }

        const updatedTask = await Task.findByPk(task.id, {
            include: [
                { model: User, as: 'assignee', attributes: ['id', 'name'] },
                { model: User, as: 'creator', attributes: ['id', 'name'] },
                { model: Attachment, as: 'attachments' },
                { model: Project, as: 'project', attributes: ['id', 'project_number', 'title'] }
            ]
        });

        res.status(200).json({
            status: 'success',
            data: { task: updatedTask }
        });
    } catch (err) {
        console.error('Error in updateTask:', err);
        next(err);
    }
};

// Delete task
exports.deleteTask = async (req, res, next) => {
    try {
        const task = await Task.findByPk(req.params.id, {
            include: [{ model: Attachment, as: 'attachments' }]
        });

        if (!task) return next(new AppError('Aufgabe nicht gefunden', 404));

        if (!hasPermission(req.user, 'MANAGE_USERS')) {
            const role = req.user.role?.name || req.user.role;
            if (role === 'Worker') {
                return next(new AppError('Keine Berechtigung zum Löschen von Aufgaben', 403));
            } else if ((role === 'Gruppenleiter' || role === 'Projektleiter') && task.created_by_id !== req.user.id) {
                return next(new AppError('Nur der Ersteller kann diese Aufgabe löschen', 403));
            }
        }

        // Delete File Attachments
        if (task.attachments && task.attachments.length > 0) {
            for (const att of task.attachments) {
                if (att.file_url && att.file_url.startsWith('http')) {
                    // 1. Delete compressed file (file_url)
                    try {
                        const urlObj = new URL(att.file_url);
                        const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                        await deleteFromR2(key);
                    } catch (err) { console.error('Error deleting file_url:', err); }

                    // 2. Delete original file (original_url)
                    if (att.original_url && att.original_url !== att.file_url) {
                        try {
                            const urlObj = new URL(att.original_url);
                            const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                            await deleteFromR2(key);
                        } catch (err) { console.error('Error deleting original_url:', err); }
                    }

                    // 3. Delete thumbnail (thumb_url)
                    if (att.thumb_url) {
                        try {
                            const urlObj = new URL(att.thumb_url);
                            const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                            await deleteFromR2(key);
                        } catch (err) { console.error('Error deleting thumb_url:', err); }
                    }
                } else if (att.file_url) {
                    // Local File
                    const filePath = path.join(__dirname, '../../../../', att.file_url);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                }
            }
        }

        await task.destroy();

        res.status(204).json({
            status: 'success',
            data: null
        });
    } catch (err) {
        console.error('Error in deleteTask:', err);
        next(err);
    }
};
