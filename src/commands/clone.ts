import fs from "fs";
import path from "path";
import ora from "ora";
import Sentry from "@sentry/node";
import {
  getProject,
  getProjectFiles,
  getProjectFile,
  getNodeTypes,
  getBootstrapTypes,
  getArgumentTypes,
  getApiUrl,
  listProjects,
} from "../lib/api";
import {
  isLoggedIn,
  saveLocalProject,
  saveLocalHashes,
  updateGitignore,
  updateTsConfig,
} from "../lib/config";
import {
  normalizeProjectName,
  writeTypeFiles,
} from "../lib/project";
import { LocalHashes } from "../lib/types";
import * as logger from "../utils/logger";
import { promptSelectProject } from "../utils/prompts";

interface CloneOptions {
  path?: string;
}

export async function clone(
  projectId: string | undefined,
  options: CloneOptions
): Promise<void> {
  if (!isLoggedIn()) {
    logger.error("Not logged in. Run 'xgodo login' first.");
    process.exit(1);
  }

  let selectedProjectId = projectId;

  // If no project ID provided, show interactive selection
  if (!selectedProjectId) {
    const spinner = ora("Fetching projects...").start();
    try {
      const projects = await listProjects();
      spinner.stop();

      if (projects.length === 0) {
        logger.info("No projects available");
        return;
      }

      selectedProjectId = await promptSelectProject(projects);
    } catch (err: unknown) {
      spinner.stop();
      Sentry.captureException(err);
      if (err instanceof Error) {
        logger.error(err.message);
      } else {
        logger.error("Failed to list projects");
      }
      process.exit(1);
    }
  }

  const spinner = ora("Fetching project info...").start();

  try {
    // Get project details
    const project = await getProject(selectedProjectId);
    spinner.text = "Fetching project files...";

    // Determine target directory
    const normalizedName = normalizeProjectName(project.name);
    const targetDir = options.path
      ? path.resolve(options.path)
      : path.resolve(process.cwd(), normalizedName);

    // Check if directory already exists
    if (fs.existsSync(targetDir)) {
      spinner.stop();
      logger.error(`Directory already exists: ${targetDir}`);
      process.exit(1);
    }

    // Create directory
    fs.mkdirSync(targetDir, { recursive: true });

    // Get all files
    const files = await getProjectFiles(selectedProjectId);

    // Build a set of .ts file paths to skip their compiled .js counterparts
    const tsFiles = new Set(
      files
        .filter((f) => f.path.endsWith(".ts"))
        .map((f) => f.path.slice(0, -3) + ".js")
    );

    // Filter out compiled .js files (where corresponding .ts exists)
    const filesToDownload = files.filter((f) => {
      if (f.path.endsWith(".js") && tsFiles.has(f.path)) {
        return false; // Skip compiled .js file
      }
      return true;
    });

    const skippedCount = files.length - filesToDownload.length;
    spinner.text = `Downloading ${filesToDownload.length} files...`;
    if (skippedCount > 0) {
      logger.dim(`  (Skipping ${skippedCount} compiled .js files)`);
    }

    // Download each file
    const hashes: LocalHashes = {};
    for (const file of filesToDownload) {
      try {
        const content = await getProjectFile(selectedProjectId, file.path);
        const filePath = path.join(targetDir, file.path);
        const fileDir = path.dirname(filePath);

        // Ensure directory exists
        if (!fs.existsSync(fileDir)) {
          fs.mkdirSync(fileDir, { recursive: true });
        }

        fs.writeFileSync(filePath, content);
        hashes[file.path] = file.hash;
      } catch (err) {
        // Skip files that can't be downloaded (e.g., binary files)
        logger.warn(`Skipped: ${file.path}`);
      }
    }

    // Download type definitions
    spinner.text = "Downloading type definitions...";
    try {
      const nodeTypes = await getNodeTypes();
      let bootstrap: { version: number; content: string } | undefined;
      let argumentTypes: string | undefined;

      try {
        bootstrap = await getBootstrapTypes();
      } catch {
        // Bootstrap types might not be available
      }

      try {
        argumentTypes = await getArgumentTypes(selectedProjectId);
      } catch {
        // Argument types might not be available
      }

      writeTypeFiles(targetDir, nodeTypes, bootstrap, argumentTypes);
    } catch (err) {
      logger.warn("Could not download type definitions");
    }

    // Save project info
    saveLocalProject(
      {
        id: selectedProjectId,
        name: project.name,
        apiUrl: getApiUrl(),
        lastSync: new Date().toISOString(),
      },
      targetDir
    );

    // Save hashes
    saveLocalHashes(hashes, targetDir);

    // Update .gitignore
    updateGitignore(targetDir);

    // Update tsconfig.json
    updateTsConfig(targetDir);

    spinner.stop();

    logger.success(`Cloned project to ${targetDir}`);
    logger.log("");
    logger.dim(`  Project: ${project.name}`);
    logger.dim(`  Files: ${filesToDownload.length}${skippedCount > 0 ? ` (${skippedCount} compiled .js skipped)` : ""}`);
    logger.dim(`  Role: ${project.role}`);
    logger.log("");
    logger.info(`Run 'cd ${path.relative(process.cwd(), targetDir)}' to enter the project`);
  } catch (err: unknown) {
    spinner.stop();
    Sentry.captureException(err);
    if (err instanceof Error) {
      logger.error(err.message);
    } else {
      logger.error("Failed to clone project");
    }
    process.exit(1);
  }
}
