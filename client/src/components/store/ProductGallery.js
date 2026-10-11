"use client";

import { useState } from "react";
import ProductImage from "./ProductImage";

// A big photo with small thumbnails underneath to switch between photos.
export default function ProductGallery({ images, alt }) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="space-y-2">
      <ProductImage image={images[activeIndex]} alt={alt} sizes="(max-width: 768px) 100vw, 50vw" className="aspect-square rounded-lg" />
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={image.publicId}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`${alt} ${index + 1}`}
              className={`shrink-0 rounded-md border-2 ${index === activeIndex ? "border-brand" : "border-transparent"}`}
            >
              <ProductImage image={image} sizes="64px" className="h-16 w-16 rounded" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
