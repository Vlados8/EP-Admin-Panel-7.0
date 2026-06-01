const bcrypt = require('bcryptjs');
const { Company, Role, User, Category, Subcategory, Question, Answer } = require('../../domain/models');

/**
 * Idempotent seeder to provision initial data on production/newly created databases.
 * Merges legacy roof/building questions with new technical PV/WP parameters.
 */
async function seedDatabase() {
    try {
        console.log('--- Initial Seeding Started ---');

        // 1. Create Default Company
        let company = await Company.findOne({ where: { name: 'EP Construction' }, paranoid: false });
        if (!company) {
            try {
                company = await Company.create({ name: 'EP Construction', billing_plan: 'pro' });
            } catch (err) {
                if (err.name === 'SequelizeUniqueConstraintError') {
                    company = await Company.findOne({ where: { name: 'EP Construction' }, paranoid: false });
                } else {
                    throw err;
                }
            }
        }
        if (company && (company.deletedAt || company.deleted_at)) {
            if (typeof company.restore === 'function') {
                await company.restore();
            }
        }
        console.log('Company check/create: EP Construction');

        // 2. Create Roles
        const roleNames = ['Admin', 'Projektleiter', 'Gruppenleiter', 'Worker'];
        const roles = {};

        for (const name of roleNames) {
            const [role] = await Role.findOrCreate({
                where: { name },
                defaults: { name }
            });
            roles[name] = role;
            console.log(`Role check/create: ${name}`);
        }

        // 3. Create First Admin User
        const adminEmail = 'admin@example.com';
        const existingAdmin = await User.findOne({ where: { email: adminEmail } });

        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('admin123', 12);
            await User.create({
                name: 'System Admin',
                email: adminEmail,
                password_hash: hashedPassword,
                status: 'active',
                company_id: company.id,
                role_id: roles['Admin'].id
            });
            console.log('Admin user created: admin@example.com / admin123');
        }

        // 4. Decision Tree Categories (PV & WP)
        console.log('Seeding Detailed Decision Tree (PV & WP)...');

        // --- Photovoltaik (PV) ---
        const [catPV] = await Category.findOrCreate({
            where: { name: 'Photovoltaik (PV)', company_id: company.id },
            defaults: { description: 'Solaranlagen und Energiesysteme', icon: 'fa-solar-panel', order_index: 0 }
        });

        const [pvMain] = await Subcategory.findOrCreate({
            where: { name: 'Gebäude & Planung', category_id: catPV.id },
            defaults: { description: 'Angaben zum Haus und zur PV-Anlage', order_index: 0 }
        });

        const questionsPV = [
            { text: 'Um welche Art von Gebäude handelt es sich?', type: 'buttons', field_key: 'pv.hausart', order_index: 0 },
            { text: 'Wie groß ist die Dachfläche (ca.)?', type: 'slider', field_key: 'pv.flaeche', unit: 'm²', config: { min: 50, max: 300, step: 10, default: 120 }, order_index: 1 },
            { text: 'Wie viel Leistung wünschen Sie (kWp)?', type: 'slider', field_key: 'pv.leistung', unit: 'kWp', config: { min: 3, max: 20, step: 1, default: 8 }, order_index: 2 },
            { text: 'Welche Dachform hat Ihr Haus?', type: 'buttons', field_key: 'pv.dachform', order_index: 3 },
            { text: 'Welche Dacheindeckung haben Sie?', type: 'buttons', field_key: 'pv.eindeckung', order_index: 4 },
            { text: 'Möchten Sie einen Stromspeicher?', type: 'buttons', field_key: 'pv.speicher', order_index: 5 },
            { text: 'Welche Speichergröße wünschen Sie?', type: 'buttons', field_key: 'pv.speicher_groesse', order_index: 6 },
            { text: 'Benötigen Sie eine Notstromfunktion?', type: 'buttons', field_key: 'pv.notstrom', order_index: 7 },
            { text: 'Haben Sie bereits eine Wallbox (E-Auto Ladestation)?', type: 'buttons', field_key: 'pv.wallbox', order_index: 8 },
            { text: 'Möchten Sie eine Wallbox installieren?', type: 'buttons', field_key: 'pv.wallbox_neu', order_index: 9 },
            { text: 'Wann möchten Sie das Projekt starten?', type: 'buttons', field_key: 'pv.start', order_index: 10 }
        ];

        const qPV = {};
        for (const qData of questionsPV) {
            const [question] = await Question.findOrCreate({
                where: { subcategory_id: pvMain.id, question_text: qData.text },
                defaults: { type: qData.type, field_key: qData.field_key, unit: qData.unit, config: qData.config, order_index: qData.order_index }
            });
            qPV[qData.text] = question;
        }

        // PV Answers & Logic
        const pvAnswers = [
            { q: 'Um welche Art von Gebäude handelt es sich?', text: 'Einfamilienhaus', next: 'Wie groß ist die Dachfläche (ca.)?' },
            { q: 'Um welche Art von Gebäude handelt es sich?', text: 'Reihenhaus', next: 'Wie groß ist die Dachfläche (ca.)?' },
            { q: 'Um welche Art von Gebäude handelt es sich?', text: 'Mehrfamilienhaus', next: 'Wie groß ist die Dachfläche (ca.)?' },
            { q: 'Wie groß ist die Dachfläche (ca.)?', text: 'Weiter', next: 'Wie viel Leistung wünschen Sie (kWp)?' },
            { q: 'Wie viel Leistung wünschen Sie (kWp)?', text: 'Weiter', next: 'Welche Dachform hat Ihr Haus?' },
            { q: 'Welche Dachform hat Ihr Haus?', text: 'Satteldach', next: 'Welche Dacheindeckung haben Sie?' },
            { q: 'Welche Dachform hat Ihr Haus?', text: 'Flachdach', next: 'Welche Dacheindeckung haben Sie?' },
            { q: 'Welche Dachform hat Ihr Haus?', text: 'Pultdach', next: 'Welche Dacheindeckung haben Sie?' },
            { q: 'Welche Dacheindeckung haben Sie?', text: 'Ziegel', next: 'Möchten Sie einen Stromspeicher?' },
            { q: 'Welche Dacheindeckung haben Sie?', text: 'Blech', next: 'Möchten Sie einen Stromspeicher?' },
            { q: 'Welche Dacheindeckung haben Sie?', text: 'Schiefer', next: 'Möchten Sie einen Stromspeicher?' },
            { q: 'Möchten Sie einen Stromspeicher?', text: 'Ja', next: 'Welche Speichergröße wünschen Sie?' },
            { q: 'Möchten Sie einen Stromspeicher?', text: 'Nein', next: 'Benötigen Sie eine Notstromfunktion?' },
            { q: 'Welche Speichergröße wünschen Sie?', text: '5 kWh', next: 'Benötigen Sie eine Notstromfunktion?' },
            { q: 'Welche Speichergröße wünschen Sie?', text: '10 kWh', next: 'Benötigen Sie eine Notstromfunktion?' },
            { q: 'Welche Speichergröße wünschen Sie?', text: '15+ kWh', next: 'Benötigen Sie eine Notstromfunktion?' },
            { q: 'Benötigen Sie eine Notstromfunktion?', text: 'Ja', next: 'Haben Sie bereits eine Wallbox (E-Auto Ladestation)?' },
            { q: 'Benötigen Sie eine Notstromfunktion?', text: 'Nein', next: 'Haben Sie bereits eine Wallbox (E-Auto Ladestation)?' },
            { q: 'Haben Sie bereits eine Wallbox (E-Auto Ladestation)?', text: 'Ja', next: 'Wann möchten Sie das Projekt starten?' },
            { q: 'Haben Sie bereits eine Wallbox (E-Auto Ladestation)?', text: 'Nein', next: 'Möchten Sie eine Wallbox installieren?' },
            { q: 'Möchten Sie eine Wallbox installieren?', text: 'Ja', next: 'Wann möchten Sie das Projekt starten?' },
            { q: 'Möchten Sie eine Wallbox installieren?', text: 'Nein', next: 'Wann möchten Sie das Projekt starten?' },
            { q: 'Wann möchten Sie das Projekt starten?', text: 'Sofort', next: null },
            { q: 'Wann möchten Sie das Projekt starten?', text: 'In 1–3 Monaten', next: null },
            { q: 'Wann möchten Sie das Projekt starten?', text: 'Später', next: null }
        ];

        for (const aData of pvAnswers) {
            const question = qPV[aData.q];
            const nextQuestion = aData.next ? qPV[aData.next] : null;
            await Answer.findOrCreate({
                where: { question_id: question.id, answer_text: aData.text },
                defaults: { next_question_id: nextQuestion ? nextQuestion.id : null }
            });
        }

        // --- Wärmepumpe (WP) ---
        const [catWP] = await Category.findOrCreate({
            where: { name: 'Wärmepumpe (WP)', company_id: company.id },
            defaults: { description: 'Effiziente Heizlösungen', icon: 'fa-fire-burner', order_index: 1 }
        });

        const [wpMain] = await Subcategory.findOrCreate({
            where: { name: 'Gebäude & Basisdaten', category_id: catWP.id },
            defaults: { description: 'Grundlegende Informationen zum Projekt', order_index: 0 }
        });

        const questionsWP = [
            { text: 'Um welche Art von Gebäude handelt es sich?', type: 'buttons', field_key: 'wp.hausart', order_index: 0 },
            { text: 'Sind Sie Eigentümer der Immobilie?', type: 'buttons', field_key: 'wp.eigentuemer', order_index: 1 },
            { text: 'Wie gut ist Ihr Haus gedämmt?', type: 'buttons', field_key: 'wp.daemmung', order_index: 2 },
            { text: 'Wie groß ist die Wohnfläche?', type: 'slider', field_key: 'wp.flaeche', unit: 'm²', config: { min: 50, max: 400, step: 10, default: 150 }, order_index: 3 },
            { text: 'Welche Heizung nutzen Sie aktuell?', type: 'buttons', field_key: 'wp.heizung', order_index: 4 },
            { text: 'Wann möchten Sie die Wärmepumpe installieren?', type: 'buttons', field_key: 'wp.start', order_index: 5 }
        ];

        const qWP = {};
        for (const qData of questionsWP) {
            const [question] = await Question.findOrCreate({
                where: { subcategory_id: wpMain.id, question_text: qData.text },
                defaults: { type: qData.type, field_key: qData.field_key, unit: qData.unit, config: qData.config, order_index: qData.order_index }
            });
            qWP[qData.text] = question;
        }

        // WP Answers & Logic
        const wpAnswers = [
            { q: 'Um welche Art von Gebäude handelt es sich?', text: 'Einfamilienhaus', next: 'Sind Sie Eigentümer der Immobilie?' },
            { q: 'Um welche Art von Gebäude handelt es sich?', text: 'Reihenhaus', next: 'Sind Sie Eigentümer der Immobilie?' },
            { q: 'Um welche Art von Gebäude handelt es sich?', text: 'Mehrfamilienhaus', next: 'Sind Sie Eigentümer der Immobilie?' },
            { q: 'Sind Sie Eigentümer der Immobilie?', text: 'Ja', next: 'Wie gut ist Ihr Haus gedämmt?' },
            { q: 'Sind Sie Eigentümer der Immobilie?', text: 'Nein', next: 'Wie gut ist Ihr Haus gedämmt?' },
            { q: 'Wie gut ist Ihr Haus gedämmt?', text: 'Gut', next: 'Wie groß ist die Wohnfläche?' },
            { q: 'Wie gut ist Ihr Haus gedämmt?', text: 'Mittel', next: 'Wie groß ist die Wohnfläche?' },
            { q: 'Wie gut ist Ihr Haus gedämmt?', text: 'Schlecht', next: 'Wie groß ist die Wohnfläche?' },
            { q: 'Wie groß ist die Wohnfläche?', text: 'Weiter', next: 'Welche Heizung nutzen Sie aktuell?' },
            { q: 'Welche Heizung nutzen Sie aktuell?', text: 'Gas', next: 'Wann möchten Sie die Wärmepumpe installieren?' },
            { q: 'Welche Heizung nutzen Sie aktuell?', text: 'Öl', next: 'Wann möchten Sie die Wärmepumpe installieren?' },
            { q: 'Welche Heizung nutzen Sie aktuell?', text: 'Strom', next: 'Wann möchten Sie die Wärmepumpe installieren?' },
            { q: 'Welche Heizung nutzen Sie aktuell?', text: 'Andere', next: 'Wann möchten Sie die Wärmepumpe installieren?' },
            { q: 'Wann möchten Sie die Wärmepumpe installieren?', text: 'Sofort', next: null },
            { q: 'Wann möchten Sie die Wärmepumpe installieren?', text: 'In 1–3 Monaten', next: null },
            { q: 'Wann möchten Sie die Wärmepumpe installieren?', text: 'Später', next: null }
        ];

        for (const aData of wpAnswers) {
            const question = qWP[aData.q];
            const nextQuestion = aData.next ? qWP[aData.next] : null;
            await Answer.findOrCreate({
                where: { question_id: question.id, answer_text: aData.text },
                defaults: { next_question_id: nextQuestion ? nextQuestion.id : null }
            });
        }

        console.log('--- Initial Seeding Completed Successfully ---');
    } catch (err) {
        console.error('--- Seeding Error: ---');
        console.error(err);
    }
}

module.exports = seedDatabase;
