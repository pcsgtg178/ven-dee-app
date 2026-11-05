import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { isDbSyncDisabled, setDbSyncDisabledOverride } from "../dbSyncConfig.ts";

describe("dbSyncConfig test suite", () => {
  const origEnvDisable = process.env.NEXT_PUBLIC_DISABLE_DB_SYNC;
  const origNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Reset env vars before each test
    delete process.env.NEXT_PUBLIC_DISABLE_DB_SYNC;
  });

  it("returns true when NEXT_PUBLIC_DISABLE_DB_SYNC is 'true'", () => {
    process.env.NEXT_PUBLIC_DISABLE_DB_SYNC = "true";
    assert.equal(isDbSyncDisabled(), true);
  });

  it("returns false when NEXT_PUBLIC_DISABLE_DB_SYNC is explicitly 'false'", () => {
    process.env.NEXT_PUBLIC_DISABLE_DB_SYNC = "false";
    assert.equal(isDbSyncDisabled(), false);
  });

  it("defaults to true in development mode", () => {
    delete process.env.NEXT_PUBLIC_DISABLE_DB_SYNC;
    process.env.NODE_ENV = "development";
    assert.equal(isDbSyncDisabled(), true);
  });

  it("defaults to false in production mode if no env override", () => {
    delete process.env.NEXT_PUBLIC_DISABLE_DB_SYNC;
    process.env.NODE_ENV = "production";
    assert.equal(isDbSyncDisabled(), false);
    // restore
    process.env.NODE_ENV = origNodeEnv;
  });
});
