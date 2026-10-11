import Image from "next/image";

// A product photo that fills its box, or a soft placeholder when there is no photo.
export default function ProductImage({ image, alt = "", sizes = "200px", className = "" }) {
  return (
    <div className={`relative overflow-hidden bg-muted ${className}`}>
      {image ? (
        <Image src={image.url} alt={alt} fill sizes={sizes} className="object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-3xl text-subtle" aria-hidden="true">
          🛍
        </div>
      )}
    </div>
  );
}
