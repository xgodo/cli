import ora from "ora";
import Sentry from "@sentry/node";
import { listProjects } from "../lib/api";
import { isLoggedIn } from "../lib/config";
import * as logger from "../utils/logger";

export async function list(): Promise<void> {
  if (!isLoggedIn()) {
    logger.error("Not logged in. Run 'xgodo login' first.");
    process.exit(1);
  }

  const spinner = ora("Fetching projects...").start();

  try {
    const projects = await listProjects();
    spinner.stop();

    if (projects.length === 0) {
      logger.info("No projects found");
      return;
    }

    logger.log("");
    logger.table(
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        owner: p.owner_username || "-",
      }))
    );
    logger.log("");
    logger.dim(`Total: ${projects.length} projects`);
  } catch (err: unknown) {
    spinner.stop();
    Sentry.captureException(err);
    if (err instanceof Error) {
      logger.error(err.message);
    } else {
      logger.error("Failed to list projects");
    }
    process.exit(1);
  }
}
