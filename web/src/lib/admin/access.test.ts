import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";

import { orNotFoundWhenRefused } from "./access";

const notFound = vi.hoisted(() =>
    vi.fn(() => {
        throw new Error("NOT_FOUND");
    }),
);
vi.mock("next/navigation", () => ({ notFound, redirect: vi.fn() }));

describe("orNotFoundWhenRefused", () => {
    it("gives the answer of the API", async () => {
        await expect(
            orNotFoundWhenRefused(Promise.resolve([1])),
        ).resolves.toEqual([1]);
        expect(notFound).not.toHaveBeenCalled();
    });

    it("shows the not found page when the API refuses the access", async () => {
        await expect(
            orNotFoundWhenRefused(Promise.reject(new ApiError(403, "refused"))),
        ).rejects.toThrow("NOT_FOUND");
        expect(notFound).toHaveBeenCalledOnce();
    });

    it("lets any other problem through", async () => {
        notFound.mockClear();

        await expect(
            orNotFoundWhenRefused(Promise.reject(new ApiError(500, "down"))),
        ).rejects.toThrow("down");
        expect(notFound).not.toHaveBeenCalled();
    });
});
