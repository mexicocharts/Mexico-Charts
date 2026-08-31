import express, { type Express } from "express";
import compression from "compression";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { optionalClerkAuth } from "./lib/auth";
import { stripeWebhookHandler } from "./routes/stripe-webhook";

const app: Express = express();

// Compress JSON/text responses without changing endpoint cache or freshness semantics.
app.use(compression({ threshold: 1024 }));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(optionalClerkAuth);
app.post("/api/monitoring/stripe-webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
