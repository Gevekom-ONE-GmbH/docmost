import { useState } from "react";
import {
  Button,
  Group,
  Modal,
  MultiSelect,
  Stack,
  Switch,
  TextInput,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  useCreateWebhookMutation,
  useWebhookEventsQuery,
} from "@/features/webhook/queries/webhook-query";

interface CreateWebhookModalProps {
  opened: boolean;
  onClose: () => void;
}

export default function CreateWebhookModal({
  opened,
  onClose,
}: CreateWebhookModalProps) {
  const { t } = useTranslation();
  const { data: eventsData } = useWebhookEventsQuery();
  const createMutation = useCreateWebhookMutation();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  const eventOptions = [
    { value: "*", label: t("All events") },
    ...(eventsData?.events ?? []).map((e) => ({ value: e, label: e })),
  ];

  const reset = () => {
    setName("");
    setUrl("");
    setSecret("");
    setEvents([]);
    setIsActive(true);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    if (!url.trim() || events.length === 0) return;
    createMutation.mutate(
      {
        name: name.trim() || undefined,
        url: url.trim(),
        secret: secret.trim() || undefined,
        events,
        isActive,
      },
      { onSuccess: handleClose },
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("Create webhook")}
      size="lg"
    >
      <Stack>
        <TextInput
          label={t("Name")}
          placeholder={t("e.g. Backend sync")}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <TextInput
          label={t("Payload URL")}
          placeholder="https://example.com/webhooks/docmost"
          value={url}
          onChange={(e) => setUrl(e.currentTarget.value)}
          required
          data-autofocus
        />
        <TextInput
          label={t("Secret")}
          description={t(
            "Used to sign the payload (HMAC-SHA256, X-Docmost-Signature).",
          )}
          value={secret}
          onChange={(e) => setSecret(e.currentTarget.value)}
        />
        <MultiSelect
          label={t("Events")}
          placeholder={t("Select events")}
          data={eventOptions}
          value={events}
          onChange={setEvents}
          searchable
          comboboxProps={{ withinPortal: true }}
          required
        />
        <Switch
          label={t("Active")}
          checked={isActive}
          onChange={(e) => setIsActive(e.currentTarget.checked)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose}>
            {t("Cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending}
            disabled={!url.trim() || events.length === 0}
          >
            {t("Create")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
