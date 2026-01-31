import fs from "fs";
import path from "path";
import os from "os";
import { Config, LocalProject, LocalHashes } from "./types";

const CONFIG_DIR = path.join(os.homedir(), ".config", "xgodo");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

// Project-specific files
const PROJECT_DIR = ".xgodo";
const PROJECT_FILE = "project.json";
const HASHES_FILE = "hashes.json";

/**
 * Ensure config directory exists
 */
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Get global config
 */
export function getConfig(): Config | null {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return null;
    }
    const content = fs.readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(content) as Config;
  } catch {
    return null;
  }
}

/**
 * Save global config
 */
export function saveConfig(config: Config): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

/**
 * Clear global config (logout)
 */
export function clearConfig(): void {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE);
  }
}

/**
 * Check if logged in
 */
export function isLoggedIn(): boolean {
  return getConfig() !== null;
}

// ==================== Project-specific functions ====================

/**
 * Get project directory path
 */
export function getProjectDir(cwd: string = process.cwd()): string {
  return path.join(cwd, PROJECT_DIR);
}

/**
 * Check if current directory is a project
 */
export function isProjectDir(cwd: string = process.cwd()): boolean {
  const projectDir = getProjectDir(cwd);
  return fs.existsSync(path.join(projectDir, PROJECT_FILE));
}

/**
 * Get local project info
 */
export function getLocalProject(cwd: string = process.cwd()): LocalProject | null {
  try {
    const projectFile = path.join(getProjectDir(cwd), PROJECT_FILE);
    if (!fs.existsSync(projectFile)) {
      return null;
    }
    const content = fs.readFileSync(projectFile, "utf-8");
    return JSON.parse(content) as LocalProject;
  } catch {
    return null;
  }
}

/**
 * Save local project info
 */
export function saveLocalProject(project: LocalProject, cwd: string = process.cwd()): void {
  const projectDir = getProjectDir(cwd);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }
  const projectFile = path.join(projectDir, PROJECT_FILE);
  fs.writeFileSync(projectFile, JSON.stringify(project, null, 2));
}

/**
 * Get local file hashes
 */
export function getLocalHashes(cwd: string = process.cwd()): LocalHashes {
  try {
    const hashesFile = path.join(getProjectDir(cwd), HASHES_FILE);
    if (!fs.existsSync(hashesFile)) {
      return {};
    }
    const content = fs.readFileSync(hashesFile, "utf-8");
    return JSON.parse(content) as LocalHashes;
  } catch {
    return {};
  }
}

/**
 * Save local file hashes
 */
export function saveLocalHashes(hashes: LocalHashes, cwd: string = process.cwd()): void {
  const projectDir = getProjectDir(cwd);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }
  const hashesFile = path.join(projectDir, HASHES_FILE);
  fs.writeFileSync(hashesFile, JSON.stringify(hashes, null, 2));
}

/**
 * Update .gitignore to include xgodo-specific entries
 */
export function updateGitignore(cwd: string = process.cwd()): void {
  const gitignorePath = path.join(cwd, ".gitignore");
  const entriesToAdd = [
    "# Xgodo CLI",
    ".xgodo/",
    "types/",
    "*.js",
    "",
  ];

  let content = "";
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, "utf-8");
  }

  // Check if already has xgodo entries
  if (content.includes("# Xgodo CLI")) {
    return;
  }

  // Add entries
  const newContent = content.trim() + "\n\n" + entriesToAdd.join("\n");
  fs.writeFileSync(gitignorePath, newContent);
}

/**
 * Create or update tsconfig.json for type definitions
 */
export function updateTsConfig(cwd: string = process.cwd()): void {
  const tsconfigPath = path.join(cwd, "tsconfig.json");

  const defaultConfig = {
    compilerOptions: {
      target: "ES2017",
      module: "ES2015",
      lib: ["esnext", "dom"],
      strict: true,
      noImplicitAny: true,
      strictFunctionTypes: true,
      strictPropertyInitialization: true,
      strictBindCallApply: true,
      noImplicitThis: true,
      noImplicitReturns: true,
      noEmit: true,
      skipLibCheck: true,
      typeRoots: ["./types"],
    },
    include: ["*.ts", "**/*.ts", "types/*.ts"],
    exclude: ["node_modules"],
  };

  if (fs.existsSync(tsconfigPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"));
      // Update typeRoots if not already pointing to ./types
      if (!existing.compilerOptions) {
        existing.compilerOptions = {};
      }
      if (!existing.compilerOptions.typeRoots || !existing.compilerOptions.typeRoots.includes("./types")) {
        existing.compilerOptions.typeRoots = ["./types"];
        fs.writeFileSync(tsconfigPath, JSON.stringify(existing, null, 2));
      }
    } catch {
      // If existing config is invalid, overwrite
      fs.writeFileSync(tsconfigPath, JSON.stringify(defaultConfig, null, 2));
    }
  } else {
    fs.writeFileSync(tsconfigPath, JSON.stringify(defaultConfig, null, 2));
  }
}
