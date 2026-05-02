const { TimeLog, User, Project, Company } = require('../../domain/models');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const path = require('path');
const logger = require('../../utils/logger');

const monthNamesDe = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const daysOfWeekDe = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

class TimeTrackingController {
    // Check-in (KOMMEN)
    static async checkIn(req, res) {
        try {
            const { pin, rfid_tag, project_id } = req.body;

            // Find worker by PIN or RFID
            const worker = await User.findOne({ 
                where: { 
                    [Op.or]: [
                        pin ? { pin } : null,
                        rfid_tag ? { rfid_tag } : null
                    ].filter(Boolean)
                } 
            });

            if (!worker) {
                return res.status(404).json({ success: false, message: 'Сотрудник не найден' });
            }

            // Check if there is an open session
            const openSession = await TimeLog.findOne({
                where: {
                    worker_id: worker.id,
                    status: 'open'
                }
            });

            if (openSession) {
                return res.status(400).json({ success: false, message: 'У вас уже есть открытая смена' });
            }

            let projectName = 'Allgemein';
            if (project_id) {
                const project = await Project.findByPk(project_id);
                if (project) {
                    projectName = project.title;
                }
            }

            const now = new Date();
            const log = await TimeLog.create({
                worker_id: worker.id,
                project_id: project_id || null,
                project_name: projectName,
                check_in_time: now,
                date: now.toISOString().split('T')[0],
                status: 'open'
            });

            return res.status(201).json({ 
                success: true, 
                message: `Приход зафиксирован: ${now.toLocaleTimeString('de-DE')}`,
                data: {
                    worker_name: worker.name,
                    time: now,
                    project: projectName
                }
            });
        } catch (err) {
            console.error('Check-in error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    // Check-out (GEHEN)
    static async checkOut(req, res) {
        try {
            const { pin, rfid_tag } = req.body;

            const worker = await User.findOne({ 
                where: { 
                    [Op.or]: [
                        pin ? { pin } : null,
                        rfid_tag ? { rfid_tag } : null
                    ].filter(Boolean)
                } 
            });

            if (!worker) {
                return res.status(404).json({ success: false, message: 'Сотрудник не найден' });
            }

            const openSession = await TimeLog.findOne({
                where: {
                    worker_id: worker.id,
                    status: 'open'
                }
            });

            if (!openSession) {
                return res.status(400).json({ success: false, message: 'У вас нет открытых смен' });
            }

            const checkOutTime = new Date();
            const checkInTime = new Date(openSession.check_in_time);
            
            // Fetch company settings for break rules
            const company = await Company.findByPk(worker.company_id);
            const ttSettings = company?.settings?.time_tracking || {};
            
            const break_6 = ttSettings.break_duration_6 ?? 0;
            const break_6_10 = ttSettings.break_duration_6_10 ?? 0.5;
            const break_10 = ttSettings.break_duration_10 ?? 0.75;

            // Calculate duration in hours
            let durationSeconds = (checkOutTime - checkInTime) / 1000;
            let durationHours = durationSeconds / 3600;
            
            // Apply tiered break deduction
            let breakDeducted = 0;
            if (durationHours > 10) {
                breakDeducted = break_10;
            } else if (durationHours > 6) {
                breakDeducted = break_6_10;
            } else {
                breakDeducted = break_6;
            }
            
            durationHours -= breakDeducted;

            await openSession.update({
                check_out_time: checkOutTime,
                total_hours: Math.max(0, durationHours),
                break_deducted: breakDeducted,
                status: 'closed'
            });

            return res.status(200).json({ 
                success: true, 
                message: `Уход зафиксирован: ${checkOutTime.toLocaleTimeString('de-DE')}`,
                data: {
                    worker_name: worker.name,
                    duration: durationHours.toFixed(2),
                    break_deducted: breakDeducted
                }
            });
        } catch (err) {
            console.error('Check-out error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    // Get Logs (Admin)
    static async getLogs(req, res) {
        try {
            const { worker_id, start_date, end_date } = req.query;
            const where = {};
            
            if (worker_id) where.worker_id = worker_id;
            if (start_date && end_date) {
                where.date = { [Op.between]: [start_date, end_date] };
            }

            const logs = await TimeLog.findAll({
                where,
                include: [
                    { model: User, as: 'worker', attributes: ['id', 'name'] },
                    { model: Project, as: 'project', attributes: ['id', 'title'] }
                ],
                order: [['check_in_time', 'DESC']]
            });

            return res.status(200).json({ success: true, data: logs });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    // Manual Create (Admin)
    static async createLog(req, res) {
        try {
            const log = await TimeLog.create(req.body);
            return res.status(201).json({ success: true, data: log });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    // Manual Update
    static async updateLog(req, res) {
        try {
            const { id } = req.params;
            const log = await TimeLog.findByPk(id);
            if (!log) return res.status(404).json({ success: false, message: 'Запись не найдена' });

            await log.update(req.body);
            return res.status(200).json({ success: true, data: log });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    // Manual Delete
    static async deleteLog(req, res) {
        try {
            const { id } = req.params;
            const log = await TimeLog.findByPk(id);
            if (!log) return res.status(404).json({ success: false, message: 'Запись не найдена' });

            await log.destroy();
            return res.status(200).json({ success: true, message: 'Запись удалена' });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    // Generate German Excel Report
    static async generateReport(req, res) {
        logger.info(`[Report] Starting generation for worker: ${req.query.worker_id}`);
        try {
            const { worker_id, month, year } = req.query;
            if (!worker_id || !month || !year) {
                return res.status(400).json({ success: false, message: 'Недостаточно данных' });
            }

            const worker = await User.findByPk(worker_id);
            if (!worker) {
                logger.warn(`[Report] Worker not found: ${worker_id}`);
                return res.status(404).json({ success: false, message: 'Сотрудник не найден' });
            }
            
            const company = await Company.findByPk(worker.company_id);
            logger.info(`[Report] Worker: ${worker.name}, Company ID: ${worker.company_id}`);

            const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];

            const logs = await TimeLog.findAll({
                where: {
                    worker_id,
                    date: { [Op.between]: [startDate, endDate] }
                },
                order: [['date', 'ASC']]
            });
            logger.info(`[Report] Logs fetched: ${logs.length}`);

            // Robust template path finding from controller directory
            const templatePath = path.join(__dirname, '..', '..', '..', '..', 'Stundenzettel_Kalender.xlsx');
            logger.info(`[Report] Using template at: ${templatePath}`);

            const workbook = new ExcelJS.Workbook();
            try {
                await workbook.xlsx.readFile(templatePath);
            } catch (readErr) {
                logger.error(`[Report] Template read error: ${readErr.message}`);
                throw new Error(`Template file not found at ${templatePath}`);
            }
            
            const worksheet = workbook.getWorksheet(1);
            if (!worksheet) throw new Error('Worksheet not found in template');
            logger.info('[Report] Template loaded successfully');

            // 1. Fill Headers
            const monthNamesDe = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
            
            if (company && company.name) {
                worksheet.getCell('B1').value = company.name;
            } else {
                worksheet.getCell('B1').value = 'Empire Premium Bau';
            }
            
            // Set B2 as Month Header (German String to avoid locale issues)
            const monthIdx = parseInt(month) - 1;
            worksheet.getCell('B2').value = `${monthNamesDe[monthIdx] || 'Unbekannt'} ${year}`;
            
            // Set B3 as Personnel Number
            worksheet.getCell('B3').value = worker.personnel_number || String(worker.id).substring(0, 8);
            
            const workerName = worker.name || 'Unbekannt';
            const nameParts = workerName.trim().split(' ');
            const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : workerName;
            const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '';
            
            worksheet.getCell('B4').value = lastName;
            worksheet.getCell('B5').value = firstName;

            // 2. Prepare Rows 10 to 40
            const daysInMonth = new Date(year, month, 0).getDate();
            for (let i = 10; i <= 40; i++) {
                const row = worksheet.getRow(i);
                ['B', 'C', 'D', 'E', 'F'].forEach(col => {
                    row.getCell(col).value = null;
                    if (col !== 'C' && col !== 'B') row.getCell(col).numFmt = 'hh:mm';
                });

                // REINFORCE INTERACTIVE FORMULAS
                const rowNum = i;
                
                // Column B: Weekday (Forced German via CHOOSE)
                // We use English formula names (CHOOSE, WEEKDAY) as exceljs/Excel requires
                row.getCell('B').value = { 
                    formula: `CHOOSE(WEEKDAY(A${rowNum}),"So","Mo","Di","Mi","Do","Fr","Sa")`, 
                    result: "" // Will be set in date population
                };
                row.getCell('B').numFmt = '@'; // Plain text format
                row.getCell('B').alignment = { horizontal: 'left' };

                // Column G: Dauer = (F - E - D) * 24
                row.getCell('G').value = { 
                    formula: `(F${rowNum}-E${rowNum}-D${rowNum})*24`, 
                    result: 0 
                };
                row.getCell('G').numFmt = '0.00';

                // Column I: Lohnart = IF(G > 0, G, "")
                row.getCell('I').value = { 
                    formula: `IF(G${rowNum}>0,G${rowNum},"")`, 
                    result: "" 
                };
                row.getCell('I').numFmt = '0.00';

                // Date formatting
                row.getCell('A').numFmt = 'dd.mm.yy';
            }

            // Populate Calendar Dates
            for (let day = 1; day <= daysInMonth; day++) {
                const rowNum = 10 + day - 1;
                const row = worksheet.getRow(rowNum);
                const currentDate = new Date(year, month - 1, day, 12, 0, 0);
                row.getCell('A').value = currentDate;
                
                // Cache the day name result for B
                row.getCell('B').value.result = daysOfWeekDe[currentDate.getDay()];
            }

            // 3. REINFORCE TOTALS (Row 41)
            // Column Mapping: I=1, J=U, K=F, L=K, M=AF
            ['I', 'J', 'K', 'L', 'M'].forEach(col => {
                const cell = worksheet.getCell(`${col}41`);
                cell.value = { formula: `SUM(${col}10:${col}40)`, result: 0 };
                cell.numFmt = '0.00';
            });

            // 4. Populate log data using numeric fractions
            logs.forEach(log => {
                const logDate = new Date(log.date);
                const day = logDate.getDate();
                const row = worksheet.getRow(10 + day - 1);

                row.getCell('C').value = log.project_name || 'Allgemein';
                
                const ttSettings = company?.settings?.time_tracking || {};
                const standardDay = ttSettings.standard_workday_hours ?? 8.5;

                // C=Context, I=Work, J=Vacation, K=Holiday, L=Sick, M=AF
                const totalHoursNum = Number(log.total_hours || 0);

                if (log.type === 'vacation') {
                    row.getCell('C').value = 'Urlaub';
                    row.getCell('G').value = totalHoursNum || standardDay;
                    row.getCell('J').value = totalHoursNum || standardDay;
                } else if (log.type === 'sick') {
                    row.getCell('C').value = 'Krank';
                    row.getCell('G').value = totalHoursNum || standardDay;
                    row.getCell('L').value = totalHoursNum || standardDay;
                } else if (log.type === 'holiday') {
                    row.getCell('C').value = 'Feiertag';
                    row.getCell('G').value = totalHoursNum || standardDay;
                    row.getCell('K').value = totalHoursNum || standardDay;
                } else if (log.type === 'work_free') {
                    row.getCell('C').value = 'Arbeitsfrei';
                    row.getCell('G').value = totalHoursNum;
                    row.getCell('M').value = totalHoursNum;
                } else {
                    // Normal work entry (Type 'work')
                    row.getCell('C').value = log.project_name || 'Allgemein';
                    
                    if (log.check_in_time) {
                        const t = new Date(log.check_in_time);
                        row.getCell('D').value = (t.getHours() + t.getMinutes() / 60) / 24;
                    }
                    
                    if (log.break_deducted) {
                        row.getCell('E').value = Number(log.break_deducted) / 24;
                    }

                    if (log.check_out_time) {
                        const t = new Date(log.check_out_time);
                        row.getCell('F').value = (t.getHours() + t.getMinutes() / 60) / 24;
                    }

                    const work = row.getCell('F').value || 0;
                    const pause = row.getCell('E').value || 0;
                    const start = row.getCell('D').value || 0;
                    const calculatedDauer = (work - pause - start) * 24;
                    
                    if (calculatedDauer > 0) {
                        row.getCell('G').value.result = calculatedDauer;
                        row.getCell('I').value = calculatedDauer;
                    }
                }
            });

            // Recalculate Grand Total I41 result cache (Sum of I through M)
            let totalReportHours = 0;
            for (let i = 10; i <= 40; i++) {
                const row = worksheet.getRow(i);
                ['I', 'J', 'K', 'L', 'M'].forEach(col => {
                    const val = row.getCell(col).value;
                    if (typeof val === 'number') totalReportHours += val;
                    else if (val && val.result) totalReportHours += Number(val.result);
                });
            }
            const i41Cell = worksheet.getCell('I41');
            if (i41Cell.value && typeof i41Cell.value === 'object') {
                i41Cell.value.result = totalReportHours;
            } else {
                // FALLBACK: If it's not a formula object, just overwrite it
                i41Cell.value = totalReportHours;
            }
            logger.info('[Report] Log data filled');

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=Stundenzettel_${workerName.replace(/\s+/g, '_')}_${month}_${year}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();
            logger.info('[Report] Generation and streaming complete');
        } catch (err) {
            logger.error(`[Report] CRITICAL ERROR: ${err.message}`);
            logger.error(err.stack);
            return res.status(500).json({ success: false, message: err.message });
        }
    }
}

module.exports = TimeTrackingController;
