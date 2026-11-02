import rateLimit from "express-rate-limit";

// General API rate limiter
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000, // Increase global limit to 2000
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        success: false,
        message: "Too many requests from this IP, please try again after 15 minutes",
    },
    // Skip rate limiting for specific conditions (e.g., local development or internal IPs)
    skip: (req) => {
        const isLocal =
            req.ip === "::1" ||
            req.ip === "127.0.0.1" ||
            req.ip === "::ffff:127.0.0.1" ||
            process.env.NODE_ENV !== "production";
        return isLocal;
    },
});

// Stricter limiter for authentication routes (login, register)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === "production" ? 50 : 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many authentication attempts, please try again after 15 minutes",
    },
    skip: (req) => {
        const isLocal =
            req.ip === "::1" ||
            req.ip === "127.0.0.1" ||
            req.ip === "::ffff:127.0.0.1" ||
            process.env.NODE_ENV !== "production";
        return isLocal;
    },
});
