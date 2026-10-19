import { Button, Group } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import useUserRole from "@/hooks/use-user-role.tsx";
import ApiKeyList from "@/features/api-key/components/api-key-list";
import CreateApiKeyModal from "@/features/api-key/components/create-api-key-modal";

export default function WorkspaceApiKeys() {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);
  const { isAdmin } = useUserRole();

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <DocumentTitle title={t("API management")} />
      <SettingsTitle title={t("API management")} />

      <Group justify="flex-end" mb="md">
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          {t("Create API key")}
        </Button>
      </Group>

      <ApiKeyList adminView />

      <CreateApiKeyModal opened={opened} onClose={close} />
    </>
  );
}
