export enum VerificationType {
  EXPIRING = "expiring",
  QMS = "qms",
}

export enum ExpirationMode {
  PERIOD = "period",
  FIXED = "fixed",
  INDEFINITE = "indefinite",
}

export enum PeriodUnit {
  DAY = "day",
  WEEK = "week",
  MONTH = "month",
  YEAR = "year",
}

export enum VerificationStatus {
  NONE = "none",
  DRAFT = "draft",
  IN_APPROVAL = "in_approval",
  VERIFIED = "verified",
  EXPIRING = "expiring",
  EXPIRED = "expired",
  OBSOLETE = "obsolete",
}

export interface IVerifier {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  isPrimary: boolean;
}

export interface IPageVerificationPermissions {
  canManage: boolean;
  canVerify: boolean;
  canSubmitForApproval: boolean;
  canMarkObsolete: boolean;
}

export interface IPageVerificationInfo {
  id?: string;
  pageId: string;
  hasVerification: boolean;
  type?: VerificationType;
  status: VerificationStatus;
  mode?: ExpirationMode | null;
  periodAmount?: number | null;
  periodUnit?: PeriodUnit | null;
  verifiedAt?: string | null;
  expiresAt?: string | null;
  requestedAt?: string | null;
  rejectedAt?: string | null;
  rejectionComment?: string | null;
  verifiers: IVerifier[];
  permissions: IPageVerificationPermissions;
}

export interface ISetupVerification {
  pageId: string;
  type?: VerificationType;
  mode?: ExpirationMode;
  periodAmount?: number;
  periodUnit?: PeriodUnit;
  fixedExpiresAt?: string;
  verifierIds?: string[];
  primaryVerifierId?: string;
}

export interface IVerificationListItem {
  id: string;
  pageId: string;
  type: VerificationType;
  status: VerificationStatus;
  expiresAt: string | null;
  verifiedAt: string | null;
  page: { id: string; title: string; slugId: string } | null;
  space: { id: string; name: string; slug: string } | null;
  verifiers: IVerifier[];
}
