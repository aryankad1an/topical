// Complete Vercel API - All routes
const RAG_URL = process.env.DEPLOYED_RAG_URL || "https://manishk5507--topicmarker-rag-fastapi-app.modal.run";

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const url = new URL(req.url, `https://${req.headers.host}`);
  const path = url.pathname;
  const pathParts = path.split("/").filter(Boolean); // ['api', 'topics', '123']

  try {
    // ============ DEBUG ============
    if (path.includes("/debug")) {
      return res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        hasKindeDomain: !!process.env.KINDE_DOMAIN,
        hasKindeClientId: !!process.env.KINDE_CLIENT_ID,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasRagUrl: !!process.env.DEPLOYED_RAG_URL,
      });
    }

    // ============ AUTH ROUTES ============
    if (path.endsWith("/login")) {
      const kindeClient = await getKindeClient();
      const sessionManager = createCookieSessionManager(req, res);
      const loginUrl = await kindeClient.login(sessionManager);
      res.setHeader("Location", loginUrl.toString());
      return res.status(302).end();
    }

    if (path.endsWith("/register")) {
      const kindeClient = await getKindeClient();
      const sessionManager = createCookieSessionManager(req, res);
      const registerUrl = await kindeClient.register(sessionManager);
      res.setHeader("Location", registerUrl.toString());
      return res.status(302).end();
    }

    if (path.endsWith("/callback")) {
      const kindeClient = await getKindeClient();
      const sessionManager = createCookieSessionManager(req, res);
      await kindeClient.handleRedirectToApp(sessionManager, url);
      res.setHeader("Location", "/");
      return res.status(302).end();
    }

    if (path.endsWith("/logout")) {
      const kindeClient = await getKindeClient();
      const sessionManager = createCookieSessionManager(req, res);
      const logoutUrl = await kindeClient.logout(sessionManager);
      res.setHeader("Location", logoutUrl.toString());
      return res.status(302).end();
    }

    if (path.endsWith("/me")) {
      const user = await getAuthenticatedUser(req, res);
      if (!user) return;
      
      // Cache user in database
      try {
        const db = await getDb();
        const existing = await db`SELECT * FROM users WHERE id = ${user.id} LIMIT 1`;
        if (!existing.length) {
          await db`INSERT INTO users (id, given_name, family_name, email) VALUES (${user.id}, ${user.given_name}, ${user.family_name}, ${user.email})`;
        }
      } catch (e) { console.error("User cache error:", e); }
      
      return res.status(200).json({ user });
    }

    // Get user by ID (public)
    if (path.match(/\/api\/user\/[^/]+$/)) {
      const userId = pathParts[pathParts.length - 1];
      const db = await getDb();
      const users = await db`SELECT id, given_name, family_name FROM users WHERE id = ${userId} LIMIT 1`;
      if (!users.length) return res.status(404).json({ error: "User not found" });
      return res.status(200).json({ user: toCamelCase(users[0]) });
    }

    // ============ TOPICS ROUTES ============
    if (path.match(/\/api\/topics/)) {
      const user = await getAuthenticatedUser(req, res);
      if (!user) return;
      const db = await getDb();

      // GET /api/topics - list all
      if (path === "/api/topics" && req.method === "GET") {
        const topics = await db`SELECT * FROM topics WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 100`;
        return res.status(200).json({ topics: toCamelCase(topics) });
      }

      // POST /api/topics - create
      if (path === "/api/topics" && req.method === "POST") {
        const body = await getBody(req);
        const result = await db`
          INSERT INTO topics (user_id, axios_wing, topic, difficulty, mdx_content, main_topic, parent_topic, is_subtopic)
          VALUES (${user.id}, ${body.axiosWing}, ${body.topic}, ${body.difficulty}, ${body.mdxContent}, ${body.mainTopic || null}, ${body.parentTopic || null}, ${body.isSubtopic || false})
          RETURNING *`;
        return res.status(201).json(toCamelCase(result[0]));
      }

      // GET /api/topics/by-difficulty/:difficulty
      if (path.match(/\/api\/topics\/by-difficulty\/\w+/)) {
        const difficulty = pathParts[pathParts.length - 1];
        const topics = await db`SELECT * FROM topics WHERE user_id = ${user.id} AND difficulty = ${difficulty} ORDER BY created_at DESC`;
        return res.status(200).json({ topics: toCamelCase(topics) });
      }

      // GET /api/topics/by-wing/:wing
      if (path.match(/\/api\/topics\/by-wing\/\w+/)) {
        const wing = pathParts[pathParts.length - 1];
        const topics = await db`SELECT * FROM topics WHERE user_id = ${user.id} AND axios_wing = ${wing} ORDER BY created_at DESC`;
        return res.status(200).json({ topics: toCamelCase(topics) });
      }

      // GET/PUT/DELETE /api/topics/:id
      const topicIdMatch = path.match(/\/api\/topics\/(\d+)$/);
      if (topicIdMatch) {
        const id = parseInt(topicIdMatch[1]);
        
        if (req.method === "GET") {
          const topics = await db`SELECT * FROM topics WHERE user_id = ${user.id} AND id = ${id} LIMIT 1`;
          if (!topics.length) return res.status(404).json({ error: "Not found" });
          return res.status(200).json({ topic: toCamelCase(topics[0]) });
        }
        
        if (req.method === "PUT") {
          const body = await getBody(req);
          const result = await db`
            UPDATE topics SET axios_wing = ${body.axiosWing}, topic = ${body.topic}, difficulty = ${body.difficulty}, 
            mdx_content = ${body.mdxContent}, main_topic = ${body.mainTopic || null}, parent_topic = ${body.parentTopic || null},
            is_subtopic = ${body.isSubtopic || false}, updated_at = NOW()
            WHERE user_id = ${user.id} AND id = ${id} RETURNING *`;
          if (!result.length) return res.status(404).json({ error: "Not found" });
          return res.status(200).json({ topic: toCamelCase(result[0]) });
        }
        
        if (req.method === "DELETE") {
          const result = await db`DELETE FROM topics WHERE user_id = ${user.id} AND id = ${id} RETURNING *`;
          if (!result.length) return res.status(404).json({ error: "Not found" });
          return res.status(200).json({ topic: toCamelCase(result[0]) });
        }
      }
    }

    // ============ LESSON PLANS ROUTES ============
    if (path.match(/\/api\/lessonPlans/)) {
      const db = await getDb();

      // Helper to parse and convert lesson plan
      const parseLessonPlan = (plan) => {
        if (!plan) return plan;
        const converted = toCamelCase(plan);
        // Ensure topics is an array (parse if string)
        if (typeof converted.topics === 'string') {
          converted.topics = JSON.parse(converted.topics);
        }
        return converted;
      };

      // GET /api/lessonPlans/public - no auth needed
      if (path === "/api/lessonPlans/public" && req.method === "GET") {
        const plans = await db`SELECT * FROM lesson_plans WHERE is_public = true ORDER BY created_at DESC LIMIT 100`;
        return res.status(200).json({ lessonPlans: plans.map(parseLessonPlan) });
      }

      // GET /api/lessonPlans/public/:id - no auth needed
      const publicIdMatch = path.match(/\/api\/lessonPlans\/public\/(\d+)$/);
      if (publicIdMatch && req.method === "GET") {
        const id = parseInt(publicIdMatch[1]);
        const plans = await db`SELECT * FROM lesson_plans WHERE id = ${id} AND is_public = true LIMIT 1`;
        if (!plans.length) return res.status(404).json({ error: "Not found" });
        return res.status(200).json(parseLessonPlan(plans[0]));
      }

      // GET /api/lessonPlans/check-public/:id - no auth needed
      const checkPublicMatch = path.match(/\/api\/lessonPlans\/check-public\/(\d+)$/);
      if (checkPublicMatch && req.method === "GET") {
        const id = parseInt(checkPublicMatch[1]);
        const plans = await db`SELECT id, is_public FROM lesson_plans WHERE id = ${id} LIMIT 1`;
        if (!plans.length) return res.status(200).json({ exists: false, isPublic: false });
        return res.status(200).json({ exists: true, isPublic: Boolean(plans[0].is_public) });
      }

      // Auth required for other lesson plan routes
      const user = await getAuthenticatedUser(req, res);
      if (!user) return;

      // GET /api/lessonPlans - list user's plans
      if (path === "/api/lessonPlans" && req.method === "GET") {
        const plans = await db`SELECT * FROM lesson_plans WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 100`;
        return res.status(200).json({ lessonPlans: plans.map(parseLessonPlan) });
      }

      // POST /api/lessonPlans - create
      if (path === "/api/lessonPlans" && req.method === "POST") {
        const body = await getBody(req);
        const result = await db`
          INSERT INTO lesson_plans (user_id, name, main_topic, topics, is_public)
          VALUES (${user.id}, ${body.name}, ${body.mainTopic}, ${JSON.stringify(body.topics)}, ${body.isPublic || false})
          RETURNING *`;
        return res.status(201).json(parseLessonPlan(result[0]));
      }

      // GET/PUT/DELETE /api/lessonPlans/:id
      const planIdMatch = path.match(/\/api\/lessonPlans\/(\d+)$/);
      if (planIdMatch) {
        const id = parseInt(planIdMatch[1]);
        
        if (req.method === "GET") {
          const plans = await db`SELECT * FROM lesson_plans WHERE user_id = ${user.id} AND id = ${id} LIMIT 1`;
          if (!plans.length) return res.status(404).json({ error: "Not found" });
          return res.status(200).json(parseLessonPlan(plans[0]));
        }
        
        if (req.method === "PUT") {
          const body = await getBody(req);
          const result = await db`
            UPDATE lesson_plans SET name = ${body.name}, main_topic = ${body.mainTopic}, 
            topics = ${JSON.stringify(body.topics)}, is_public = ${body.isPublic || false}, updated_at = NOW()
            WHERE user_id = ${user.id} AND id = ${id} RETURNING *`;
          if (!result.length) return res.status(404).json({ error: "Not found" });
          return res.status(200).json(parseLessonPlan(result[0]));
        }
        
        if (req.method === "DELETE") {
          await db`DELETE FROM lesson_plans WHERE user_id = ${user.id} AND id = ${id}`;
          return res.status(204).end();
        }
      }
    }

    // ============ RAG ROUTES ============
    if (path.match(/\/api\/rag\//)) {
      const user = await getAuthenticatedUser(req, res);
      if (!user) return;

      const ragPath = path.replace("/api/rag", "");
      const body = req.method === "POST" ? await getBody(req) : null;

      // Proxy to RAG service
      try {
        const response = await fetch(`${RAG_URL}/rag${ragPath}`, {
          method: req.method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });

        const contentType = response.headers.get("content-type") || "";
        
        if (contentType.includes("application/json")) {
          const data = await response.json();
          return res.status(response.status).json(data);
        } else {
          const text = await response.text();
          res.setHeader("Content-Type", "text/plain");
          return res.status(response.status).send(text);
        }
      } catch (error) {
        console.error("RAG error:", error);
        return res.status(500).json({ error: "RAG service error", message: error.message });
      }
    }

    return res.status(404).json({ error: "Not found", path });
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: "Server error", message: error.message });
  }
}

// ============ HELPERS ============

// Convert snake_case to camelCase
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Convert object keys from snake_case to camelCase
function toCamelCase(obj) {
  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }
  // Preserve Date objects - convert to ISO string for JSON serialization
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }
  // Handle plain objects (not Date, RegExp, etc.)
  if (typeof obj === 'object' && obj.constructor === Object) {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = snakeToCamel(key);
      acc[camelKey] = toCamelCase(obj[key]);
      return acc;
    }, {});
  }
  // Return primitives and other types as-is
  return obj;
}

async function getBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  return {};
}

// Lazy Database
let _db = null;
async function getDb() {
  if (!_db) {
    const postgres = (await import("postgres")).default;
    _db = postgres(process.env.DATABASE_URL);
  }
  return _db;
}

// Lazy Kinde client
let _kindeClient = null;
async function getKindeClient() {
  if (!_kindeClient) {
    const { createKindeServerClient, GrantType } = await import("@kinde-oss/kinde-typescript-sdk");
    _kindeClient = createKindeServerClient(GrantType.AUTHORIZATION_CODE, {
      authDomain: process.env.KINDE_DOMAIN,
      clientId: process.env.KINDE_CLIENT_ID,
      clientSecret: process.env.KINDE_CLIENT_SECRET,
      redirectURL: process.env.KINDE_REDIRECT_URI,
      logoutRedirectURL: process.env.KINDE_LOGOUT_REDIRECT_URI,
    });
  }
  return _kindeClient;
}

// Get authenticated user
async function getAuthenticatedUser(req, res) {
  try {
    const kindeClient = await getKindeClient();
    const sessionManager = createCookieSessionManager(req, res);
    const isAuthenticated = await kindeClient.isAuthenticated(sessionManager);
    if (!isAuthenticated) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }
    return await kindeClient.getUserProfile(sessionManager);
  } catch (error) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
}

// Cookie session manager
function createCookieSessionManager(req, res) {
  const cookies = parseCookies(req.headers.cookie || "");
  const cookiesToSet = [];
  
  return {
    async getSessionItem(key) { return cookies[key]; },
    async setSessionItem(key, value) {
      const val = typeof value === "string" ? value : JSON.stringify(value);
      cookiesToSet.push(`${key}=${val}; HttpOnly; Secure; SameSite=Lax; Path=/`);
      res.setHeader("Set-Cookie", cookiesToSet);
    },
    async removeSessionItem(key) {
      cookiesToSet.push(`${key}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
      res.setHeader("Set-Cookie", cookiesToSet);
    },
    async destroySession() {
      ["id_token", "access_token", "user", "refresh_token", "ac-state-key"].forEach(key => {
        cookiesToSet.push(`${key}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
      });
      res.setHeader("Set-Cookie", cookiesToSet);
    },
  };
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(";").forEach(cookie => {
      const [name, ...rest] = cookie.split("=");
      cookies[name.trim()] = rest.join("=").trim();
    });
  }
  return cookies;
}
