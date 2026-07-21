import { describe, expect, it } from "vitest";
import { ApiError, isForbiddenError } from "./apiError";

describe("ApiError / isForbiddenError", () => {
  it("carries the HTTP status alongside the message", () => {
    const error = new ApiError(403, "Forbidden");
    expect(error.status).toBe(403);
    expect(error.message).toBe("Forbidden");
    expect(error).toBeInstanceOf(Error);
  });

  it("isForbiddenError is true only for a 403 ApiError", () => {
    expect(isForbiddenError(new ApiError(403, "nope"))).toBe(true);
    expect(isForbiddenError(new ApiError(404, "not found"))).toBe(false);
    expect(isForbiddenError(new Error("plain"))).toBe(false);
    expect(isForbiddenError("not an error")).toBe(false);
  });
});
