const fs = require('fs');
const path = require('path');
const heicConvert = require('heic-convert');
const { fixEncoding } = require('./fileUtils');

/**
 * Checks if an uploaded file is a HEIC or HEIF image, and converts it to standard JPEG.
 * Also standardizes JFIF extensions and mimetypes.
 * Updates the Multer file object in-place (path, mimetype, size, originalname).
 * 
 * @param {Object} file - The Multer file object
 * @returns {Promise<Object>} - The processed file object
 */
async function processUploadedFile(file) {
    if (!file) return file;

    // Ensure originalname is fixed
    file.originalname = fixEncoding(file.originalname);
    const ext = path.extname(file.originalname).toLowerCase();

    if (['.heic', '.heif'].includes(ext)) {
        try {
            console.log(`[ImageConverter] Processing HEIC/HEIF file: ${file.originalname} (${file.path})`);
            const inputBuffer = fs.readFileSync(file.path);
            const outputBuffer = await heicConvert({
                buffer: inputBuffer,
                format: 'JPEG',
                quality: 0.85
            });

            const convertedPath = file.path + '_converted.jpg';
            fs.writeFileSync(convertedPath, outputBuffer);

            // Delete original temporary file
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }

            // Update file object properties
            file.path = convertedPath;
            file.originalname = file.originalname.replace(/\.(heic|heif)$/i, '.jpg');
            file.mimetype = 'image/jpeg';
            file.size = outputBuffer.length;
            
            console.log(`[ImageConverter] Successfully converted HEIC/HEIF to JPEG: ${file.originalname}, new size: ${file.size} bytes`);
        } catch (err) {
            console.error(`[ImageConverter ERROR] Failed to convert HEIC/HEIF file ${file.originalname}:`, err);
            // Fallback: keep the file as-is rather than failing completely
        }
    } else if (ext === '.dng') {
        try {
            console.log(`[ImageConverter] Processing DNG RAW file: ${file.originalname} (${file.path})`);
            const sharp = require('sharp');
            const convertedPath = file.path + '_converted.jpg';
            
            // Convert DNG to JPEG using sharp, applying auto-rotation based on EXIF orientation
            await sharp(file.path).rotate().jpeg({ quality: 85 }).toFile(convertedPath);

            // Delete original temporary file
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }

            // Update file object properties
            file.path = convertedPath;
            file.originalname = file.originalname.replace(/\.dng$/i, '.jpg');
            file.mimetype = 'image/jpeg';
            file.size = fs.statSync(convertedPath).size;
            
            console.log(`[ImageConverter] Successfully converted DNG to JPEG: ${file.originalname}, new size: ${file.size} bytes`);
        } catch (err) {
            console.error(`[ImageConverter ERROR] Failed to convert DNG RAW file ${file.originalname}:`, err);
            // Fallback: keep the file as-is rather than failing completely
        }
    } else if (ext === '.jfif') {
        file.originalname = file.originalname.replace(/\.jfif$/i, '.jpg');
        file.mimetype = 'image/jpeg';
        console.log(`[ImageConverter] Normalized JFIF file name and mime: ${file.originalname}`);
    }

    return file;
}

module.exports = {
    processUploadedFile
};
