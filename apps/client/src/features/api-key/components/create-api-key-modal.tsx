import { useState } from "react";
import {
  ActionIcon,
  Alert,
  Button,
  Code,
  CopyButton,
  Group,
  Modal,
  Select,
  Stack,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useCreateApiKeyMutation } from "@/features/api-key/queries/api-key-query";

interface CreateApiKeyModalProps {
  opened: boolean;
  onClose: () => void;
}

const EXPIRY_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
];

export default function CreateApiKeyModal({
  opened,
  onClose,
}: CreateApiKeyModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState<string>("never");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const createMutation = useCreateApiKeyMutation();

  const handleClose = () => {
    setName("");
    setExpiry("never");
    setCreatedToken(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    let expiresAt: string | undefined;
    if (expiry !== "never") {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(expiry, 10));
      expiresAt = d.toISOString();
    }
    const key = await createMutation.mutateAsync({
      name: name.trim(),
      expiresAt,
    });
    setCreatedToken(key.token ?? null);
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={createdToken ? t("API key created") : t("Create API key")}
      size="lg"
    >
      {createdToken ? (
        <Stack>
          <Alert color="yellow">
            {t(
              "Copy your API key now. For security reasons you won't be able to see it again.",
            )}
          </Alert>
          <Group wrap="nowrap" align="flex-start">
            <Code
              block
              style={{ flex: 1, wordBreak: "break-all", whiteSpace: "pre-wrap" }}
            >
              {createdToken}
            </Code>
            <CopyButton value={createdToken}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? t("Copied") : t("Copy")} withArrow>
                  <ActionIcon variant="subtle" onClick={copy} aria-label={t("Copy")}>
                    {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
          <Group justify="flex-end">
            <Button onClick={handleClose}>{t("Done")}</Button>
          </Group>
        </Stack>
      ) : (
        <Stack>
          <TextInput
            label={t("Name")}
            placeholder={t("e.g. Backend integration")}
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            data-autofocus
            required
          />
          <Select
            label={t("Expiration")}
            data={EXPIRY_OPTIONS.map((o) => ({
              value: o.value,
              label: t(o.label),
            }))}
            value={expiry}
            onChange={(v) => setExpiry(v ?? "never")}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose}>
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending}
              disabled={!name.trim()}
            >
              {t("Create")}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
