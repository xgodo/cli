export interface Config {
  apiKey: string;
  apiUrl: string;
  user: {
    name: string;
    email: string;
  };
}

export interface Project {
  id: string;
  name: string;
  description: string;
  role: "owner" | "editor";
  owner_username?: string;
  updated_at: string;
}

export interface ProjectFile {
  path: string;
  hash: string;
  size: number;
}

export interface SyncResult {
  path: string;
  hash: string;
  compiled?: boolean;
  errors?: string[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  is_own: boolean;
  is_public: boolean;
  owner_username: string;
}

export interface LocalProject {
  id: string;
  name: string;
  apiUrl: string;
  lastSync?: string;
}

export interface LocalHashes {
  [path: string]: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  [key: string]: T | boolean | string | undefined;
}

/**
 * Field schema for input validation
 * Supports recursive nesting for n-dimensional arrays via the `items` property
 */
export interface IFieldSchema {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object" | "any";
  required?: boolean;
  description?: string;
  defaultValue?: any;
  // String validations
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: (string | number)[];
  // Number validations
  min?: number;
  max?: number;
  integer?: boolean;
  // Array validations
  minItems?: number;
  maxItems?: number;
  // Recursive item schema for arrays (supports n-dimensional arrays)
  items?: IFieldSchema;
  // Object validations (nested fields) - also used for array of objects
  properties?: IFieldSchema[];
}

/**
 * Input schema for automation parameters or job variables
 */
export interface IInputSchema {
  fields: IFieldSchema[];
}

/**
 * Project details including input schemas
 */
export interface ProjectDetails {
  id: string;
  name: string;
  description: string;
  automation_parameters_schema: IInputSchema | null;
  job_variables_schema: IInputSchema | null;
  min_android_version: number | null;
  min_app_version: number | null;
  is_owner: boolean;
  is_template: boolean;
}

/**
 * Git change status
 */
export interface GitChange {
  path: string;
  status: "new" | "modified" | "deleted" | "unchanged";
}

/**
 * Git status response
 */
export interface GitStatus {
  hasChanges: boolean;
  changes: GitChange[];
}

/**
 * Git commit info
 */
export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  authorEmail?: string;
  timestamp: string;
}

/**
 * Git diff file
 */
export interface GitDiffFile {
  path: string;
  status: "added" | "modified" | "deleted";
  original: string;
  modified: string;
}
