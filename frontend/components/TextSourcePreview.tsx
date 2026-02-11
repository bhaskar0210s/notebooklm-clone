import { DocumentTextIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button.tsx";

interface TextSourcePreviewProps {
  preview: string;
  onRemove?: () => void;
  onEdit?: () => void;
  /** When true, hide remove button (e.g. for loaded-from-DB sources) */
  readOnly?: boolean;
}

export function TextSourcePreview({ preview, onRemove, onEdit, readOnly }: TextSourcePreviewProps) {
  const displayPreview = preview.length > 50 ? `${preview.slice(0, 50)}...` : preview;
  const showRemove = !readOnly && onRemove;

  return (
    <div
      role={onEdit ? "button" : undefined}
      tabIndex={onEdit ? 0 : undefined}
      onClick={onEdit}
      onKeyDown={onEdit ? (e) => e.key === "Enter" && onEdit() : undefined}
      className={`flex items-center gap-2 rounded-lg border border-gray-700/50 bg-gray-800/80 p-2 shadow-sm ${
        onEdit ? "cursor-pointer transition-colors hover:border-gray-600 hover:bg-gray-800" : ""
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600">
        <DocumentTextIcon className="h-6 w-6 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-200">{displayPreview}</p>
        <p className="text-xs text-gray-500">Text</p>
      </div>
      {showRemove && (
        <Button
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-700/50 hover:text-gray-200"
          onClick={(e) => {
            e.stopPropagation();
            onRemove!();
          }}
          aria-label="Remove text source"
        >
          <XMarkIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
