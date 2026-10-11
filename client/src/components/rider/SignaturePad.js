"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

const WIDTH = 500;
const HEIGHT = 180;

// A box the customer signs with a finger or mouse. onChange(dataUrl | null) after each stroke.
// The picture is a small PNG (a few KB), sent to the server as proof of delivery.
export default function SignaturePad({ onChange }) {
  const t = useTranslations("rider");
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  // White background and a thick dark pen.
  useEffect(() => {
    const context = canvasRef.current.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.lineWidth = 3;
    context.lineCap = "round";
    context.strokeStyle = "#111111";
  }, []);

  // Converts a pointer position on screen to a position on the canvas.
  function pointFrom(event) {
    const box = canvasRef.current.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * WIDTH, y: ((event.clientY - box.top) / box.height) * HEIGHT };
  }

  // Starts a stroke.
  function start(event) {
    event.preventDefault();
    canvasRef.current.setPointerCapture(event.pointerId);
    const { x, y } = pointFrom(event);
    const context = canvasRef.current.getContext("2d");
    context.beginPath();
    context.moveTo(x, y);
    isDrawing.current = true;
  }

  // Draws while the finger or mouse moves.
  function move(event) {
    if (!isDrawing.current) return;
    const { x, y } = pointFrom(event);
    const context = canvasRef.current.getContext("2d");
    context.lineTo(x, y);
    context.stroke();
  }

  // Ends the stroke and reports the new picture.
  function end() {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    setHasInk(true);
    onChange(canvasRef.current.toDataURL("image/png"));
  }

  // Wipes the box.
  function clear() {
    const context = canvasRef.current.getContext("2d");
    context.fillRect(0, 0, WIDTH, HEIGHT);
    setHasInk(false);
    onChange(null);
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="w-full touch-none rounded-md border border-line bg-white"
        aria-label={t("signHere")}
      />
      <div className="mt-1 flex justify-between text-xs text-subtle">
        <span>{t("signHere")}</span>
        {hasInk && (
          <button type="button" onClick={clear} className="text-brand underline">
            {t("clearSignature")}
          </button>
        )}
      </div>
    </div>
  );
}
