import passport from "passport";
import { Strategy, ExtractJwt } from "passport-jwt";
import { prisma } from "./prisma.config.js";

passport.use(
    new Strategy(
        {
            // ✅ Automatically read BOTH header + cookie
            jwtFromRequest: ExtractJwt.fromExtractors([
                ExtractJwt.fromAuthHeaderAsBearerToken(),
                (req: any) => req?.cookies?.accessToken || null,
            ]),
            secretOrKey: process.env.ACCESS_TOKEN_SECRET!,
        },
        async (payload, done) => {
            try {
                const user = await prisma.user.findUnique({
                    where: { id: payload.id },
                });

                if (!user) {
                    return done(null, false);
                }

                return done(null, user);
            } catch (err) {
                return done(err, false);
            }
        },
    ),
);

export default passport;
