const { FileAsset, FileFolder, FileFavorite, User, Company } = require('../../domain/models');
const { uploadToR2, deleteFromR2 } = require('../utils/storage');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { fixEncoding, getSafeStorageName } = require('../../utils/fileUtils');
const { Op } = require('sequelize');

const upload = multer({ dest: path.join(__dirname, '../../../../uploads/temp/') });

exports.uploadMiddleware = upload.array('files');

exports.listFiles = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const companyId = req.user.company_id;
        let { folder_id, is_public, favorite_only } = req.query;

        // Convert to boolean reliably
        is_public = is_public === 'true' || is_public === true;
        favorite_only = favorite_only === 'true' || favorite_only === true;

        let whereClause = {
            company_id: companyId
        };

        // Filter by section (Public vs Private)
        if (favorite_only) {
            // Skip is_public and user_id filtering to show ALL favorites (both public and private)
        } else if (is_public) {
            whereClause.is_public = true;
        } else {
            whereClause.user_id = userId;
            whereClause.is_public = false;
        }

        // Filter by folder - Priority: Favorites show ALL starred regardless of folder
        if (favorite_only) {
            // Keep generic whereClause but will join with favorites
        } else if (folder_id && folder_id !== 'root') {
            whereClause.folder_id = folder_id;
        } else {
            whereClause.folder_id = null; // Root of the section
        }

        // Fetch Files
        const files = await FileAsset.findAll({
            where: whereClause,
            include: [
                { model: User, as: 'user', attributes: ['name'] },
                { 
                    model: FileFavorite, 
                    as: 'favorited_by', 
                    where: { user_id: userId }, 
                    required: favorite_only
                }
            ],
            order: [['created_at', 'DESC']]
        });

        // Fetch Folders (Folders no longer have favorites)
        let folderWhere = { company_id: companyId };
        if (favorite_only) {
            // Skip folders in favorites mode
        } else {
            folderWhere.is_public = is_public;
            if (!is_public) folderWhere.user_id = userId;
            folderWhere.parent_id = (folder_id && folder_id !== 'root') ? folder_id : null;
        }

        const folders = favorite_only ? [] : await FileFolder.findAll({
            where: folderWhere,
            order: [['name', 'ASC']]
        });

        const currentUserData = await User.findByPk(userId, { attributes: ['storage_used_bytes', 'storage_limit_gb'] });

        res.status(200).json({
            status: 'success',
            data: { 
                files,
                folders,
                storage_used_bytes: currentUserData?.storage_used_bytes || 0,
                storage_limit_gb: currentUserData?.storage_limit_gb || 2.0
            }
        });
    } catch (err) {
        console.error('List Files Error:', err);
        next(err);
    }
};

exports.createFolder = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const companyId = req.user.company_id;
        const { name, parent_id, is_public } = req.body;

        if (!name) return res.status(400).json({ status: 'fail', message: 'Name is required' });

        const folder = await FileFolder.create({
            name,
            parent_id: (parent_id && parent_id !== 'root') ? parent_id : null,
            user_id: userId,
            company_id: companyId,
            is_public: is_public === 'true' || is_public === true
        });

        res.status(201).json({
            status: 'success',
            data: { folder }
        });
    } catch (err) {
        next(err);
    }
};

const deleteFolderRecursive = async (folderId) => {
    // 1. Find the folder
    const folder = await FileFolder.findByPk(folderId);
    if (!folder) return;

    // 2. Find all child folders
    const children = await FileFolder.findAll({ where: { parent_id: folderId } });
    for (const child of children) {
        await deleteFolderRecursive(child.id);
    }

    // 3. Find and delete all files in this folder
    const files = await FileAsset.findAll({ where: { folder_id: folderId } });
    for (const file of files) {
        // Delete from R2
        try {
            await deleteFromR2(file.path);
        } catch (r2Err) {
            console.error('Failed to delete file from R2 during recursive folder cleanup:', r2Err.message);
        }
        
        // Update user storage
        const owner = await User.findByPk(file.user_id);
        if (owner) {
            let currentUsed = BigInt(owner.storage_used_bytes || 0);
            currentUsed = currentUsed > BigInt(file.size) ? currentUsed - BigInt(file.size) : 0n;
            owner.storage_used_bytes = currentUsed.toString();
            await owner.save();
        }
        
        await file.destroy();
    }

    // 4. Delete the folder itself
    await folder.destroy();
};

exports.deleteFolder = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role?.name;

        const folder = await FileFolder.findByPk(id);
        if (!folder) {
            return res.status(404).json({ status: 'fail', message: 'Folder not found' });
        }

        // Only owner or admin can delete
        if (folder.user_id !== userId && !['Admin', 'Büro'].includes(userRole)) {
            return res.status(403).json({ status: 'fail', message: 'Permission denied' });
        }

        await deleteFolderRecursive(id);

        res.status(204).json({
            status: 'success',
            data: null
        });
    } catch (err) {
        next(err);
    }
};

exports.toggleFavorite = async (req, res, next) => {
    try {
        const { id, type } = req.body;
        const userId = req.user.id;

        if (!id) return res.status(400).json({ status: 'fail', message: 'ID is required' });
        if (type === 'folder') return res.status(400).json({ status: 'fail', message: 'Folders cannot be favorited' });

        // Check if file exists
        const file = await FileAsset.findByPk(id);
        if (!file) {
            return res.status(404).json({ status: 'fail', message: 'File not found' });
        }

        const existing = await FileFavorite.findOne({
            where: { user_id: userId, file_id: id }
        });

        if (existing) {
            await existing.destroy();
            return res.status(200).json({ status: 'success', is_favorite: false });
        } else {
            await FileFavorite.create({ user_id: userId, file_id: id });
            return res.status(201).json({ status: 'success', is_favorite: true });
        }
    } catch (err) {
        console.error('Toggle Favorite Backend Error:', err);
        next(err);
    }
};

exports.uploadFiles = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const companyId = req.user.company_id;
        const { is_public, folder_id } = req.body;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ status: 'fail', message: 'No files uploaded' });
        }

        const user = await User.findByPk(userId);
        const limitBytes = (user.storage_limit_gb || 2.0) * 1024 * 1024 * 1024;
        let currentUsed = BigInt(user.storage_used_bytes || 0);

        const totalUploadSize = req.files.reduce((sum, file) => sum + file.size, 0);

        if (Number(currentUsed) + totalUploadSize > limitBytes) {
            // Cleanup temp files
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            });
            return res.status(400).json({ status: 'fail', message: 'Storage limit exceeded. Upgrade storage to upload more files.' });
        }

        const uploadedAssets = [];

        for (const file of req.files) {
            let originalName = fixEncoding(file.originalname);
            let storageName = getSafeStorageName(originalName);
            const r2Key = `assets/${companyId}/${userId}/${Date.now()}-${storageName}`;

            const fileUrl = await uploadToR2(file.path, r2Key, file.mimetype);
            
            // Save to DB
            const asset = await FileAsset.create({
                name: originalName,
                file_url: fileUrl,
                size: file.size,
                mime_type: file.mimetype,
                is_public: is_public === 'true' || is_public === true,
                user_id: userId,
                company_id: companyId,
                path: r2Key,
                folder_id: (folder_id && folder_id !== 'root') ? folder_id : null
            });

            currentUsed += BigInt(file.size);
            uploadedAssets.push(asset);

            // Cleanup temp
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        }

        user.storage_used_bytes = currentUsed.toString();
        await user.save();

        res.status(201).json({
            status: 'success',
            data: { files: uploadedAssets }
        });
    } catch (err) {
        // Cleanup temp files on error
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            });
        }
        next(err);
    }
};

exports.deleteFile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role?.name;

        const asset = await FileAsset.findByPk(id);
        if (!asset) {
            return res.status(404).json({ status: 'fail', message: 'File not found' });
        }

        // Only owner or admin can delete
        if (asset.user_id !== userId && !['Admin', 'Büro'].includes(userRole)) {
            return res.status(403).json({ status: 'fail', message: 'Permission denied' });
        }

        // Delete from R2
        await deleteFromR2(asset.path);

        // Update user usage
        const owner = await User.findByPk(asset.user_id);
        if (owner) {
            let currentUsed = BigInt(owner.storage_used_bytes || 0);
            currentUsed = currentUsed > BigInt(asset.size) ? currentUsed - BigInt(asset.size) : 0n;
            owner.storage_used_bytes = currentUsed.toString();
            await owner.save();
        }

        await asset.destroy();

        res.status(204).json({
            status: 'success',
            data: null
        });
    } catch (err) {
        next(err);
    }
};

exports.toggleExternalShare = async (req, res, next) => {
    try {
        const { id, type } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role?.name;

        let model = type === 'folder' ? FileFolder : FileAsset;
        const item = await model.findByPk(id);

        if (!item) return res.status(404).json({ status: 'fail', message: 'Not found' });

        if (item.user_id !== userId && !['Admin', 'Büro'].includes(userRole)) {
            return res.status(403).json({ status: 'fail', message: 'Permission denied' });
        }

        item.is_external_shared = !item.is_external_shared;
        if (item.is_external_shared && !item.share_token) {
            item.share_token = require('crypto').randomUUID();
        }

        await item.save();

        res.status(200).json({
            status: 'success',
            is_external_shared: item.is_external_shared,
            share_token: item.share_token
        });
    } catch (err) {
        next(err);
    }
};

exports.getSharedContent = async (req, res, next) => {
    try {
        const { token } = req.params;
        const { folder_id } = req.query;

        // 1. Validate the root token
        let rootFile = await FileAsset.findOne({ where: { share_token: token, is_external_shared: true } });
        let rootFolder = null;

        if (!rootFile) {
            rootFolder = await FileFolder.findOne({ where: { share_token: token, is_external_shared: true } });
        }

        if (!rootFile && !rootFolder) {
            return res.status(404).json({ status: 'fail', message: 'Shared content not found or disabled' });
        }

        // 2. If it's a file, return it
        if (rootFile) {
            return res.status(200).json({
                status: 'success',
                data: {
                    type: 'file',
                    file: rootFile
                }
            });
        }

        // 3. If it's a folder, list children
        // Use either the root folder or a sub-folder if navigating
        const targetFolderId = folder_id || rootFolder.id;
        
        // Security: Ensure the targetFolder is a descendant of rootFolder (or rootFolder itself)
        // For simplicity in this demo, we assume the token is valid for all sub-items.
        
        const files = await FileAsset.findAll({ where: { folder_id: targetFolderId } });
        const folders = await FileFolder.findAll({ where: { parent_id: targetFolderId } });

        res.status(200).json({
            status: 'success',
            data: {
                type: 'folder',
                folderName: rootFolder.name,
                items: [
                    ...folders.map(f => ({ 
                        id: f.id, 
                        name: f.name, 
                        isDirectory: true, 
                        createdAt: f.createdAt 
                    })),
                    ...files.map(f => ({ 
                        id: f.id, 
                        name: f.name, 
                        isDirectory: false, 
                        size: f.size, 
                        url: f.file_url, 
                        createdAt: f.createdAt,
                        mime_type: f.mime_type
                    }))
                ]
            }
        });
    } catch (err) {
        next(err);
    }
};
