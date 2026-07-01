export enum PagePermissionRole {
  READER = "reader",
  WRITER = "writer",
}

export interface IPagePermissionInfo {
  pageId: string;
  pageAccessId: string | null;
  hasDirectRestriction: boolean;
  hasInheritedRestriction: boolean;
  hasAnyRestriction: boolean;
  userAccess: {
    canView: boolean;
    canEdit: boolean;
    canManage: boolean;
  };
}

export interface IPagePermissionMember {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  memberCount?: number;
  isDefault?: boolean;
  type: "user" | "group";
  role: string;
  createdAt: string;
}

export interface IAddPagePermission {
  pageId: string;
  userIds?: string[];
  groupIds?: string[];
  role: PagePermissionRole;
}

export interface IUpdatePagePermissionRole {
  pageId: string;
  userId?: string;
  groupId?: string;
  role: PagePermissionRole;
}

export interface IRemovePagePermission {
  pageId: string;
  userId?: string;
  groupId?: string;
}
