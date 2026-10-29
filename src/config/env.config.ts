export const ENV = {
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET!,
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET!,
    ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || "3h",
    REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || "7d",
    ACCESS_TOKEN_EXPIRY_MS: parseInt(process.env.ACCESS_TOKEN_EXPIRY_MS || "10800000"),
    REFRESH_TOKEN_EXPIRY_MS: parseInt(process.env.REFRESH_TOKEN_EXPIRY_MS || "604800000"),

    // S3 Bucket
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET!,
    AWS_S3_PUBLIC: process.env.AWS_S3_PUBLIC!,
    AWS_REGION: process.env.AWS_REGION!,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID!,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY!,

    // SMTP Credentials
    SMTP_HOST: process.env.SMTP_HOST!,
    SMTP_PORT: parseInt(process.env.SMTP_PORT!),
    SMTP_USER: process.env.SMTP_USER!,
    SMTP_PASS: process.env.SMTP_PASS!,
    FROM_EMAIL: process.env.FROM_EMAIL!,
    TO_EMAIL: process.env.TO_EMAIL!,
    CC_EMAIL: process.env.CC_EMAIL!,

    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
};
