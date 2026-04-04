const { Project, Task, Inquiry, User } = require('../../domain/models');
const { Op } = require('sequelize');

exports.getSummary = async (req, res) => {
    try {
        const [projectsCount, tasksCount, inquiriesCount, usersCount] = await Promise.all([
            Project.count({ where: { status: 'Aktiv' } }),
            Task.count({ where: { status: { [Op.ne]: 'Erledigt' } } }),
            Inquiry.count({ where: { status: 'Neu' } }),
            User.count()
        ]);

        res.status(200).json({
            status: 'success',
            counts: {
                projects: projectsCount,
                tasks: tasksCount,
                inquiries: inquiriesCount,
                customers: usersCount // Mapping to what mobile expects
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Fehler beim Laden der Zusammenfassung',
            error: error.message
        });
    }
};

exports.getRecentActivity = async (req, res) => {
    try {
        const [recentProjects, recentInquiries] = await Promise.all([
            Project.findAll({
                limit: 5,
                order: [['createdAt', 'DESC']],
                attributes: ['id', 'title', 'status', 'createdAt']
            }),
            Inquiry.findAll({
                limit: 5,
                order: [['createdAt', 'DESC']],
                attributes: ['id', 'company_name', 'status', 'createdAt'] // assuming company_name is the title
            })
        ]);

        const activities = [
            ...recentProjects.map(p => ({
                id: p.id,
                title: p.title,
                type: 'PROJEKT',
                status: p.status,
                createdAt: p.createdAt,
                icon: 'briefcase',
                color: '#F59E0B'
            })),
            ...recentInquiries.map(i => ({
                id: i.id,
                title: i.company_name || 'Neue Anfrage',
                type: 'ANFRAGE',
                status: i.status,
                createdAt: i.createdAt,
                icon: 'inbox',
                color: '#10B981'
            }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

        res.status(200).json({
            status: 'success',
            activities
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Fehler beim Laden der Aktivitäten',
            error: error.message
        });
    }
};
