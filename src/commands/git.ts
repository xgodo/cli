import chalk from "chalk";
import ora from "ora";
import fs from "fs";
import path from "path";
import * as Diff from "diff";
import { getGitStatus, getGitHistory, getGitDiffWithWorking } from "../lib/api";
import { getLocalProject, isLoggedIn, isProjectDir } from "../lib/config";
import { GitChange, GitDiffFile } from "../lib/types";
import { autoSync } from "./sync";

/**
 * Format a status badge for a file change
 */
function formatStatusBadge(status: GitChange["status"]): string {
  switch (status) {
    case "new":
      return chalk.green("[A]"); // Added
    case "modified":
      return chalk.yellow("[M]"); // Modified
    case "deleted":
      return chalk.red("[D]"); // Deleted
    default:
      return chalk.gray("[?]");
  }
}

/**
 * Format a diff status badge
 */
function formatDiffStatusBadge(status: GitDiffFile["status"]): string {
  switch (status) {
    case "added":
      return chalk.green("[A]");
    case "modified":
      return chalk.yellow("[M]");
    case "deleted":
      return chalk.red("[D]");
    default:
      return chalk.gray("[?]");
  }
}

/**
 * Format a timestamp in a human-readable way
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return "just now";
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
}

/**
 * Generate a unified diff between two strings and colorize it
 */
function generateUnifiedDiff(
  filePath: string,
  original: string,
  modified: string,
  status: GitDiffFile["status"]
): string {
  // Use the diff library to generate a proper unified diff
  const patch = Diff.createPatch(
    filePath,
    original,
    modified,
    status === "deleted" ? filePath : undefined,
    status === "added" ? filePath : undefined
  );

  // Colorize the output
  const lines = patch.split("\n");
  const colorized = lines.map((line) => {
    if (line.startsWith("+++") || line.startsWith("---")) {
      return chalk.gray(line);
    } else if (line.startsWith("@@")) {
      return chalk.cyan(line);
    } else if (line.startsWith("+")) {
      return chalk.green(line);
    } else if (line.startsWith("-")) {
      return chalk.red(line);
    } else if (line.startsWith("\\")) {
      return chalk.gray(line);
    } else if (line.startsWith("Index:") || line.startsWith("===")) {
      return chalk.bold(line);
    }
    return line;
  });

  return colorized.join("\n");
}

/**
 * Check if a .js file is a compiled output (corresponding .ts exists)
 */
function isCompiledJsFile(filePath: string, projectDir: string = process.cwd()): boolean {
  if (!filePath.endsWith(".js")) return false;

  const tsPath = filePath.slice(0, -3) + ".ts";
  const localTsPath = path.join(projectDir, tsPath);

  return fs.existsSync(localTsPath);
}

/**
 * Filter out compiled .js files where corresponding .ts exists
 */
function filterCompiledJsFiles(changes: GitChange[], projectDir: string = process.cwd()): GitChange[] {
  return changes.filter((c) => !isCompiledJsFile(c.path, projectDir));
}

/**
 * Filter out compiled .js diff files where corresponding .ts exists
 */
function filterCompiledJsDiffFiles(files: GitDiffFile[], projectDir: string = process.cwd()): GitDiffFile[] {
  return files.filter((f) => !isCompiledJsFile(f.path, projectDir));
}

/**
 * xgodo project status - Show uncommitted changes
 */
export async function gitStatus(): Promise<void> {
  if (!isLoggedIn()) {
    console.error(chalk.red("Not logged in. Run 'xgodo login' first."));
    process.exit(1);
  }

  const project = getLocalProject();
  if (!project) {
    console.error(chalk.red("Not in a project directory. Run this from a cloned project folder."));
    process.exit(1);
  }

  // Auto-sync before checking status
  await autoSync();

  const spinner = ora("Checking status...").start();

  try {
    const status = await getGitStatus(project.id);
    spinner.stop();

    // Filter out compiled .js files
    const filteredChanges = filterCompiledJsFiles(status.changes);

    if (filteredChanges.length === 0) {
      console.log(chalk.green("Working directory clean - no uncommitted changes"));
      return;
    }

    console.log(chalk.bold("Changes not committed:\n"));

    // Group by status
    const newFiles = filteredChanges.filter((c) => c.status === "new");
    const modifiedFiles = filteredChanges.filter((c) => c.status === "modified");
    const deletedFiles = filteredChanges.filter((c) => c.status === "deleted");

    if (newFiles.length > 0) {
      console.log(chalk.green("  New files:"));
      for (const file of newFiles) {
        console.log(chalk.green(`    ${formatStatusBadge(file.status)} ${file.path}`));
      }
      console.log();
    }

    if (modifiedFiles.length > 0) {
      console.log(chalk.yellow("  Modified files:"));
      for (const file of modifiedFiles) {
        console.log(chalk.yellow(`    ${formatStatusBadge(file.status)} ${file.path}`));
      }
      console.log();
    }

    if (deletedFiles.length > 0) {
      console.log(chalk.red("  Deleted files:"));
      for (const file of deletedFiles) {
        console.log(chalk.red(`    ${formatStatusBadge(file.status)} ${file.path}`));
      }
      console.log();
    }

    const total = filteredChanges.length;
    console.log(
      chalk.gray(
        `${total} file${total === 1 ? "" : "s"} changed (${newFiles.length} new, ${modifiedFiles.length} modified, ${deletedFiles.length} deleted)`
      )
    );
    console.log(chalk.gray("\nUse 'xgodo project sync' to upload changes"));
    console.log(chalk.gray("Use 'xgodo project commit' to commit changes"));
  } catch (err: any) {
    spinner.fail("Failed to get status");
    console.error(chalk.red(err.message));
    process.exit(1);
  }
}

/**
 * xgodo project log - Show commit history
 */
export async function gitLog(options: { limit?: string }): Promise<void> {
  const project = getLocalProject();
  if (!project) {
    console.error(chalk.red("Not in a project directory. Run this from a cloned project folder."));
    process.exit(1);
  }

  const limit = options.limit ? parseInt(options.limit, 10) : 20;
  if (isNaN(limit) || limit < 1) {
    console.error(chalk.red("Invalid limit value"));
    process.exit(1);
  }

  const spinner = ora("Fetching commit history...").start();

  try {
    const commits = await getGitHistory(project.id, limit);
    spinner.stop();

    if (commits.length === 0) {
      console.log(chalk.yellow("No commits found"));
      return;
    }

    console.log(chalk.bold(`Commit history (showing ${commits.length} commits):\n`));

    for (const commit of commits) {
      // Commit hash (abbreviated)
      const shortHash = commit.hash.substring(0, 7);
      console.log(chalk.yellow(`commit ${shortHash}`) + chalk.gray(` (${commit.hash})`));

      // Author
      const authorEmail = commit.authorEmail ? ` <${commit.authorEmail}>` : "";
      console.log(chalk.gray(`Author: ${commit.author}${authorEmail}`));

      // Date
      const formattedDate = formatTimestamp(commit.timestamp);
      const fullDate = new Date(commit.timestamp).toLocaleString();
      console.log(chalk.gray(`Date:   ${fullDate} (${formattedDate})`));

      // Message
      console.log();
      const messageLines = commit.message.trim().split("\n");
      for (const line of messageLines) {
        console.log(`    ${line}`);
      }
      console.log();
    }
  } catch (err: any) {
    spinner.fail("Failed to get commit history");
    console.error(chalk.red(err.message));
    process.exit(1);
  }
}

/**
 * xgodo project diff - Show diff between working directory and last commit
 */
export async function gitDiff(options: { file?: string }): Promise<void> {
  if (!isLoggedIn()) {
    console.error(chalk.red("Not logged in. Run 'xgodo login' first."));
    process.exit(1);
  }

  const project = getLocalProject();
  if (!project) {
    console.error(chalk.red("Not in a project directory. Run this from a cloned project folder."));
    process.exit(1);
  }

  // Auto-sync before fetching diff
  await autoSync();

  const spinner = ora("Fetching changes...").start();

  try {
    // First get the latest commit
    const commits = await getGitHistory(project.id, 1);
    if (commits.length === 0) {
      spinner.fail("No commits found");
      process.exit(1);
    }

    const latestCommit = commits[0];

    // Get diff with working directory
    const diff = await getGitDiffWithWorking(project.id, latestCommit.hash);
    spinner.stop();

    // Filter out compiled .js files
    const filteredFiles = filterCompiledJsDiffFiles(diff.files);

    if (filteredFiles.length === 0) {
      console.log(chalk.green("No changes from last commit"));
      return;
    }

    // Filter by file if specified
    let filesToShow = filteredFiles;
    if (options.file) {
      const fileFilter = options.file;
      filesToShow = filteredFiles.filter((f) => f.path === fileFilter || f.path.includes(fileFilter));
      if (filesToShow.length === 0) {
        console.log(chalk.yellow(`No changes found for: ${options.file}`));
        return;
      }
    }

    console.log(chalk.bold(`Diff against commit ${latestCommit.hash.substring(0, 7)}:\n`));

    for (const file of filesToShow) {
      console.log(formatDiffStatusBadge(file.status) + " " + chalk.bold(file.path));
      console.log();

      const diffOutput = generateUnifiedDiff(file.path, file.original, file.modified, file.status);
      console.log(diffOutput);
      console.log();
    }

    console.log(chalk.gray(`${filesToShow.length} file${filesToShow.length === 1 ? "" : "s"} changed`));
  } catch (err: any) {
    spinner.fail("Failed to get diff");
    console.error(chalk.red(err.message));
    process.exit(1);
  }
}
