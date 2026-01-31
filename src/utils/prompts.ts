import inquirer from "inquirer";

/**
 * Prompt for API key (hidden input)
 */
export async function promptApiKey(): Promise<string> {
  const { apiKey } = await inquirer.prompt([
    {
      type: "password",
      name: "apiKey",
      message: "Enter your API key:",
      mask: "*",
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return "API key is required";
        }
        return true;
      },
    },
  ]);
  return apiKey.trim();
}

/**
 * Prompt for API URL
 */
export async function promptApiUrl(defaultUrl: string): Promise<string> {
  const { apiUrl } = await inquirer.prompt([
    {
      type: "input",
      name: "apiUrl",
      message: "Enter API URL:",
      default: defaultUrl,
    },
  ]);
  return apiUrl.trim();
}

/**
 * Prompt for commit message
 */
export async function promptCommitMessage(): Promise<string> {
  const { message } = await inquirer.prompt([
    {
      type: "input",
      name: "message",
      message: "Enter commit message:",
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return "Commit message is required";
        }
        return true;
      },
    },
  ]);
  return message.trim();
}

/**
 * Prompt to select a project from a list
 */
export async function promptSelectProject(
  projects: { id: string; name: string; role: string }[]
): Promise<string> {
  const choices = projects.map((p) => ({
    name: `${p.name} (${p.role})`,
    value: p.id,
  }));

  const { projectId } = await inquirer.prompt([
    {
      type: "list",
      name: "projectId",
      message: "Select a project:",
      choices,
    },
  ]);

  return projectId;
}

/**
 * Prompt to select a template from a list
 */
export async function promptSelectTemplate(
  templates: { id: string; name: string; owner_username: string }[]
): Promise<string> {
  const choices = templates.map((t) => ({
    name: `${t.name} (by ${t.owner_username})`,
    value: t.id,
  }));

  const { templateId } = await inquirer.prompt([
    {
      type: "list",
      name: "templateId",
      message: "Select a template:",
      choices,
    },
  ]);

  return templateId;
}

/**
 * Prompt for confirmation
 */
export async function promptConfirm(message: string): Promise<boolean> {
  const { confirmed } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirmed",
      message,
      default: false,
    },
  ]);
  return confirmed;
}

/**
 * Prompt for directory path
 */
export async function promptPath(
  message: string,
  defaultPath: string
): Promise<string> {
  const { path } = await inquirer.prompt([
    {
      type: "input",
      name: "path",
      message,
      default: defaultPath,
    },
  ]);
  return path.trim();
}
