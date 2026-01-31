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
