import { describe, it, expect, vi, beforeEach } from "vitest";
import { StorageAdapter, storageConfigFromEnv, resetStorage, getStorage } from "./adapter.ts";

// ─── Mock AWS SDK ─────────────────────────────────────────────────────────────

vi.mock("@aws-sdk/client-s3", () => {
  const send = vi.fn();
  const S3Client = vi.fn().mockImplementation(() => ({ send }));
  const PutObjectCommand = vi.fn();
  const GetObjectCommand = vi.fn();
  const HeadObjectCommand = vi.fn();
  const DeleteObjectCommand = vi.fn();
  return { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, send };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://storage.example.com/signed?token=abc"),
}));

const TEST_CONFIG = {
  endpoint: "http://localhost:9000",
  accessKeyId: "minioadmin",
  secretAccessKey: "minioadmin",
  bucket: "test-bucket",
  region: "us-east-1",
  provider: "minio" as const,
};

describe("StorageAdapter", () => {
  let adapter: StorageAdapter;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { S3Client } = await import("@aws-sdk/client-s3");
    // Re-setup the send mock for each test
    const mockSend = vi.fn().mockResolvedValue({});
    (S3Client as ReturnType<typeof vi.fn>).mockImplementation(() => ({ send: mockSend }));
    adapter = new StorageAdapter(TEST_CONFIG);
  });

  describe("upload", () => {
    it("calls PutObjectCommand with correct key, mime type, and content length", async () => {
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      const buffer = Buffer.from("fake-image-data");
      const result = await adapter.upload("runs/abc/screenshot.png", buffer, "image/png");

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: TEST_CONFIG.bucket,
          Key: "runs/abc/screenshot.png",
          ContentType: "image/png",
          ContentLength: buffer.byteLength,
        })
      );
      expect(result.key).toBe("runs/abc/screenshot.png");
      expect(result.bucket).toBe(TEST_CONFIG.bucket);
      expect(result.sizeBytes).toBe(buffer.byteLength);
    });
  });

  describe("getSignedUrl", () => {
    it("returns a pre-signed URL string", async () => {
      const url = await adapter.getSignedUrl("runs/abc/screenshot.png");
      expect(typeof url).toBe("string");
      expect(url).toContain("https://");
    });

    it("passes the key to GetObjectCommand", async () => {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      await adapter.getSignedUrl("runs/abc/screenshot.png", 7200);
      expect(GetObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({ Key: "runs/abc/screenshot.png" })
      );
    });
  });

  describe("exists", () => {
    it("returns true when HeadObjectCommand succeeds", async () => {
      const result = await adapter.exists("runs/abc/screenshot.png");
      expect(result).toBe(true);
    });

    it("returns false when HeadObjectCommand throws", async () => {
      const { S3Client } = await import("@aws-sdk/client-s3");
      const mockSend = vi.fn().mockRejectedValue(new Error("NoSuchKey"));
      (S3Client as ReturnType<typeof vi.fn>).mockImplementation(() => ({ send: mockSend }));
      const failAdapter = new StorageAdapter(TEST_CONFIG);
      const result = await failAdapter.exists("runs/abc/missing.png");
      expect(result).toBe(false);
    });
  });
});

describe("storageConfigFromEnv", () => {
  it("throws when required env vars are missing", () => {
    const original = process.env;
    process.env = {};
    expect(() => storageConfigFromEnv()).toThrow("Missing required storage environment variables");
    process.env = original;
  });

  it("reads config from environment variables", () => {
    process.env["STORAGE_ENDPOINT"] = "http://localhost:9000";
    process.env["STORAGE_ACCESS_KEY"] = "key";
    process.env["STORAGE_SECRET_KEY"] = "secret";
    process.env["STORAGE_BUCKET"] = "my-bucket";
    process.env["STORAGE_PROVIDER"] = "minio";

    const config = storageConfigFromEnv();
    expect(config.endpoint).toBe("http://localhost:9000");
    expect(config.bucket).toBe("my-bucket");
    expect(config.provider).toBe("minio");

    delete process.env["STORAGE_ENDPOINT"];
    delete process.env["STORAGE_ACCESS_KEY"];
    delete process.env["STORAGE_SECRET_KEY"];
    delete process.env["STORAGE_BUCKET"];
    delete process.env["STORAGE_PROVIDER"];
  });
});

describe("getStorage / resetStorage", () => {
  beforeEach(() => resetStorage());

  it("returns the same singleton on repeated calls", () => {
    const a = getStorage(TEST_CONFIG);
    const b = getStorage(TEST_CONFIG);
    expect(a).toBe(b);
  });

  it("creates a new instance after reset", () => {
    const a = getStorage(TEST_CONFIG);
    resetStorage();
    const b = getStorage(TEST_CONFIG);
    expect(a).not.toBe(b);
  });
});
