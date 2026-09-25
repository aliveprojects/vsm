import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import { initStore, loadScenarios } from "./store/db.js";
import { validateScenario } from "./engine/scenarioEngine.js";
import { buildApiRouter } from "./routes/api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const FRONTEND_DIST = path.resolve(__dirname, "../../frontend/dist");

initStore();

const scenarios = loadScenarios();
for (const s of Object.values(scenarios)) {
  const errors = validateScenario(s);
  if (errors.length) {
    console.warn(`[scenario:${s.id}] validation:`, errors);
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

const openapiPath = path.resolve(__dirname, "./openapi.yaml");
const openapi = YAML.parse(fs.readFileSync(openapiPath, "utf8"));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi));
app.get("/api/openapi.json", (_req, res) => res.json(openapi));

app.use("/api", buildApiRouter());

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});

app.listen(PORT, () => {
  console.log(`Проводник.400 API → http://localhost:${PORT}`);
  console.log(`Swagger UI       → http://localhost:${PORT}/api/docs`);
  console.log(`Сценариев загружено: ${Object.keys(scenarios).length}`);
});
