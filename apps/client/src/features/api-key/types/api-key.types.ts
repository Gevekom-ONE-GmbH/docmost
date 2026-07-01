export interface IApiKeyCreator {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface IApiKey {
  id: string;
  name: string;
  token?: string;
  creatorId: string;
  workspaceId: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  creator?: IApiKeyCreator;
}

export interface ICreateApiKeyRequest {
  name: string;
  expiresAt?: string;
}

export interface IUpdateApiKeyRequest {
  apiKeyId: string;
  name: string;
}
