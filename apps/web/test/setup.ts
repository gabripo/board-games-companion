import { cleanup, configure } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
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

// Lazy-loaded tabs can take over a second to appear when the whole suite runs in parallel.
configure({ asyncUtilTimeout: 5000 });

// happy-dom cancels Web Animations on teardown; animations are irrelevant to unit tests.
MotionGlobalConfig.skipAnimations = true;
