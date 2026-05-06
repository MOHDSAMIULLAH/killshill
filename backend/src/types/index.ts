export interface AppError extends Error {
  statusCode?: number;
  errors?: string[];
}
