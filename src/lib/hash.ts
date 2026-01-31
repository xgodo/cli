import crypto from "crypto";

/**
 * Compute git blob hash for file content
 * Git computes blob hashes as: SHA-1("blob <size>\0<content>")
 */
export function computeGitBlobHash(content: Buffer): string {
  const header = Buffer.from(`blob ${content.length}\0`);
  const store = Buffer.concat([header, content]);
  return crypto.createHash("sha1").update(store).digest("hex");
}

/**
 * Compute git blob hash from string content
 */
export function computeGitBlobHashFromString(content: string): string {
  return computeGitBlobHash(Buffer.from(content, "utf-8"));
}
