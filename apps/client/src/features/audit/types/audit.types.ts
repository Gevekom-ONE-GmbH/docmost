export interface IAuditActor {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface IAuditLog {
  id: string;
  workspaceId: string;
  actorId: string | null;
  actorType: string;
  event: string;
  resourceType: string;
  resourceId: string | null;
  spaceId: string | null;
  changes: Record<string, any> | null;
  metadata: Record<string, any> | null;
  ipAddress: string | null;
  createdAt: string;
  actor: IAuditActor | null;
}
