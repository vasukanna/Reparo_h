import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Stripe initialization
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Create Stripe Checkout Session
  app.post("/api/create-checkout-session", async (req, res) => {
    const { userId, email, priceId, mode = "subscription", workerId } = req.body;

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: "Stripe secret key not configured" });
    }

    try {
      const queryParams = new URLSearchParams();
      queryParams.set('session_id', '{CHECKOUT_SESSION_ID}');
      if (workerId) queryParams.set('workerId', workerId);

      const sessionConfig: any = {
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId || process.env.STRIPE_PRICE_ID,
            quantity: 1,
          },
        ],
        mode: mode,
        success_url: `${process.env.APP_URL || "http://localhost:3000"}/subscription/success?${queryParams.toString()}`,
        cancel_url: `${process.env.APP_URL || "http://localhost:3000"}/subscription/cancel`,
        customer_email: email,
        client_reference_id: userId,
      };

      if (mode === "subscription") {
        sessionConfig.subscription_data = {
          trial_period_days: 7, // 7-day free trial
        };
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error("Stripe error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
