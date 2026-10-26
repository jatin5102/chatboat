import { S3Client } from "@aws-sdk/client-s3";
import { ENV } from "./env.config.js";

export const s3Config = {
  region: ENV.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: ENV.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY || "",
  },
};

export const s3 = new S3Client(s3Config);
