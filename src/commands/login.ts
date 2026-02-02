import ora from "ora";
import Sentry from "@sentry/node";
import { validateApiKey } from "../lib/api";
import { saveConfig } from "../lib/config";
import { DEFAULT_API_URL } from "../lib/constants";
import * as logger from "../utils/logger";
import { promptApiKey, promptApiUrl } from "../utils/prompts";

interface LoginOptions {
  key?: string;
  url?: string;
}

export async function login(options: LoginOptions): Promise<void> {
  try {
    // Get API key
    const apiKey = options.key || (await promptApiKey());

    // Get API URL
    const apiUrl = options.url || DEFAULT_API_URL;

    // Validate API key
    const spinner = ora("Validating API key...").start();

    try {
      const user = await validateApiKey(apiKey, apiUrl);
      spinner.stop();

      // Save config
      saveConfig({
        apiKey,
        apiUrl,
        user,
      });

      logger.success(`Logged in as ${user.name} <${user.email}>`);
    } catch (err: unknown) {
      spinner.stop();
      Sentry.captureException(err);
      if (err instanceof Error) {
        logger.error(err.message);
      } else {
        logger.error("Failed to validate API key");
      }
      process.exit(1);
    }
  } catch (err: unknown) {
    Sentry.captureException(err);
    if (err instanceof Error) {
      logger.error(err.message);
    } else {
      logger.error("Login failed");
    }
    process.exit(1);
  }
}
