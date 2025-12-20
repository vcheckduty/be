import jwt from 'jsonwebtoken';
import { UserRole } from '@/models/User';

if (!process.env.JWT_SECRET) {
  throw new Error('Please define the JWT_SECRET environment variable inside .env.local');
}

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Token payload interface
 */
export interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  role: UserRole;
}

/**
 * Generate JWT token
 * @param payload - User information to encode in token
 * @param expiresIn - Token expiration time (default: 7 days)
 * @returns JWT token string
 */
export function generateToken(
  payload: TokenPayload,
  expiresIn: string = '7d'
): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
    issuer: 'vcheck-api',
  });
}

/**
 * Verify and decode JWT token
 * @param token - JWT token string
 * @returns Decoded token payload or null if invalid
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'vcheck-api',
    }) as TokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from Authorization header
 * @param authHeader - Authorization header value
 * @returns Token string or null
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  
  // Expected format: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}

/**
 * Check if user has required role
 * @param userRole - User's role
 * @param allowedRoles - Array of allowed roles
 * @returns boolean
 */
export function hasRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * Role hierarchy for authorization
 * Admin > Supervisor > Officer
 */
export function hasMinimumRole(userRole: UserRole, minimumRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    [UserRole.OFFICER]: 1,
    [UserRole.SUPERVISOR]: 2,
    [UserRole.ADMIN]: 3,
  };

  return roleHierarchy[userRole] >= roleHierarchy[minimumRole];
}
