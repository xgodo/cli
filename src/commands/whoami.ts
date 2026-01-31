import { getConfig, isLoggedIn } from "../lib/config";
import * as logger from "../utils/logger";

export async function whoami(): Promise<void> {
  if (!isLoggedIn()) {
    logger.error("Not logged in. Run 'xgodo login' first.");
    process.exit(1);
  }

  const config = getConfig()!;
  logger.log(`${config.user.name} <${config.user.email}>`);
}
