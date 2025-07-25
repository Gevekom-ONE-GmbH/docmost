import { useParams } from "react-router-dom";
import { usePageQuery } from "@/features/page/queries/page-query";
import { FullEditor } from "@/features/editor/full-editor";
import HistoryModal from "@/features/page-history/components/history-modal";
import { Helmet } from "react-helmet-async";
import PageHeader from "@/features/page/components/header/page-header.tsx";
import { extractPageSlugId } from "@/lib";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";
import { useTranslation } from "react-i18next";
import React from "react";

const MemoizedFullEditor = React.memo(FullEditor);
const MemoizedPageHeader = React.memo(PageHeader);
const MemoizedHistoryModal = React.memo(HistoryModal);

export default function Page() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  console.log("URL hash: ", window.location.hash);
  const {
    data: page,
    isLoading,
    isError,
    error,
  } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });
  const { data: space } = useGetSpaceBySlugQuery(page?.space?.slug);

  const spaceRules = space?.membership?.permissions;
  const spaceAbility = useSpaceAbility(spaceRules);

  if (isLoading) {
    return <></>;
  }

  if (isError || !page) {
    if ([401, 403, 404].includes(error?.["status"])) {
      return <div>{t("Page not found")}</div>;
    }
    return <div>{t("Error fetching page data.")}</div>;
  }

  if (!space) {
    return <></>;
  }

  function assignHeadingIds(doc: any) {
    let idCount = 0;

    const slugify = (text: string) =>
      text.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w-]/g, "");

    const traverse = (node: any) => {
      if (node.type === "heading") {
        const textNode = node.content[0];
        const text = textNode?.text || `heading-${idCount}`;
        node.attrs = {
          ...node.attrs,
          id: slugify(text) + (idCount > 0 ? `-${idCount}` : ""),
        };
        idCount++;
      }
      if (node.content) {
        node.content.forEach(traverse);
      }
    };

    traverse(doc);
    return doc;
  }
  let content = assignHeadingIds(page.content)
  console.log("Processed page content with IDs: ", content);
  return (
    page && (
      <div>
        <Helmet>
          <title>{`${page?.icon || ""}  ${page?.title || t("untitled")}`}</title>
        </Helmet>

        <MemoizedPageHeader
          readOnly={spaceAbility.cannot(
            SpaceCaslAction.Manage,
            SpaceCaslSubject.Page,
          )}
        />

        <MemoizedFullEditor
          key={page.id}
          pageId={page.id}
          title={page.title}
          content={content}
          slugId={page.slugId}
          spaceSlug={page?.space?.slug}
          editable={spaceAbility.can(
            SpaceCaslAction.Manage,
            SpaceCaslSubject.Page,
          )}
        />
        <MemoizedHistoryModal pageId={page.id} />
      </div>
    )
  );
}
