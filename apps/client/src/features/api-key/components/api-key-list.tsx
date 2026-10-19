import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  useApiKeysQuery,
  useRevokeApiKeyMutation,
} from "@/features/api-key/queries/api-key-query";
import { IApiKey } from "@/features/api-key/types/api-key.types";
import { formattedDate } from "@/lib/time.ts";

interface ApiKeyListProps {
  adminView?: boolean;
}

export default function ApiKeyList({ adminView }: ApiKeyListProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useApiKeysQuery({ limit: 100, adminView });
  const revokeMutation = useRevokeApiKeyMutation();
  const [toRevoke, setToRevoke] = useState<IApiKey | null>(null);

  const handleRevoke = () => {
    if (!toRevoke) return;
    revokeMutation.mutate(
      { apiKeyId: toRevoke.id },
      { onSettled: () => setToRevoke(null) },
    );
  };

  if (isLoading) {
    return (
      <Text c="dimmed" size="sm">
        {t("Loading...")}
      </Text>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        {t("No API keys yet.")}
      </Text>
    );
  }

  const neverBadge = (
    <Badge variant="light" color="gray">
      {t("Never")}
    </Badge>
  );

  return (
    <>
      <Table.ScrollContainer minWidth={600}>
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("Name")}</Table.Th>
              {adminView && <Table.Th>{t("Creator")}</Table.Th>}
              <Table.Th>{t("Created")}</Table.Th>
              <Table.Th>{t("Last used")}</Table.Th>
              <Table.Th>{t("Expires")}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.items.map((k) => (
              <Table.Tr key={k.id}>
                <Table.Td>{k.name}</Table.Td>
                {adminView && <Table.Td>{k.creator?.name ?? "—"}</Table.Td>}
                <Table.Td>{formattedDate(new Date(k.createdAt))}</Table.Td>
                <Table.Td>
                  {k.lastUsedAt
                    ? formattedDate(new Date(k.lastUsedAt))
                    : neverBadge}
                </Table.Td>
                <Table.Td>
                  {k.expiresAt
                    ? formattedDate(new Date(k.expiresAt))
                    : neverBadge}
                </Table.Td>
                <Table.Td>
                  <Group justify="flex-end">
                    <Tooltip label={t("Revoke")} withArrow>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => setToRevoke(k)}
                        aria-label={t("Revoke")}
                      >
                        <IconTrash size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Modal
        opened={!!toRevoke}
        onClose={() => setToRevoke(null)}
        title={t("Revoke API key")}
      >
        <Text size="sm">
          {t(
            'Are you sure you want to revoke "{{name}}"? Any integration using it will stop working immediately.',
            { name: toRevoke?.name },
          )}
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setToRevoke(null)}>
            {t("Cancel")}
          </Button>
          <Button
            color="red"
            loading={revokeMutation.isPending}
            onClick={handleRevoke}
          >
            {t("Revoke")}
          </Button>
        </Group>
      </Modal>
    </>
  );
}
