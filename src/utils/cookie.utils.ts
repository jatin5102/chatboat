import { Response } from "express";
import { ENV } from "../config/env.config.js";

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
) => {
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "none",
    maxAge: ENV.ACCESS_TOKEN_EXPIRY_MS,
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "none",
    maxAge: ENV.REFRESH_TOKEN_EXPIRY_MS,
  });
};
