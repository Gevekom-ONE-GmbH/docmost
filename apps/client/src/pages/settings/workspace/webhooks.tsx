import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Switch,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { getAppName } from "@/lib/config.ts";
import { formattedDate } from "@/lib/time.ts";
import {
  useDeleteWebhookMutation,
  useUpdateWebhookMutation,
  useWebhooksQuery,
} from "@/features/webhook/queries/webhook-query";
import { IWebhook } from "@/features/webhook/types/webhook.types";
import CreateWebhookModal from "@/features/webhook/components/create-webhook-modal";

export default function Webhooks() {
  const { t } = useTranslation();
  const { data, isLoading } = useWebhooksQuery();
  const updateMutation = useUpdateWebhookMutation();
  const deleteMutation = useDeleteWebhookMutation();
  const [opened, { open, close }] = useDisclosure(false);
  const [toDelete, setToDelete] = useState<IWebhook | null>(null);

  return (
    <>
      <Helmet>
        <title>
          {t("Webhooks")} - {getAppName()}
        </title>
      </Helmet>
      <SettingsTitle title={t("Webhooks")} />

      <Group justify="space-between" mb="md">
        <Text size="sm" c="dimmed">
          {t("Send HMAC-signed HTTP requests when events happen in the workspace.")}
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          {t("Create webhook")}
        </Button>
      </Group>

      {isLoading ? (
        <Text c="dimmed" size="sm">
          {t("Loading...")}
        </Text>
      ) : !data || data.items.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t("No webhooks yet.")}
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={700}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("Name")}</Table.Th>
                <Table.Th>{t("URL")}</Table.Th>
                <Table.Th>{t("Events")}</Table.Th>
                <Table.Th>{t("Active")}</Table.Th>
                <Table.Th>{t("Last triggered")}</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.items.map((w) => (
                <Table.Tr key={w.id}>
                  <Table.Td>{w.name || "—"}</Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={1} maw={240}>
                      {w.url}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {w.events.map((e) => (
                        <Badge key={e} variant="light" size="sm">
                          {e}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Switch
                      checked={w.isActive}
                      onChange={(e) =>
                        updateMutation.mutate({
                          webhookId: w.id,
                          isActive: e.currentTarget.checked,
                        })
                      }
                      aria-label={t("Toggle active")}
                    />
                  </Table.Td>
                  <Table.Td>
                    {w.lastTriggeredAt
                      ? formattedDate(new Date(w.lastTriggeredAt))
                      : "—"}
                  </Table.Td>
                  <Table.Td>
                    <Group justify="flex-end">
                      <Tooltip label={t("Delete")} withArrow>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => setToDelete(w)}
                          aria-label={t("Delete")}
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
      )}

      <CreateWebhookModal opened={opened} onClose={close} />

      <Modal
        opened={!!toDelete}
        onClose={() => setToDelete(null)}
        title={t("Delete webhook")}
      >
        <Text size="sm">
          {t('Are you sure you want to delete this webhook?')}
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setToDelete(null)}>
            {t("Cancel")}
          </Button>
          <Button
            color="red"
            loading={deleteMutation.isPending}
            onClick={() =>
              toDelete &&
              deleteMutation.mutate(toDelete.id, {
                onSettled: () => setToDelete(null),
              })
            }
          >
            {t("Delete")}
          </Button>
        </Group>
      </Modal>
    </>
  );
}
