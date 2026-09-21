import fs from "fs";
import path from "path";
import ora from "ora";
import Sentry from "@sentry/node";
import {
  getProjectFiles,
  getProjectFile,
  getNodeTypes,
  getBootstrapTypes,
  getArgumentTypes,
} from "../lib/api";
import {
  isLoggedIn,
  isProjectDir,
  getLocalProject,
  saveLocalHashes,
  updateGitignore,
  updateTsConfig,
} from "../lib/config";
import { computeLocalHashes, writeTypeFiles } from "../lib/project";
import * as logger from "../utils/logger";

export async function pull(): Promise<void> {
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

    // Build a set of .js paths that are compiled from server-side .ts files
    const compiledJsPaths = new Set(
      serverFiles
        .filter((f) => f.path.endsWith(".ts"))
        .map((f) => f.path.slice(0, -3) + ".js")
    );

    // Download server files that are new or different locally,
    // skipping compiled .js files where a corresponding .ts exists
    const filesToPull = serverFiles.filter((file) => {
      if (file.path.endsWith(".js")) {
        const tsPath = file.path.slice(0, -3) + ".ts";
        if (
          compiledJsPaths.has(file.path) ||
          fs.existsSync(path.join(projectDir, tsPath))
        ) {
          return false;
        }
      }
      return localHashes[file.path] !== file.hash;
    });

    if (filesToPull.length > 0) {
      spinner.text = `Downloading ${filesToPull.length} files...`;

      const pulled: string[] = [];
      for (const file of filesToPull) {
        try {
          const content = await getProjectFile(project.id, file.path);
          const fullPath = path.join(projectDir, file.path);
          const fileDir = path.dirname(fullPath);

          if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true });
          }

          fs.writeFileSync(fullPath, content);
          localHashes[file.path] = file.hash;
          pulled.push(file.path);
        } catch (err) {
          Sentry.captureException(err);
          logger.warn(`Could not download: ${file.path}`);
        }
      }

      logger.success(`Pulled ${pulled.length} files`);
      for (const file of pulled) {
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
      Sentry.captureException(err);
      logger.warn("Could not update type definitions");
    }

    // Save hashes
    saveLocalHashes(localHashes);

    // Update .gitignore and tsconfig
    updateGitignore(projectDir);
    updateTsConfig(projectDir);

    spinner.stop();
    if (filesToPull.length === 0) {
      logger.success("Already up to date");
    } else {
      logger.success("Pull complete");
    }
  } catch (err: unknown) {
    spinner.stop();
    Sentry.captureException(err);
    if (err instanceof Error) {
      logger.error(err.message);
    } else {
      logger.error("Failed to pull");
    }
    process.exit(1);
  }
}
