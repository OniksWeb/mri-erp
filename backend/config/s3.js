// backend/config/s3.js
import { S3Client } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
  region: "us-east-1", // DO uses this but it doesn’t matter much
  endpoint: "https://nyc3.digitaloceanspaces.com", // replace with your region
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
  },
});
