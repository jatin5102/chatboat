import { Response } from "express";

// interface ApiResponse<T = any> {
//      status: "success" | "fail" | "error";
//      code: number;
//      message: string;
//      data?: T;
//      errors?: any;
// }

/**
 * For successful responses
 */
// export const successResponse = <T>(
//      res: Response,
//      code: number,
//      message: string,
//      data?: T
// ): Response<ApiResponse<T>> => {
//      return res.status(code).json({
//           status: "success",
//           // code,
//           message,
//           data,
//      });
// };

export const successResponse = <T>(
  res: Response,
  code: number,
  message: string,
  payload?: T,
): Response => {
  // detect paginated payload
  const isPaginated =
    payload &&
    typeof payload === "object" &&
    "data" in (payload as any) &&
    "pagination" in (payload as any);

  return res.status(code).json({
    status: "success",
    message,
    ...(isPaginated
      ? payload // spread only for pagination
      : { data: payload }), // wrap single record
  });
};
