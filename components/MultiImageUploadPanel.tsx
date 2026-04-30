"use client";

import { type ChangeEvent, type RefObject } from "react";
import { IconAddPhoto, IconPhotoLibrary, IconEdit } from "@/components/icons";

type Props = {
  cameraRef: RefObject<HTMLInputElement | null>;
  multiRef: RefObject<HTMLInputElement | null>;
  onCameraChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onMultiChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onManualClick?: () => void;
  disabled?: boolean;
  compact?: boolean;
  cameraLabel?: string;
  multiLabel?: string;
  manualLabel?: string;
};

export default function MultiImageUploadPanel({
  cameraRef,
  multiRef,
  onCameraChange,
  onMultiChange,
  onManualClick,
  disabled = false,
  compact = false,
  cameraLabel = "撮影する",
  multiLabel = "写真から複数選ぶ",
  manualLabel = "手入力で追加",
}: Props) {
  if (compact) {
    return (
      <div className="flex gap-2 flex-wrap">
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onCameraChange}
        />
        <input
          ref={multiRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onMultiChange}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => cameraRef.current?.click()}
          className="flex-1 min-h-10 rounded-xl border-2 border-dashed border-orange-300 bg-orange-50 text-sm font-bold text-primary disabled:opacity-50 flex items-center justify-center gap-1"
        >
          <IconAddPhoto size={16} />
          {cameraLabel}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => multiRef.current?.click()}
          className="flex-1 min-h-10 rounded-xl border-2 border-primary bg-white text-sm font-bold text-primary disabled:opacity-50 flex items-center justify-center gap-1"
        >
          <IconPhotoLibrary size={16} />
          {multiLabel}
        </button>
        {onManualClick && (
          <button
            type="button"
            disabled={disabled}
            onClick={onManualClick}
            className="flex-1 min-h-10 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-600 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <IconEdit size={16} />
            {manualLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onCameraChange}
      />
      <input
        ref={multiRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onMultiChange}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => cameraRef.current?.click()}
        className="w-full min-h-[140px] rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50 flex flex-col items-center justify-center gap-2 font-bold text-primary text-lg disabled:opacity-50"
      >
        <IconAddPhoto size={40} />
        {cameraLabel}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => multiRef.current?.click()}
        className="w-full rounded-xl border-2 border-primary bg-white py-3 font-bold text-primary disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <IconPhotoLibrary size={20} />
        {multiLabel}
      </button>
      {onManualClick && (
        <button
          type="button"
          disabled={disabled}
          onClick={onManualClick}
          className="w-full rounded-xl border border-gray-200 bg-white py-3 font-bold text-gray-600 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <IconEdit size={20} />
          {manualLabel}
        </button>
      )}
    </div>
  );
}
