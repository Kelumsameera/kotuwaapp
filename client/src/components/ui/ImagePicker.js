"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { uploadImage, errorMessage } from "@/lib/apiClient";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

// Upload and remove images. images: [{ url, publicId }]   onChange(newImages)
// The server checks everything again; these checks just give quicker feedback.
export default function ImagePicker({ label, images, onChange, maxImages = 1 }) {
  const t = useTranslations();
  const fileInput = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  // Uploads the chosen files one by one and adds them to the list.
  async function handleFiles(event) {
    const files = Array.from(event.target.files || []).slice(0, maxImages - images.length);
    event.target.value = "";
    setError("");

    const uploaded = [];
    setIsUploading(true);
    try {
      for (const file of files) {
        if (!ALLOWED_TYPES.includes(file.type)) throw { code: "UPLOAD_NOT_IMAGE" };
        if (file.size > MAX_BYTES) throw { code: "FILE_TOO_LARGE" };
        uploaded.push(await uploadImage(file));
      }
    } catch (uploadError) {
      setError(errorMessage(uploadError, t));
    } finally {
      setIsUploading(false);
      if (uploaded.length > 0) onChange([...images, ...uploaded]);
    }
  }

  // Removes one image from the list (the server deletes it when the form is saved).
  function removeImage(publicId) {
    onChange(images.filter((image) => image.publicId !== publicId));
  }

  const canAddMore = images.length < maxImages;

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      <div className="flex flex-wrap gap-3">
        {images.map((image) => (
          <div key={image.publicId} className="relative h-24 w-24 overflow-hidden rounded-md border border-line bg-muted">
            <Image src={image.url} alt="" fill sizes="96px" className="object-cover" />
            <button
              type="button"
              onClick={() => removeImage(image.publicId)}
              className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-xs text-white"
              aria-label={t("form.removeImage")}
            >
              ✕
            </button>
          </div>
        ))}
        {canAddMore && (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={isUploading}
            className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-line text-center text-xs text-subtle hover:bg-muted"
          >
            {isUploading ? t("common.loading") : t("form.addImage")}
          </button>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        multiple={maxImages > 1}
        onChange={handleFiles}
        className="hidden"
      />
      <p className="mt-1 text-xs text-subtle">{t("form.imageHint", { max: maxImages })}</p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
