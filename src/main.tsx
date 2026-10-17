import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// The one stylesheet: Tailwind, the faces, the tokens and the base element styles, in that order.
import "./styles/theme.css";
import { AppearanceProvider } from "./appearance/AppearanceProvider";
import { router } from "./application/router";
import { SessionProvider } from "./application/session";
import { ApplicationErrorBoundary } from "./pages/problems/ProblemPages";
import { TranslationProvider } from "./translations/TranslationProvider";
import { ToasterProvider } from "./ui/components";
import { NoticePoller } from "./application/notices";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("Application root is missing.");
}

createRoot(container).render(
  <StrictMode>
    <AppearanceProvider>
      <ApplicationErrorBoundary>
        <TranslationProvider>
          <ToasterProvider>
            <SessionProvider>
              <NoticePoller />
              <RouterProvider router={router} />
            </SessionProvider>
          </ToasterProvider>
        </TranslationProvider>
      </ApplicationErrorBoundary>
    </AppearanceProvider>
  </StrictMode>,
);
