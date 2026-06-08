const { ProjectStage, User, ProjectStageImage, ProjectUser, ProjectSubcontractor, Subcontractor } = require('../../domain/models');
const AppError = require('../../utils/appError');
const fs = require('fs');
const path = require('path');
const { hasPermission } = require('../../utils/permissions');
const { uploadToR2, deleteFromR2 } = require('../utils/storage');
const { processUploadedFile } = require('../../utils/imageConverter');

// Get all stages for a project
exports.getStages = async (req, res, next) => {
    try {
        const { projectId } = req.query;
        const where = projectId ? { project_id: projectId } : {};

        const stages = await ProjectStage.findAll({
            where,
            include: [
                { model: User, as: 'assignee', attributes: ['id', 'name'] },
                { model: User, as: 'creator', attributes: ['id', 'name'] },
                { model: Subcontractor, as: 'subcontractor_creator', attributes: ['id', 'name'] },
                { model: ProjectStageImage, as: 'images' }
            ],
            order: [['createdAt', 'ASC']]
        });

        res.status(200).json({
            status: 'success',
            results: stages.length,
            data: { stages }
        });
    } catch (err) {
        next(err);
    }
};

// Create a new stage
exports.createStage = async (req, res, next) => {
    try {
        const { title, description, assigned_to_id, status, project_id } = req.body;

        const isSubcontractor = req.user?.role?.name === 'Subcontractor' || req.user?.role === 'Subcontractor';
        let created_by_id = null;
        let created_by_subcontractor_id = null;

        if (isSubcontractor) {
            created_by_subcontractor_id = req.user.id;
        } else {
            created_by_id = req.user?.id;
            if (!created_by_id) {
                const admin = await User.findOne({ where: { email: 'admin@ep-bau.de' } });
                created_by_id = admin?.id;
            }
        }

        if (!title || !project_id) {
            return next(new AppError('Titel und Projekt-ID sind erforderlich', 400));
        }

        // Check if user is authorized for this project
        if (!hasPermission(req.user, 'MANAGE_API_KEYS')) {
            let isAssigned = false;
            if (isSubcontractor) {
                const isSubAssigned = await ProjectSubcontractor.findOne({
                    where: { project_id, subcontractor_id: req.user.id }
                });
                if (isSubAssigned) isAssigned = true;
            } else {
                const isUserAssigned = await ProjectUser.findOne({
                    where: { project_id, user_id: req.user.id }
                });
                if (isUserAssigned) isAssigned = true;
            }

            if (!isAssigned) {
                // For PL/GL, also check if project is unassigned
                if (req.user.role?.name === 'Projektleiter' || req.user.role?.name === 'Gruppenleiter' || req.user.role === 'Projektleiter' || req.user.role === 'Gruppenleiter') {
                    const hasPL = await ProjectUser.findOne({ where: { project_id, role: 'projektleiter' } });
                    if (hasPL) return next(new AppError('Keine Berechtigung für dieses Projekt', 403));
                } else {
                    return next(new AppError('Keine Berechtigung für dieses Projekt', 403));
                }
            }
        }

        const newStage = await ProjectStage.create({
            title,
            description,
            status: status || 'In Arbeit',
            assigned_to_id: assigned_to_id || null,
            created_by_id,
            created_by_subcontractor_id,
            project_id
        });

        // Handle uploaded images with R2
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await processUploadedFile(file);
                try {
                    const r2Key = `projects/${project_id}/stages/${newStage.id}/${Date.now()}_${file.originalname}`;
                    const fileUrl = await uploadToR2(file.path, r2Key, file.mimetype);

                    await ProjectStageImage.create({
                        project_stage_id: newStage.id,
                        path: fileUrl
                    });

                    // Cleanup local temp
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                } catch (err) {
                    console.error('R2 Stage Image Upload Error:', err);
                }
            }
        }

        const stageWithData = await ProjectStage.findByPk(newStage.id, {
            include: [
                { model: User, as: 'assignee', attributes: ['id', 'name'] },
                { model: User, as: 'creator', attributes: ['id', 'name'] },
                { model: Subcontractor, as: 'subcontractor_creator', attributes: ['id', 'name'] },
                { model: ProjectStageImage, as: 'images' }
            ]
        });

        res.status(201).json({
            status: 'success',
            data: { stage: stageWithData }
        });
    } catch (err) {
        console.error('Error in createStage:', err);
        next(err);
    }
};

// Update stage
exports.updateStage = async (req, res, next) => {
    try {
        const stage = await ProjectStage.findByPk(req.params.id);
        if (!stage) return next(new AppError('Etappe nicht gefunden', 404));

        // RBAC: Only creator or manager can update details. Subcontractor can toggle status if assigned to project.
        const userRole = req.user.role?.name || req.user.role;
        let allowed = false;
        let statusOnly = false;

        if (hasPermission(req.user, 'MANAGE_API_KEYS')) {
            allowed = true;
        } else {
            const isManager = userRole === 'Projektleiter' || userRole === 'Gruppenleiter';
            const isOwner = (stage.created_by_id === req.user.id) || (stage.created_by_subcontractor_id === req.user.id);
            
            if (isOwner) {
                allowed = true;
            } else if (isManager) {
                allowed = true;
                // If manager, check if they are authorized for the project
                const isAssigned = await ProjectUser.findOne({ where: { project_id: stage.project_id, user_id: req.user.id } });
                if (!isAssigned) {
                    const hasPL = await ProjectUser.findOne({ where: { project_id: stage.project_id, role: 'projektleiter' } });
                    if (hasPL) allowed = false;
                }
            } else if (userRole === 'Subcontractor') {
                // Check project assignment for subcontractor
                const isSubAssigned = await ProjectSubcontractor.findOne({
                    where: { project_id: stage.project_id, subcontractor_id: req.user.id }
                });
                if (isSubAssigned) {
                    allowed = true;
                    statusOnly = true;
                }
            }
        }

        if (!allowed) {
            return next(new AppError('Keine Berechtigung zum Bearbeiten dieser Etappe', 403));
        }

        const { status, title, description, assigned_to_id, imagesToDelete } = req.body;

        if (statusOnly) {
            const hasOtherFields = (title !== undefined && title !== stage.title) ||
                                   (description !== undefined && description !== stage.description) ||
                                   (assigned_to_id !== undefined && assigned_to_id !== stage.assigned_to_id) ||
                                   (imagesToDelete !== undefined && imagesToDelete !== null) ||
                                   (req.files && req.files.length > 0);
            if (hasOtherFields) {
                return next(new AppError('Als Subunternehmer können Sie nur den Status anderer Etappen ändern', 403));
            }
        }

        if (status !== undefined) stage.status = status;
        if (title !== undefined && !statusOnly) stage.title = title;
        if (description !== undefined && !statusOnly) stage.description = description;
        if (assigned_to_id !== undefined && !statusOnly) stage.assigned_to_id = assigned_to_id || null;

        await stage.save();

        // Handle image deletions
        if (imagesToDelete) {
            const idsToDelete = typeof imagesToDelete === 'string' ? JSON.parse(imagesToDelete) : imagesToDelete;
            if (Array.isArray(idsToDelete) && idsToDelete.length > 0) {
                const images = await ProjectStageImage.findAll({
                    where: { id: idsToDelete, project_stage_id: stage.id }
                });

                for (const img of images) {
                    try {
                        if (img.path && img.path.startsWith('http')) {
                            // R2 Deletion
                            const url = new URL(img.path);
                            const key = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
                            await deleteFromR2(key);
                        } else {
                            // Legacy Local Deletion
                            const fullPath = path.join(__dirname, '../../../../', img.path);
                            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                        }
                    } catch (err) {
                        console.error('Image Deletion Error:', err);
                    }
                    await img.destroy();
                }
            }
        }

        // Handle new image uploads with R2
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await processUploadedFile(file);
                try {
                    const r2Key = `projects/${stage.project_id}/stages/${stage.id}/${Date.now()}_${file.originalname}`;
                    const fileUrl = await uploadToR2(file.path, r2Key, file.mimetype);

                    await ProjectStageImage.create({
                        project_stage_id: stage.id,
                        path: fileUrl
                    });

                    // Cleanup local temp
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                } catch (err) {
                    console.error('R2 Stage Image Upload Error (Update):', err);
                }
            }
        }

        const updatedStage = await ProjectStage.findByPk(stage.id, {
            include: [
                { model: User, as: 'assignee', attributes: ['id', 'name'] },
                { model: User, as: 'creator', attributes: ['id', 'name'] },
                { model: Subcontractor, as: 'subcontractor_creator', attributes: ['id', 'name'] },
                { model: ProjectStageImage, as: 'images' }
            ]
        });

        res.status(200).json({
            status: 'success',
            data: { stage: updatedStage }
        });
    } catch (err) {
        console.error('Error in updateStage:', err);
        next(err);
    }
};

// Delete stage
exports.deleteStage = async (req, res, next) => {
    try {
        const stage = await ProjectStage.findByPk(req.params.id);
        if (!stage) return next(new AppError('Etappe nicht gefunden', 404));

        // RBAC: Only creator or manager can delete
        const userRole = req.user.role?.name || req.user.role;
        if (!hasPermission(req.user, 'MANAGE_API_KEYS')) {
            const isManager = userRole === 'Projektleiter' || userRole === 'Gruppenleiter';
            const isOwner = (stage.created_by_id === req.user.id) || (stage.created_by_subcontractor_id === req.user.id);
            
            if (!isOwner && !isManager) {
                return next(new AppError('Keine Berechtigung zum Löschen dieser Etappe', 403));
            }
        }

        const stageId = String(stage.id);
        const projectId = String(stage.project_id);

        // Cleanup R2 images
        try {
            const images = await ProjectStageImage.findAll({ where: { project_stage_id: stage.id }, paranoid: false });
            for (const img of images) {
                if (img.path && img.path.startsWith('http')) {
                    const url = new URL(img.path);
                    const key = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
                    await deleteFromR2(key);
                }
            }
        } catch (err) {
            console.error('R2 Stage Cleanup Error:', err);
        }

        await stage.destroy();

        // Clean up from FS (legacy)
        const stageDir = path.join(__dirname, '../../../../uploads/projects', projectId, 'stages', stageId);
        if (fs.existsSync(stageDir)) {
            fs.rmSync(stageDir, { recursive: true, force: true });
        }

        res.status(204).json({
            status: 'success',
            data: null
        });
    } catch (err) {
        console.error('Error in deleteStage:', err);
        next(err);
    }
};
