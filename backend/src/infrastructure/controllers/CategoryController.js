const { Category, Subcategory, Question, Answer, Company } = require('../../domain/models');
const { Op } = require('sequelize');
const AppError = require('../../utils/appError');

exports.getAllCategories = async (req, res, next) => {
    try {
        const whereClause = {};

        // Если запрос идет через API-ключ, фильтруем по разрешенным категориям (если они указаны)
        let allowedIds = req.apiKey && req.apiKey.allowed_category_ids;
        if (allowedIds) {
            if (typeof allowedIds === 'string') {
                try { allowedIds = JSON.parse(allowedIds); } catch (e) { allowedIds = null; }
            }
            if (Array.isArray(allowedIds) && allowedIds.length > 0) {
                whereClause.id = { [Op.in]: allowedIds };
            }
        }

        // Фильтрация по target (site, admin, both)
        if (req.query.target) {
            whereClause.target = req.query.target;
        } else if (req.apiKey) {
            // Запросы через внешний API-ключ видят только 'site' и 'both'
            whereClause.target = { [Op.in]: ['site', 'both'] };
        }

        const categories = await Category.findAll({
            where: whereClause,
            order: [
                ['order_index', 'ASC'],
                ['name', 'ASC'],
                [{ model: Subcategory, as: 'subcategories' }, 'order_index', 'ASC'],
                [{ model: Subcategory, as: 'subcategories' }, { model: Question, as: 'questions' }, 'order_index', 'ASC'],
                [{ model: Subcategory, as: 'subcategories' }, { model: Question, as: 'questions' }, { model: Answer, as: 'answers' }, 'order_index', 'ASC']
            ],
            include: [
                {
                    model: Subcategory,
                    as: 'subcategories',
                    include: [
                        {
                            model: Question,
                            as: 'questions',
                            include: [
                                {
                                    model: Answer,
                                    as: 'answers'
                                }
                            ]
                        }
                    ]
                }
            ]
        });

        res.status(200).json({
            status: 'success',
            results: categories.length,
            data: { categories }
        });
    } catch (err) {
        next(err);
    }
};

// --- CATEGORY ---
exports.createCategory = async (req, res, next) => {
    try {
        let cid = (req.user && req.user.company_id) || req.body.company_id;
        if (!cid) {
            const company = await Company.findOne();
            if (company) cid = company.id;
        }

        const category = await Category.create({ ...req.body, company_id: cid });
        res.status(201).json({ status: 'success', data: { category } });
    } catch (err) { next(err); }
};

exports.updateCategory = async (req, res, next) => {
    try {
        const category = await Category.findByPk(req.params.id);
        if (!category) return next(new AppError('Not found', 404));
        await category.update(req.body);
        res.status(200).json({ status: 'success', data: { category } });
    } catch (err) { next(err); }
};

exports.deleteCategory = async (req, res, next) => {
    try {
        const category = await Category.findByPk(req.params.id, {
            include: [{ 
                model: Subcategory, 
                as: 'subcategories',
                include: [{
                    model: Question,
                    as: 'questions'
                }]
            }]
        });
        if (!category) return next(new AppError('Not found', 404));

        // Cascade delete subcategories, questions and answers
        const subcategories = category.subcategories || [];
        for (const subcat of subcategories) {
            const questions = subcat.questions || [];
            const questionIds = questions.map(q => q.id);
            if (questionIds.length > 0) {
                await Answer.destroy({ where: { question_id: questionIds } });
                await Question.destroy({ where: { id: questionIds } });
            }
        }
        
        const subcategoryIds = subcategories.map(s => s.id);
        if (subcategoryIds.length > 0) {
            await Subcategory.destroy({ where: { id: subcategoryIds } });
        }

        await category.destroy();
        res.status(204).json({ status: 'success', data: null });
    } catch (err) { next(err); }
};

// --- SUBCATEGORY ---
exports.createSubcategory = async (req, res, next) => {
    try {
        const sub = await Subcategory.create(req.body);
        res.status(201).json({ status: 'success', data: { subcategory: sub } });
    } catch (err) { next(err); }
};

exports.updateSubcategory = async (req, res, next) => {
    try {
        const sub = await Subcategory.findByPk(req.params.id);
        if (!sub) return next(new AppError('Not found', 404));
        await sub.update(req.body);
        res.status(200).json({ status: 'success', data: { subcategory: sub } });
    } catch (err) { next(err); }
};

exports.deleteSubcategory = async (req, res, next) => {
    try {
        const sub = await Subcategory.findByPk(req.params.id, {
            include: [{ model: Question, as: 'questions' }]
        });
        if (!sub) return next(new AppError('Not found', 404));

        // Cascade delete questions and answers
        const questions = sub.questions || [];
        const questionIds = questions.map(q => q.id);
        if (questionIds.length > 0) {
            await Answer.destroy({ where: { question_id: questionIds } });
            await Question.destroy({ where: { id: questionIds } });
        }

        await sub.destroy();
        res.status(204).json({ status: 'success', data: null });
    } catch (err) { next(err); }
};

// --- QUESTION ---
exports.createQuestion = async (req, res, next) => {
    try {
        const q = await Question.create(req.body);
        res.status(201).json({ status: 'success', data: { question: q } });
    } catch (err) { next(err); }
};

exports.updateQuestion = async (req, res, next) => {
    try {
        const q = await Question.findByPk(req.params.id);
        if (!q) return next(new AppError('Not found', 404));
        await q.update(req.body);
        res.status(200).json({ status: 'success', data: { question: q } });
    } catch (err) { next(err); }
};

exports.deleteQuestion = async (req, res, next) => {
    try {
        const q = await Question.findByPk(req.params.id);
        if (!q) return next(new AppError('Not found', 404));

        // Cascade delete answers
        await Answer.destroy({ where: { question_id: q.id } });

        await q.destroy();
        res.status(204).json({ status: 'success', data: null });
    } catch (err) { next(err); }
};

// --- ANSWER ---
exports.createAnswer = async (req, res, next) => {
    try {
        // If next_question_id is empty string, set to null to avoid FK errors
        const body = { ...req.body };
        if (body.next_question_id === '') body.next_question_id = null;

        const ans = await Answer.create(body);
        res.status(201).json({ status: 'success', data: { answer: ans } });
    } catch (err) { next(err); }
};

exports.updateAnswer = async (req, res, next) => {
    try {
        const ans = await Answer.findByPk(req.params.id);
        if (!ans) return next(new AppError('Not found', 404));

        const body = { ...req.body };
        if (body.next_question_id === '') body.next_question_id = null;

        await ans.update(body);
        res.status(200).json({ status: 'success', data: { answer: ans } });
    } catch (err) { next(err); }
};

exports.deleteAnswer = async (req, res, next) => {
    try {
        const ans = await Answer.findByPk(req.params.id);
        if (!ans) return next(new AppError('Not found', 404));
        await ans.destroy();
        res.status(204).json({ status: 'success', data: null });
    } catch (err) { next(err); }
};
