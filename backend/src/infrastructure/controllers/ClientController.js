const { Client, Company } = require('../../domain/models');
const AppError = require('../../utils/appError');
const bcrypt = require('bcryptjs');

exports.getAllClients = async (req, res, next) => {
    try {
        const clients = await Client.findAll();

        res.status(200).json({
            status: 'success',
            results: clients.length,
            data: { clients }
        });
    } catch (err) {
        next(err);
    }
};

exports.checkClientByEmail = async (req, res, next) => {
    try {
        const { email } = req.query;
        if (!email) {
            return next(new AppError('No email provided', 400));
        }

        const client = await Client.findOne({ where: { email } });

        res.status(200).json({
            status: 'success',
            data: {
                exists: !!client,
                client: client || null
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.createClient = async (req, res, next) => {
    try {
        const {
            name, contact_person, email, phone,
            address, zip_code, city, type, status, notes, company_id, source,
            client_partner, password
        } = req.body;

        // Ensure company_id is provided, normally extracted from logged in user req.user.company_id
        let cid = company_id;
        if (!cid) {
            const company = await Company.findOne();
            if (company) cid = company.id;
        }

        const client = await Client.create({
            name,
            contact_person: contact_person === '' ? null : contact_person,
            email: email === '' ? null : email,
            phone: phone === '' ? null : phone,
            address: address === '' ? null : address,
            zip_code: zip_code === '' ? null : zip_code,
            city: city === '' ? null : city,
            type: type || 'company',
            status: status || 'active',
            source: source || 'funnelforms',
            notes: notes === '' ? null : notes,
            company_id: cid,
            client_partner: client_partner || 'client',
            password_hash: (client_partner === 'partner' && password) ? await bcrypt.hash(password, 10) : null
        });

        res.status(201).json({
            status: 'success',
            data: { client }
        });
    } catch (err) {
        next(err);
    }
};

exports.updateClient = async (req, res, next) => {
    try {
        const client = await Client.findByPk(req.params.id);

        if (!client) {
            return next(new AppError('Client not found', 404));
        }

        const {
            name, contact_person, email, phone,
            address, zip_code, city, type, status, notes,
            client_partner, password
        } = req.body;

        if (name !== undefined) client.name = name;
        if (contact_person !== undefined) client.contact_person = contact_person === '' ? null : contact_person;
        if (email !== undefined) client.email = email === '' ? null : email;
        if (phone !== undefined) client.phone = phone === '' ? null : phone;
        if (address !== undefined) client.address = address === '' ? null : address;
        if (zip_code !== undefined) client.zip_code = zip_code === '' ? null : zip_code;
        if (city !== undefined) client.city = city === '' ? null : city;
        if (type !== undefined) client.type = type;
        if (status !== undefined) client.status = status;
        if (notes !== undefined) client.notes = notes === '' ? null : notes;
        if (client_partner !== undefined) client.client_partner = client_partner;
        if (password !== undefined && password !== '') {
            client.password_hash = await bcrypt.hash(password, 10);
        }

        await client.save();

        res.status(200).json({
            status: 'success',
            data: { client }
        });
    } catch (err) {
        next(err);
    }
};

exports.deleteClient = async (req, res, next) => {
    try {
        const client = await Client.findByPk(req.params.id);

        if (!client) {
            return next(new AppError('Client not found', 404));
        }

        await client.destroy();

        res.status(204).json({
            status: 'success',
            data: null
        });
    } catch (err) {
        next(err);
    }
};
