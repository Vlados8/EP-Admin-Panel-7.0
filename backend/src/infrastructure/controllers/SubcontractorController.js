const { Subcontractor, Company } = require('../../domain/models');
const AppError = require('../../utils/appError');
const bcrypt = require('bcryptjs');

exports.getAllSubcontractors = async (req, res, next) => {
    try {
        const subcontractors = await Subcontractor.findAll();

        res.status(200).json({
            status: 'success',
            results: subcontractors.length,
            data: { subcontractors }
        });
    } catch (err) {
        next(err);
    }
};

exports.createSubcontractor = async (req, res, next) => {
    try {
        const {
            name, trade, contact_person, email, phone,
            address, zip_code, city, hourly_rate, status, notes, company_id, password
        } = req.body;

        // Ensure company_id is provided, normally extracted from logged in user req.user.company_id
        let cid = company_id;
        if (!cid) {
            const company = await Company.findOne();
            if (company) cid = company.id;
        }

        let password_hash = null;
        if (password) {
            password_hash = await bcrypt.hash(password, 12);
        }

        const subcontractor = await Subcontractor.create({
            name,
            trade,
            contact_person: contact_person === '' ? null : contact_person,
            email: email === '' ? null : email,
            phone: phone === '' ? null : phone,
            address: address === '' ? null : address,
            zip_code: zip_code === '' ? null : zip_code,
            city: city === '' ? null : city,
            hourly_rate: hourly_rate === '' ? null : hourly_rate || null,
            status: status || 'active',
            notes: notes === '' ? null : notes,
            password_hash,
            company_id: cid
        });

        res.status(201).json({
            status: 'success',
            data: { subcontractor }
        });
    } catch (err) {
        next(err);
    }
};

exports.updateSubcontractor = async (req, res, next) => {
    try {
        const subcontractor = await Subcontractor.findByPk(req.params.id);

        if (!subcontractor) {
            return next(new AppError('Subcontractor not found', 404));
        }

        const {
            name, trade, contact_person, email, phone,
            address, zip_code, city, hourly_rate, status, notes, password
        } = req.body;

        if (name !== undefined) subcontractor.name = name;
        if (trade !== undefined) subcontractor.trade = trade;
        if (contact_person !== undefined) subcontractor.contact_person = contact_person === '' ? null : contact_person;
        if (email !== undefined) subcontractor.email = email === '' ? null : email;
        if (phone !== undefined) subcontractor.phone = phone === '' ? null : phone;
        if (address !== undefined) subcontractor.address = address === '' ? null : address;
        if (zip_code !== undefined) subcontractor.zip_code = zip_code === '' ? null : zip_code;
        if (city !== undefined) subcontractor.city = city === '' ? null : city;
        if (hourly_rate !== undefined) subcontractor.hourly_rate = hourly_rate === '' ? null : hourly_rate;
        if (status !== undefined) subcontractor.status = status;
        if (notes !== undefined) subcontractor.notes = notes === '' ? null : notes;
        if (password !== undefined && password !== '') {
            subcontractor.password_hash = await bcrypt.hash(password, 12);
        }

        await subcontractor.save();

        res.status(200).json({
            status: 'success',
            data: { subcontractor }
        });
    } catch (err) {
        next(err);
    }
};

exports.deleteSubcontractor = async (req, res, next) => {
    try {
        const subcontractor = await Subcontractor.findByPk(req.params.id);

        if (!subcontractor) {
            return next(new AppError('Subcontractor not found', 404));
        }

        await subcontractor.destroy();

        res.status(204).json({
            status: 'success',
            data: null
        });
    } catch (err) {
        next(err);
    }
};
