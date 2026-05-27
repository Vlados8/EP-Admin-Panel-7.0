const fs = require('fs');
const path = require('path');
const { ProjectFolder, Project, Client, ProjectFile } = require('../../domain/models');
const { fixEncoding } = require('../../utils/fileUtils');

const UPLOADS_DIR = path.join(__dirname, '../../../../uploads/projects');

exports.getSharedFolder = async (req, res) => {
    try {
        const { token } = req.params;
        const subPath = req.query.path || '';

        const folder = await ProjectFolder.findOne({
            where: { share_token: token, is_public: true },
            include: [{
                model: Project,
                as: 'project',
                include: [{
                    model: Client,
                    as: 'client'
                }]
            }]
        });

        if (!folder) {
            return res.status(404).json({ error: 'Freigegebener Ordner nicht gefunden oder Zugriff deaktiviert' });
        }

        // --- 1. DETERMINE VIRTUAL PATH ---
        // fullVirtualPath is the "path" column value for sub-items
        const fullVirtualPath = [folder.path, folder.name, subPath].filter(Boolean).join('/').replace(/\/$/, '');
        
        // --- 2. GET DB RECORDS ---
        const dbFolders = await ProjectFolder.findAll({ 
            where: { project_id: folder.project_id, path: fullVirtualPath } 
        });
        const dbFiles = await ProjectFile.findAll({ 
            where: { project_id: folder.project_id, path: fullVirtualPath } 
        });

        // --- 3. ASSEMBLE ITEMS ---
        const itemMap = new Map();

        // Add DB folders
        dbFolders.forEach(r => {
            itemMap.set(r.name, {
                id: r.id,
                name: fixEncoding(r.name),
                isDirectory: true,
                size: 0,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
                url: null,
                source: 'db'
            });
        });

        // Add DB files
        dbFiles.forEach(r => {
            itemMap.set(r.name, {
                id: r.id,
                name: fixEncoding(r.name),
                isDirectory: false,
                size: r.size || 0,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
                url: r.file_url || null,
                source: 'db'
            });
        });

        // --- 4. OPTIONAL LEGACY FS FALLBACK ---
        // Only check FS if we have some legacy project files
        const projectDir = path.join(UPLOADS_DIR, String(folder.project_id));
        const rootSharedPath = path.resolve(projectDir, folder.path || '', folder.name);
        const targetPath = path.resolve(rootSharedPath, subPath);

        if (fs.existsSync(targetPath) && targetPath.startsWith(rootSharedPath)) {
            const physicalItems = fs.readdirSync(targetPath, { withFileTypes: true });
            physicalItems.forEach(item => {
                if (!itemMap.has(item.name)) {
                    const itemFullPath = path.join(targetPath, item.name);
                    const stats = fs.statSync(itemFullPath);
                    const relativePath = path.relative(UPLOADS_DIR, itemFullPath).replace(/\\/g, '/');

                    itemMap.set(item.name, {
                        name: fixEncoding(item.name),
                        isDirectory: item.isDirectory(),
                        size: stats.size,
                        createdAt: stats.birthtime,
                        updatedAt: stats.mtime,
                        url: item.isDirectory() ? null : `/uploads/projects/${relativePath}`,
                        source: 'fs'
                    });
                }
            });
        }

        const formattedItems = Array.from(itemMap.values());

        res.status(200).json({
            status: 'success',
            data: {
                folderName: folder.name,
                currentPath: subPath,
                items: formattedItems,
                project: folder.project ? {
                    title: folder.project.title,
                    description: folder.project.description,
                    address: folder.project.address,
                    clientName: folder.project.client 
                        ? folder.project.client.name 
                        : 'Unbekannter Kunde',
                    clientPhone: folder.project.client ? folder.project.client.phone : null,
                    clientEmail: folder.project.client ? folder.project.client.email : null,
                    clientAddress: folder.project.client ? `${folder.project.client.address || ''}, ${folder.project.client.city || ''}`.replace(/^, /, '') : null,
                    
                    subClientFirstName: folder.project.client_first_name,
                    subClientLastName: folder.project.client_last_name,
                    subClientPhone: folder.project.client_phone,
                    subClientEmail: folder.project.client_email,
                    subClientAddress: folder.project.client_address,
                    
                    startDate: folder.project.start_date,
                    endDate: folder.project.end_date
                } : null
            }
        });
    } catch (error) {
        console.error('Error fetching shared folder:', error);
        res.status(400).json({ error: 'Serverfehler beim Laden des freigegebenen Ordners' });
    }
};

exports.downloadSharedFile = async (req, res) => {
    try {
        const { token } = req.params;
        const relativeFile = req.query.file; 

        const folder = await ProjectFolder.findOne({
            where: { share_token: token, is_public: true }
        });

        if (!folder) return res.status(404).json({ error: 'Nicht gefunden' });

        const fileName = path.basename(relativeFile);
        const folderSubPath = path.dirname(relativeFile) === '.' ? '' : path.dirname(relativeFile);
        const fullVirtualPath = [folder.path, folder.name, folderSubPath].filter(f => f && f !== '.').join('/').replace(/\/$/, '');

        // 1. Try DB Lookup for R2 URL
        const fileRecord = await ProjectFile.findOne({
            where: { project_id: folder.project_id, path: fullVirtualPath, name: fileName }
        });

        if (fileRecord && fileRecord.file_url && fileRecord.file_url.startsWith('http')) {
            return res.redirect(fileRecord.file_url);
        }

        // 2. Legacy disk fallback
        const projectDir = path.join(UPLOADS_DIR, String(folder.project_id));
        const rootSharedPath = path.resolve(projectDir, folder.path || '', folder.name);
        const targetPath = path.resolve(rootSharedPath, relativeFile);

        if (fs.existsSync(targetPath) && targetPath.startsWith(rootSharedPath)) {
            const stats = fs.statSync(targetPath);
            if (!stats.isDirectory()) {
                return res.download(targetPath);
            }
        }

        // 3. Garbled names fallback
        const dir = path.dirname(targetPath);
        const base = path.basename(targetPath);
        const garbledBase = Buffer.from(base, 'utf8').toString('latin1');
        const garbledPath = path.join(dir, garbledBase);

        if (fs.existsSync(garbledPath) && garbledPath.startsWith(rootSharedPath)) {
            return res.download(garbledPath);
        }

        res.status(404).json({ error: 'Datei nicht gefunden' });
    } catch (error) {
        console.error('Download error:', error);
        res.status(400).json({ error: 'Download fehlgeschlagen' });
    }
};
