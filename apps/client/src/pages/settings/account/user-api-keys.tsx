import { Button, Group } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus } from "@tabler/icons-react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { getAppName } from "@/lib/config.ts";
import ApiKeyList from "@/features/api-key/components/api-key-list";
import CreateApiKeyModal from "@/features/api-key/components/create-api-key-modal";

export default function UserApiKeys() {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Helmet>
        <title>
          {t("API keys")} - {getAppName()}
        </title>
      </Helmet>
      <SettingsTitle title={t("API keys")} />

      <Group justify="flex-end" mb="md">
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          {t("Create API key")}
        </Button>
      </Group>

      <ApiKeyList />

      <CreateApiKeyModal opened={opened} onClose={close} />
    </>
  );
}
