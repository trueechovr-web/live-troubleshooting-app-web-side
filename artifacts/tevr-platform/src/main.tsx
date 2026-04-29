import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply theme before first render to prevent flash
const stored = localStorage.getItem("tevr-theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
if (stored === "dark" || (!stored && prefersDark)) {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")!).render(<App />);
