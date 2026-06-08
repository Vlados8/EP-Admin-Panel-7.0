const { Note, User, Project, Attachment, Subcontractor } = require('../../domain/models');
const fs = require('fs');
const path = require('path');
const AppError = require('../../utils/appError');
const { hasPermission } = require('../../utils/permissions');
const { uploadToR2, deleteFromR2 } = require('../utils/storage');
const sharp = require('sharp');
const { processUploadedFile } = require('../../utils/imageConverter');
const { Op } = require('sequelize');
const sequelize = require('../../config/database');

// Get all notes, potentially filtered by date or month
exports.getNotes = async (req, res, next) => {
    try {
        const whereClause = {};
        const userRole = req.user.role?.name || req.user.role;
        
        if (userRole === 'Subcontractor') {
            if (req.query.projectId) {
                whereClause.project_id = req.query.projectId;
                whereClause.showInDiary = true;
            } else {
                whereClause.subcontractor_id = req.user.id;
            }
        } else {
            if (req.query.projectId) {
                whereClause.project_id = req.query.projectId;
                whereClause.showInDiary = true;
            } else {
                whereClause.user_id = req.user.id;
            }
        }

        const notes = await Note.findAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name']
                },
                {
                    model: Subcontractor,
                    as: 'subcontractor',
                    attributes: ['id', 'name']
                },
                {
                    model: Project,
                    as: 'project',
                    attributes: ['id', 'project_number', 'title']
                },
                {
                    model: Attachment,
                    as: 'attachments'
                }
            ],
            order: [['date', 'ASC'], ['createdAt', 'DESC']]
        });

        res.status(200).json({
            status: 'success',
            results: notes.length,
            data: { notes }
        });
    } catch (err) {
        next(err);
    }
};


// Create a new note
exports.createNote = async (req, res, next) => {
    try {
        const { title, content, date, time, color, project_id, showInDiary } = req.body;

        const userRole = req.user.role?.name || req.user.role;
        let user_id = userRole === 'Subcontractor' ? null : req.user.id;
        let subcontractor_id = userRole === 'Subcontractor' ? req.user.id : null;

        if (!title || !content || !date) {
            return next(new AppError('Bitte füllen Sie Titel, Inhalt und Datum aus', 400));
        }

        const newNote = await Note.create({
            title,
            content,
            date,
            time: time || null,
            color,
            project_id: (project_id === '' || project_id === 'null' || !project_id) ? null : project_id,
            user_id,
            subcontractor_id,
            isPinned: req.body.isPinned || false,
            showInDiary: showInDiary === 'true' || showInDiary === true || false
        });

        // Handle File Uploads: upload to R2 with tiered quality (Original, Compressed, Thumbnail)
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await processUploadedFile(file);
                try {
                    let fileUrl = null;
                    let thumbUrl = null;
                    let originalUrl = null;

                    // 1. Upload Original File
                    const originalR2Key = `notes/original_${file.filename}`;
                    originalUrl = await uploadToR2(file.path, originalR2Key, file.mimetype);

                    if (file.mimetype.startsWith('image/')) {
                        // 2. Create Compressed Version (High resolution, 75% quality)
                        const compressedPath = file.path + '_compressed.jpg';
                        await sharp(file.path)
                            .jpeg({ quality: 75, progressive: true })
                            .toFile(compressedPath);
                        
                        const compressedR2Key = `notes/${file.filename}`;
                        fileUrl = await uploadToR2(compressedPath, compressedR2Key, 'image/jpeg');
                        if (fs.existsSync(compressedPath)) fs.unlinkSync(compressedPath);
                    } else {
                        // For non-images, fileUrl is the same as originalUrl
                        fileUrl = originalUrl;
                    }

                    await Attachment.create({
                        note_id: newNote.id,
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
                    const errorMsg = uploadErr.message || 'Unknown R2 error';
                    console.error(`[NoteController] Failed to upload note attachment ${file.originalname} to R2:`, errorMsg);
                    if (process.env.ENABLE_FILE_LOGGING === 'true') {
                        const logger = require('../../utils/logger');
                        logger.error(`Note Attachment Upload Failure: ${file.originalname} | Error: ${errorMsg}`);
                    }
                }
            }
        }

        // Fetch back with user info and project info
        const noteWithUser = await Note.findByPk(newNote.id, {
            include: [
                { model: User, as: 'user', attributes: ['id', 'name'] },
                { model: Subcontractor, as: 'subcontractor', attributes: ['id', 'name'] },
                { model: Project, as: 'project', attributes: ['id', 'project_number', 'title'] },
                { model: Attachment, as: 'attachments' }
            ]
        });

        res.status(201).json({
            status: 'success',
            data: { note: noteWithUser }
        });
    } catch (err) {
        next(err);
    }
};

// Delete note
exports.deleteNote = async (req, res, next) => {
    try {
        const note = await Note.findByPk(req.params.id, {
            include: [{ model: Attachment, as: 'attachments' }]
        });

        if (!note) {
            return next(new AppError('Notiz nicht gefunden', 404));
        }

        const userRole = req.user.role?.name || req.user.role;
        const isOwner = (userRole === 'Subcontractor' && note.subcontractor_id === req.user.id) ||
                        (userRole !== 'Subcontractor' && note.user_id === req.user.id);

        if (!isOwner) {
            return next(new AppError('Keine Berechtigung zum Löschen dieser Notiz', 403));
        }

        // Delete File Attachments
        if (note.attachments && note.attachments.length > 0) {
            for (const att of note.attachments) {
                if (att.file_url && att.file_url.startsWith('http')) {
                    // R2 File
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
                } else {
                    // Local File
                    const filePath = path.join(__dirname, '../../../../', att.file_url);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                }
            }
        }

        await note.destroy();

        res.status(204).json({
            status: 'success',
            data: null
        });
    } catch (err) {
        next(err);
    }
};

// Update note
exports.updateNote = async (req, res, next) => {
    try {
        const note = await Note.findByPk(req.params.id);

        if (!note) {
            return next(new AppError('Notiz nicht gefunden', 404));
        }

        const userRole = req.user.role?.name || req.user.role;
        const isOwner = (userRole === 'Subcontractor' && note.subcontractor_id === req.user.id) ||
                        (userRole !== 'Subcontractor' && note.user_id === req.user.id);

        if (!isOwner) {
            return next(new AppError('Keine Berechtigung zum Bearbeiten dieser Notiz', 403));
        }

        const { isDone, title, content, color, date, time, project_id, isPinned, showInDiary } = req.body;

        if (isDone !== undefined) note.isDone = isDone;
        if (title !== undefined) note.title = title;
        if (content !== undefined) note.content = content;
        if (color !== undefined) note.color = color;
        if (date !== undefined) note.date = date;
        if (time !== undefined) note.time = time || null;
        if (project_id !== undefined) {
            note.project_id = (project_id === '' || project_id === 'null') ? null : project_id;
        }
        if (isPinned !== undefined) note.isPinned = isPinned;
        if (showInDiary !== undefined) {
            note.showInDiary = showInDiary === 'true' || showInDiary === true;
        }

        await note.save();

        // Handle New File Uploads in Update with tiered quality
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await processUploadedFile(file);
                try {
                    let fileUrl = null;
                    let thumbUrl = null;
                    let originalUrl = null;

                    // 1. Upload Original File
                    const originalR2Key = `notes/original_${file.filename}`;
                    originalUrl = await uploadToR2(file.path, originalR2Key, file.mimetype);

                    if (file.mimetype.startsWith('image/')) {
                        // 2. Create Compressed Version
                        const compressedPath = file.path + '_compressed.jpg';
                        await sharp(file.path)
                            .jpeg({ quality: 75, progressive: true })
                            .toFile(compressedPath);
                        
                        const compressedR2Key = `notes/${file.filename}`;
                        fileUrl = await uploadToR2(compressedPath, compressedR2Key, 'image/jpeg');
                        if (fs.existsSync(compressedPath)) fs.unlinkSync(compressedPath);
                    } else {
                        fileUrl = originalUrl;
                    }

                    await Attachment.create({
                        note_id: note.id,
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
                    const errorMsg = uploadErr.message || 'Unknown R2 error';
                    console.error(`[NoteController Update] Failed to upload note attachment ${file.originalname} to R2:`, errorMsg);
                    if (process.env.ENABLE_FILE_LOGGING === 'true') {
                        const logger = require('../../utils/logger');
                        logger.error(`Note Update Attachment Upload Failure: ${file.originalname} | Error: ${errorMsg}`);
                    }
                }
            }
        }

        const updatedNote = await Note.findByPk(note.id, {
            include: [
                { model: User, as: 'user', attributes: ['id', 'name'] },
                { model: Subcontractor, as: 'subcontractor', attributes: ['id', 'name'] },
                { model: Project, as: 'project', attributes: ['id', 'project_number', 'title'] },
                { model: Attachment, as: 'attachments' }
            ]
        });

        res.status(200).json({
            status: 'success',
            data: { note: updatedNote }
        });
    } catch (err) {
        next(err);
    }
};
