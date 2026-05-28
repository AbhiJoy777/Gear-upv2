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

type GearUpRuntimeWindow = Window & {
  __GEARUP_CONFIG__?: {
    razorpayKey?: string;
    googleMapsKey?: string;
  };
};

const runtimeWindow = window as GearUpRuntimeWindow;

runtimeWindow.__GEARUP_CONFIG__ = {
  ...runtimeWindow.__GEARUP_CONFIG__,
  razorpayKey: import.meta.env.VITE_RAZORPAY_KEY_ID || runtimeWindow.__GEARUP_CONFIG__?.razorpayKey,
  googleMapsKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || runtimeWindow.__GEARUP_CONFIG__?.googleMapsKey,
};

createRoot(document.getElementById("root")!).render(<App />);
