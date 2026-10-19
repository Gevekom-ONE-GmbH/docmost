import { Alert, Button, Group } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconInfoCircle, IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import useUserRole from "@/hooks/use-user-role.tsx";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import ApiKeyList from "@/features/api-key/components/api-key-list";
import CreateApiKeyModal from "@/features/api-key/components/create-api-key-modal";

export default function UserApiKeys() {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);
  const { isAdmin } = useUserRole();
  const workspace = useAtomValue(workspaceAtom);
  const restrictedToAdmins = workspace?.settings?.api?.restrictToAdmins === true;
  const canCreate = !restrictedToAdmins || isAdmin;

  return (
    <>
      <DocumentTitle title={t("API keys")} />
      <SettingsTitle title={t("API keys")} />

      {canCreate ? (
        <Group justify="flex-end" mb="md">
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            {t("Create API key")}
          </Button>
        </Group>
      ) : (
        <Alert icon={<IconInfoCircle />} color="blue" mb="md">
          {t("API access is restricted to workspace admins.")}
        </Alert>
      )}

      <ApiKeyList />

      <CreateApiKeyModal opened={opened} onClose={close} />
    </>
  );
}
