const { Task, User, Project, Attachment } = require('../../domain/models');
const AppError = require('../../utils/appError');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { hasPermission } = require('../../utils/permissions');

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

        // Handle uploaded images: uploads/tasks/
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await Attachment.create({
                    task_id: newTask.id,
                    file_name: file.originalname,
                    file_url: `/uploads/tasks/${file.filename}`,
                    file_size: file.size,
                    content_type: file.mimetype
                });
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

        // Handle New File Uploads in Update
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await Attachment.create({
                    task_id: task.id,
                    file_name: file.originalname,
                    file_url: `/uploads/tasks/${file.filename}`,
                    file_size: file.size,
                    content_type: file.mimetype
                });
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

        // Delete File Attachments from disk
        if (task.attachments && task.attachments.length > 0) {
            task.attachments.forEach(att => {
                const filePath = path.join(__dirname, '../../../../', att.file_url);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });
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
