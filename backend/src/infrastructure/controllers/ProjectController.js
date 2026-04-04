const { Project, Category, Subcategory, ProjectUser, ProjectSubcontractor, User, Client, Subcontractor, ProjectStage, ProjectStageImage, ProjectImage, ProjectAnswer, Question, Answer } = require('../../domain/models');
const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const fs = require('fs');
const path = require('path');
const { hasPermission } = require('../../utils/permissions');

exports.getAllProjects = async (req, res) => {
    try {
        const userRole = req.user.role?.name || req.user.role;
        const whereClause = {};

        // Role-based visibility filtering
        if (!hasPermission(req.user, 'MANAGE_USERS')) { // Not Admin/Büro
            if (userRole === 'Worker') {
                // Workers only see projects they are assigned to
                whereClause[Op.and] = [
                    sequelize.literal(`EXISTS (SELECT 1 FROM project_users AS pu WHERE pu.project_id = Project.id AND pu.user_id = '${req.user.id}')`)
                ];
            } else if (userRole === 'Projektleiter') {
                // PL see projects they are in OR projects where no Projektleiter is assigned yet
                whereClause[Op.or] = [
                    sequelize.literal(`EXISTS (SELECT 1 FROM project_users AS pu WHERE pu.project_id = Project.id AND pu.user_id = '${req.user.id}')`),
                    sequelize.literal(`NOT EXISTS (SELECT 1 FROM project_users AS pu WHERE pu.project_id = Project.id AND pu.role = 'projektleiter')`)
                ];
            } else if (userRole === 'Gruppenleiter') {
                // GL now only see projects they are assigned to (as per audio feedback)
                whereClause[Op.and] = [
                    sequelize.literal(`EXISTS (SELECT 1 FROM project_users AS pu WHERE pu.project_id = Project.id AND pu.user_id = '${req.user.id}')`)
                ];
            }
        }

        const projects = await Project.findAll({
            where: whereClause,
            include: [
                { model: Client, as: 'client' },
                { model: User, as: 'creator', attributes: ['id', 'name', 'specialty'] },
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
                    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'specialty'] }]
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
                }
            ]
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });

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

    try {
        const { title, description, address, status, progress, start_date, end_date, budget, client_id, category_id, subcategory_id, inquiry_id } = req.body;

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
            created_by: creatorId
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

        // --- Handle Photo Uploads ---
        if (req.files && (req.files.photos || req.files.mainImage)) {
            const projectDir = path.join(__dirname, '../../../../uploads/projects', String(newProject.id));

            if (!fs.existsSync(projectDir)) {
                fs.mkdirSync(projectDir, { recursive: true });
            }

            // Handle Main Image
            if (req.files.mainImage && req.files.mainImage.length > 0) {
                const file = req.files.mainImage[0];
                const timestamp = Date.now();
                const ext = path.extname(file.originalname);
                const mainFileName = `main_${timestamp}${ext}`;
                const newFilePath = path.join(projectDir, mainFileName);
                fs.renameSync(file.path, newFilePath);

                await newProject.update({
                    main_image: `/uploads/projects/${newProject.id}/${mainFileName}`
                }, { transaction: t });
            }

            // Handle Additional Photos
            if (req.files.photos && req.files.photos.length > 0) {
                const imageRecords = [];
                const timestamp = Date.now();

                req.files.photos.forEach((file, index) => {
                    const ext = path.extname(file.originalname);
                    const uniqueFileName = `${timestamp}_${index}${ext}`;
                    const newFilePath = path.join(projectDir, uniqueFileName);
                    fs.renameSync(file.path, newFilePath);

                    imageRecords.push({
                        project_id: newProject.id,
                        file_path: `/uploads/projects/${newProject.id}/${uniqueFileName}`,
                        file_name: uniqueFileName,
                        uploaded_by: creatorId
                    });
                });
                await ProjectImage.bulkCreate(imageRecords, { transaction: t });
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

        // Update basic info
        await project.update(basicInfo, { transaction: t });

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
            // Delete dynamic associations to prevent foreign key constraint fails
            await ProjectUser.destroy({ where: { project_id: project.id }, transaction: t });
            await ProjectSubcontractor.destroy({ where: { project_id: project.id }, transaction: t });
            await ProjectAnswer.destroy({ where: { project_id: project.id }, transaction: t });
            await ProjectImage.destroy({ where: { project_id: project.id }, transaction: t });

            const stages = await ProjectStage.findAll({ where: { project_id: project.id }, transaction: t });
            for (const stage of stages) {
                await ProjectStageImage.destroy({ where: { project_stage_id: stage.id }, transaction: t });
                await stage.destroy({ transaction: t });
            }

            await project.destroy({ transaction: t });
            await t.commit();
        } catch (dbError) {
            await t.rollback();
            throw dbError; // Caught by outer try-catch
        }

        // Delete associated directory after DB commit succeeds
        if (fs.existsSync(projectDir)) {
            fs.rmSync(projectDir, { recursive: true, force: true });
        }

        res.json({ message: 'Project and associated files deleted successfully' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Server error during deletion' });
    }
};
