import { DocumentIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

interface FilePreviewProps {
  file: File;
  onRemove: () => void;
}

export function FilePreview({ file, onRemove }: FilePreviewProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-700/50 bg-gray-800/80 p-2 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600">
        <DocumentIcon className="h-6 w-6 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-200">{file.name}</p>
        <p className="text-xs text-gray-500">PDF</p>
      </div>
      <Button
        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-700/50 hover:text-gray-200"
        onClick={onRemove}
        aria-label="Remove file"
      >
        <XMarkIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}

