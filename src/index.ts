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

const program = new Command();

program
  .name("xgodo")
  .description("CLI tool for Xgodo platform")
  .version("1.0.0");

// Login command
program
  .command("login")
  .description("Login with your API key")
  .option("-k, --key <key>", "API key (will prompt if not provided)")
  .option("-u, --url <url>", "API URL (default: https://xgodobackend.omdev.in/server)")
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
  .command("clone <project-id>")
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

// Parse arguments
program.parse();
