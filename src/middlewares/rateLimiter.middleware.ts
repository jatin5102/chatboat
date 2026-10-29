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
        const isLocal = req.ip === "::1" || req.ip === "127.0.0.1";
        return isLocal;
    },
});

// Stricter limiter for authentication routes (login, register)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 login/register requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many authentication attempts, please try again after 15 minutes",
    },
});
