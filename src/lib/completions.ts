import tabtab from "tabtab";
import { isLoggedIn } from "./config";
import { listProjects, listTemplates } from "./api";

// Top-level commands
const TOP_COMMANDS = [
  { name: "login", description: "Login with your API key" },
  { name: "logout", description: "Logout and clear stored credentials" },
  { name: "whoami", description: "Show current logged-in user" },
  { name: "project", description: "Manage automation projects" },
  { name: "p", description: "Manage automation projects (alias)" },
  { name: "completion", description: "Manage shell completions" },
];

// Project subcommands
const PROJECT_COMMANDS = [
  { name: "list", description: "List your automation projects" },
  { name: "ls", description: "List your automation projects (alias)" },
  { name: "clone", description: "Clone a project to local directory" },
  { name: "sync", description: "Sync local changes with server" },
  { name: "commit", description: "Commit changes to the project" },
  { name: "template", description: "Manage project templates" },
  { name: "t", description: "Manage project templates (alias)" },
];

// Template subcommands
const TEMPLATE_COMMANDS = [
  { name: "list", description: "List available templates" },
  { name: "ls", description: "List available templates (alias)" },
  { name: "apply", description: "Apply a template to current project" },
];

// Completion subcommands
const COMPLETION_COMMANDS = [
  { name: "install", description: "Install shell completions" },
  { name: "uninstall", description: "Uninstall shell completions" },
];

// Options for various commands
const LOGIN_OPTIONS = [
  { name: "-k", description: "API key" },
  { name: "--key", description: "API key" },
  { name: "-u", description: "API URL" },
  { name: "--url", description: "API URL" },
];

const CLONE_OPTIONS = [
  { name: "-p", description: "Target directory path" },
  { name: "--path", description: "Target directory path" },
];

const COMMIT_OPTIONS = [
  { name: "-m", description: "Commit message" },
  { name: "--message", description: "Commit message" },
  { name: "-f", description: "Use default commit message" },
  { name: "--force", description: "Use default commit message" },
];

/**
 * Fetch project IDs for completion
 */
async function getProjectCompletions(): Promise<{ name: string; description: string }[]> {
  if (!isLoggedIn()) {
    return [];
  }

  try {
    const projects = await listProjects();
    return projects.map((p) => ({
      name: p.id,
      description: `${p.name} (${p.role})`,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch template IDs for completion
 */
async function getTemplateCompletions(): Promise<{ name: string; description: string }[]> {
  if (!isLoggedIn()) {
    return [];
  }

  try {
    const templates = await listTemplates();
    return templates.map((t) => ({
      name: t.id,
      description: `${t.name} (by ${t.owner_username})`,
    }));
  } catch {
    return [];
  }
}

/**
 * Handle tab completion
 */
export async function handleCompletion(): Promise<void> {
  const env = tabtab.parseEnv(process.env);

  if (!env.complete) {
    return;
  }

  const { line, prev } = env;
  // Parse words from the line
  const words = line.split(/\s+/).filter(Boolean);
  const args = words.slice(1); // Remove 'xgodo' from the beginning

  // No args yet - show top-level commands
  if (args.length === 0 || (args.length === 1 && !line.endsWith(" "))) {
    return tabtab.log(TOP_COMMANDS);
  }

  const firstArg = args[0];
  const secondArg = args[1];
  const thirdArg = args[2];

  // Completing login options
  if (firstArg === "login") {
    if (prev === "-k" || prev === "--key" || prev === "-u" || prev === "--url") {
      return; // Don't complete values
    }
    return tabtab.log(LOGIN_OPTIONS);
  }

  // Completing project subcommands
  if (firstArg === "project" || firstArg === "p") {
    // No subcommand yet
    if (args.length === 1 || (args.length === 2 && !line.endsWith(" "))) {
      return tabtab.log(PROJECT_COMMANDS);
    }

    // Completing template subcommands
    if (secondArg === "template" || secondArg === "t") {
      if (args.length === 2 || (args.length === 3 && !line.endsWith(" "))) {
        return tabtab.log(TEMPLATE_COMMANDS);
      }

      // Completing template apply <template-id>
      if (thirdArg === "apply") {
        const templates = await getTemplateCompletions();
        return tabtab.log(templates);
      }

      return;
    }

    // Completing clone <project-id>
    if (secondArg === "clone") {
      if (prev === "-p" || prev === "--path") {
        return; // Let shell handle path completion
      }

      // Check if we're completing options or project ID
      if (args.length === 2 || (args.length === 3 && !line.endsWith(" ") && !args[2].startsWith("-"))) {
        const projects = await getProjectCompletions();
        return tabtab.log([...projects, ...CLONE_OPTIONS]);
      }

      return tabtab.log(CLONE_OPTIONS);
    }

    // Completing commit options
    if (secondArg === "commit") {
      if (prev === "-m" || prev === "--message") {
        return; // Don't complete message value
      }
      return tabtab.log(COMMIT_OPTIONS);
    }

    return;
  }

  // Completing completion subcommands
  if (firstArg === "completion") {
    if (args.length === 1 || (args.length === 2 && !line.endsWith(" "))) {
      return tabtab.log(COMPLETION_COMMANDS);
    }
    return;
  }
}

/**
 * Install shell completions
 */
export async function installCompletions(): Promise<void> {
  await tabtab.install({
    name: "xgodo",
    completer: "xgodo",
  });
}

/**
 * Uninstall shell completions
 */
export async function uninstallCompletions(): Promise<void> {
  await tabtab.uninstall({
    name: "xgodo",
  });
}
