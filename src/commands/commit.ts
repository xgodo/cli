import ora from "ora";
import { commitChanges, getProjectFiles, syncFilesToServer } from "../lib/api";
import {
  isLoggedIn,
  isProjectDir,
  getLocalProject,
  saveLocalHashes,
} from "../lib/config";
import { DEFAULT_COMMIT_MESSAGE } from "../lib/constants";
import { computeLocalHashes, findChangedFiles } from "../lib/project";
import * as logger from "../utils/logger";
import { promptCommitMessage } from "../utils/prompts";
import fs from "fs";
import path from "path";

interface CommitOptions {
  message?: string;
  force?: boolean;
}

export async function commit(options: CommitOptions): Promise<void> {
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

  // Determine commit message
  let message: string;
  if (options.message) {
    message = options.message;
  } else if (options.force) {
    message = DEFAULT_COMMIT_MESSAGE;
  } else {
    message = await promptCommitMessage();
  }

  const spinner = ora("Checking for changes...").start();

  try {
    // Get server files with hashes
    const serverFiles = await getProjectFiles(project.id);

    // Compute local hashes
    const localHashes = computeLocalHashes(projectDir);

    // Find changed files
    const changes = findChangedFiles(localHashes, serverFiles);

    // First, sync any local changes
    if (changes.upload.length > 0) {
      spinner.text = `Syncing ${changes.upload.length} files...`;

      const filesToUpload = changes.upload.map((filePath) => {
        const fullPath = path.join(projectDir, filePath);
        const content = fs.readFileSync(fullPath);
        return {
          path: filePath,
          content: content.toString("base64"),
        };
      });

      const results = await syncFilesToServer(project.id, filesToUpload);

      // Update local hashes
      for (const result of results) {
        localHashes[result.path] = result.hash;

        // Check for compilation errors
        if (result.errors && result.errors.length > 0) {
          spinner.stop();
          logger.warn(`Compilation warnings for ${result.path}:`);
          for (const err of result.errors) {
            logger.dim(`  ${err}`);
          }
          spinner.start();
        }
      }

      saveLocalHashes(localHashes);
    }

    // Create commit
    spinner.text = "Creating commit...";
    const commitResult = await commitChanges(project.id, message);

    spinner.stop();

    if (changes.upload.length > 0) {
      logger.success(`Synced ${changes.upload.length} files`);
      for (const file of changes.upload) {
        logger.dim(`  + ${file}`);
      }
    }

    logger.success(`Committed: ${commitResult.hash.substring(0, 7)}`);
    logger.dim(`  Message: ${message}`);
  } catch (err: unknown) {
    spinner.stop();
    if (err instanceof Error) {
      // Handle "no changes" error gracefully
      if (err.message.includes("No changes to commit")) {
        logger.info("No changes to commit");
        return;
      }
      logger.error(err.message);
    } else {
      logger.error("Failed to commit");
    }
    process.exit(1);
  }
}
