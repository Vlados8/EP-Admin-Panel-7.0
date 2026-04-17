const { S3Client } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');

dotenv.config();

const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

module.exports = {
    s3Client,
    R2_BUCKET_NAME,
    R2_PUBLIC_URL
};
