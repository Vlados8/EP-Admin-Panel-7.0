const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/jwtConfig');
const { User, Role, Company, Subcontractor, Client } = require('../../domain/models');
const AppError = require('../../utils/appError');
const { hasPermission } = require('../../utils/permissions');

/**
 * Middleware для защиты маршрутов с использованием JWT.
 * Проверяет наличие токена, его валидность и существование пользователя.
 */
exports.protect = async (req, res, next) => {
    try {
        let token;

        // 1. Получение токена из заголовков
        if (req.headers.authorization && /^bearer\s+/i.test(req.headers.authorization)) {
            token = req.headers.authorization.split(/\s+/)[1];
        }

        if (!token) {
            return next(new AppError('Вы не авторизованы. Пожалуйста, войдите в систему.', 401));
        }

        // 2. Верификация токена
        const decoded = jwt.verify(token, JWT_SECRET);

        // 3. Проверка, существует ли пользователь или субподрядчик
        let currentUser;
        if (decoded.isSubcontractor) {
            currentUser = await Subcontractor.findByPk(decoded.id, {
                include: [
                    { model: Company, as: 'company' }
                ]
            });
            if (currentUser) {
                currentUser.role = 'Subcontractor';
            }
        } else if (decoded.isPartner) {
            currentUser = await Client.findByPk(decoded.id, {
                include: [
                    { model: Company, as: 'company' }
                ]
            });
            if (currentUser) {
                currentUser.role = 'Subcontractor';
                currentUser.isPartner = true;
            }
        } else {
            currentUser = await User.findByPk(decoded.id, {
                include: [
                    { model: Role, as: 'role' },
                    { model: Company, as: 'company' }
                ]
            });
        }

        if (!currentUser) {
            return next(new AppError('Пользователь, которому принадлежит этот токен, больше не существует.', 401));
        }

        // 4. Сохранение пользователя в объекте запроса
        req.user = currentUser;

        // 5. Update last_seen_at (Throttle to once per minute to avoid excessive DB writes)
        if (!decoded.isSubcontractor && !decoded.isPartner) {
            const now = new Date();
            const lastSeen = currentUser.last_seen_at ? new Date(currentUser.last_seen_at) : new Date(0);
            if (now.getTime() - lastSeen.getTime() > 60000) {
                currentUser.last_seen_at = now;
                currentUser.save().catch(err => console.error('Error updating last_seen_at:', err.message));
            }
        }

        next();
    } catch (err) {
        if (err.name === 'JsonWebTokenError') {
            return next(new AppError('Невалидный токен. Пожалуйста, войдите снова.', 401));
        }
        if (err.name === 'TokenExpiredError') {
            return next(new AppError('Ваш токен истек. Пожалуйста, войдите снова.', 401));
        }
        next(err);
    }
};

/**
 * Middleware для ограничения доступа по ролям.
 * @param  {...string} roles - Список разрешенных ролей (slugs)
 */
exports.restrictTo = (...roles) => {
    const lowerRoles = roles.map(r => r.toLowerCase());
    return (req, res, next) => {
        // Проверка: есть ли у пользователя роль и входит ли её имя в список разрешенных (в нижнем регистре)
        if (!req.user.role || !lowerRoles.includes((req.user.role.name || req.user.role).toLowerCase())) {
            return next(new AppError('У вас нет прав на выполнение этого действия.', 403));
        }
        next();
    };
};

/**
 * Middleware для защиты маршрутов на основе прав доступа (PERMISSIONS).
 * @param {string} permission - Ключ права доступа (например, 'MANAGE_USERS')
 */
exports.checkPermission = (permission) => {
    return (req, res, next) => {
        if (req.apiKey) {
            return next();
        }
        // hasPermission сам понимает логику 'Admin'
        if (!hasPermission(req.user, permission)) {
            return next(new AppError(`У вас нет прав (${permission}) на выполнение этого действия.`, 403));
        }
        next();
    };
};
