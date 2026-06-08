const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/jwtConfig');
const { User, Role, Company, Subcontractor, Client } = require('../../domain/models');

const generateToken = (id, roleName) => {
    return jwt.sign({ id, role: roleName }, JWT_SECRET, {
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

const generateSubcontractorToken = (id, roleName) => {
    return jwt.sign({ id, role: roleName, isSubcontractor: true }, JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '90d',
    });
};

exports.subcontractorLogin = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate Input
        if (!email || !password) {
            return res.status(400).json({ status: 'fail', message: 'Email and password are required' });
        }

        // Check subcontractor
        const subcontractor = await Subcontractor.findOne({
            where: { email }
        });

        if (!subcontractor || subcontractor.status !== 'active') {
            return res.status(401).json({ status: 'fail', message: 'Invalid credentials or inactive user' });
        }

        if (!subcontractor.password_hash) {
            return res.status(401).json({ status: 'fail', message: 'Credentials not set for this account. Please contact your administrator.' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, subcontractor.password_hash);
        if (!isMatch) {
            return res.status(401).json({ status: 'fail', message: 'Invalid credentials' });
        }

        // Generate Token
        const token = generateSubcontractorToken(subcontractor.id, 'Subcontractor');

        const [firstName, ...lastNameParts] = (subcontractor.contact_person || subcontractor.name || '').split(' ');
        const lastName = lastNameParts.join(' ');

        res.status(200).json({
            status: 'success',
            token,
            data: {
                user: {
                    id: subcontractor.id,
                    name: subcontractor.name,
                    contact_person: subcontractor.contact_person,
                    firstName: firstName || subcontractor.name,
                    lastName: lastName || '',
                    email: subcontractor.email,
                    role: 'Subcontractor',
                    company_id: subcontractor.company_id
                }
            }
        });

    } catch (err) {
        next(err);
    }
};

exports.partnerLogin = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate Input
        if (!email || !password) {
            return res.status(400).json({ status: 'fail', message: 'Email and password are required' });
        }

        // Check client (partner)
        const partner = await Client.findOne({
            where: { email, client_partner: 'partner' }
        });

        if (!partner || partner.status !== 'active') {
            return res.status(401).json({ status: 'fail', message: 'Invalid credentials or inactive user' });
        }

        if (!partner.password_hash) {
            return res.status(401).json({ status: 'fail', message: 'Credentials not set for this account. Please contact your administrator.' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, partner.password_hash);
        if (!isMatch) {
            return res.status(401).json({ status: 'fail', message: 'Invalid credentials' });
        }

        // Generate Token
        const token = jwt.sign({ id: partner.id, role: 'Subcontractor', isPartner: true }, JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '90d',
        });

        const [firstName, ...lastNameParts] = (partner.contact_person || partner.name || '').split(' ');
        const lastName = lastNameParts.join(' ');

        res.status(200).json({
            status: 'success',
            token,
            data: {
                user: {
                    id: partner.id,
                    name: partner.name,
                    contact_person: partner.contact_person,
                    firstName: firstName || partner.name,
                    lastName: lastName || '',
                    email: partner.email,
                    role: 'Subcontractor',
                    isPartner: true,
                    company_id: partner.company_id
                }
            }
        });

    } catch (err) {
        next(err);
    }
};

