import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/roboto-flex/full.css";
import "@fontsource-variable/noto-sans-hk/index.css";
import "@fontsource-variable/material-symbols-rounded/full.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto-mono/400.css";
import "@fontsource/roboto-mono/500.css";
import "./design-system/material-browser.css";
import "./design-system/m3-theme.css";
import "./design-system/m3.css";
import "./m3/app.css";
import { App } from "./app/App";

createRoot(document.getElementById("root")!).render(<App />);
