import ora from "ora";
import { listTemplates, applyTemplate } from "../lib/api";
import {
  isLoggedIn,
  isProjectDir,
  getLocalProject,
} from "../lib/config";
import * as logger from "../utils/logger";
import { promptSelectTemplate, promptConfirm } from "../utils/prompts";
import { autoSync } from "./sync";

/**
 * List available templates
 */
export async function templateList(): Promise<void> {
  if (!isLoggedIn()) {
    logger.error("Not logged in. Run 'xgodo login' first.");
    process.exit(1);
  }

  const spinner = ora("Fetching templates...").start();

  try {
    const templates = await listTemplates();
    spinner.stop();

    if (templates.length === 0) {
      logger.info("No templates available");
      return;
    }

    logger.log("");
    logger.table(
      templates.map((t) => ({
        id: t.id,
        name: t.name,
        owner: t.owner_username,
        type: t.is_own ? "own" : t.is_public ? "public" : "shared",
      }))
    );
    logger.log("");
    logger.dim(`Total: ${templates.length} templates`);
  } catch (err: unknown) {
    spinner.stop();
    if (err instanceof Error) {
      logger.error(err.message);
    } else {
      logger.error("Failed to list templates");
    }
    process.exit(1);
  }
}

/**
 * Apply a template to the current project
 */
export async function templateApply(templateId?: string): Promise<void> {
  if (!isLoggedIn()) {
    logger.error("Not logged in. Run 'xgodo login' first.");
    process.exit(1);
  }

  if (!isProjectDir()) {
    logger.error("Not in a project directory. Run 'xgodo clone' first.");
    process.exit(1);
  }

  // Auto-sync before applying template
  await autoSync();

  const project = getLocalProject()!;

  let selectedTemplateId = templateId;

  // If no template ID provided, show selection prompt
  if (!selectedTemplateId) {
    const spinner = ora("Fetching templates...").start();
    try {
      const templates = await listTemplates();
      spinner.stop();

      if (templates.length === 0) {
        logger.info("No templates available");
        return;
      }

      selectedTemplateId = await promptSelectTemplate(templates);
    } catch (err: unknown) {
      spinner.stop();
      if (err instanceof Error) {
        logger.error(err.message);
      } else {
        logger.error("Failed to list templates");
      }
      process.exit(1);
    }
  }

  // Confirm before applying
  logger.warn("Applying a template will overwrite existing files with the same names.");
  const confirmed = await promptConfirm("Continue?");

  if (!confirmed) {
    logger.info("Cancelled");
    return;
  }

  const spinner = ora("Applying template...").start();

  try {
    const result = await applyTemplate(project.id, selectedTemplateId);
    spinner.stop();

    logger.success(`Applied template: ${result.files_copied} files copied`);
    for (const file of result.files) {
      logger.dim(`  + ${file}`);
    }

    logger.log("");
    logger.info("Run 'xgodo sync' to download the updated files");
  } catch (err: unknown) {
    spinner.stop();
    if (err instanceof Error) {
      logger.error(err.message);
    } else {
      logger.error("Failed to apply template");
    }
    process.exit(1);
  }
}
