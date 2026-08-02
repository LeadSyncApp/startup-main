export const getAllowedOrigins = (): string[] => {
  const envOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
    : [];

  const defaultOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
  ];

  if (process.env.FRONTEND_URL) {
    defaultOrigins.push(process.env.FRONTEND_URL.trim());
  }
  if (process.env.API_BASE_URL) {
    defaultOrigins.push(process.env.API_BASE_URL.trim());
  }

  return Array.from(new Set([...envOrigins, ...defaultOrigins]));
};
