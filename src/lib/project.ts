import fs from "fs";
import path from "path";
import { computeGitBlobHash } from "./hash";
import { LocalHashes } from "./types";

/**
 * Recursively get all files in a directory
 */
export function getAllFiles(
  dir: string,
  basePath: string = ""
): { path: string; fullPath: string }[] {
  const files: { path: string; fullPath: string }[] = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = basePath ? path.join(basePath, entry.name) : entry.name;
    const fullPath = path.join(dir, entry.name);

    // Skip hidden directories and files (except .gitignore)
    if (entry.name.startsWith(".") && entry.name !== ".gitignore") {
      continue;
    }

    // Skip types directory (auto-generated)
    if (entry.name === "types" && entry.isDirectory()) {
      continue;
    }

    // Skip node_modules
    if (entry.name === "node_modules") {
      continue;
    }

    // Skip compiled .js files (they are auto-generated from .ts)
    if (entry.name.endsWith(".js")) {
      const tsPath = fullPath.slice(0, -3) + ".ts";
      if (fs.existsSync(tsPath)) {
        continue;
      }
    }

    if (entry.isDirectory()) {
      const subFiles = getAllFiles(fullPath, relativePath);
      files.push(...subFiles);
    } else {
      files.push({ path: relativePath, fullPath });
    }
  }

  return files;
}

/**
 * Compute hashes for all local files
 */
export function computeLocalHashes(projectDir: string): LocalHashes {
  const hashes: LocalHashes = {};
  const files = getAllFiles(projectDir);

  for (const file of files) {
    const content = fs.readFileSync(file.fullPath);
    hashes[file.path] = computeGitBlobHash(content);
  }

  return hashes;
}

/**
 * Find files that have changed between local and server
 */
export function findChangedFiles(
  localHashes: LocalHashes,
  serverHashes: { path: string; hash: string }[]
): {
  upload: string[]; // Files to upload (local changed or new)
  download: string[]; // Files to download (server has new version)
  delete: string[]; // Files deleted locally
} {
  const serverHashMap = new Map(serverHashes.map((f) => [f.path, f.hash]));
  const localPaths = new Set(Object.keys(localHashes));
  const serverPaths = new Set(serverHashes.map((f) => f.path));

  const upload: string[] = [];
  const download: string[] = [];
  const deleteFiles: string[] = [];

  // Check local files
  for (const [localPath, localHash] of Object.entries(localHashes)) {
    const serverHash = serverHashMap.get(localPath);

    if (!serverHash) {
      // New local file
      upload.push(localPath);
    } else if (localHash !== serverHash) {
      // File changed locally (upload local version)
      upload.push(localPath);
    }
  }

  // Check for files that exist on server but not locally
  for (const serverPath of serverPaths) {
    if (!localPaths.has(serverPath)) {
      // File exists on server but not locally - could be deleted locally
      // For now, we'll consider this as a file to download
      // In a more advanced version, you might want to track deletions
      download.push(serverPath);
    }
  }

  return { upload, download, delete: deleteFiles };
}

/**
 * Normalize project name for directory creation
 */
export function normalizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

/**
 * Ensure types directory exists
 */
export function ensureTypesDir(projectDir: string): void {
  const typesDir = path.join(projectDir, "types");
  if (!fs.existsSync(typesDir)) {
    fs.mkdirSync(typesDir, { recursive: true });
  }
}

/**
 * Write type definition files
 */
export function writeTypeFiles(
  projectDir: string,
  nodeTypes: string,
  bootstrap?: { version: number; content: string },
  argumentTypes?: string
): void {
  ensureTypesDir(projectDir);

  const typesDir = path.join(projectDir, "types");

  // Write node-types.ts
  fs.writeFileSync(path.join(typesDir, "node-types.ts"), nodeTypes);

  // Write bootstrap.ts if available
  if (bootstrap) {
    fs.writeFileSync(path.join(typesDir, "bootstrap.ts"), bootstrap.content);
  }

  // Write arguments.ts if available
  if (argumentTypes) {
    fs.writeFileSync(path.join(typesDir, "arguments.ts"), argumentTypes);
  }
}
