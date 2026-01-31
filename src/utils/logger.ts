import chalk from "chalk";

export function success(message: string): void {
  console.log(chalk.green("✓"), message);
}

export function error(message: string): void {
  console.error(chalk.red("✗"), message);
}

export function warn(message: string): void {
  console.log(chalk.yellow("!"), message);
}

export function info(message: string): void {
  console.log(chalk.blue("i"), message);
}

export function log(message: string): void {
  console.log(message);
}

export function dim(message: string): void {
  console.log(chalk.dim(message));
}

export function table(data: Record<string, string>[]): void {
  if (data.length === 0) {
    console.log(chalk.dim("  No data"));
    return;
  }

  // Get column headers
  const headers = Object.keys(data[0]);

  // Calculate column widths
  const widths: Record<string, number> = {};
  for (const header of headers) {
    widths[header] = header.length;
    for (const row of data) {
      const value = String(row[header] || "");
      widths[header] = Math.max(widths[header], value.length);
    }
  }

  // Print header
  const headerLine = headers
    .map((h) => chalk.bold(h.toUpperCase().padEnd(widths[h])))
    .join("  ");
  console.log(headerLine);

  // Print rows
  for (const row of data) {
    const line = headers
      .map((h) => String(row[h] || "").padEnd(widths[h]))
      .join("  ");
    console.log(line);
  }
}
