import jwt from 'jsonwebtoken';

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("FATAL: JWT_SECRET environment variable is missing.");
  }
  return secret;
};

export function signToken(payload: any) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '24h', algorithm: 'HS256' });
}

export function verifyToken(token: string): any {
  return jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
}

