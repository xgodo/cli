import fs from "fs";
import path from "path";
import ora from "ora";
import {
  getProjectFiles,
  getProjectFile,
  syncFilesToServer,
  getNodeTypes,
  getBootstrapTypes,
  getArgumentTypes,
} from "../lib/api";
import {
  isLoggedIn,
  isProjectDir,
  getLocalProject,
  saveLocalHashes,
  getLocalHashes,
  updateGitignore,
  updateTsConfig,
} from "../lib/config";
import {
  computeLocalHashes,
  findChangedFiles,
  getAllFiles,
  writeTypeFiles,
} from "../lib/project";
import * as logger from "../utils/logger";

/**
 * Auto-sync: silently upload local changes to the server before running other commands.
 * This ensures the server has the latest local changes.
 * Returns true if sync was successful, false otherwise.
 */
export async function autoSync(): Promise<boolean> {
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

      logger.dim(`Auto-synced ${changes.upload.length} file${changes.upload.length === 1 ? "" : "s"}`);
    }

    return true;
  } catch {
    // Silently fail - the main command will handle errors
    return false;
  }
}

export async function sync(): Promise<void> {
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

    if (changes.upload.length === 0 && changes.download.length === 0) {
      spinner.stop();
      logger.success("Already up to date");
      return;
    }

    // Upload changed files
    if (changes.upload.length > 0) {
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

      logger.success(`Uploaded ${changes.upload.length} files`);
      for (const file of changes.upload) {
        logger.dim(`  + ${file}`);
      }
    }

    // Download new/updated files from server
    if (changes.download.length > 0) {
      spinner.text = `Downloading ${changes.download.length} files...`;

      for (const filePath of changes.download) {
        try {
          const content = await getProjectFile(project.id, filePath);
          const fullPath = path.join(projectDir, filePath);
          const fileDir = path.dirname(fullPath);

          if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true });
          }

          fs.writeFileSync(fullPath, content);

          // Update hash
          const serverFile = serverFiles.find((f) => f.path === filePath);
          if (serverFile) {
            localHashes[filePath] = serverFile.hash;
          }
        } catch (err) {
          logger.warn(`Could not download: ${filePath}`);
        }
      }

      logger.success(`Downloaded ${changes.download.length} files`);
      for (const file of changes.download) {
        logger.dim(`  + ${file}`);
      }
    }

    // Update type definitions
    spinner.text = "Updating type definitions...";
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
        argumentTypes = await getArgumentTypes(project.id);
      } catch {
        // Argument types might not be available
      }

      writeTypeFiles(projectDir, nodeTypes, bootstrap, argumentTypes);
    } catch (err) {
      logger.warn("Could not update type definitions");
    }

    // Save hashes
    saveLocalHashes(localHashes);

    // Update .gitignore and tsconfig
    updateGitignore(projectDir);
    updateTsConfig(projectDir);

    spinner.stop();
    logger.success("Sync complete");
  } catch (err: unknown) {
    spinner.stop();
    if (err instanceof Error) {
      logger.error(err.message);
    } else {
      logger.error("Failed to sync");
    }
    process.exit(1);
  }
}
