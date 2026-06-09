const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Op } = require('sequelize');
const { ProjectFolder, ProjectFile, Role, Project, User, ProjectImage, ProjectStageImage, ProjectStage, Subcontractor } = require('../../domain/models');
const { uploadToR2, deleteFromR2, listFromR2 } = require('../utils/storage');

// Base uploads directory
const UPLOADS_DIR = path.join(__dirname, '../../../../uploads/projects');

// Temporary storage for incoming uploads before moving them
const upload = multer({ 
    dest: path.join(__dirname, '../../../../uploads/temp/'),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB per file
        files: 20 // Max 20 files at once
    }
});

const { fixEncoding, getSafeStorageName } = require('../../utils/fileUtils');
const { processUploadedFile } = require('../../utils/imageConverter');

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
        const userRoleName = userRole?.name || userRole;

        if (subPath && userRoleName === 'Subcontractor') {
            const pathParts = subPath.split('/').filter(Boolean);
            const parentFolders = await ProjectFolder.findAll({
                where: {
                    project_id: id,
                    name: pathParts
                }
            });
            const hasHiddenParent = req.user.isPartner
                ? parentFolders.some(f => f.visible_to_partners === false)
                : parentFolders.some(f => f.visible_to_subcontractors === false);
            if (hasHiddenParent) {
                return res.status(403).json({ error: 'Zugriff verweigert' });
            }
        }

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
            } else if (!subPath && images.length > 0) {
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

        const isManagement = ['Admin', 'Büro', 'Projektleiter', 'Gruppenleiter'].includes(userRoleName);

        // --- 3. STANDARD LISTING WITH R2 DISCOVERY ---
        // 1. Fetch DB Items
        console.log(`[DB] Fetching items for project ${id}, subPath: "${subPath}"`);
        const folderRecords = await ProjectFolder.findAll({
            where: { project_id: id, path: subPath },
            include: [
                { model: User, as: 'creator', attributes: ['id', 'name'] },
                { model: Subcontractor, as: 'subcontractor_creator', attributes: ['id', 'name'] },
                { model: Client, as: 'client_creator', attributes: ['id', 'name'] }
            ]
        });
        const fileRecords = await ProjectFile.findAll({
            where: { project_id: id, path: subPath },
            include: [
                { model: User, as: 'creator', attributes: ['id', 'name'] },
                { model: Subcontractor, as: 'subcontractor_creator', attributes: ['id', 'name'] },
                { model: Client, as: 'client_creator', attributes: ['id', 'name'] }
            ]
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
                    const fullFolderPath = subPath ? (subPath.endsWith('/') ? subPath + folderName : subPath + '/' + folderName) : folderName;
                    itemMap.set(folderName, {
                        name: displayName,
                        physicalName: folderName,
                        path: fullFolderPath,
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
                const fullFilePath = subPath ? (subPath.endsWith('/') ? subPath + fileName : subPath + '/' + fileName) : fileName;

                // Update existing item if found (from gallery/virtual) or create new
                if (itemMap.has(fileName)) {
                    const existing = itemMap.get(fileName);
                    itemMap.set(fileName, {
                        ...existing,
                        path: fullFilePath,
                        size: obj.Size,
                        updatedAt: obj.LastModified,
                        url: existing.url || `${process.env.R2_PUBLIC_URL}/${obj.Key}`
                    });
                } else {
                    itemMap.set(fileName, {
                        name: fileName,
                        physicalName: fileName,
                        path: fullFilePath,
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
            const itemPath = r.path ? (r.path.endsWith('/') ? r.path + r.name : r.path + '/' + r.name) : r.name;
            
            itemMap.set(r.name, {
                id: r.id,
                name: displayName,
                physicalName: r.name,
                path: itemPath,
                isDirectory: true,
                size: 0,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
                created_by_id: r.created_by_id,
                created_by_subcontractor_id: r.created_by_subcontractor_id,
                created_by_client_id: r.created_by_client_id,
                creator_name: r.creator ? r.creator.name : (r.subcontractor_creator ? r.subcontractor_creator.name : (r.client_creator ? r.client_creator.name : null)),
                permissions: {
                    allowed_role_ids: r.allowed_role_ids,
                    is_public: r.is_public,
                    share_token: r.share_token,
                    visible_to_subcontractors: r.visible_to_subcontractors,
                    visible_to_partners: r.visible_to_partners
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

            const itemPath = r.path ? (r.path.endsWith('/') ? r.path + r.name : r.path + '/' + r.name) : r.name;

            itemMap.set(physicalName, {
                id: r.id,
                name: fixEncoding(r.name),
                physicalName: physicalName,
                path: itemPath,
                isDirectory: false,
                size: r.size || 0,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
                url: r.file_url,
                created_by_id: r.created_by_id,
                created_by_subcontractor_id: r.created_by_subcontractor_id,
                created_by_client_id: r.created_by_client_id,
                creator_name: r.creator ? r.creator.name : (r.subcontractor_creator ? r.subcontractor_creator.name : (r.client_creator ? r.client_creator.name : null)),
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

                // Subcontractor check
                if (userRoleName === 'Subcontractor') {
                    if (req.user.isPartner) {
                        if (item.permissions && item.permissions.visible_to_partners === false) {
                            return false;
                        }
                        return true;
                    }
                    if (item.permissions && item.permissions.visible_to_subcontractors === false) {
                        return false;
                    }
                    return true;
                }

                if (!item.permissions || !item.permissions.allowed_role_ids) return true;

                const allowedRoles = Array.isArray(item.permissions.allowed_role_ids)
                    ? item.permissions.allowed_role_ids
                    : (typeof item.permissions.allowed_role_ids === 'string'
                        ? JSON.parse(item.permissions.allowed_role_ids)
                        : []);

                const currentRoleId = userRole && typeof userRole === 'object' ? userRole.id : null;
                return currentRoleId && allowedRoles.includes(currentRoleId);
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
        const userRole = req.user.role;
        const userRoleName = userRole?.name || userRole;
        const isPartner = req.user.isPartner === true;
        const isSubcontractor = !isPartner && (userRoleName === 'Subcontractor');

        // Defaults based on who is creating the folder
        let defaultSub = true;
        let defaultPartner = true;
        if (isPartner) {
            defaultSub = false;
            defaultPartner = true;
        }

        await ProjectFolder.create({
            project_id: id,
            name: name,
            path: folderPath || '',
            allowed_role_ids: allowed_role_ids || null,
            visible_to_subcontractors: req.body.visible_to_subcontractors !== undefined ? req.body.visible_to_subcontractors : defaultSub,
            visible_to_partners: req.body.visible_to_partners !== undefined ? req.body.visible_to_partners : defaultPartner,
            created_by_id: (isSubcontractor || isPartner) ? null : req.user.id,
            created_by_subcontractor_id: isSubcontractor ? req.user.id : null,
            created_by_client_id: isPartner ? req.user.id : null
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

        console.log(`[UPLOAD] Starting for Project: ${id}, Path: "${uploadPath}" (${req.files ? req.files.length : 0} files)`);

        if (!req.files || req.files.length === 0) {
            console.error('[UPLOAD ERROR] No files found in request');
            return res.status(400).json({ error: 'No files uploaded' });
        }

        // Validate path
        getSecurePath(id, uploadPath);

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
            await processUploadedFile(file);
            let originalName = file.originalname;

            let nameToStore = originalName;
            let fileRecord = null;
            let fileUrl = '';
            
            ext = path.extname(originalName);
            const baseName = path.basename(originalName, ext);
            let counter = 1;

            // Step 1: Reserve the name in DB (Handles race conditions)
            while (!fileRecord) {
                try {
                    let storageName = getSafeStorageName(nameToStore);
                    const r2Key = `projects/${id}/${uploadPath ? uploadPath + '/' : ''}${storageName}`;
                    fileUrl = `${process.env.R2_PUBLIC_URL}/${r2Key}`;

                    const isPartner = req.user.isPartner === true;
                    const isSubcontractor = !isPartner && (req.user.role === 'Subcontractor' || req.user.role?.name === 'Subcontractor');
                    fileRecord = await ProjectFile.create({
                        project_id: id,
                        folder_id: folderId,
                        name: nameToStore,
                        path: uploadPath || '',
                        size: file.size,
                        mime_type: file.mimetype,
                        file_url: fileUrl,
                        created_by_id: (isSubcontractor || isPartner) ? null : req.user.id,
                        created_by_subcontractor_id: isSubcontractor ? req.user.id : null,
                        created_by_client_id: isPartner ? req.user.id : null
                    });
                } catch (err) {
                    if (err.name === 'SequelizeUniqueConstraintError') {
                        // Collision! Try next name
                        nameToStore = `${baseName} (${counter})${ext}`;
                        counter++;
                    } else {
                        // Real error
                        throw err;
                    }
                }
            }
            
            console.log(`[UPLOAD] Reserved name: "${nameToStore}" (URL: ${fileUrl})`);

            // Step 2: Upload to R2
            try {
                const urlObj = new URL(fileUrl);
                const r2Key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                
                await uploadToR2(file.path, r2Key, file.mimetype);

                // Cleanup temp file
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                
                uploadedFiles.push({
                    id: fileRecord.id,
                    name: nameToStore,
                    url: fileUrl
                });
            } catch (uploadError) {
                console.error(`[UPLOAD ERROR] R2 upload failed for ${nameToStore}, rolling back DB:`, uploadError);
                // Rollback DB reservation
                if (fileRecord) await fileRecord.destroy();
                throw new Error(`Upload failed for ${nameToStore}: ${uploadError.message}`);
            }
        }

        res.status(201).json({
            status: 'success',
            message: 'Files uploaded successfully',
            data: uploadedFiles
        });
    } catch (error) {
        // Cleanup ALL temp files on error if they still exist
        if (req.files) {
            req.files.forEach(file => {
                try {
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                } catch (e) {
                    console.error('[CLEANUP ERROR]:', e.message);
                }
            });
        }

        console.error('[UPLOAD CRITICAL ERROR]:', error);
        
        // Check for specific database errors
        let errorMessage = error.message || 'Server error uploading files';
        let details = null;

        if (error.name === 'SequelizeUniqueConstraintError') {
            errorMessage = 'A file with this name already exists in this folder.';
            details = 'Duplicate name';
        }

        res.status(400).json({ 
            error: errorMessage,
            details: details,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

exports.deleteItem = async (req, res) => {
    try {
        const { id } = req.params;
        const itemPath = req.query.path;
 
        const userRoleName = req.user.role?.name || req.user.role;
        const userId = req.user.id;
        const isManagement = ['Admin', 'Büro', 'Projektleiter', 'Gruppenleiter'].includes(userRoleName);
 
        if (!itemPath) return res.status(400).json({ error: 'Pfad ist erforderlich' });
 
        const name = path.basename(itemPath);
        const parentRelativePath = path.dirname(itemPath) === '.' ? '' : path.dirname(itemPath);
 
        // 1. Check if it's a known folder in DB
        const folderRecord = await ProjectFolder.findOne({
            where: { project_id: id, path: parentRelativePath, name: name }
        });
 
        if (folderRecord) {
            // FOLDER DELETION
            if (userRoleName === 'Subcontractor') {
                if (req.user.isPartner) {
                    if (folderRecord.created_by_client_id !== userId) {
                        return res.status(403).json({ error: 'Zugriff verweigert: Sie können nur Ihre eigenen Ordner löschen' });
                    }
                } else {
                    if (folderRecord.created_by_subcontractor_id !== userId) {
                        return res.status(403).json({ error: 'Zugriff verweigert: Sie können nur Ihre eigenen Ordner löschen' });
                    }
                }
            } else if (!isManagement) {
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

            if (!fileRecord && !isManagement && userRoleName !== 'Subcontractor') {
                return res.status(404).json({ error: 'Datei nicht gefunden oder keine Berechtigung' });
            }
 
            let canDeleteFile = false;
            if (userRoleName === 'Subcontractor') {
                if (req.user.isPartner) {
                    canDeleteFile = fileRecord && fileRecord.created_by_client_id === userId;
                } else {
                    canDeleteFile = fileRecord && fileRecord.created_by_subcontractor_id === userId;
                }
            } else {
                canDeleteFile = isManagement || (fileRecord && (fileRecord.created_by_id === userId || fileRecord.created_by_subcontractor_id === userId || fileRecord.created_by_client_id === userId));
            }
 
            if (canDeleteFile) {
                if (fileRecord) {
                    if (fileRecord.file_url && fileRecord.file_url.startsWith('http')) {
                        try {
                            const urlObj = new URL(fileRecord.file_url);
                            const key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
                            await deleteFromR2(key);
                        } catch (err) { console.error('R2 delete error:', err); }
                    }
                    await fileRecord.destroy();
                } else if (isManagement) {
                    // Fallback for orphaned files in R2 (Discovery items)
                    try {
                        const r2Key = `projects/${id}/${itemPath}`;
                        await deleteFromR2(r2Key);
                        console.log(`[CLEANUP] Deleted orphaned R2 object: ${r2Key}`);
                    } catch (err) {
                        console.warn(`[CLEANUP] R2 orphan delete failed (might not exist): ${err.message}`);
                    }
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

        // 1.5. Fallback to R2 (for discovered/orphaned files)
        const r2Key = `projects/${id}/${itemPath}`;
        try {
            // We can't easily check for existence without another R2 call, 
            // but we can just redirect and let R2/Browser handle it.
            return res.redirect(`${process.env.R2_PUBLIC_URL}/${r2Key}`);
        } catch (e) {
            console.warn('R2 Redirect fallback failed:', e.message);
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
        const { path: folderPath, name, allowed_role_ids, visible_to_subcontractors, visible_to_partners } = req.body;
        const userRole = req.user.role;
        const userRoleName = userRole?.name || userRole;

        if (!name) return res.status(400).json({ error: 'Folder name is required' });

        // Restriction: Only Admin, Büro, Projektleiter, and Gruppenleiter can change permissions
        const allowedToManage = ['Admin', 'Büro', 'Projektleiter', 'Gruppenleiter'].includes(userRoleName);
        if (!allowedToManage) {
            return res.status(403).json({ error: 'Access denied: Insufficient permissions' });
        }

        const [folder, created] = await ProjectFolder.findOrCreate({
            where: { project_id: id, path: folderPath || '', name: name },
            defaults: { 
                allowed_role_ids, 
                visible_to_subcontractors: visible_to_subcontractors !== undefined ? visible_to_subcontractors : true, 
                visible_to_partners: visible_to_partners !== undefined ? visible_to_partners : true, 
                created_by_id: req.user.id 
            }
        });

        if (!created) {
            if (allowed_role_ids !== undefined) folder.allowed_role_ids = allowed_role_ids;
            if (visible_to_subcontractors !== undefined) folder.visible_to_subcontractors = visible_to_subcontractors;
            if (visible_to_partners !== undefined) folder.visible_to_partners = visible_to_partners;
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
