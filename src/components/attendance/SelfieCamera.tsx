import { useEffect, useRef, useState } from "react";
import { Camera, X, RotateCcw, Check } from "lucide-react";

interface Props {
  onCapture: (blob: Blob) => void;
  onCancel: () => void;
}

export function SelfieCamera({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => { /* ignore */ });
        }
      } catch (err: any) {
        const msg = String(err?.name || err);
        if (msg.includes("NotAllowed") || msg.includes("Permission")) {
          setError("Izinkan akses kamera di browser");
        } else if (msg.includes("NotFound")) {
          setError("Kamera depan tidak ditemukan");
        } else {
          setError("Gagal membuka kamera");
        }
      }
    })();
    return () => {
      stopped = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth || 720;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror horizontal supaya hasil seperti kaca
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -w, 0, w, h);
    ctx.restore();
    canvas.toBlob((blob) => {
      if (!blob) return;
      setCapturedBlob(blob);
      setPreview(URL.createObjectURL(blob));
    }, "image/jpeg", 0.85);
  };

  const retake = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setCapturedBlob(null);
  };

  const confirm = () => {
    if (capturedBlob) onCapture(capturedBlob);
  };

  return (
    <div className="fixed inset-0 bg-black z-[1000] flex flex-col items-center justify-center">
      <button
        onClick={onCancel}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center z-10"
        aria-label="Tutup"
      >
        <X size={20} />
      </button>

      <div className="text-white text-[0.85rem] font-bold mb-3 flex items-center gap-2">
        <Camera size={18} /> {preview ? "Konfirmasi foto" : "Posisikan wajah di tengah"}
      </div>

      {error ? (
        <div className="bg-red-500/20 text-red-300 px-4 py-3 rounded-xl text-[0.8rem] text-center max-w-[320px]">
          {error}
        </div>
      ) : preview ? (
        <img
          src={preview}
          alt="Preview"
          className="w-[min(90vw,440px)] h-[min(90vw,440px)] object-cover rounded-xl"
        />
      ) : (
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-[min(90vw,440px)] h-[min(90vw,440px)] object-cover rounded-xl bg-black"
          style={{ transform: "scaleX(-1)" }}
        />
      )}

      <canvas ref={canvasRef} className="hidden" />

      <div className="mt-5 flex gap-3">
        {preview ? (
          <>
            <button
              onClick={retake}
              className="px-5 py-3 rounded-full bg-white/20 text-white font-bold flex items-center gap-2"
            >
              <RotateCcw size={18} /> Ulangi
            </button>
            <button
              onClick={confirm}
              className="px-6 py-3 rounded-full bg-[#0d9488] text-white font-bold flex items-center gap-2"
            >
              <Check size={18} /> Pakai Foto Ini
            </button>
          </>
        ) : (
          !error && (
            <button
              onClick={capture}
              className="w-16 h-16 rounded-full bg-white border-4 border-[#0d9488] active:scale-95 transition-transform"
              aria-label="Ambil foto"
            />
          )
        )}
      </div>
    </div>
  );
}
