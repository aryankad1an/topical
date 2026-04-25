import {
  createKindeServerClient,
  GrantType,
  type SessionManager,
  type UserType,
} from "@kinde-oss/kinde-typescript-sdk";
import { type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { z } from "zod";

const KindeEnv = z.object({
  KINDE_DOMAIN: z.string(),
  KINDE_CLIENT_ID: z.string(),
  KINDE_CLIENT_SECRET: z.string(),
  KINDE_REDIRECT_URI: z.string().url(),
  KINDE_LOGOUT_REDIRECT_URI: z.string().url(),
});

// Parse env gracefully — don't crash if missing
const kindeEnvResult = KindeEnv.safeParse(process.env);

const isKindeConfigured = kindeEnvResult.success;

if (!isKindeConfigured) {
  console.warn(
    "⚠️  Kinde environment variables are not configured. Auth will be disabled.\n" +
    "   Copy .env.example to .env and fill in your Kinde credentials to enable authentication.\n"
  );
}

const ProcessEnv = kindeEnvResult.success ? kindeEnvResult.data : null;

// Client for authorization code flow (only created if env is configured)
export const kindeClient = ProcessEnv
  ? createKindeServerClient(GrantType.AUTHORIZATION_CODE, {
      authDomain: ProcessEnv.KINDE_DOMAIN,
      clientId: ProcessEnv.KINDE_CLIENT_ID,
      clientSecret: ProcessEnv.KINDE_CLIENT_SECRET,
      redirectURL: ProcessEnv.KINDE_REDIRECT_URI,
      logoutRedirectURL: ProcessEnv.KINDE_LOGOUT_REDIRECT_URI,
    })
  : null;

export const sessionManager = (c: Context): SessionManager => ({
  async getSessionItem(key: string) {
    const result = getCookie(c, key);
    return result;
  },
  async setSessionItem(key: string, value: unknown) {
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    } as const;
    if (typeof value === "string") {
      setCookie(c, key, value, cookieOptions);
    } else {
      setCookie(c, key, JSON.stringify(value), cookieOptions);
    }
  },
  async removeSessionItem(key: string) {
    deleteCookie(c, key);
  },
  async destroySession() {
    ["id_token", "access_token", "user", "refresh_token"].forEach((key) => {
      deleteCookie(c, key);
    });
  },
});

type Env = {
  Variables: {
    user: UserType;
  };
};

export const getUser = createMiddleware<Env>(async (c, next) => {
  // If Kinde is not configured, return a mock user for development
  if (!kindeClient) {
    c.set("user", {
      id: "dev-user",
      given_name: "Dev",
      family_name: "User",
      email: "dev@localhost",
      picture: null,
    } as unknown as UserType);
    await next();
    return;
  }

  try {
    const manager = sessionManager(c);
    const isAuthenticated = await kindeClient.isAuthenticated(manager);
    if (!isAuthenticated) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const user = await kindeClient.getUserProfile(manager);
    c.set("user", user);
    await next();
  } catch (e) {
    console.error(e);
    return c.json({ error: "Unauthorized" }, 401);
  }
});

export { isKindeConfigured };
