const { Project, Category, Subcategory, ProjectUser, ProjectSubcontractor, User, Client, Subcontractor, ProjectStage, ProjectStageImage, ProjectImage, ProjectAnswer, Question, Answer, ProjectFolder, ProjectFile, Task, Note, SupportTicket, Inquiry, InquiryAnswer } = require('../../domain/models');
const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const fs = require('fs');
const path = require('path');
const { hasPermission } = require('../../utils/permissions');
const { uploadToR2, deleteFromR2, deletePrefixFromR2 } = require('../utils/storage');
const { processUploadedFile } = require('../../utils/imageConverter');

exports.getAllProjects = async (req, res) => {
    try {
        const userRole = req.user.role?.name || req.user.role;
        const whereClause = {};

        // Role-based visibility filtering
        if (!hasPermission(req.user, 'MANAGE_USERS')) { // Not Admin/Büro
            if (userRole === 'Worker') {
                whereClause[Op.and] = [
                    sequelize.literal(`EXISTS (SELECT 1 FROM project_users AS pu WHERE pu.project_id = Project.id AND pu.user_id = '${req.user.id}')`)
                ];
            } else if (userRole === 'Projektleiter') {
                whereClause[Op.or] = [
                    sequelize.literal(`EXISTS (SELECT 1 FROM project_users AS pu WHERE pu.project_id = Project.id AND pu.user_id = '${req.user.id}')`),
                    sequelize.literal(`NOT EXISTS (SELECT 1 FROM project_users AS pu WHERE pu.project_id = Project.id AND pu.role = 'projektleiter')`)
                ];
            } else if (userRole === 'Gruppenleiter') {
                whereClause[Op.and] = [
                    sequelize.literal(`EXISTS (SELECT 1 FROM project_users AS pu WHERE pu.project_id = Project.id AND pu.user_id = '${req.user.id}')`)
                ];
            }
        }

        // Status-based filtering
        if (req.query.status) {
            whereClause.status = req.query.status;
        } else if (req.query.excludeStatus) {
            whereClause.status = { [Op.ne]: req.query.excludeStatus };
        }

        const projects = await Project.findAll({
            where: whereClause,
            include: [
                { model: Client, as: 'client' },
                { model: User, as: 'creator', attributes: ['id', 'name', 'specialty'] },
                {
                    model: ProjectUser,
                    as: 'assigned_personnel',
                    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'specialty', 'email', 'phone'] }]
                },
                {
                    model: ProjectSubcontractor,
                    as: 'assigned_subcontractors',
                    include: [{ model: Subcontractor, as: 'subcontractor' }]
                },
                { model: Category, as: 'category' },
                { model: Subcategory, as: 'subcategory' }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json({
            status: 'success',
            results: projects.length,
            data: { projects }
        });
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getProjectById = async (req, res) => {
    try {
        const project = await Project.findByPk(req.params.id, {
            include: [
                { model: Client, as: 'client' },
                { model: User, as: 'creator', attributes: ['id', 'name', 'specialty'] },
                {
                    model: ProjectUser,
                    as: 'assigned_personnel',
                    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'specialty', 'email', 'phone'] }]
                },
                {
                    model: ProjectStage,
                    as: 'stages',
                    include: [
                        { model: ProjectStageImage, as: 'images' },
                        { model: User, as: 'creator', attributes: ['id', 'name'] }
                    ]
                },
                {
                    model: ProjectSubcontractor,
                    as: 'assigned_subcontractors',
                    include: [{ model: Subcontractor, as: 'subcontractor' }]
                },
                { model: ProjectImage, as: 'images' },
                { model: Category, as: 'category' },
                { model: Subcategory, as: 'subcategory' },
                {
                    model: ProjectAnswer,
                    as: 'answers',
                    include: [
                        { model: Question, as: 'question' },
                        { model: Answer, as: 'answer' }
                    ]
                },
                { model: Inquiry, as: 'source_inquiry' }
            ]
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        let categoriesList = [];
        if (project.categories_json) {
            try {
                const parsed = JSON.parse(project.categories_json);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    for (const item of parsed) {
                        const cat = await Category.findByPk(item.category_id, {
                            include: [{ model: Subcategory, as: 'subcategories' }]
                        });
                        const sub = item.subcategory_id ? await Subcategory.findByPk(item.subcategory_id) : null;
                        if (cat) {
                            categoriesList.push({
                                category: cat,
                                subcategory: sub
                            });
                        }
                    }
                }
            } catch (err) {
                console.error('Error parsing categories_json in getProjectById:', err);
            }
        }
        project.setDataValue('categories_list', categoriesList);

        const userRole = req.user.role?.name || req.user.role;
        if (!hasPermission(req.user, 'MANAGE_API_KEYS')) {
            const isAssigned = await ProjectUser.findOne({ where: { project_id: project.id, user_id: req.user.id } });
            
            if (userRole === 'Worker' && !isAssigned) {
                return res.status(403).json({ error: 'Keine Berechtigung für dieses Projekt' });
            }
            
            if (userRole === 'Gruppenleiter' && !isAssigned) {
                return res.status(403).json({ error: 'Keine Berechtigung für dieses Projekt (Nur für Teilnehmer)' });
            }

            if (userRole === 'Projektleiter' && !isAssigned) {
                const hasPL = await ProjectUser.findOne({ where: { project_id: project.id, role: 'projektleiter' } });
                if (hasPL) {
                    return res.status(403).json({ error: 'Dieses Projekt ist bereits einem anderen Projektleiter zugeordnet' });
                }
            }
        }

        res.status(200).json({
            status: 'success',
            data: { project }
        });
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.createProject = async (req, res) => {
    // Only Admin, Office, and Projektleiter can create projects
    if (!hasPermission(req.user, 'MANAGE_PROJECTS')) {
        return res.status(403).json({ error: 'Keine Berechtigung zum Erstellen von Projekten' });
    }
    const t = await sequelize.transaction();
    // Local directory creation removed - everything on R2

    try {
        const {
            title, description, address, status, progress, start_date, end_date, budget,
            client_id, category_id, subcategory_id, inquiry_id,
            client_first_name, client_last_name, client_phone, client_email, client_address, client_notes,
            categories_json
        } = req.body;

        // Fetch all project numbers to find the true max
        const allProjects = await Project.findAll({
            attributes: ['project_number'],
            paranoid: false,
            transaction: t
        });

        let nextNumber = 1;
        if (allProjects.length > 0) {
            let maxNumber = 0;
            allProjects.forEach(p => {
                if (p.project_number && p.project_number.startsWith('EP-')) {
                    const parts = p.project_number.split('-');
                    if (parts.length === 2 && !isNaN(parts[1])) {
                        const num = parseInt(parts[1], 10);
                        if (num > maxNumber) maxNumber = num;
                    }
                }
            });
            nextNumber = maxNumber + 1;
        }

        const project_number = `EP-${nextNumber.toString().padStart(3, '0')}`;

        let creatorId = req.user ? req.user.id : null;
        if (!creatorId) {
            const admin = await User.findOne({ where: { email: 'admin@ep-bau.de' }, transaction: t });
            if (admin) creatorId = admin.id;
        }

        const parseId = (val) => (val && val !== 'null' && val !== 'undefined' && val !== '') ? val : null;
        const parseDate = (val) => (val && val !== 'null' && val !== 'undefined' && val !== '') ? val : null;

        const newProject = await Project.create({
            project_number,
            title,
            description,
            address,
            status: status || 'Aktiv',
            progress: progress || 0,
            start_date: parseDate(start_date),
            end_date: parseDate(end_date),
            budget: budget || 0,
            client_id: parseId(client_id),
            category_id: parseId(category_id),
            subcategory_id: parseId(subcategory_id),
            categories_json: categories_json || null,
            created_by: creatorId,
            client_first_name: client_first_name || null,
            client_last_name: client_last_name || null,
            client_phone: client_phone || null,
            client_email: client_email || null,
            client_address: client_address || null,
            client_notes: client_notes || null
        }, { transaction: t });

        // --- Handle Assignments (Users & Roles) ---
        if (req.body.assigned_users) {
            const parsedUsers = JSON.parse(req.body.assigned_users);
            if (Array.isArray(parsedUsers) && parsedUsers.length > 0) {
                const userRecords = parsedUsers.map(u => ({
                    project_id: newProject.id,
                    user_id: u.user_id,
                    role: u.role
                }));
                await ProjectUser.bulkCreate(userRecords, { transaction: t });
            }
        }

        // --- Handle Subcontractors ---
        if (req.body.assigned_subcontractors) {
            const parsedSubs = JSON.parse(req.body.assigned_subcontractors);
            if (Array.isArray(parsedSubs) && parsedSubs.length > 0) {
                const subRecords = parsedSubs.map(id => ({
                    project_id: newProject.id,
                    subcontractor_id: id
                }));
                await ProjectSubcontractor.bulkCreate(subRecords, { transaction: t });
            }
        }

        // --- Handle Category Answers ---
        if (req.body.answers) {
            const parsedAnswers = JSON.parse(req.body.answers);
            if (Array.isArray(parsedAnswers) && parsedAnswers.length > 0) {
                const answerRecords = parsedAnswers.map(ans => ({
                    project_id: newProject.id,
                    question_id: ans.question_id,
                    answer_id: ans.answer_id || null,
                    custom_value: ans.custom_value || null
                }));
                await ProjectAnswer.bulkCreate(answerRecords, { transaction: t });
            }
        }

        // --- Handle Photo Uploads with R2 ---
        if (req.files && (req.files.photos || req.files.mainImage)) {
            // Handle Main Image
            if (req.files.mainImage && req.files.mainImage.length > 0) {
                await processUploadedFile(req.files.mainImage[0]);
                const file = req.files.mainImage[0];
                try {
                    const r2Key = `projects/${newProject.id}/main_${Date.now()}${path.extname(file.originalname)}`;
                    const fileUrl = await uploadToR2(file.path, r2Key, file.mimetype);

                    await newProject.update({ main_image: fileUrl }, { transaction: t });

                    // Cleanup local temp
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                } catch (err) {
                    console.error('R2 Main Image Upload Error:', err);
                }
            }

            // Handle Additional Photos
            if (req.files.photos && req.files.photos.length > 0) {
                // Ensure a "Galerie" folder exists in the database
                await ProjectFolder.findOrCreate({
                    where: { 
                        project_id: newProject.id, 
                        path: '', 
                        name: 'gallery' // Internal name
                    },
                    defaults: {
                        name: 'gallery',
                        path: '',
                        project_id: newProject.id,
                        created_by_id: creatorId
                    },
                    transaction: t
                });

                const imageRecords = [];
                for (const file of req.files.photos) {
                    await processUploadedFile(file);
                    try {
                        const r2Key = `projects/${newProject.id}/gallery/${Date.now()}_${file.originalname}`;
                        const fileUrl = await uploadToR2(file.path, r2Key, file.mimetype);

                        imageRecords.push({
                            project_id: newProject.id,
                            file_path: fileUrl,
                            file_name: file.originalname,
                            uploaded_by: creatorId
                        });

                        // Cleanup local temp
                        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                    } catch (err) {
                        console.error('R2 Gallery Upload Error:', err);
                    }
                }
                
                if (imageRecords.length > 0) {
                    await ProjectImage.bulkCreate(imageRecords, { transaction: t });
                }
            }
        }

        // --- Handle Inquiry Conversion ---
        if (inquiry_id) {
            const Inquiry = require('../../domain/models/Inquiry');
            const inquiry = await Inquiry.findByPk(inquiry_id, { transaction: t });
            if (inquiry) {
                await inquiry.update({
                    project_id: newProject.id,
                    status: 'won'
                }, { transaction: t });
            }
        }

        await t.commit();

        const createdProject = await Project.findByPk(newProject.id, {
            include: [
                { model: Client, as: 'client' },
                { model: User, as: 'creator', attributes: ['id', 'name'] },
                {
                    model: ProjectUser,
                    as: 'assigned_personnel',
                    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'specialty'] }]
                },
                {
                    model: ProjectSubcontractor,
                    as: 'assigned_subcontractors',
                    include: [{ model: Subcontractor, as: 'subcontractor' }]
                },
                { model: Category, as: 'category' },
                { model: Subcategory, as: 'subcategory' },
                { model: ProjectImage, as: 'images' }
            ]
        });

        res.status(201).json({
            message: 'Project created successfully via Wizard',
            project: createdProject
        });
    } catch (error) {
        await t.rollback();
        console.error('Error creating project via wizard:', error);
        res.status(500).json({ error: 'Server error during project creation', message: error.message, errors: error.errors });
    }
};

exports.updateProject = async (req, res) => {
    // Worker cannot edit projects
    if (req.user.role?.name === 'Worker' || req.user.role === 'Worker') {
        return res.status(403).json({ error: 'Worker dürfen Projekte nicht bearbeiten' });
    }

    const t = await sequelize.transaction();
    try {
        console.log(`[BACKEND] Updating project ${req.params.id} with body:`, JSON.stringify(req.body, null, 2));
        const project = await Project.findByPk(req.params.id);
        if (!project) {
            await t.rollback();
            return res.status(404).json({ error: 'Project not found' });
        }

        // Extract assignments and answers from body to prevent Sequelize from trying to update them as basic attributes
        const { assigned_users, assigned_subcontractors, answers, ...basicInfo } = req.body;

        const parseId = (val) => (val && val !== 'null' && val !== 'undefined' && val !== '') ? val : null;
        const parseDate = (val) => (val && val !== 'null' && val !== 'undefined' && val !== '') ? val : null;

        if (basicInfo.client_id !== undefined) basicInfo.client_id = parseId(basicInfo.client_id);
        if (basicInfo.category_id !== undefined) basicInfo.category_id = parseId(basicInfo.category_id);
        if (basicInfo.subcategory_id !== undefined) basicInfo.subcategory_id = parseId(basicInfo.subcategory_id);
        if (basicInfo.start_date !== undefined) basicInfo.start_date = parseDate(basicInfo.start_date);
        if (basicInfo.end_date !== undefined) basicInfo.end_date = parseDate(basicInfo.end_date);
        if (basicInfo.budget !== undefined) {
            basicInfo.budget = (basicInfo.budget === '' || basicInfo.budget === null || basicInfo.budget === 'null') ? null : parseFloat(basicInfo.budget);
        }

        const oldStatus = project.status;
        // Update basic info
        await project.update(basicInfo, { transaction: t });

        // If status changed to 'aktiv', check if it came from 'angebot' and update Inquiry
        if (basicInfo.status === 'aktiv' && oldStatus === 'angebot') {
             const inquiry = await Inquiry.findOne({ 
                 where: { project_id: project.id },
                 transaction: t
             });
             if (inquiry) {
                 await inquiry.update({ status: 'won' }, { transaction: t });
             }
        }

        // --- Handle Personnel Assignments ---
        if (assigned_users) {
            const parsedUsers = Array.isArray(assigned_users)
                ? assigned_users
                : JSON.parse(assigned_users);

            // Delete old personnel
            await ProjectUser.destroy({ where: { project_id: project.id }, transaction: t });

            // Add new personnel
            if (parsedUsers.length > 0) {
                const userRecords = parsedUsers.map(u => ({
                    project_id: project.id,
                    user_id: u.user_id,
                    role: u.role
                }));
                await ProjectUser.bulkCreate(userRecords, { transaction: t });
            }
        }

        // --- Handle Subcontractors ---
        if (assigned_subcontractors) {
            const parsedSubs = Array.isArray(assigned_subcontractors)
                ? assigned_subcontractors
                : JSON.parse(assigned_subcontractors);

            // Delete old subcontractors
            await ProjectSubcontractor.destroy({ where: { project_id: project.id }, transaction: t });

            // Add new subcontractors
            if (parsedSubs.length > 0) {
                const subRecords = parsedSubs.map(id => ({
                    project_id: project.id,
                    subcontractor_id: id
                }));
                await ProjectSubcontractor.bulkCreate(subRecords, { transaction: t });
            }
        }

        // --- Handle Category Answers ---
        if (answers) {
            const parsedAnswers = Array.isArray(answers) ? answers : JSON.parse(answers);

            // Delete old answers
            await ProjectAnswer.destroy({ where: { project_id: project.id }, transaction: t });

            // Add new answers
            if (parsedAnswers.length > 0) {
                const answerRecords = parsedAnswers.map(ans => ({
                    project_id: project.id,
                    question_id: ans.question_id,
                    answer_id: ans.answer_id || null,
                    custom_value: ans.custom_value || null
                }));
                await ProjectAnswer.bulkCreate(answerRecords, { transaction: t });
            }
        }

        // --- Handle Main Image Upload ---
        if (req.files && req.files.mainImage && req.files.mainImage.length > 0) {
            await processUploadedFile(req.files.mainImage[0]);
            const file = req.files.mainImage[0];
            try {
                // 1. Delete old image if it exists
                if (project.main_image && project.main_image.startsWith('http')) {
                    try {
                        const oldUrl = new URL(project.main_image);
                        const oldKey = oldUrl.pathname.startsWith('/') ? oldUrl.pathname.substring(1) : oldUrl.pathname;
                        await deleteFromR2(oldKey);
                    } catch (urlErr) {
                        console.warn('Could not delete old main image (invalid URL?):', project.main_image);
                    }
                }

                // 2. Upload new image
                const r2Key = `projects/${project.id}/main_${Date.now()}${path.extname(file.originalname)}`;
                const fileUrl = await uploadToR2(file.path, r2Key, file.mimetype);

                // 3. Update project record
                await project.update({ main_image: fileUrl }, { transaction: t });

                // 4. Cleanup local temp
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            } catch (err) {
                console.error('R2 Main Image Update Error:', err);
                // We continue with basic info update even if image fails, or we could throw.
            }
        }

        await t.commit();

        const updatedProject = await Project.findByPk(req.params.id, {
            include: [
                { model: Client, as: 'client' },
                { model: User, as: 'creator', attributes: ['id', 'name'] },
                {
                    model: ProjectUser,
                    as: 'assigned_personnel',
                    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'specialty'] }]
                },
                {
                    model: ProjectSubcontractor,
                    as: 'assigned_subcontractors',
                    include: [{ model: Subcontractor, as: 'subcontractor' }]
                },
                {
                    model: ProjectStage,
                    as: 'stages',
                    include: [{ model: ProjectStageImage, as: 'images' }]
                },
                { model: Category, as: 'category' },
                { model: Subcategory, as: 'subcategory' },
                { model: ProjectImage, as: 'images' }
            ]
        });

        res.json({
            status: 'success',
            data: { project: updatedProject }
        });
    } catch (error) {
        await t.rollback();
        console.error('[BACKEND] Error updating project:', error);
        res.status(400).json({
            error: 'Fehler beim Speichern des Projekts',
            details: error.message
        });
    }
};

exports.deleteProject = async (req, res) => {
    // Only Admin and Office can delete projects (as per user request GL/PL cannot delete)
    if (!hasPermission(req.user, 'MANAGE_USERS')) { // MANAGE_USERS is proxy for Admin/Office
        return res.status(403).json({ error: 'Nur Administratoren können Projekte löschen' });
    }
    try {
        const project = await Project.findByPk(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const fs = require('fs');
        const path = require('path');
        const projectDir = path.join(__dirname, '../../../../uploads/projects', String(project.id));

        const t = await sequelize.transaction();
        try {
            const id = project.id;

            // 1. Static associations (Many-to-Many or Direct Links)
            await ProjectUser.destroy({ where: { project_id: id }, transaction: t });
            await ProjectSubcontractor.destroy({ where: { project_id: id }, transaction: t });
            await ProjectAnswer.destroy({ where: { project_id: id }, transaction: t });
            await ProjectImage.destroy({ where: { project_id: id }, transaction: t });
            await ProjectFile.destroy({ where: { project_id: id }, transaction: t });
            await ProjectFolder.destroy({ where: { project_id: id }, transaction: t });

            // 2. Activities & Support
            await Task.destroy({ where: { project_id: id }, transaction: t });
            await Note.destroy({ where: { project_id: id }, transaction: t });
            await SupportTicket.destroy({ where: { project_id: id }, transaction: t });

            // 3. Inquiries (And their answers)
            const linkedInquiries = await Inquiry.findAll({ where: { project_id: id }, transaction: t });
            for (const inq of linkedInquiries) {
                await InquiryAnswer.destroy({ where: { inquiry_id: inq.id }, transaction: t });
                await inq.destroy({ transaction: t });
            }

            // 4. Stages & Stage Images
            const stages = await ProjectStage.findAll({ where: { project_id: id }, transaction: t });
            for (const stage of stages) {
                await ProjectStageImage.destroy({ where: { project_stage_id: stage.id }, transaction: t });
                await stage.destroy({ transaction: t });
            }

            // 5. Finally delete the project itself
            await project.destroy({ transaction: t });

            await t.commit();
        } catch (dbError) {
            await t.rollback();
            throw dbError;
        }

        // 6. Cleanup R2 files recursively after DB commit succeeds
        try {
            const prefix = `projects/${project.id}/`;
            await deletePrefixFromR2(prefix);
        } catch (err) {
            console.error('R2 Project Recursive Cleanup Error:', err);
        }

        // Legacy local directory deletion removed - everything on R2/DB
        
        res.json({ message: 'Project and associated files deleted successfully' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Server error during deletion' });
    }
};
