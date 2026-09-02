// backend/config/s3.js
const { S3Client } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  region: "us-east-1", 
  endpoint: "https://nyc3.digitaloceanspaces.com", 
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
  },
});

module.exports = { s3Client };