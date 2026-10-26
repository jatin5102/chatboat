import jwt, { SignOptions, VerifyOptions } from "jsonwebtoken";
import { ENV } from "../config/env.config.js";

export const signAccessToken = (payload: object) =>
  jwt.sign(payload, ENV.ACCESS_TOKEN_SECRET, {
    expiresIn: ENV.ACCESS_TOKEN_EXPIRY as SignOptions["expiresIn"],
  });

export const signRefreshToken = (payload: object) =>
  jwt.sign(payload, ENV.REFRESH_TOKEN_SECRET, {
    expiresIn: ENV.REFRESH_TOKEN_EXPIRY as SignOptions["expiresIn"],
  });
