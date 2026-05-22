import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { createHmac } from "node:crypto";

const port = Number(process.env.PORT) || 5173;
const basePath = process.env.BASE_PATH || "/";

const readBody = (req: any) => new Promise<any>((resolve, reject) => {
  let body = "";
  req.on("data", (chunk: Buffer) => {
    body += chunk.toString();
  });
  req.on("end", () => {
    try {
      resolve(body ? JSON.parse(body) : {});
    } catch (err) {
      reject(err);
    }
  });
  req.on("error", reject);
});

const sendJson = (res: any, status: number, payload: any) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

const registerRazorpayApi = (middlewares: any) => {
  middlewares.use("/api/razorpay/create-order", async (req: any, res: any) => {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const keyId = process.env.VITE_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      sendJson(res, 500, { error: "Payment gateway not configured" });
      return;
    }

    try {
      const body = await readBody(req);
      const amount = Number(body.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        sendJson(res, 400, { error: "Invalid payment amount" });
        return;
      }

      const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          currency: "INR",
          receipt: body.receipt || `gearup-${Date.now()}`,
        }),
      });

      if (!orderResponse.ok) {
        console.error("Razorpay order creation failed:", await orderResponse.text());
        sendJson(res, 502, { error: "Could not create payment order" });
        return;
      }

      const order = await orderResponse.json();
      sendJson(res, 200, {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId,
      });
    } catch (err) {
      console.error("Razorpay order route failed:", err);
      sendJson(res, 500, { error: "Could not create payment order" });
    }
  });

  middlewares.use("/api/razorpay/verify-payment", async (req: any, res: any) => {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      sendJson(res, 500, { error: "Payment gateway not configured" });
      return;
    }

    try {
      const body = await readBody(req);
      const orderId = String(body.orderId || "");
      const paymentId = String(body.paymentId || "");
      const signature = String(body.signature || "");

      if (!orderId || !paymentId || !signature) {
        sendJson(res, 400, { error: "Missing payment verification fields" });
        return;
      }

      const expectedSignature = createHmac("sha256", keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      if (expectedSignature !== signature) {
        sendJson(res, 400, { error: "Invalid payment signature" });
        return;
      }

      sendJson(res, 200, { verified: true });
    } catch (err) {
      console.error("Razorpay verification route failed:", err);
      sendJson(res, 500, { error: "Could not verify payment" });
    }
  });
};

const razorpayApiPlugin = () => ({
  name: "gearup-razorpay-api",
  configureServer(server: any) {
    registerRazorpayApi(server.middlewares);
  },
  configurePreviewServer(server: any) {
    registerRazorpayApi(server.middlewares);
  },
});

export default defineConfig({
  base: basePath,
  plugins: [razorpayApiPlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
