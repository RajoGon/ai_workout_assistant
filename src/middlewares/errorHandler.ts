import { Request, Response, NextFunction } from "express"

export interface AppError extends Error {
  status?: number,
}
export const errorHandler = (error: AppError, req: Request, res: Response, next: NextFunction) => {
  console.error(error);
  const status = error.status || 500;
  res.status(status).json({
    message: error.message || 'Internal Server Error'
  })


}
export default errorHandler;
