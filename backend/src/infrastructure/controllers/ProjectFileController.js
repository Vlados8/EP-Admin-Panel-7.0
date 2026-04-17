const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Op } = require('sequelize');
const { ProjectFolder, ProjectFile, Role, Project, User, ProjectImage, ProjectStageImage } = require('../../domain/models');
const { uploadToR2, deleteFromR2, listFromR2 } = require('../utils/storage');

// Base uploads directory
const UPLOADS_DIR = path.join(__dirname, '../../../../uploads/projects');

// Temporary storage for incoming uploads before moving them
const upload = multer({ dest: path.join(__dirname, '../../../../uploads/temp/') });

const { fixEncoding, getSafeStorageName } = require('../../utils/fileUtils');

// Utility func to ensure requested path is secure
const getSecurePath = (projectId, requestedPath) => {
    if (!projectId) throw new Error('Project ID is required');

    // For R2, we don't strictly need to resolve absolute paths for validation,
    // but we can normalize the path for prefixing.
    const normalizedPath = (requestedPath || '').replace(/\\/g, '/').replace(/^\//, '').replace(/\/$/, '');

    return { 
        projectDir: String(projectId), 
        targetPath: normalizedPath 
    };
};

// ensureProjectDir removed as requested by user - we no longer create local project directories.

exports.listFiles = async (req, res) => {
    try {
        const { id } = req.params;
        const subPath = req.query.path || '';
        const userRole = req.user.role;

        // --- 1. PREPARE UNIFIED LISTING MAP ---
        const itemMap = new Map();
        const normalizePath = (p) => p.endsWith('/') ? p : (p ? p + '/' : '');

        // --- 2. SPECIAL VIRTUAL SOURCES (Gallery & Stages) ---
        // If we are at root or in specific virtual folders, fetch legacy records
        if (!subPath || subPath === 'gallery' || subPath === 'gallery/') {
            const images = await ProjectImage.findAll({
                where: { project_id: id },
                include: [{ model: User, as: 'uploader', attributes: ['id', 'name'] }]
            });

            if (subPath.startsWith('gallery')) {
                // Inside gallery: add ProjectImage records as files
                images.forEach(img => {
                    const physicalName = path.basename(img.file_path);
                    itemMap.set(physicalName, {
                        id: img.id,
                        name: img.file_name || physicalName,
                        physicalName: physicalName,
                        isDirectory: false,
                        size: 0, // Will be updated by R2 discovery if match found
                        createdAt: img.createdAt,
                        updatedAt: img.updatedAt,
                        url: img.file_path,
                        created_by_id: img.uploaded_by,
                        creator_name: img.uploader ? img.uploader.name : null,
                        source: 'gallery'
                    });
                });
            } else if (!subPath) {
                // At root: Ensure 'Galerie' folder is visible if any images exist
                itemMap.set('gallery', {
                    name: 'Galerie',
                    physicalName: 'gallery',
                    isDirectory: true,
                    size: 0,
                    source: 'virtual'
                });
            }
        }

        if (!subPath || subPath === 'stages' || subPath === 'stages/') {
            console.log(`[STAGES] Handling stages for subPath: "${subPath}"`);
            try {
                const stages = await ProjectStageImage.findAll({
                    include: [{ 
                        model: ProjectStage, 
                        as: 'stage',
                        where: { project_id: id }
                    }]
                });
                
                if (subPath.startsWith('stages')) {
                    stages.forEach(si => {
                        const physicalName = path.basename(si.path);
                        itemMap.set(physicalName, {
                            id: si.id,
                            name: physicalName,
                            physicalName: physicalName,
                            isDirectory: false,
                            size: 0,
                            createdAt: si.createdAt,
                            updatedAt: si.updatedAt,
                            url: si.path,
                            source: 'stages'
                        });
                    });
                } else if (!subPath) {
                    itemMap.set('stages', {
                        name: 'Etappen',
                        physicalName: 'stages',
                        isDirectory: true,
                        size: 0,
                        source: 'virtual'
                    });
                }
            } catch (stageErr) {
                console.error('[STAGES] Query Error:', stageErr.message);
                // Non-fatal, just log it. If it's a 400 later, we'll see why.
            }
        }

        // If we are inside 'stages', we show ProjectStageImage records (grouped or flat?)
        // Assuming we want a flat list of all stage images for now, or we could group by stage.
        // Let's stick to the prompt's focus on Gallery for now, but handle 'stages' similarly if requested.

        const isManagement = userRole && userRole.name ? ['Admin', 'Büro', 'Projektleiter', 'Gruppenleiter'].includes(userRole.name) : false;

        // --- 3. STANDARD LISTING WITH R2 DISCOVERY ---
        // 1. Fetch DB Items
        console.log(`[DB] Fetching items for project ${id}, subPath: "${subPath}"`);
        const folderRecords = await ProjectFolder.findAll({
            where: { project_id: id, path: subPath },
            include: [{ model: User, as: 'creator', attributes: ['id', 'name'] }]
        });
        const fileRecords = await ProjectFile.findAll({
            where: { project_id: id, path: subPath },
            include: [{ model: User, as: 'creator', attributes: ['id', 'name'] }]
        });
        console.log(`[DB] Found ${folderRecords.length} folders, ${fileRecords.length} files.`);

        // 2. R2 DISCOVERY (Scan R2 for folders/files)
        const r2Prefix = normalizePath(`projects/${id}/${subPath}`);
        
        let r2Items = { CommonPrefixes: [], Contents: [] };
        try {
            r2Items = await listFromR2(r2Prefix, '/');
        } catch (err) {
            console.error('R2 Scan Error:', err);
        }

        // Add R2 Folders (CommonPrefixes)
        if (r2Items.CommonPrefixes) {
            r2Items.CommonPrefixes.forEach(cp => {
                const fullPrefix = cp.Prefix;
                const folderName = fullPrefix.split('/').filter(Boolean).pop();
                
                // Map internal 'gallery' to 'Galerie' for display
                const displayName = folderName === 'gallery' ? 'Galerie' : (folderName === 'stages' ? 'Etappen' : folderName);

                if (!itemMap.has(folderName)) {
                    itemMap.set(folderName, {
                        name: displayName,
                        physicalName: folderName,
                        isDirectory: true,
                        size: 0,
                        source: 'r2'
                    });
                }
            });
        }

        // Add R2 Files (Contents)
        if (r2Items.Contents) {
            r2Items.Contents.forEach(obj => {
                const fileName = obj.Key.split('/').filter(Boolean).pop();
                if (!fileName || obj.Key.endsWith('/')) return;

                // Update existing item if found (from gallery/virtual) or create new
                if (itemMap.has(fileName)) {
                    const existing = itemMap.get(fileName);
                    itemMap.set(fileName, {
                        ...existing,
                        size: obj.Size,
                        updatedAt: obj.LastModified,
                        url: existing.url || `${process.env.R2_PUBLIC_URL}/${obj.Key}`
                    });
                } else {
                    itemMap.set(fileName, {
                        name: fileName,
                        physicalName: fileName,
                        isDirectory: false,
                        size: obj.Size,
                        updatedAt: obj.LastModified,
                        url: `${process.env.R2_PUBLIC_URL}/${obj.Key}`,
                        source: 'r2'
                    });
                }
            });
        }

        // 4. MERGE WITH DB (DB takes precedence for metadata/permissions)
        folderRecords.forEach(r => {
            const displayName = r.name === 'gallery' ? 'Galerie' : (r.name === 'stages' ? 'Etappen' : fixEncoding(r.name));
            itemMap.set(r.name, {
                id: r.id,
                name: displayName,
                physicalName: r.name,
                isDirectory: true,
                size: 0,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
                created_by_id: r.created_by_id,
                creator_name: r.creator ? r.creator.name : null,
                permissions: {
                    allowed_role_ids: r.allowed_role_ids,
                    is_public: r.is_public,
                    share_token: r.share_token
                },
                source: 'db'
            });
        });

        fileRecords.forEach(r => {
            // Deduplication: extract physical name from file_url (UUID)
            let physicalName = r.name;
            if (r.file_url && r.file_url.startsWith('http')) {
                try {
                    // Extract basename from URL (e.g. 123-uuid.png)
                    physicalName = path.basename(new URL(r.file_url).pathname);
                } catch (e) {
                    console.warn('URL parse error for deduplication:', r.file_url);
                }
            }

            itemMap.set(physicalName, {
                id: r.id,
                name: fixEncoding(r.name),
                physicalName: physicalName,
                isDirectory: false,
                size: r.size || 0,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
                url: r.file_url,
                created_by_id: r.created_by_id,
                creator_name: r.creator ? r.creator.name : null,
                source: 'db'
            });
        });

        const formattedItems = Array.from(itemMap.values());

        // 5. Filter items based on permissions
        const filteredItems = formattedItems.filter(item => {
            // Priority for management roles
            if (isManagement) return true;

            if (item.isDirectory) {
                // Check folder-specific metadata from DB
                if (item.permissions && item.permissions.is_public) return true;
                if (!item.permissions || !item.permissions.allowed_role_ids) return true;

                const allowedRoles = Array.isArray(item.permissions.allowed_role_ids)
                    ? item.permissions.allowed_role_ids
                    : (typeof item.permissions.allowed_role_ids === 'string' 
                        ? JSON.parse(item.permissions.allowed_role_ids) 
                        : []);

                return userRole && allowedRoles.includes(userRole.id);
            }
            // For general files, we list them if they are in the folder
            return true;
        });

        // 6. Sort: Virtual folders first, then Alphabetical
        filteredItems.sort((a, b) => {
            if (a.isDirectory === b.isDirectory) {
                return a.name.localeCompare(b.name);
            }
            return a.isDirectory ? -1 : 1;
        });

        res.status(200).json({
            status: 'success',
            data: filteredItems
        });
    } catch (error) {
        console.error('CRITICAL Error listing files:', error);
        res.status(400).json({ error: error.message || 'Server error reading directory' });
    }
};

exports.createFolder = async (req, res) => {
    try {
        const { id } = req.params;
        const { path: folderPath, name, allowed_role_ids } = req.body;

        if (!name) return res.status(400).json({ error: 'Folder name is required' });

        const { targetPath } = getSecurePath(id, folderPath);
        // We no longer call ensureProjectDir or fs.mkdirSync for local paths.
        // For R2, folders dont need to be 'created' physically, but we check if we already have a record
        // to prevent logical duplicates if necessary.
        
        const existingFolder = await ProjectFolder.findOne({
            where: { project_id: id, path: folderPath || '', name: name.trim() }
        });

        if (existingFolder) {
            return res.status(400).json({ error: 'Folder already exists in database' });
        }

        // Save metadata to DB
        await ProjectFolder.create({
            project_id: id,
            name: name,
            path: folderPath || '',
            allowed_role_ids: allowed_role_ids || null,
            created_by_id: req.user.id
        });

        res.status(201).json({
            status: 'success',
            message: 'Folder created successfully'
        });
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(400).json({ error: error.message || 'Server error creating folder' });
    }
};

// Multer middleware wrapper for file uploads
exports.uploadMiddleware = upload.array('files');

exports.uploadFiles = async (req, res) => {
    try {
        const { id } = req.params;
        const uploadPath = req.body.path || '';

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const { targetPath } = getSecurePath(id, uploadPath);

        // Try to find the parent folder ID if we are uploading to a subpath
        let folderId = null;
        if (uploadPath) {
            const pathParts = uploadPath.split('/').filter(Boolean);
            const folderName = pathParts[pathParts.length - 1];
            const parentPath = pathParts.slice(0, -1).join('/');
            const folderRecord = await ProjectFolder.findOne({
                where: { project_id: id, path: parentPath, name: folderName }
            });
            if (folderRecord) folderId = folderRecord.id;
        }

        const uploadedFiles = [];

        for (const file of req.files) {
            // Fix encoding: multer/busboy misinterprets UTF-8 as Latin-1
            let originalName = fixEncoding(file.originalname);
            let storageName = getSafeStorageName(originalName);
            // In R2, we don't need to check local filesystem for name collisions the same way,
            // but we can append a timestamp to be safe if desired.
            
            // Upload to R2 directly from Multer's temp path
            let fileUrl;
            try {
                const r2Key = `projects/${id}/${uploadPath ? uploadPath + '/' : ''}${storageName}`;
                fileUrl = await uploadToR2(file.path, r2Key, file.mimetype);
                
                // Cleanup temp file
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            } catch (uploadError) {
                console.error('R2 upload failed:', uploadError);
                fileUrl = `/uploads/projects/${relativePath}`; // Fallback if local move somehow happened
            }

            // Save to DB
            await ProjectFile.create({
                project_id: id,
                folder_id: folderId,
                name: originalName,
                path: uploadPath || '',
                size: file.size,
                mime_type: file.mimetype,
                file_url: fileUrl,
                created_by_id: req.user.id
            });

            uploadedFiles.push({
                name: originalName,
                url: fileUrl
            });
        }

        res.status(201).json({
            status: 'success',
            message: 'Files uploaded successfully',
            data: uploadedFiles
        });
    } catch (error) {
        // Cleanup temp files on error
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            });
        }

        console.error('Error uploading files:', error);
        res.status(400).json({ error: error.message || 'Server error uploading files' });
    }
};

exports.deleteItem = async (req, res) => {
    try {
        const { id } = req.params;
        const itemPath = req.query.path;
        const userRole = req.user.role;
        const userId = req.user.id;
        const isManagement = ['Admin', 'Büro', 'Projektleiter', 'Gruppenleiter'].includes(userRole.name);

        if (!itemPath) return res.status(400).json({ error: 'Pfad ist erforderlich' });

        const name = path.basename(itemPath);
        const parentRelativePath = path.dirname(itemPath) === '.' ? '' : path.dirname(itemPath);
        
        // 1. Check if it's a known folder in DB
        const folderRecord = await ProjectFolder.findOne({ 
            where: { project_id: id, path: parentRelativePath, name: name } 
        });

        if (folderRecord) {
            // FOLDER DELETION
            if (!isManagement) {
                return res.status(403).json({ error: 'Zugriff verweigert: Nur Management kann Ordner löschen' });
            }

            // Recursive cleanup of nested files in R2
            const nestedFiles = await ProjectFile.findAll({
                where: { project_id: id, path: { [Op.like]: `${itemPath}%` } }
            });

            for (const nf of nestedFiles) {
                if (nf.file_url && nf.file_url.startsWith('http')) {
                    try {
                        const urlObj = new URL(nf.file_url);
                        const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                        await deleteFromR2(key);
                    } catch (err) { console.error('R2 nested delete error:', err); }
                }
            }
            
            // Delete DB records
            await ProjectFile.destroy({ where: { project_id: id, path: { [Op.like]: `${itemPath}%` } } });
            await folderRecord.destroy();

            // Physical cleanup (Legacy fallback)
            const { targetPath } = getSecurePath(id, itemPath);
            if (fs.existsSync(targetPath)) {
                fs.rmSync(targetPath, { recursive: true, force: true });
            }
        } else {
            // 2. FILE DELETION
            const fileRecord = await ProjectFile.findOne({
                where: { 
                    project_id: id, 
                    [Op.or]: [
                        { [Op.and]: [{ path: parentRelativePath }, { name: name }] },
                        { file_url: { [Op.like]: `%/${name}` } }
                    ]
                }
            });

            if (!fileRecord && !isManagement) {
                return res.status(404).json({ error: 'Datei nicht gefunden oder keine Berechtigung' });
            }

            if (isManagement || (fileRecord && fileRecord.created_by_id === userId)) {
                if (fileRecord) {
                    if (fileRecord.file_url && fileRecord.file_url.startsWith('http')) {
                        try {
                            const urlObj = new URL(fileRecord.file_url);
                            const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                            await deleteFromR2(key);
                        } catch (err) { console.error('R2 delete error:', err); }
                    }
                    await fileRecord.destroy();
                }
                
                // Physical cleanup (Legacy fallback)
                const { targetPath } = getSecurePath(id, itemPath);
                if (fs.existsSync(targetPath)) {
                    fs.unlinkSync(targetPath);
                }
            } else {
                return res.status(403).json({ error: 'Zugriff verweigert: Sie können nur eigene Dateien löschen' });
            }
        }

        res.status(200).json({
            status: 'success',
            message: 'Erfolgreich gelöscht'
        });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(400).json({ error: error.message || 'Server error deleting item' });
    }
};

exports.downloadFile = async (req, res) => {
    try {
        const { id } = req.params;
        const itemPath = req.query.path;

        if (!itemPath) return res.status(400).json({ error: 'Path is required for download' });

        const fileName = path.basename(itemPath);
        const parentRelativePath = path.dirname(itemPath) === '.' ? '' : path.dirname(itemPath);

        // 1. Prioritize Database Lookup (to find R2 URL)
        const fileRecord = await ProjectFile.findOne({
            where: { project_id: id, path: parentRelativePath, name: fileName }
        });

        if (fileRecord && fileRecord.file_url && fileRecord.file_url.startsWith('http')) {
            return res.redirect(fileRecord.file_url);
        }

        // 2. Fallback to standard disk lookup (Legacy)
        const { targetPath } = getSecurePath(id, itemPath);
        if (fs.existsSync(targetPath)) {
            const stats = fs.statSync(targetPath);
            if (stats.isDirectory()) {
                return res.status(400).json({ error: 'Cannot directly download a directory' });
            }
            return res.download(targetPath);
        }

        // 3. Fallback for garbled names (Legacy)
        const dir = path.dirname(targetPath);
        const base = path.basename(targetPath);
        const garbledBase = Buffer.from(base, 'utf8').toString('latin1');
        const garbledPath = path.join(dir, garbledBase);

        if (fs.existsSync(garbledPath)) {
            return res.download(garbledPath);
        }

        res.status(404).json({ error: 'Datei nicht gefunden' });
    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(400).json({ error: error.message || 'Server error downloading file' });
    }
};

exports.updatePermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { path: folderPath, name, allowed_role_ids } = req.body;
        const userRole = req.user.role;

        if (!name) return res.status(400).json({ error: 'Folder name is required' });

        // Restriction: Only Admin, Büro, Projektleiter, and Gruppenleiter can change permissions
        const allowedToManage = ['Admin', 'Büro', 'Projektleiter', 'Gruppenleiter'].includes(userRole.name);
        if (!allowedToManage) {
            return res.status(403).json({ error: 'Access denied: Insufficient permissions' });
        }

        const [folder, created] = await ProjectFolder.findOrCreate({
            where: { project_id: id, path: folderPath || '', name: name },
            defaults: { allowed_role_ids, created_by_id: req.user.id }
        });

        if (!created) {
            folder.allowed_role_ids = allowed_role_ids;
            await folder.save();
        }

        res.status(200).json({ status: 'success', message: 'Permissions updated' });
    } catch (err) {
        console.error('[updatePermissions ERROR]:', err);
        res.status(400).json({ error: err.message });
    }
};

exports.togglePublicShare = async (req, res) => {
    try {
        const { id } = req.params;
        const { path: folderPath, name } = req.body;
        const userRole = req.user.role;

        if (!name) return res.status(400).json({ error: 'Folder name is required' });

        // Restriction: Only Admin, Büro, Projektleiter, and Gruppenleiter can manage links
        const allowedToManage = ['Admin', 'Büro', 'Projektleiter', 'Gruppenleiter'].includes(userRole.name);
        if (!allowedToManage) {
            return res.status(403).json({ error: 'Access denied: Insufficient permissions' });
        }

        const [folder] = await ProjectFolder.findOrCreate({
            where: { project_id: id, path: folderPath || '', name: name },
            defaults: { created_by_id: req.user.id }
        });

        // Ensure share_token exists (e.g. if we found an existing record without one)
        if (!folder.share_token) {
            folder.share_token = require('crypto').randomUUID();
        }

        folder.is_public = !folder.is_public;
        await folder.save();

        res.status(200).json({
            status: 'success',
            is_public: folder.is_public,
            share_token: folder.share_token
        });
    } catch (err) {
        console.error('[togglePublicShare ERROR]:', err);
        res.status(400).json({ error: err.message });
    }
};
