import ora from "ora";
import inquirer from "inquirer";
import { getProjectDetails, updateProjectOptions, listProjects } from "../lib/api";
import {
  isLoggedIn,
  isProjectDir,
  getLocalProject,
} from "../lib/config";
import { IFieldSchema, IInputSchema } from "../lib/types";
import * as logger from "../utils/logger";
import { promptSelectProject } from "../utils/prompts";

/**
 * Get the type string representation for a field (e.g., "string[][]")
 */
function getTypeString(field: IFieldSchema): string {
  if (field.type !== "array") {
    return field.type;
  }
  if (!field.items) return "any[]";
  return getArrayTypeString(field.items, 1);
}

function getArrayTypeString(field: IFieldSchema, depth: number): string {
  if (field.type !== "array") {
    if (field.type === "object") return "object" + "[]".repeat(depth);
    return field.type + "[]".repeat(depth);
  }
  if (!field.items) return "any" + "[]".repeat(depth + 1);
  return getArrayTypeString(field.items, depth + 1);
}

/**
 * Format a field for display
 */
function formatField(field: IFieldSchema, indent: string = "  "): string[] {
  const lines: string[] = [];
  const typeStr = getTypeString(field);
  const requiredStr = field.required ? " (required)" : "";

  lines.push(`${indent}${field.name}: ${typeStr}${requiredStr}`);

  if (field.description) {
    lines.push(`${indent}  Description: ${field.description}`);
  }

  if (field.defaultValue !== undefined) {
    lines.push(`${indent}  Default: ${JSON.stringify(field.defaultValue)}`);
  }

  if (field.enum && field.enum.length > 0) {
    lines.push(`${indent}  Enum: ${field.enum.join(", ")}`);
  }

  // String validations
  if (field.type === "string") {
    if (field.minLength !== undefined) {
      lines.push(`${indent}  Min length: ${field.minLength}`);
    }
    if (field.maxLength !== undefined) {
      lines.push(`${indent}  Max length: ${field.maxLength}`);
    }
    if (field.pattern) {
      lines.push(`${indent}  Pattern: ${field.pattern}`);
    }
  }

  // Number validations
  if (field.type === "number") {
    if (field.min !== undefined) {
      lines.push(`${indent}  Min: ${field.min}`);
    }
    if (field.max !== undefined) {
      lines.push(`${indent}  Max: ${field.max}`);
    }
    if (field.integer) {
      lines.push(`${indent}  Integer: yes`);
    }
  }

  // Array validations
  if (field.type === "array") {
    if (field.minItems !== undefined) {
      lines.push(`${indent}  Min items: ${field.minItems}`);
    }
    if (field.maxItems !== undefined) {
      lines.push(`${indent}  Max items: ${field.maxItems}`);
    }
  }

  // Object properties
  if (field.type === "object" && field.properties && field.properties.length > 0) {
    lines.push(`${indent}  Properties:`);
    for (const prop of field.properties) {
      lines.push(...formatField(prop, indent + "    "));
    }
  }

  return lines;
}

/**
 * Display a schema
 */
function displaySchema(schema: IInputSchema | null, title: string): void {
  logger.log(`\n${title}:`);

  if (!schema || !schema.fields || schema.fields.length === 0) {
    logger.dim("  (none)");
    return;
  }

  for (const field of schema.fields) {
    const lines = formatField(field);
    for (const line of lines) {
      logger.log(line);
    }
    logger.log("");
  }
}

/**
 * List automation arguments (parameters and job variables)
 */
export async function argumentsList(): Promise<void> {
  if (!isLoggedIn()) {
    logger.error("Not logged in. Run 'xgodo login' first.");
    process.exit(1);
  }

  let projectId: string;

  // Check if we're in a project directory
  if (isProjectDir()) {
    const project = getLocalProject()!;
    projectId = project.id;
  } else {
    // Not in a project directory, prompt to select one
    const spinner = ora("Fetching projects...").start();
    try {
      const projects = await listProjects();
      spinner.stop();

      if (projects.length === 0) {
        logger.info("No projects available");
        return;
      }

      projectId = await promptSelectProject(projects);
    } catch (err: unknown) {
      spinner.stop();
      if (err instanceof Error) {
        logger.error(err.message);
      } else {
        logger.error("Failed to list projects");
      }
      process.exit(1);
    }
  }

  const spinner = ora("Fetching project details...").start();

  try {
    const details = await getProjectDetails(projectId);
    spinner.stop();

    logger.log(`\nProject: ${details.name}`);
    logger.dim(`ID: ${details.id}`);

    displaySchema(details.automation_parameters_schema, "Automation Parameters");
    displaySchema(details.job_variables_schema, "Job Variables");

  } catch (err: unknown) {
    spinner.stop();
    if (err instanceof Error) {
      logger.error(err.message);
    } else {
      logger.error("Failed to fetch project details");
    }
    process.exit(1);
  }
}

/**
 * Types for field editing
 */
type FieldType = "string" | "number" | "boolean" | "array" | "object" | "any";

const FIELD_TYPES: FieldType[] = ["string", "number", "boolean", "array", "object", "any"];

/**
 * Create a new field interactively
 */
async function createField(): Promise<IFieldSchema | null> {
  const { name } = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "Field name:",
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return "Field name is required";
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input.trim())) {
          return "Field name must start with a letter or underscore, and contain only letters, numbers, and underscores";
        }
        return true;
      },
    },
  ]);

  const { type } = await inquirer.prompt([
    {
      type: "list",
      name: "type",
      message: "Field type:",
      choices: FIELD_TYPES,
    },
  ]);

  const { required } = await inquirer.prompt([
    {
      type: "confirm",
      name: "required",
      message: "Is this field required?",
      default: false,
    },
  ]);

  const { description } = await inquirer.prompt([
    {
      type: "input",
      name: "description",
      message: "Description (optional):",
    },
  ]);

  const field: IFieldSchema = {
    name: name.trim(),
    type,
    required,
  };

  if (description.trim()) {
    field.description = description.trim();
  }

  // Type-specific options
  if (type === "string") {
    const { hasStringOptions } = await inquirer.prompt([
      {
        type: "confirm",
        name: "hasStringOptions",
        message: "Add string validations (minLength, maxLength, pattern, enum)?",
        default: false,
      },
    ]);

    if (hasStringOptions) {
      const stringOpts = await inquirer.prompt([
        {
          type: "input",
          name: "minLength",
          message: "Min length (leave empty for none):",
        },
        {
          type: "input",
          name: "maxLength",
          message: "Max length (leave empty for none):",
        },
        {
          type: "input",
          name: "pattern",
          message: "Regex pattern (leave empty for none):",
        },
        {
          type: "input",
          name: "enumValues",
          message: "Enum values (comma-separated, leave empty for none):",
        },
      ]);

      if (stringOpts.minLength) {
        const val = parseInt(stringOpts.minLength, 10);
        if (!isNaN(val)) field.minLength = val;
      }
      if (stringOpts.maxLength) {
        const val = parseInt(stringOpts.maxLength, 10);
        if (!isNaN(val)) field.maxLength = val;
      }
      if (stringOpts.pattern.trim()) {
        field.pattern = stringOpts.pattern.trim();
      }
      if (stringOpts.enumValues.trim()) {
        field.enum = stringOpts.enumValues.split(",").map((s: string) => s.trim()).filter((s: string) => s);
      }
    }
  }

  if (type === "number") {
    const { hasNumberOptions } = await inquirer.prompt([
      {
        type: "confirm",
        name: "hasNumberOptions",
        message: "Add number validations (min, max, integer)?",
        default: false,
      },
    ]);

    if (hasNumberOptions) {
      const numOpts = await inquirer.prompt([
        {
          type: "input",
          name: "min",
          message: "Min value (leave empty for none):",
        },
        {
          type: "input",
          name: "max",
          message: "Max value (leave empty for none):",
        },
        {
          type: "confirm",
          name: "integer",
          message: "Must be integer?",
          default: false,
        },
      ]);

      if (numOpts.min) {
        const val = parseFloat(numOpts.min);
        if (!isNaN(val)) field.min = val;
      }
      if (numOpts.max) {
        const val = parseFloat(numOpts.max);
        if (!isNaN(val)) field.max = val;
      }
      if (numOpts.integer) {
        field.integer = true;
      }
    }
  }

  if (type === "array") {
    const { itemType } = await inquirer.prompt([
      {
        type: "list",
        name: "itemType",
        message: "Array item type:",
        choices: FIELD_TYPES,
      },
    ]);

    field.items = { name: "", type: itemType };

    // If array of objects, allow defining properties
    if (itemType === "object") {
      const { defineProperties } = await inquirer.prompt([
        {
          type: "confirm",
          name: "defineProperties",
          message: "Define object properties now?",
          default: false,
        },
      ]);

      if (defineProperties) {
        field.items.properties = await editFieldsLoop([]);
      }
    }

    const { hasArrayOptions } = await inquirer.prompt([
      {
        type: "confirm",
        name: "hasArrayOptions",
        message: "Add array validations (minItems, maxItems)?",
        default: false,
      },
    ]);

    if (hasArrayOptions) {
      const arrOpts = await inquirer.prompt([
        {
          type: "input",
          name: "minItems",
          message: "Min items (leave empty for none):",
        },
        {
          type: "input",
          name: "maxItems",
          message: "Max items (leave empty for none):",
        },
      ]);

      if (arrOpts.minItems) {
        const val = parseInt(arrOpts.minItems, 10);
        if (!isNaN(val)) field.minItems = val;
      }
      if (arrOpts.maxItems) {
        const val = parseInt(arrOpts.maxItems, 10);
        if (!isNaN(val)) field.maxItems = val;
      }
    }
  }

  if (type === "object") {
    const { defineProperties } = await inquirer.prompt([
      {
        type: "confirm",
        name: "defineProperties",
        message: "Define object properties now?",
        default: false,
      },
    ]);

    if (defineProperties) {
      field.properties = await editFieldsLoop([]);
    }
  }

  // Default value
  const { hasDefault } = await inquirer.prompt([
    {
      type: "confirm",
      name: "hasDefault",
      message: "Set a default value?",
      default: false,
    },
  ]);

  if (hasDefault) {
    const { defaultValue } = await inquirer.prompt([
      {
        type: "input",
        name: "defaultValue",
        message: "Default value (JSON format for objects/arrays):",
      },
    ]);

    try {
      // Try to parse as JSON first
      field.defaultValue = JSON.parse(defaultValue);
    } catch {
      // If not valid JSON, use as string (or parse based on type)
      if (type === "number") {
        const val = parseFloat(defaultValue);
        if (!isNaN(val)) field.defaultValue = val;
      } else if (type === "boolean") {
        field.defaultValue = defaultValue.toLowerCase() === "true";
      } else {
        field.defaultValue = defaultValue;
      }
    }
  }

  return field;
}

/**
 * Edit a field's properties
 */
async function editFieldProperties(field: IFieldSchema): Promise<IFieldSchema> {
  const { property } = await inquirer.prompt([
    {
      type: "list",
      name: "property",
      message: "What would you like to edit?",
      choices: [
        { name: "Name", value: "name" },
        { name: "Type", value: "type" },
        { name: "Required", value: "required" },
        { name: "Description", value: "description" },
        { name: "Default value", value: "defaultValue" },
        ...(field.type === "string" ? [
          { name: "Enum values", value: "enum" },
          { name: "Min length", value: "minLength" },
          { name: "Max length", value: "maxLength" },
          { name: "Pattern", value: "pattern" },
        ] : []),
        ...(field.type === "number" ? [
          { name: "Min value", value: "min" },
          { name: "Max value", value: "max" },
          { name: "Integer only", value: "integer" },
        ] : []),
        ...(field.type === "array" ? [
          { name: "Min items", value: "minItems" },
          { name: "Max items", value: "maxItems" },
          { name: "Item type", value: "items" },
        ] : []),
        ...(field.type === "object" ? [
          { name: "Properties", value: "properties" },
        ] : []),
        { name: "Cancel", value: "cancel" },
      ],
    },
  ]);

  if (property === "cancel") {
    return field;
  }

  const updated = { ...field };

  switch (property) {
    case "name": {
      const { name } = await inquirer.prompt([
        {
          type: "input",
          name: "name",
          message: "New name:",
          default: field.name,
          validate: (input: string) => {
            if (!input || input.trim().length === 0) {
              return "Field name is required";
            }
            return true;
          },
        },
      ]);
      updated.name = name.trim();
      break;
    }
    case "type": {
      const { type } = await inquirer.prompt([
        {
          type: "list",
          name: "type",
          message: "New type:",
          choices: FIELD_TYPES,
          default: field.type,
        },
      ]);
      updated.type = type;
      // Clear type-specific fields if type changed
      if (type !== field.type) {
        delete updated.minLength;
        delete updated.maxLength;
        delete updated.pattern;
        delete updated.enum;
        delete updated.min;
        delete updated.max;
        delete updated.integer;
        delete updated.minItems;
        delete updated.maxItems;
        delete updated.items;
        delete updated.properties;

        if (type === "array") {
          updated.items = { name: "", type: "string" };
        }
        if (type === "object") {
          updated.properties = [];
        }
      }
      break;
    }
    case "required": {
      const { required } = await inquirer.prompt([
        {
          type: "confirm",
          name: "required",
          message: "Is this field required?",
          default: field.required || false,
        },
      ]);
      updated.required = required;
      break;
    }
    case "description": {
      const { description } = await inquirer.prompt([
        {
          type: "input",
          name: "description",
          message: "Description:",
          default: field.description || "",
        },
      ]);
      if (description.trim()) {
        updated.description = description.trim();
      } else {
        delete updated.description;
      }
      break;
    }
    case "defaultValue": {
      const { defaultValue } = await inquirer.prompt([
        {
          type: "input",
          name: "defaultValue",
          message: "Default value (JSON format, or leave empty to clear):",
          default: field.defaultValue !== undefined ? JSON.stringify(field.defaultValue) : "",
        },
      ]);
      if (defaultValue.trim()) {
        try {
          updated.defaultValue = JSON.parse(defaultValue);
        } catch {
          if (field.type === "number") {
            const val = parseFloat(defaultValue);
            if (!isNaN(val)) updated.defaultValue = val;
          } else if (field.type === "boolean") {
            updated.defaultValue = defaultValue.toLowerCase() === "true";
          } else {
            updated.defaultValue = defaultValue;
          }
        }
      } else {
        delete updated.defaultValue;
      }
      break;
    }
    case "enum": {
      const { enumValues } = await inquirer.prompt([
        {
          type: "input",
          name: "enumValues",
          message: "Enum values (comma-separated, leave empty to clear):",
          default: field.enum ? field.enum.join(", ") : "",
        },
      ]);
      if (enumValues.trim()) {
        updated.enum = enumValues.split(",").map((s: string) => s.trim()).filter((s: string) => s);
      } else {
        delete updated.enum;
      }
      break;
    }
    case "minLength": {
      const { minLength } = await inquirer.prompt([
        {
          type: "input",
          name: "minLength",
          message: "Min length (leave empty to clear):",
          default: field.minLength?.toString() || "",
        },
      ]);
      if (minLength.trim()) {
        const val = parseInt(minLength, 10);
        if (!isNaN(val)) updated.minLength = val;
      } else {
        delete updated.minLength;
      }
      break;
    }
    case "maxLength": {
      const { maxLength } = await inquirer.prompt([
        {
          type: "input",
          name: "maxLength",
          message: "Max length (leave empty to clear):",
          default: field.maxLength?.toString() || "",
        },
      ]);
      if (maxLength.trim()) {
        const val = parseInt(maxLength, 10);
        if (!isNaN(val)) updated.maxLength = val;
      } else {
        delete updated.maxLength;
      }
      break;
    }
    case "pattern": {
      const { pattern } = await inquirer.prompt([
        {
          type: "input",
          name: "pattern",
          message: "Regex pattern (leave empty to clear):",
          default: field.pattern || "",
        },
      ]);
      if (pattern.trim()) {
        updated.pattern = pattern.trim();
      } else {
        delete updated.pattern;
      }
      break;
    }
    case "min": {
      const { min } = await inquirer.prompt([
        {
          type: "input",
          name: "min",
          message: "Min value (leave empty to clear):",
          default: field.min?.toString() || "",
        },
      ]);
      if (min.trim()) {
        const val = parseFloat(min);
        if (!isNaN(val)) updated.min = val;
      } else {
        delete updated.min;
      }
      break;
    }
    case "max": {
      const { max } = await inquirer.prompt([
        {
          type: "input",
          name: "max",
          message: "Max value (leave empty to clear):",
          default: field.max?.toString() || "",
        },
      ]);
      if (max.trim()) {
        const val = parseFloat(max);
        if (!isNaN(val)) updated.max = val;
      } else {
        delete updated.max;
      }
      break;
    }
    case "integer": {
      const { integer } = await inquirer.prompt([
        {
          type: "confirm",
          name: "integer",
          message: "Must be integer?",
          default: field.integer || false,
        },
      ]);
      if (integer) {
        updated.integer = true;
      } else {
        delete updated.integer;
      }
      break;
    }
    case "minItems": {
      const { minItems } = await inquirer.prompt([
        {
          type: "input",
          name: "minItems",
          message: "Min items (leave empty to clear):",
          default: field.minItems?.toString() || "",
        },
      ]);
      if (minItems.trim()) {
        const val = parseInt(minItems, 10);
        if (!isNaN(val)) updated.minItems = val;
      } else {
        delete updated.minItems;
      }
      break;
    }
    case "maxItems": {
      const { maxItems } = await inquirer.prompt([
        {
          type: "input",
          name: "maxItems",
          message: "Max items (leave empty to clear):",
          default: field.maxItems?.toString() || "",
        },
      ]);
      if (maxItems.trim()) {
        const val = parseInt(maxItems, 10);
        if (!isNaN(val)) updated.maxItems = val;
      } else {
        delete updated.maxItems;
      }
      break;
    }
    case "items": {
      const { itemType } = await inquirer.prompt([
        {
          type: "list",
          name: "itemType",
          message: "Item type:",
          choices: FIELD_TYPES,
          default: field.items?.type || "string",
        },
      ]);
      updated.items = { name: "", type: itemType };
      if (itemType === "object") {
        const { editProps } = await inquirer.prompt([
          {
            type: "confirm",
            name: "editProps",
            message: "Edit object properties?",
            default: false,
          },
        ]);
        if (editProps) {
          updated.items.properties = await editFieldsLoop(field.items?.properties || []);
        }
      }
      break;
    }
    case "properties": {
      updated.properties = await editFieldsLoop(field.properties || []);
      break;
    }
  }

  return updated;
}

/**
 * Interactive fields editing loop
 */
async function editFieldsLoop(fields: IFieldSchema[]): Promise<IFieldSchema[]> {
  let currentFields = [...fields];

  while (true) {
    const choices: { name: string; value: string }[] = [];

    // Add existing fields as edit options
    for (let i = 0; i < currentFields.length; i++) {
      const f = currentFields[i];
      const typeStr = getTypeString(f);
      const reqStr = f.required ? " *" : "";
      choices.push({
        name: `Edit: ${f.name} (${typeStr})${reqStr}`,
        value: `edit:${i}`,
      });
    }

    choices.push({ name: "Add new field", value: "add" });

    if (currentFields.length > 0) {
      choices.push({ name: "Delete a field", value: "delete" });
      choices.push({ name: "Reorder fields", value: "reorder" });
    }

    choices.push({ name: "Done editing", value: "done" });

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: `Fields (${currentFields.length}):`,
        choices,
      },
    ]);

    if (action === "done") {
      break;
    }

    if (action === "add") {
      const newField = await createField();
      if (newField) {
        currentFields.push(newField);
        logger.success(`Added field: ${newField.name}`);
      }
    } else if (action === "delete") {
      const deleteChoices = currentFields.map((f, i) => ({
        name: `${f.name} (${getTypeString(f)})`,
        value: i,
      }));
      deleteChoices.push({ name: "Cancel", value: -1 });

      const { index } = await inquirer.prompt([
        {
          type: "list",
          name: "index",
          message: "Select field to delete:",
          choices: deleteChoices,
        },
      ]);

      if (index >= 0) {
        const deleted = currentFields.splice(index, 1)[0];
        logger.warn(`Deleted field: ${deleted.name}`);
      }
    } else if (action === "reorder") {
      const { fromIndex } = await inquirer.prompt([
        {
          type: "list",
          name: "fromIndex",
          message: "Select field to move:",
          choices: currentFields.map((f, i) => ({
            name: `${i + 1}. ${f.name}`,
            value: i,
          })),
        },
      ]);

      const { toIndex } = await inquirer.prompt([
        {
          type: "input",
          name: "toIndex",
          message: `Move to position (1-${currentFields.length}):`,
          validate: (input: string) => {
            const val = parseInt(input, 10);
            if (isNaN(val) || val < 1 || val > currentFields.length) {
              return `Enter a number between 1 and ${currentFields.length}`;
            }
            return true;
          },
        },
      ]);

      const targetIndex = parseInt(toIndex, 10) - 1;
      const [field] = currentFields.splice(fromIndex, 1);
      currentFields.splice(targetIndex, 0, field);
      logger.info(`Moved ${field.name} to position ${targetIndex + 1}`);
    } else if (action.startsWith("edit:")) {
      const index = parseInt(action.split(":")[1], 10);
      currentFields[index] = await editFieldProperties(currentFields[index]);
    }
  }

  return currentFields;
}

/**
 * Edit automation arguments interactively
 */
export async function argumentsEdit(): Promise<void> {
  if (!isLoggedIn()) {
    logger.error("Not logged in. Run 'xgodo login' first.");
    process.exit(1);
  }

  let projectId: string;

  // Check if we're in a project directory
  if (isProjectDir()) {
    const project = getLocalProject()!;
    projectId = project.id;
  } else {
    // Not in a project directory, prompt to select one
    const spinner = ora("Fetching projects...").start();
    try {
      const projects = await listProjects();
      spinner.stop();

      if (projects.length === 0) {
        logger.info("No projects available");
        return;
      }

      projectId = await promptSelectProject(projects);
    } catch (err: unknown) {
      spinner.stop();
      if (err instanceof Error) {
        logger.error(err.message);
      } else {
        logger.error("Failed to list projects");
      }
      process.exit(1);
    }
  }

  const spinner = ora("Fetching project details...").start();

  let details;
  try {
    details = await getProjectDetails(projectId);
    spinner.stop();
  } catch (err: unknown) {
    spinner.stop();
    if (err instanceof Error) {
      logger.error(err.message);
    } else {
      logger.error("Failed to fetch project details");
    }
    process.exit(1);
  }

  logger.log(`\nEditing arguments for: ${details.name}`);
  logger.dim(`ID: ${details.id}\n`);

  let automationParams = details.automation_parameters_schema?.fields || [];
  let jobVars = details.job_variables_schema?.fields || [];
  let hasChanges = false;

  while (true) {
    const { section } = await inquirer.prompt([
      {
        type: "list",
        name: "section",
        message: "What would you like to edit?",
        choices: [
          {
            name: `Automation Parameters (${automationParams.length} fields)`,
            value: "params",
          },
          {
            name: `Job Variables (${jobVars.length} fields)`,
            value: "vars",
          },
          { name: "View current configuration", value: "view" },
          { name: "Save and exit", value: "save" },
          { name: "Exit without saving", value: "cancel" },
        ],
      },
    ]);

    if (section === "params") {
      const newFields = await editFieldsLoop(automationParams);
      if (JSON.stringify(newFields) !== JSON.stringify(automationParams)) {
        automationParams = newFields;
        hasChanges = true;
      }
    } else if (section === "vars") {
      const newFields = await editFieldsLoop(jobVars);
      if (JSON.stringify(newFields) !== JSON.stringify(jobVars)) {
        jobVars = newFields;
        hasChanges = true;
      }
    } else if (section === "view") {
      displaySchema(
        automationParams.length > 0 ? { fields: automationParams } : null,
        "Automation Parameters"
      );
      displaySchema(
        jobVars.length > 0 ? { fields: jobVars } : null,
        "Job Variables"
      );
    } else if (section === "save") {
      if (!hasChanges) {
        logger.info("No changes to save");
        break;
      }

      const saveSpinner = ora("Saving changes...").start();
      try {
        await updateProjectOptions(projectId, {
          automation_parameters_schema: automationParams.length > 0 ? { fields: automationParams } : null,
          job_variables_schema: jobVars.length > 0 ? { fields: jobVars } : null,
        });
        saveSpinner.stop();
        logger.success("Changes saved successfully");

        // Hint about syncing to get updated types
        logger.info("\nRun 'xgodo project sync' to update local type definitions");
      } catch (err: unknown) {
        saveSpinner.stop();
        if (err instanceof Error) {
          logger.error(err.message);
        } else {
          logger.error("Failed to save changes");
        }
        process.exit(1);
      }
      break;
    } else if (section === "cancel") {
      if (hasChanges) {
        const { confirm } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirm",
            message: "You have unsaved changes. Are you sure you want to exit?",
            default: false,
          },
        ]);
        if (!confirm) {
          continue;
        }
      }
      logger.info("Exiting without saving");
      break;
    }
  }
}
