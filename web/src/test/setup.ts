import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// A CI machine can be slow: 1 second (the default) is too short to wait for
// an answer. A test that really fails only takes a little longer to say so.
configure({ asyncUtilTimeout: 4000 });

afterEach(() => {
    cleanup();
});
