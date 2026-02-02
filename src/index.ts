#!/usr/bin/env node

import { Command } from "commander";
import { login } from "./commands/login";
import { logout } from "./commands/logout";
import { whoami } from "./commands/whoami";
import { list } from "./commands/list";
import { clone } from "./commands/clone";
import { sync } from "./commands/sync";
import { commit } from "./commands/commit";
import { templateList, templateApply } from "./commands/template";
import { argumentsList, argumentsEdit } from "./commands/arguments";
import { gitStatus, gitLog, gitDiff } from "./commands/git";
import {
  handleCompletion,
  installCompletions,
  uninstallCompletions,
} from "./lib/completions";

import Sentry from "@sentry/node";

import "./instrument";

// Handle tab completion first (tabtab checks env vars)
handleCompletion()
  .then((handled) => {
    if (!handled) {
      runCli();
    }
  })
  .catch((e) => {
    Sentry.captureException(e);
    runCli();
  });

function runCli(): void {
  const program = new Command();

  program
    .name("xgodo")
    .description("CLI tool for Xgodo platform")
    .version("1.3.0");

  // Login command
  program
    .command("login")
    .description("Login with your API key")
    .option("-k, --key <key>", "API key (will prompt if not provided)")
    .option(
      "-u, --url <url>",
      "API URL (default: https://xgodobackend.omdev.in/server)",
    )
    .action(login);

  // Logout command
  program
    .command("logout")
    .description("Logout and clear stored credentials")
    .action(logout);

  // Whoami command
  program
    .command("whoami")
    .description("Show current logged-in user")
    .action(whoami);

  // ==================== Project commands ====================
  const projectCmd = program
    .command("project")
    .alias("p")
    .description("Manage automation projects");

  // List projects
  projectCmd
    .command("list")
    .alias("ls")
    .description("List your automation projects")
    .action(list);

  // Clone project
  projectCmd
    .command("clone [project-id]")
    .description("Clone an automation project to local directory")
    .option("-p, --path <path>", "Target directory (default: ./<project-name>)")
    .action(clone);

  // Sync project
  projectCmd
    .command("sync")
    .description("Sync local changes with the server")
    .action(sync);

  // Commit changes
  projectCmd
    .command("commit")
    .description("Commit changes to the project")
    .option("-m, --message <message>", "Commit message")
    .option("-f, --force", "Use default commit message")
    .action(commit);

  // Git status
  projectCmd
    .command("status")
    .description("Show uncommitted changes")
    .action(gitStatus);

  // Git log
  projectCmd
    .command("log")
    .description("Show commit history")
    .option("-n, --limit <limit>", "Number of commits to show (default: 20)")
    .action(gitLog);

  // Git diff
  projectCmd
    .command("diff")
    .description("Show diff between working directory and last commit")
    .option("-f, --file <file>", "Show diff for a specific file")
    .action(gitDiff);

  // Template subcommands under project
  const templateCmd = projectCmd
    .command("template")
    .alias("t")
    .description("Manage project templates");

  templateCmd
    .command("list")
    .alias("ls")
    .description("List available templates")
    .action(templateList);

  templateCmd
    .command("apply [template-id]")
    .description("Apply a template to the current project")
    .action(templateApply);

  // Arguments subcommands under project
  const argsCmd = projectCmd
    .command("arguments")
    .alias("args")
    .description("Manage automation parameters and job variables");

  argsCmd
    .command("list")
    .alias("ls")
    .description("List automation parameters and job variables")
    .action(argumentsList);

  argsCmd
    .command("edit")
    .description("Interactively edit automation parameters and job variables")
    .action(argumentsEdit);

  // ==================== Completion commands ====================
  const completionCmd = program
    .command("completion")
    .description("Manage shell tab completions");

  completionCmd
    .command("install")
    .description("Install shell completions (bash, zsh, fish)")
    .action(async () => {
      try {
        await installCompletions();
      } catch (err: any) {
        Sentry.captureException(err);
        console.error("Failed to install completions:", err.message);
        process.exit(1);
      }
    });

  completionCmd
    .command("uninstall")
    .description("Uninstall shell completions")
    .action(async () => {
      try {
        await uninstallCompletions();
      } catch (err: any) {
        Sentry.captureException(err);
        console.error("Failed to uninstall completions:", err.message);
        process.exit(1);
      }
    });

  // Parse arguments
  program.parse();
}
