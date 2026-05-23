const { PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { s3Client, R2_BUCKET_NAME, R2_PUBLIC_URL } = require('../../config/r2');
const fs = require('fs');
const logger = require('../../utils/logger');

/**
 * Uploads a local file to R2
 * @param {string} localPath - Path to the local file
 * @param {string} destinationKey - Target path/name in R2 (e.g., 'tasks/file.jpg')
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} - The public URL of the uploaded file
 */
const uploadToR2 = async (localPath, destinationKey, contentType) => {
    try {
        const fileStream = fs.createReadStream(localPath);

        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: destinationKey,
            Body: fileStream,
            ContentType: contentType,
        });

        await s3Client.send(command);
        
        // Return the public URL
        return `${R2_PUBLIC_URL}/${destinationKey}`;
    } catch (error) {
        if (logger) {
            logger.error(`R2 Upload Error [${destinationKey}]: ${error.message}`);
        } else {
            console.error(`R2 Upload Error [${destinationKey}]:`, error);
        }
        throw error;
    }
};

/**
 * Lists objects in R2 with a given prefix
 * @param {string} prefix - The prefix to filter by (e.g., 'projects/1/')
 * @param {string} delimiter - The delimiter to use (e.g., '/') to group by folders
 * @returns {Promise<Object>} - The raw S3 listing response
 */
const listFromR2 = async (prefix, delimiter = '/') => {
    try {
        const command = new ListObjectsV2Command({
            Bucket: R2_BUCKET_NAME,
            Prefix: prefix,
            Delimiter: delimiter
        });

        const response = await s3Client.send(command);
        return response;
    } catch (error) {
        if (logger) {
            logger.error(`R2 List Error [${prefix}]: ${error.message}`);
        } else {
            console.error(`R2 List Error [${prefix}]:`, error);
        }
        throw error;
    }
};

/**
 * Deletes an object from R2
 * @param {string} key - The object key to delete
 */
const deleteFromR2 = async (key) => {
    try {
        const command = new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
        });
        await s3Client.send(command);
    } catch (error) {
        if (logger) {
            logger.error(`R2 Delete Error [${key}]: ${error.message}`);
        } else {
            console.error(`R2 Delete Error [${key}]:`, error);
        }
        throw error;
    }
};

/**
 * Deletes all objects with a given prefix from R2 (Recursive delete)
 * @param {string} prefix - The prefix to delete (e.g., 'projects/1/')
 */
const deletePrefixFromR2 = async (prefix) => {
    try {
        if (!prefix) return;

        // 1. List all objects with prefix
        const listCommand = new ListObjectsV2Command({
            Bucket: R2_BUCKET_NAME,
            Prefix: prefix,
        });

        const listResponse = await s3Client.send(listCommand);

        if (!listResponse.Contents || listResponse.Contents.length === 0) {
            console.log(`[R2] No objects found with prefix: ${prefix}`);
            return;
        }

        // 2. Prepare for bulk delete
        const objectsToDelete = listResponse.Contents.map(obj => ({ Key: obj.Key }));

        const deleteCommand = new DeleteObjectsCommand({
            Bucket: R2_BUCKET_NAME,
            Delete: {
                Objects: objectsToDelete,
                Quiet: true
            }
        });

        await s3Client.send(deleteCommand);
        console.log(`[R2] Successfully deleted ${objectsToDelete.length} objects with prefix: ${prefix}`);

        // 3. Handle pagination if more than 1000 objects
        if (listResponse.IsTruncated) {
            await deletePrefixFromR2(prefix); // Recursive call for next page
        }
    } catch (error) {
        if (logger) {
            logger.error(`R2 Prefix Delete Error [${prefix}]: ${error.message}`);
        } else {
            console.error(`R2 Prefix Delete Error [${prefix}]:`, error);
        }
        throw error;
    }
};

module.exports = {
    uploadToR2,
    deleteFromR2,
    listFromR2,
    deletePrefixFromR2
};
