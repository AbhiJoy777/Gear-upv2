import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

declare global {
  interface Window {
    __GEARUP_CONFIG__?: {
      razorpayKey?: string;
    };
  }
}

window.__GEARUP_CONFIG__ = {
  razorpayKey: import.meta.env.VITE_RAZORPAY_KEY_ID,
};

createRoot(document.getElementById("root")!).render(<App />);
