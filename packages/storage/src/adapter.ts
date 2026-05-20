import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StorageConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
  /** "minio" uses path-style addressing; "s3" uses virtual-hosted-style */
  provider: "minio" | "s3";
}

export interface UploadResult {
  key: string;
  bucket: string;
  sizeBytes: number;
}

// ─── Default config from environment ─────────────────────────────────────────

export function storageConfigFromEnv(): StorageConfig {
  const endpoint = process.env["STORAGE_ENDPOINT"];
  const accessKeyId = process.env["STORAGE_ACCESS_KEY"];
  const secretAccessKey = process.env["STORAGE_SECRET_KEY"];
  const bucket = process.env["STORAGE_BUCKET"];
  const region = process.env["STORAGE_REGION"] ?? "us-east-1";
  const provider = (process.env["STORAGE_PROVIDER"] ?? "minio") as "minio" | "s3";

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "Missing required storage environment variables: STORAGE_ENDPOINT, STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY, STORAGE_BUCKET"
    );
  }

  return { endpoint, accessKeyId, secretAccessKey, bucket, region, provider };
}

// ─── Storage adapter ─────────────────────────────────────────────────────────

export class StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: StorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // MinIO requires path-style URLs; AWS S3 uses virtual-hosted-style
      forcePathStyle: config.provider === "minio",
    });
  }

  /**
   * Upload a buffer to object storage.
   * @param key  Storage key, e.g. "runs/abc123/desktop/screenshot.png"
   * @param buffer  File content as a Buffer
   * @param mimeType  MIME type, e.g. "image/png"
   */
  async upload(
    key: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<UploadResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ContentLength: buffer.byteLength,
      })
    );

    return { key, bucket: this.bucket, sizeBytes: buffer.byteLength };
  }

  /**
   * Generate a pre-signed URL that expires in `expiresIn` seconds (default 1 hour).
   */
  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Check whether a key exists in the bucket.
   */
  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key })
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete an object. Resolves silently if the key does not exist.
   */
  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _storage: StorageAdapter | undefined;

export function getStorage(config?: StorageConfig): StorageAdapter {
  if (!_storage) {
    _storage = new StorageAdapter(config ?? storageConfigFromEnv());
  }
  return _storage;
}

/** Reset the singleton — useful in tests. */
export function resetStorage(): void {
  _storage = undefined;
}
