import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Loader,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import { formattedDate } from "@/lib/time.ts";
import { MultiUserSelect } from "@/features/group/components/multi-user-select.tsx";
import {
  useMarkObsoleteMutation,
  useRejectApprovalMutation,
  useRemoveVerificationMutation,
  useSetupVerificationMutation,
  useSubmitForApprovalMutation,
  useVerificationInfoQuery,
  useVerifyPageMutation,
} from "@/features/page-verification/queries/page-verification-query";
import {
  ExpirationMode,
  PeriodUnit,
  VerificationStatus,
  VerificationType,
} from "@/features/page-verification/types/page-verification.types";

interface PageVerificationModalProps {
  pageId: string;
  opened: boolean;
  onClose: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  verified: "green",
  expiring: "yellow",
  expired: "red",
  in_approval: "blue",
  draft: "gray",
  obsolete: "gray",
  none: "gray",
};

export default function PageVerificationModal({
  pageId,
  opened,
  onClose,
}: PageVerificationModalProps) {
  const { t } = useTranslation();
  const { data: info, isLoading } = useVerificationInfoQuery(pageId, opened);

  const setupMutation = useSetupVerificationMutation();
  const verifyMutation = useVerifyPageMutation();
  const submitMutation = useSubmitForApprovalMutation();
  const rejectMutation = useRejectApprovalMutation();
  const obsoleteMutation = useMarkObsoleteMutation();
  const removeMutation = useRemoveVerificationMutation();

  const [editing, setEditing] = useState(false);
  const [type, setType] = useState<VerificationType>(VerificationType.EXPIRING);
  const [mode, setMode] = useState<ExpirationMode>(ExpirationMode.PERIOD);
  const [periodAmount, setPeriodAmount] = useState<number>(6);
  const [periodUnit, setPeriodUnit] = useState<PeriodUnit>(PeriodUnit.MONTH);
  const [fixedExpiresAt, setFixedExpiresAt] = useState<string>("");
  const [verifierIds, setVerifierIds] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState(false);
  const [rejectComment, setRejectComment] = useState("");

  const hasVerification = !!info?.hasVerification;
  const showForm = editing || !hasVerification;

  useEffect(() => {
    if (info?.hasVerification) {
      setType(info.type ?? VerificationType.EXPIRING);
      setMode((info.mode as ExpirationMode) ?? ExpirationMode.PERIOD);
      setPeriodAmount(info.periodAmount ?? 6);
      setPeriodUnit((info.periodUnit as PeriodUnit) ?? PeriodUnit.MONTH);
      setVerifierIds((info.verifiers ?? []).map((v) => v.id));
    }
  }, [info]);

  const handleSave = () => {
    setupMutation.mutate(
      {
        pageId,
        type,
        mode,
        periodAmount: mode === ExpirationMode.PERIOD ? periodAmount : undefined,
        periodUnit: mode === ExpirationMode.PERIOD ? periodUnit : undefined,
        fixedExpiresAt:
          mode === ExpirationMode.FIXED && fixedExpiresAt
            ? new Date(fixedExpiresAt).toISOString()
            : undefined,
        verifierIds,
      },
      { onSuccess: () => setEditing(false) },
    );
  };

  const perms = info?.permissions;
  const status = info?.status ?? VerificationStatus.NONE;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("Page verification")}
      size="lg"
    >
      {isLoading ? (
        <Group justify="center" p="lg">
          <Loader size="sm" />
        </Group>
      ) : showForm ? (
        <Stack>
          <Select
            label={t("Verification type")}
            data={[
              { value: VerificationType.EXPIRING, label: t("Expiring") },
              { value: VerificationType.QMS, label: t("QMS (approval workflow)") },
            ]}
            value={type}
            onChange={(v) => setType((v as VerificationType) ?? type)}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
          <Select
            label={t("Expiration")}
            data={[
              { value: ExpirationMode.PERIOD, label: t("After a period") },
              { value: ExpirationMode.FIXED, label: t("On a fixed date") },
              { value: ExpirationMode.INDEFINITE, label: t("Never expires") },
            ]}
            value={mode}
            onChange={(v) => setMode((v as ExpirationMode) ?? mode)}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
          {mode === ExpirationMode.PERIOD && (
            <Group grow>
              <NumberInput
                label={t("Amount")}
                min={1}
                max={1000}
                value={periodAmount}
                onChange={(v) => setPeriodAmount(Number(v) || 1)}
              />
              <Select
                label={t("Unit")}
                data={[
                  { value: PeriodUnit.DAY, label: t("Days") },
                  { value: PeriodUnit.WEEK, label: t("Weeks") },
                  { value: PeriodUnit.MONTH, label: t("Months") },
                  { value: PeriodUnit.YEAR, label: t("Years") },
                ]}
                value={periodUnit}
                onChange={(v) => setPeriodUnit((v as PeriodUnit) ?? periodUnit)}
                allowDeselect={false}
                comboboxProps={{ withinPortal: true }}
              />
            </Group>
          )}
          {mode === ExpirationMode.FIXED && (
            <TextInput
              type="date"
              label={t("Expiry date")}
              value={fixedExpiresAt}
              onChange={(e) => setFixedExpiresAt(e.currentTarget.value)}
            />
          )}
          <MultiUserSelect
            label={t("Verifiers")}
            onChange={setVerifierIds}
          />
          <Group justify="flex-end">
            {hasVerification && (
              <Button variant="default" onClick={() => setEditing(false)}>
                {t("Cancel")}
              </Button>
            )}
            <Button onClick={handleSave} loading={setupMutation.isPending}>
              {t("Save")}
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack>
          <Group justify="space-between">
            <Group gap="xs">
              <Text fw={500}>{t("Status")}</Text>
              <Badge color={STATUS_COLOR[status] ?? "gray"} variant="light">
                {t(status)}
              </Badge>
              <Badge variant="outline" color="gray">
                {info?.type === VerificationType.QMS ? t("QMS") : t("Expiring")}
              </Badge>
            </Group>
          </Group>

          {info?.expiresAt && (
            <Text size="sm" c="dimmed">
              {t("Expires")}: {formattedDate(new Date(info.expiresAt))}
            </Text>
          )}
          {info?.verifiedAt && (
            <Text size="sm" c="dimmed">
              {t("Verified")}: {formattedDate(new Date(info.verifiedAt))}
            </Text>
          )}
          {info?.rejectionComment && status === VerificationStatus.DRAFT && (
            <Alert color="red" title={t("Rejected")}>
              {info.rejectionComment}
            </Alert>
          )}

          <div>
            <Text fw={500} size="sm" mb={4}>
              {t("Verifiers")}
            </Text>
            {info?.verifiers?.length ? (
              <Stack gap={4}>
                {info.verifiers.map((v) => (
                  <Text key={v.id} size="sm">
                    {v.name}{" "}
                    <Text span c="dimmed" size="xs">
                      {v.email}
                    </Text>
                  </Text>
                ))}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                {t("No verifiers assigned.")}
              </Text>
            )}
          </div>

          <Divider />

          {rejecting ? (
            <Stack>
              <Textarea
                label={t("Rejection reason")}
                value={rejectComment}
                onChange={(e) => setRejectComment(e.currentTarget.value)}
                autosize
                minRows={2}
              />
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setRejecting(false)}>
                  {t("Cancel")}
                </Button>
                <Button
                  color="red"
                  loading={rejectMutation.isPending}
                  onClick={() =>
                    rejectMutation.mutate(
                      { pageId, comment: rejectComment },
                      {
                        onSuccess: () => {
                          setRejecting(false);
                          setRejectComment("");
                        },
                      },
                    )
                  }
                >
                  {t("Reject")}
                </Button>
              </Group>
            </Stack>
          ) : (
            <Group>
              {perms?.canVerify && (
                <Button
                  color="green"
                  loading={verifyMutation.isPending}
                  onClick={() => verifyMutation.mutate(pageId)}
                >
                  {status === VerificationStatus.IN_APPROVAL
                    ? t("Approve")
                    : t("Verify")}
                </Button>
              )}
              {perms?.canSubmitForApproval && (
                <Button
                  loading={submitMutation.isPending}
                  onClick={() => submitMutation.mutate(pageId)}
                >
                  {t("Submit for approval")}
                </Button>
              )}
              {status === VerificationStatus.IN_APPROVAL &&
                perms?.canVerify && (
                  <Button
                    variant="light"
                    color="red"
                    onClick={() => setRejecting(true)}
                  >
                    {t("Reject")}
                  </Button>
                )}
              {perms?.canMarkObsolete && (
                <Button
                  variant="light"
                  color="gray"
                  loading={obsoleteMutation.isPending}
                  onClick={() => obsoleteMutation.mutate(pageId)}
                >
                  {t("Mark obsolete")}
                </Button>
              )}
              {perms?.canManage && (
                <>
                  <Button variant="default" onClick={() => setEditing(true)}>
                    {t("Edit")}
                  </Button>
                  <Button
                    variant="subtle"
                    color="red"
                    loading={removeMutation.isPending}
                    onClick={() => removeMutation.mutate(pageId)}
                  >
                    {t("Remove")}
                  </Button>
                </>
              )}
            </Group>
          )}
        </Stack>
      )}
    </Modal>
  );
}
