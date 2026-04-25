import { createMiddleware } from "hono/factory";
import { type Context } from "hono";
import { getUser } from "../kinde";

/**
 * Middleware to check if a user has a specific role
 * @param role The role to check for
 * @returns A middleware that checks if the user has the specified role
 */
export const hasRole = (role: string) => {
  return createMiddleware(async (c: Context, next) => {
    // First apply the getUser middleware to ensure we have a user
    await getUser(c, async () => {});
    
    const user = c.var.user;
    
    // If no user is found, return unauthorized
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    
    // Check if the user has the required role
    const userRoles = user.roles || [];
    if (!userRoles.includes(role)) {
      return c.json({ error: "Forbidden: Insufficient permissions" }, 403);
    }
    
    // User has the required role, proceed
    await next();
  });
};

/**
 * Middleware to check if a user has any of the specified roles
 * @param roles Array of roles to check for
 * @returns A middleware that checks if the user has any of the specified roles
 */
export const hasAnyRole = (roles: string[]) => {
  return createMiddleware(async (c: Context, next) => {
    // First apply the getUser middleware to ensure we have a user
    await getUser(c, async () => {});
    
    const user = c.var.user;
    
    // If no user is found, return unauthorized
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    
    // Check if the user has any of the required roles
    const userRoles = user.roles || [];
    const hasRequiredRole = roles.some(role => userRoles.includes(role));
    
    if (!hasRequiredRole) {
      return c.json({ error: "Forbidden: Insufficient permissions" }, 403);
    }
    
    // User has at least one of the required roles, proceed
    await next();
  });
};

/**
 * Middleware to check if a user has all of the specified roles
 * @param roles Array of roles to check for
 * @returns A middleware that checks if the user has all of the specified roles
 */
export const hasAllRoles = (roles: string[]) => {
  return createMiddleware(async (c: Context, next) => {
    // First apply the getUser middleware to ensure we have a user
    await getUser(c, async () => {});
    
    const user = c.var.user;
    
    // If no user is found, return unauthorized
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    
    // Check if the user has all of the required roles
    const userRoles = user.roles || [];
    const hasAllRequiredRoles = roles.every(role => userRoles.includes(role));
    
    if (!hasAllRequiredRoles) {
      return c.json({ error: "Forbidden: Insufficient permissions" }, 403);
    }
    
    // User has all of the required roles, proceed
    await next();
  });
};
