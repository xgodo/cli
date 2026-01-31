import { clearConfig, isLoggedIn } from "../lib/config";
import * as logger from "../utils/logger";

export async function logout(): Promise<void> {
  if (!isLoggedIn()) {
    logger.info("Not logged in");
    return;
  }

  clearConfig();
  logger.success("Logged out successfully");
}
