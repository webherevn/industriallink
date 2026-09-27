import { customSchemaNodes } from '@industriallink/contracts';

/** Xuất JSON-LD đã lưu. Chỉ stringify object đã parse — không nhúng HTML thô. */
export function CmsCustomSchemaScripts({ schema }: { schema: string | null | undefined }) {
  const nodes = customSchemaNodes(schema);
  if (nodes.length === 0) return null;
  return (
    <>
      {nodes.map((node, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(node).replace(/</g, '\\u003c'),
          }}
        />
      ))}
    </>
  );
}
