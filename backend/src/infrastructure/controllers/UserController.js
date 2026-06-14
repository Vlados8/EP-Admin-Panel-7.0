const { User, Role, Company } = require('../../domain/models');
const bcrypt = require('bcryptjs');

exports.getAllUsers = async (req, res, next) => {
    try {
        const company_id = req.user.company_id;
        const users = await User.findAll({
            where: { company_id },
            attributes: { exclude: ['password_hash'] },
            include: [
                { model: Role, as: 'role', attributes: ['id', 'name'] },
                { model: Company, as: 'company', attributes: ['id', 'name'] },
                { model: User, as: 'manager', attributes: ['id', 'name'] }
            ]
        });

        res.status(200).json({
            status: 'success',
            data: { users }
        });
    } catch (err) {
        next(err);
    }
};

exports.createUser = async (req, res, next) => {
    try {
        const { name, phone, password, role_id, manager_id, specialty, mobile_phone, extension_id, sip_user, sip_password, sip_domain, wss_url } = req.body;
        const email = req.body.email ? req.body.email.trim().toLowerCase() : null;
        const company_id = req.user.company_id;

        if (!name || !email || !password) {
            return res.status(400).json({ status: 'fail', message: 'Missing required fields' });
        }

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ status: 'fail', message: 'Email is already in use' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            name,
            email,
            phone: phone || mobile_phone || null,
            password_hash: hashedPassword,
            role_id: role_id || null,
            manager_id: manager_id || null,
            specialty: specialty || null,
            company_id,
            mobile_phone: mobile_phone || phone || null,
            extension_id: extension_id || null,
            sip_user: sip_user || null,
            sip_password: sip_password || null,
            sip_domain: sip_domain || null,
            wss_url: wss_url || null,
            is_receiving_calls: req.body.is_receiving_calls || false,
            pin: req.body.pin || null,
            rfid_tag: req.body.rfid_tag || null
        });

        res.status(201).json({
            status: 'success',
            data: {
                user: {
                    id: newUser.id,
                    name: newUser.name,
                    email: newUser.email,
                    phone: newUser.phone,
                    role_id: newUser.role_id,
                    manager_id: newUser.manager_id,
                    specialty: newUser.specialty,
                    company_id: newUser.company_id,
                    pin: newUser.pin,
                    rfid_tag: newUser.rfid_tag
                }
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, phone, role_id, status, manager_id, specialty, storage_limit_gb, mobile_phone, extension_id, is_receiving_calls, sip_user, sip_password, sip_domain, wss_url, pin, rfid_tag } = req.body;
        const email = req.body.email ? req.body.email.trim().toLowerCase() : null;

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'User not found' });
        }

        user.name = name || user.name;
        
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ where: { email } });
            if (existingUser && existingUser.id !== id) {
                return res.status(400).json({ status: 'fail', message: 'Email is already in use' });
            }
            user.email = email;
        }

        if (phone !== undefined || mobile_phone !== undefined) {
            const finalPhone = phone !== undefined ? phone : mobile_phone;
            user.phone = finalPhone;
            user.mobile_phone = finalPhone;
        }
        
        // Handle UUIDs - convert empty string to null
        user.role_id = role_id && role_id !== '' ? role_id : (role_id === '' ? null : user.role_id);
        user.manager_id = manager_id && manager_id !== '' ? manager_id : (manager_id === '' ? null : user.manager_id);
        
        user.specialty = specialty !== undefined ? specialty : user.specialty;
        user.status = status || user.status;
        user.storage_limit_gb = storage_limit_gb !== undefined ? storage_limit_gb : user.storage_limit_gb;
        user.extension_id = extension_id !== undefined ? extension_id : user.extension_id;
        user.is_receiving_calls = is_receiving_calls !== undefined ? is_receiving_calls : user.is_receiving_calls;
        user.sip_user = sip_user !== undefined ? sip_user : user.sip_user;
        user.sip_password = sip_password !== undefined ? sip_password : user.sip_password;
        user.sip_domain = sip_domain !== undefined ? sip_domain : user.sip_domain;
        user.wss_url = wss_url !== undefined ? wss_url : user.wss_url;
        user.pin = pin !== undefined ? pin : user.pin;
        user.rfid_tag = rfid_tag !== undefined ? rfid_tag : user.rfid_tag;

        // Password update
        if (req.body.password) {
            user.password_hash = await bcrypt.hash(req.body.password, 10);
        }

        await user.save();

        res.status(200).json({
            status: 'success',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role_id: user.role_id,
                    manager_id: user.manager_id,
                    specialty: user.specialty,
                    status: user.status,
                    storage_limit_gb: user.storage_limit_gb,
                    storage_used_bytes: user.storage_used_bytes,
                    is_receiving_calls: user.is_receiving_calls,
                    mobile_phone: user.mobile_phone,
                    extension_id: user.extension_id,
                    sip_user: user.sip_user,
                    sip_domain: user.sip_domain,
                    wss_url: user.wss_url,
                    pin: user.pin,
                    rfid_tag: user.rfid_tag
                }
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await User.findByPk(id);

        if (!user) {
            return res.status(404).json({ status: 'fail', message: 'User not found' });
        }

        await user.destroy(); // soft delete

        res.status(204).json({
            status: 'success',
            data: null
        });
    } catch (err) {
        next(err);
    }
};
