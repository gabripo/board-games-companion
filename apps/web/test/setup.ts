import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

afterEach(() => {
  cleanup();
  localStorage.clear();
  resetGamePrefsCache();
});

import { initI18n } from "../src/i18n";
import { resetGamePrefsCache } from "../src/settings/settings";

initI18n();
