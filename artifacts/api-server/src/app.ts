import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

// Dynamic import for connect-pg-simple (CommonJS module)
import connectPgSimple from "connect-pg-simple";

const PgStore = connectPgSimple(session);

const app: Express = express();

// Trust reverse proxy (Replit's proxy terminates TLS)
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(
  cors({
    origin: true, // reflect request origin (same-domain in Replit)
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" })); // allow base64 image payloads
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  logger.warn("SESSION_SECRET is not set — using fallback (set it for production)");
}

app.use(
  session({
    store: new PgStore({
      pool,
      tableName: "user_sessions",
    }),
    secret: sessionSecret ?? "ardana-dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Replit dev uses HTTP internally even though the browser sees HTTPS
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: "lax",
    },
  }),
);

app.use("/api", router);

export default app;
