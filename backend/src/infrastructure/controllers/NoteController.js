const { Note, User, Project, Attachment } = require('../../domain/models');
const fs = require('fs');
const path = require('path');
const AppError = require('../../utils/appError');
const { hasPermission } = require('../../utils/permissions');

// Get all notes, potentially filtered by date or month
exports.getNotes = async (req, res, next) => {
    try {
        const whereClause = {};
        whereClause.user_id = req.user.id;

        const notes = await Note.findAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    as: 'user',
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
        const { title, content, date, time, color, project_id } = req.body;

        let user_id = req.user.id;

        if (!title || !content || !date) {
            return next(new AppError('Bitte füllen Sie Titel, Inhalt und Datum aus', 400));
        }

        const newNote = await Note.create({
            title,
            content,
            date,
            time: time || null,
            color,
            project_id: project_id || null,
            user_id
        });

        // Handle File Uploads
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await Attachment.create({
                    note_id: newNote.id,
                    file_name: file.originalname,
                    file_url: `/uploads/notizen/${file.filename}`,
                    file_size: file.size,
                    content_type: file.mimetype
                });
            }
        }

        // Fetch back with user info and project info
        const noteWithUser = await Note.findByPk(newNote.id, {
            include: [
                { model: User, as: 'user', attributes: ['id', 'name'] },
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

        if (note.user_id !== req.user.id) {
            return next(new AppError('Keine Berechtigung zum Löschen этой заметки', 403));
        }

        // Delete File Attachments from disk
        if (note.attachments && note.attachments.length > 0) {
            note.attachments.forEach(att => {
                const filePath = path.join(__dirname, '../../../../', att.file_url);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });
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

        if (note.user_id !== req.user.id) {
            return next(new AppError('Keine Berechtigung zum Bearbeiten dieser Notiz', 403));
        }

        const { isDone, title, content, color, date, time, project_id } = req.body;

        if (isDone !== undefined) note.isDone = isDone;
        if (title !== undefined) note.title = title;
        if (content !== undefined) note.content = content;
        if (color !== undefined) note.color = color;
        if (date !== undefined) note.date = date;
        if (time !== undefined) note.time = time || null;
        if (project_id !== undefined) note.project_id = project_id || null;

        await note.save();

        // Handle New File Uploads in Update
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await Attachment.create({
                    note_id: note.id,
                    file_name: file.originalname,
                    file_url: `/uploads/notizen/${file.filename}`,
                    file_size: file.size,
                    content_type: file.mimetype
                });
            }
        }

        const updatedNote = await Note.findByPk(note.id, {
            include: [
                { model: User, as: 'user', attributes: ['id', 'name'] },
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
