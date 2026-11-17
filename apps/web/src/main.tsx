import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { defaultRepository, RepositoryProvider } from "./data/repository";
import { initI18n } from "./i18n";
import { registerServiceWorker } from "./offline/registerServiceWorker";
import { createAppRouter } from "./router";
import "./styles.css";

initI18n();
const router = createAppRouter();
const repository = defaultRepository();

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");
createRoot(root).render(
  <StrictMode>
    <RepositoryProvider repository={repository}>
      <RouterProvider router={router} />
    </RepositoryProvider>
  </StrictMode>,
);

registerServiceWorker();
