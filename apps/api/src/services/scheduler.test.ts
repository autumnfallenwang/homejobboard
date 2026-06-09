import cron from "node-cron";
import { describe, expect, it } from "vitest";
import { config } from "../config.js";

describe("scheduler config", () => {
  it("the default poll cron expression is valid", () => {
    expect(cron.validate(config.pollCron)).toBe(true);
  });
});
