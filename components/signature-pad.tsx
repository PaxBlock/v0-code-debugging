"use client";

import { useRef, useState } from "react";

export function SignaturePad({ label }: { label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const context = canvas.getContext("2d");
    if (!context) return;
    context.lineWidth = 2;
    context.lineCap = "round";
    context.strokeStyle = "#10251f";
    context.lineTo(event.clientX - rect.left, event.clientY - rect.top);
    context.stroke();
  }
  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    canvasRef.current?.setPointerCapture(event.pointerId);
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const context = canvas?.getContext("2d");
    if (!rect || !context) return;
    context.beginPath();
    context.moveTo(event.clientX - rect.left, event.clientY - rect.top);
    setDrawing(true);
  }
  const [data, setData] = useState("");
  function clear() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setData("");
  }
  function finish() {
    setDrawing(false);
    setData(canvasRef.current?.toDataURL("image/png") ?? "");
  }
  const inputName = `${label.toLowerCase().replaceAll(" ", "_")}_signature_data`;
  return <div className="space-y-2"><div className="flex items-center justify-between"><label className="text-sm font-semibold">{label}</label><button type="button" onClick={clear} className="text-xs font-semibold text-[#3b806a]">Clear</button></div><canvas ref={canvasRef} width={560} height={130} onPointerDown={start} onPointerMove={(event) => drawing && point(event)} onPointerUp={finish} onPointerCancel={finish} className="h-28 w-full touch-none rounded-xl border border-dashed border-[#9bb9aa] bg-white" /><input name={inputName} value={data} readOnly type="hidden" /></div>;
}
