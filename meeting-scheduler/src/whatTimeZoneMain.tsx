import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { WhatTimeZone } from "./components/WhatTimeZone";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <WhatTimeZone />
    </ErrorBoundary>
  </StrictMode>,
);
