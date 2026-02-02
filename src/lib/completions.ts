import tabtab from "tabtab";
import Sentry from "@sentry/node";
import { isLoggedIn } from "./config";
import { listProjects, listTemplates } from "./api";

// Command definitions
const COMMANDS = {
  top: [
    { name: "login", description: "Login with your API key" },
    { name: "logout", description: "Logout and clear credentials" },
    { name: "whoami", description: "Show current user" },
    { name: "project", description: "Manage automation projects" },
    { name: "p", description: "Manage automation projects (alias)" },
    { name: "completion", description: "Manage shell completions" },
  ],
  project: [
    { name: "list", description: "List your projects" },
    { name: "ls", description: "List your projects (alias)" },
    { name: "clone", description: "Clone a project locally" },
    { name: "sync", description: "Sync changes with server" },
    { name: "commit", description: "Commit changes" },
    { name: "status", description: "Show uncommitted changes" },
    { name: "log", description: "Show commit history" },
    { name: "diff", description: "Show diff with last commit" },
    { name: "template", description: "Manage templates" },
    { name: "t", description: "Manage templates (alias)" },
    { name: "arguments", description: "Manage arguments" },
    { name: "args", description: "Manage arguments (alias)" },
  ],
  arguments: [
    { name: "list", description: "List automation parameters and job variables" },
    { name: "ls", description: "List automation parameters and job variables (alias)" },
    { name: "edit", description: "Edit arguments interactively" },
  ],
  template: [
    { name: "list", description: "List available templates" },
    { name: "ls", description: "List available templates (alias)" },
    { name: "apply", description: "Apply a template" },
  ],
  completion: [
    { name: "install", description: "Install shell completions" },
    { name: "uninstall", description: "Uninstall shell completions" },
  ],
};

const OPTIONS = {
  login: [
    { name: "-k", description: "API key" },
    { name: "--key", description: "API key" },
    { name: "-u", description: "API URL" },
    { name: "--url", description: "API URL" },
  ],
  clone: [
    { name: "-p", description: "Target directory path" },
    { name: "--path", description: "Target directory path" },
  ],
  commit: [
    { name: "-m", description: "Commit message" },
    { name: "--message", description: "Commit message" },
    { name: "-f", description: "Use default message" },
    { name: "--force", description: "Use default message" },
  ],
  log: [
    { name: "-n", description: "Number of commits" },
    { name: "--limit", description: "Number of commits" },
  ],
  diff: [
    { name: "-f", description: "Show diff for a specific file" },
    { name: "--file", description: "Show diff for a specific file" },
  ],
};

/**
 * Fetch project IDs for completion
 */
async function getProjectCompletions(): Promise<{ name: string; description: string }[]> {
  if (!isLoggedIn()) return [];
  try {
    const projects = await listProjects();
    return projects.map((p) => ({
      name: p.id,
      description: `${p.name} (${p.role})`,
    }));
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

/**
 * Fetch template IDs for completion
 */
async function getTemplateCompletions(): Promise<{ name: string; description: string }[]> {
  if (!isLoggedIn()) return [];
  try {
    const templates = await listTemplates();
    return templates.map((t) => ({
      name: t.id,
      description: `${t.name} (by ${t.owner_username})`,
    }));
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

/**
 * Handle tab completion
 */
export async function handleCompletion(): Promise<boolean> {
  const env = tabtab.parseEnv(process.env);

  if (!env.complete) {
    return false;
  }

  const { line, prev } = env;
  const words = line.split(/\s+/).filter(Boolean);
  const args = words.slice(1); // Remove 'xgodo'

  try {
    // No args - show top-level commands
    if (args.length === 0 || (args.length === 1 && !line.endsWith(" "))) {
      tabtab.log(COMMANDS.top);
      return true;
    }

    const first = args[0];
    const second = args[1];
    const third = args[2];

    // Login options
    if (first === "login") {
      if (prev === "-k" || prev === "--key" || prev === "-u" || prev === "--url") {
        return true; // Don't complete values
      }
      tabtab.log(OPTIONS.login);
      return true;
    }

    // Project commands
    if (first === "project" || first === "p") {
      if (args.length === 1 || (args.length === 2 && !line.endsWith(" "))) {
        tabtab.log(COMMANDS.project);
        return true;
      }

      // Template subcommands
      if (second === "template" || second === "t") {
        if (args.length === 2 || (args.length === 3 && !line.endsWith(" "))) {
          tabtab.log(COMMANDS.template);
          return true;
        }

        // template apply <template-id>
        if (third === "apply") {
          const templates = await getTemplateCompletions();
          tabtab.log(templates);
          return true;
        }
        return true;
      }

      // clone <project-id>
      if (second === "clone") {
        if (prev === "-p" || prev === "--path") {
          return true; // Let shell handle path completion
        }
        if (args.length === 2 || (args.length === 3 && !line.endsWith(" ") && !args[2]?.startsWith("-"))) {
          const projects = await getProjectCompletions();
          tabtab.log(projects);
          return true;
        }
        tabtab.log(OPTIONS.clone);
        return true;
      }

      // commit options
      if (second === "commit") {
        if (prev === "-m" || prev === "--message") {
          return true; // Don't complete message
        }
        tabtab.log(OPTIONS.commit);
        return true;
      }

      // Arguments subcommands
      if (second === "arguments" || second === "args") {
        if (args.length === 2 || (args.length === 3 && !line.endsWith(" "))) {
          tabtab.log(COMMANDS.arguments);
          return true;
        }
        return true;
      }

      // log options
      if (second === "log") {
        if (prev === "-n" || prev === "--limit") {
          return true; // Don't complete values
        }
        tabtab.log(OPTIONS.log);
        return true;
      }

      // diff options
      if (second === "diff") {
        if (prev === "-f" || prev === "--file") {
          return true; // Let shell handle file completion
        }
        tabtab.log(OPTIONS.diff);
        return true;
      }

      return true;
    }

    // Completion commands
    if (first === "completion") {
      if (args.length === 1 || (args.length === 2 && !line.endsWith(" "))) {
        tabtab.log(COMMANDS.completion);
        return true;
      }
      return true;
    }

    return true;
  } catch (err) {
    // Fail silently for completions
    Sentry.captureException(err);
    return true;
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
