const path = require('path');
const crypto = require('crypto');

/**
 * Fixes encoding issues where UTF-8 bytes were interpreted as Latin-1 by Multer/Busboy.
 * e.g., "ÃÂ¼ÃÂ°Ã_" -> "марта"
 * @param {string} str - The string to fix
 * @returns {string} - The corrected UTF-8 string
 */
const fixEncoding = (str) => {
    if (!str) return str;
    try {
        // First try to detect if it's already correct UTF-8 or if it's the broken Latin-1 representation
        // The pattern ÃÂ is very common in broken UTF-8-as-Latin-1
        const hasBrokenPattern = /[\u00C0-\u00FF]/.test(str);
        if (!hasBrokenPattern) return str;

        const buf = Buffer.from(str, 'latin1');
        const utf8 = buf.toString('utf8');
        
        // Basic check if the result is valid and contains meaningful characters (like Cyrillic)
        // or just doesn't contain the replacement character
        if (utf8.includes('\ufffd')) return str; 
        
        return utf8;
    } catch {
        return str;
    }
};

/**
 * Generates a safe storage name for R2/S3 using a UUID.
 * Keeps the original extension if possible.
 * @param {string} originalname - The original filename
 * @returns {string} - A safe unique filename (e.g., "550e8400-e29b-41d4-a716-446655440000.png")
 */
const getSafeStorageName = (originalname) => {
    const ext = path.extname(originalname || '').toLowerCase();
    const uniqueId = crypto.randomUUID();
    return `${uniqueId}${ext}`;
};

module.exports = {
    fixEncoding,
    getSafeStorageName
};
