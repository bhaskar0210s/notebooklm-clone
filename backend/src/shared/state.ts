import { Document } from "@langchain/core/documents";
import { v4 as uuidv4 } from "uuid";

/**
 * Reduces the document array based on the provided new documents or actions.
 *
 * @param existing - The existing array of documents.
 * @param newDocs - The new documents or actions to apply.
 * @returns The updated array of documents.
 */
export function reduceDocs(
  existing?: Document[],
  newDocs?: Document[] | { [key: string]: any }[] | string[] | string | "delete"
): Document[] {
  if (newDocs === "delete") {
    return [];
  }

  const existingList = existing || [];
  const existingIds = new Set(existingList.map((doc) => doc.metadata?.uuid));

  if (typeof newDocs === "string") {
    const docId = uuidv4();
    return [
      ...existingList,
      { pageContent: newDocs, metadata: { uuid: docId } },
    ];
  }

  const newList: Document[] = [];
  if (Array.isArray(newDocs)) {
    for (const item of newDocs) {
      if (typeof item === "string") {
        const itemId = uuidv4();
        newList.push({ pageContent: item, metadata: { uuid: itemId } });
        existingIds.add(itemId);
      } else if (typeof item === "object") {
        const metadata = (item as Document).metadata ?? {};
        let itemId = metadata.uuid ?? uuidv4();

        if (!existingIds.has(itemId)) {
          const hasPageContent = "pageContent" in item;
          const pageContentValue = (item as Document).pageContent;
          const hasPageContentValue = hasPageContent && pageContentValue;

          if (hasPageContentValue) {
            // It's a Document-like object with pageContent
            newList.push({
              ...(item as Document),
              metadata: { ...metadata, uuid: itemId },
            });
          } else {
            // Check if content is in metadata.page_content (common after serialization)
            // Also check top-level page_content and other possible locations
            const pageContent =
              (item as Document).pageContent ||
              (item as any).page_content ||
              metadata.page_content ||
              (item as any).content ||
              (item as any).text ||
              "";

            // Remove page_content from metadata if we're using it as pageContent
            const { page_content, ...cleanMetadata } = metadata;

            newList.push({
              pageContent,
              metadata: { ...cleanMetadata, uuid: itemId },
            });
          }
          existingIds.add(itemId);
        }
      }
    }
  }

  return [...existingList, ...newList];
}
