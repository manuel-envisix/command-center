import { useCallback, useEffect, useState } from "react";

export function ImageLightbox({
  src,
  alt,
  className = "image-thumb",
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <button type="button" className="image-lightbox-trigger" onClick={() => setOpen(true)}>
        <img src={src} alt={alt ?? ""} className={className} loading="lazy" />
      </button>
      {open && (
        <div
          className="image-lightbox-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={alt ?? "Bild in Vollbild"}
          onClick={close}
        >
          <img
            src={src}
            alt={alt ?? ""}
            className="image-lightbox-full"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
