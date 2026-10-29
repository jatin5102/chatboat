import { RequestHandler } from "express";
import passport from "passport";

export const authenticate = passport.authenticate("jwt", { session: false });

export const authorize =
    (roles: string[]): RequestHandler =>
    (req: any, res, next) => {
        const user = req.user;
        if (!user) return res.status(401).json({ message: "Unauthorized" });
        if (!roles.includes(user.role)) return res.status(403).json({ message: "Forbidden" });
        next();
    };
