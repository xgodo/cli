import fetch from "node-fetch";
import { getConfig } from "./config";
import { DEFAULT_API_URL } from "./constants";
import {
  ApiResponse,
  Project,
  ProjectFile,
  SyncResult,
  Template,
} from "./types";

/**
 * Get API URL from config or default
 */
export function getApiUrl(): string {
  const config = getConfig();
  return config?.apiUrl || DEFAULT_API_URL;
}

/**
 * Get API key from config
 */
export function getApiKey(): string | null {
  const config = getConfig();
  return config?.apiKey || null;
}

/**
 * Make an authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    apiKey?: string;
    apiUrl?: string;
  } = {}
): Promise<T> {
  const { method = "GET", body, apiKey, apiUrl } = options;

  const key = apiKey || getApiKey();
  if (!key) {
    throw new Error("Not logged in. Run 'xgodo login' first.");
  }

  const url = `${apiUrl || getApiUrl()}/api${endpoint}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    throw new Error("Authentication failed. Your API key may be invalid or expired. Run 'xgodo login' again.");
  }

  const data = await response.json() as T & { success?: boolean; message?: string };

  if (data.success === false) {
    throw new Error(data.message || "API request failed");
  }

  return data;
}

// ==================== API Methods ====================

/**
 * Validate API key and get user info
 */
export async function validateApiKey(
  apiKey: string,
  apiUrl: string = DEFAULT_API_URL
): Promise<{ name: string; email: string }> {
  const data = await apiRequest<{ user: { name: string; email: string } }>(
    "/v2/user/me",
    { apiKey, apiUrl }
  );
  return data.user;
}

/**
 * Get current user info
 */
export async function getUserInfo(): Promise<{ name: string; email: string }> {
  const data = await apiRequest<{ user: { name: string; email: string } }>(
    "/v2/user/me"
  );
  return data.user;
}

/**
 * List automation projects
 */
export async function listProjects(): Promise<Project[]> {
  const data = await apiRequest<{ projects: Project[] }>(
    "/v2/automation-projects"
  );
  return data.projects;
}

/**
 * Get a single project
 */
export async function getProject(projectId: string): Promise<Project> {
  const data = await apiRequest<{ project: Project }>(
    `/v2/automation-project/${projectId}`
  );
  return data.project;
}

/**
 * Get project files with hashes
 */
export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const data = await apiRequest<{ files: ProjectFile[] }>(
    `/v2/automation-project/${projectId}/files`
  );
  return data.files;
}

/**
 * Get a single file content
 */
export async function getProjectFile(
  projectId: string,
  filePath: string
): Promise<string> {
  const data = await apiRequest<{ content: string }>(
    `/v2/automation-project/${projectId}/file?path=${encodeURIComponent(filePath)}`
  );
  return data.content;
}

/**
 * Sync files to server
 */
export async function syncFilesToServer(
  projectId: string,
  files: { path: string; content: string }[]
): Promise<SyncResult[]> {
  const data = await apiRequest<{ updated: SyncResult[] }>(
    `/v2/automation-project/${projectId}/sync`,
    {
      method: "POST",
      body: { files },
    }
  );
  return data.updated;
}

/**
 * Commit changes
 */
export async function commitChanges(
  projectId: string,
  message: string
): Promise<{ hash: string; message: string }> {
  const data = await apiRequest<{ commit: { hash: string; message: string } }>(
    `/v2/automation-project/${projectId}/commit`,
    {
      method: "POST",
      body: { message },
    }
  );
  return data.commit;
}

/**
 * Get node-types.ts content
 */
export async function getNodeTypes(): Promise<string> {
  const data = await apiRequest<{ content: string }>("/v2/types/node-types");
  return data.content;
}

/**
 * Get bootstrap types content
 */
export async function getBootstrapTypes(): Promise<{ version: number; content: string }> {
  const data = await apiRequest<{ version: number; content: string }>(
    "/v2/types/bootstrap"
  );
  return { version: data.version, content: data.content };
}

/**
 * Get argument types for a project
 */
export async function getArgumentTypes(projectId: string): Promise<string> {
  const data = await apiRequest<{ content: string }>(
    `/v2/automation-project/${projectId}/types/arguments`
  );
  return data.content;
}

/**
 * List templates
 */
export async function listTemplates(): Promise<Template[]> {
  const data = await apiRequest<{ templates: Template[] }>("/v2/templates");
  return data.templates;
}

/**
 * Apply template to project
 */
export async function applyTemplate(
  projectId: string,
  templateId: string
): Promise<{ files_copied: number; files: string[] }> {
  const data = await apiRequest<{
    files_copied: number;
    files: string[];
  }>(`/v2/automation-project/${projectId}/template`, {
    method: "POST",
    body: { template_id: templateId },
  });
  return { files_copied: data.files_copied, files: data.files };
}
