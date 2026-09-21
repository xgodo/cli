import fs from "fs";
import path from "path";
import ora from "ora";
import Sentry from "@sentry/node";
import { getProjectFiles, syncFilesToServer } from "../lib/api";
import {
  isLoggedIn,
  isProjectDir,
  getLocalProject,
  saveLocalHashes,
} from "../lib/config";
import { computeLocalHashes, findChangedFiles } from "../lib/project";
import * as logger from "../utils/logger";

/**
 * Auto-push: silently upload local changes to the server before running other commands.
 * This ensures the server has the latest local changes.
 * Returns true if push was successful, false otherwise.
 */
export async function autoPush(): Promise<boolean> {
  if (!isLoggedIn() || !isProjectDir()) {
    return false;
  }

  const project = getLocalProject();
  if (!project) {
    return false;
  }

  const projectDir = process.cwd();

  try {
    // Get server files with hashes
    const serverFiles = await getProjectFiles(project.id);

    // Compute local hashes
    const localHashes = computeLocalHashes(projectDir);

    // Find changed files
    const changes = findChangedFiles(localHashes, serverFiles);

    // Only upload local changes (don't download)
    if (changes.upload.length > 0) {
      const filesToUpload = changes.upload.map((filePath) => {
        const fullPath = path.join(projectDir, filePath);
        const content = fs.readFileSync(fullPath);
        return {
          path: filePath,
          content: content.toString("base64"),
        };
      });

      const results = await syncFilesToServer(project.id, filesToUpload);

      // Update local hashes with server response
      for (const result of results) {
        localHashes[result.path] = result.hash;
      }

      // Save hashes
      saveLocalHashes(localHashes);

      logger.dim(`Auto-pushed ${changes.upload.length} file${changes.upload.length === 1 ? "" : "s"}`);
    }

    return true;
  } catch (err) {
    // Silently fail - the main command will handle errors
    Sentry.captureException(err);
    return false;
  }
}

export async function push(): Promise<void> {
  if (!isLoggedIn()) {
    logger.error("Not logged in. Run 'xgodo login' first.");
    process.exit(1);
  }

  if (!isProjectDir()) {
    logger.error("Not in a project directory. Run 'xgodo clone' first.");
    process.exit(1);
  }

  const project = getLocalProject()!;
  const projectDir = process.cwd();

  const spinner = ora("Checking for changes...").start();

  try {
    // Get server files with hashes
    const serverFiles = await getProjectFiles(project.id);

    // Compute local hashes
    const localHashes = computeLocalHashes(projectDir);

    // Find changed files
    const changes = findChangedFiles(localHashes, serverFiles);

    if (changes.upload.length === 0) {
      spinner.stop();
      logger.success("Nothing to push - server is up to date");
      return;
    }

    // Upload changed files
    spinner.text = `Uploading ${changes.upload.length} files...`;

    const filesToUpload = changes.upload.map((filePath) => {
      const fullPath = path.join(projectDir, filePath);
      const content = fs.readFileSync(fullPath);
      return {
        path: filePath,
        content: content.toString("base64"),
      };
    });

    const results = await syncFilesToServer(project.id, filesToUpload);

    // Update local hashes with server response
    for (const result of results) {
      localHashes[result.path] = result.hash;

      // Check for compilation errors
      if (result.errors && result.errors.length > 0) {
        logger.warn(`Compilation warnings for ${result.path}:`);
        for (const err of result.errors) {
          logger.dim(`  ${err}`);
        }
      }
    }

    // Save hashes
    saveLocalHashes(localHashes);

    spinner.stop();
    logger.success(`Pushed ${changes.upload.length} files`);
    for (const file of changes.upload) {
      logger.dim(`  + ${file}`);
    }
  } catch (err: unknown) {
    spinner.stop();
    Sentry.captureException(err);
    if (err instanceof Error) {
      logger.error(err.message);
    } else {
      logger.error("Failed to push");
    }
    process.exit(1);
  }
}
