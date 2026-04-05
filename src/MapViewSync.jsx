import { useEffect } from "react";
import { useMap } from "react-leaflet";

/** Leaflet measures the container before layout finishes; this re-syncs tiles. */
export default function MapViewSync() {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    invalidate();
    const raf = requestAnimationFrame(invalidate);
    const t1 = window.setTimeout(invalidate, 0);
    const t2 = window.setTimeout(invalidate, 150);
    window.addEventListener("resize", invalidate);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", invalidate);
    };
  }, [map]);

  return null;
}
