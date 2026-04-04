const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Role, Company } = require('../../domain/models');

const generateToken = (id, roleName) => {
    return jwt.sign({ id, role: roleName }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '90d',
    });
};

exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate Input
        if (!email || !password) {
            return res.status(400).json({ status: 'fail', message: 'Email and password are required' });
        }

        // Check user
        const user = await User.findOne({
            where: { email },
            include: [{ model: Role, as: 'role' }]
        });

        if (!user || user.status !== 'active') {
            return res.status(401).json({ status: 'fail', message: 'Invalid credentials or inactive user' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ status: 'fail', message: 'Invalid credentials' });
        }

        // Generate Token
        const token = generateToken(user.id, user.role ? user.role.name : 'Worker');

        const [firstName, ...lastNameParts] = (user.name || '').split(' ');
        const lastName = lastNameParts.join(' ');

        res.status(200).json({
            status: 'success',
            token,
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    firstName: firstName || user.name,
                    lastName: lastName || '',
                    email: user.email,
                    role: user.role ? user.role.name : 'Worker',
                    company_id: user.company_id
                }
            }
        });

    } catch (err) {
        next(err);
    }
};

exports.getMe = async (req, res, next) => {
    try {
        // req.user is set by auth.protect middleware
        const user = req.user;
        const [firstName, ...lastNameParts] = (user.name || '').split(' ');
        const lastName = lastNameParts.join(' ');

        res.status(200).json({
            status: 'success',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    firstName: firstName || user.name,
                    lastName: lastName || '',
                    email: user.email,
                    role: user.role ? (user.role.name || user.role) : 'Worker',
                    company_id: user.company_id,
                    company: user.company
                }
            }
        });
    } catch (err) {
        next(err);
    }
};
