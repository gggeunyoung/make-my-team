"use client";

import { useCallback, useRef, useState } from "react";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

const ASPECT = 354 / 472;

type Props = {
  imageSrc: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
};

const MAX_BYTES = 1_000_000;

function dataUrlByteSize(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}

function getCroppedDataUrl(image: HTMLImageElement, crop: PixelCrop): string {
  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = Math.round(crop.width * scaleX);
  canvas.height = Math.round(crop.height * scaleY);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  let quality = 0.7;
  let result = canvas.toDataURL("image/jpeg", quality);

  while (dataUrlByteSize(result) > MAX_BYTES && quality > 0.1) {
    quality -= 0.1;
    result = canvas.toDataURL("image/jpeg", quality);
  }

  return result;
}

export function PlayerPhotoCropModal({ imageSrc, onConfirm, onCancel }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const cropHeight = height * 0.9;
    const cropWidth = cropHeight * ASPECT;
    const finalWidth = Math.min(cropWidth, width * 0.9);
    const finalHeight = finalWidth / ASPECT;

    setCrop({
      unit: "px",
      x: (width - finalWidth) / 2,
      y: (height - finalHeight) / 2,
      width: finalWidth,
      height: finalHeight,
    });
  }, []);

  const handleConfirm = () => {
    if (!imgRef.current || !completedCrop) return;
    const dataUrl = getCroppedDataUrl(imgRef.current, completedCrop);
    onConfirm(dataUrl);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div className="border-b border-zinc-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-zinc-900">사진 크롭</h3>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={ASPECT}
            minWidth={50}
            minHeight={50}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt="크롭 대상 이미지"
              className="max-h-[60vh] w-full object-contain"
              onLoad={onImageLoad}
            />
          </ReactCrop>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!completedCrop}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
