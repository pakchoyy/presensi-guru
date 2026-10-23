import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera } from "lucide-react";

/** Hasil verifikasi yang ikut disimpan bersama absen. */
export interface InfoSelfie {
  /** true = wajah terdeteksi & gerakan kepala (kanan lalu kiri) sesuai. */
  verifikasiWajah: boolean;
}

interface Props {
  onCapture: (blob: Blob, info?: InfoSelfie) => void;
  onCancel: () => void;
}

type Fase = "memuat" | "cari" | "toleh1" | "toleh2" | "hadap" | "selesai" | "manual";

// Ambang dikalibrasi dari foto contoh: wajah menghadap depan |yaw| ≤ 0,10,
// wajah menoleh 0,2–0,66.
const AMBANG_TOLEH = 0.28;
const AMBANG_HADAP = 0.12;
/** Kalau verifikasi tidak kunjung lolos, foto biasa boleh diambil (ditandai). */
const BATAS_TUNGGU_MS = 45_000;
const MODEL_URL = "/assets/face-v1";

const INSTRUKSI: Record<Fase, string> = {
  memuat: "Menyiapkan kamera…",
  cari: "Hadapkan Wajah",
  toleh1: "Toleh Kanan",
  toleh2: "Toleh Kiri",
  hadap: "Lihat ke Kamera",
  selesai: "Wajah Terverifikasi",
  manual: "Ambil Foto",
};

type FaceApi = typeof import("@vladmandic/face-api");

/** Muat face-api + model sekali saja (dibagi antar pembukaan kamera). */
let muatFaceApi: Promise<FaceApi> | null = null;
function siapkanFaceApi(): Promise<FaceApi> {
  if (!muatFaceApi) {
    muatFaceApi = (async () => {
      const faceapi = await import("@vladmandic/face-api");
      // Tipe bawaan paket tidak mendeklarasikan fungsi backend tfjs ini.
      const tf = faceapi.tf as unknown as {
        setBackend(nama: string): Promise<boolean>;
        ready(): Promise<void>;
      };
      const webgl = await tf.setBackend("webgl").catch(() => false);
      if (!webgl) await tf.setBackend("cpu");
      await tf.ready();
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
      return faceapi;
    })().catch((e) => {
      muatFaceApi = null; // boleh dicoba lagi lain kali
      throw e;
    });
  }
  return muatFaceApi;
}

/**
 * Seberapa menoleh kepala: posisi hidung relatif titik tengah kedua mata,
 * dibagi jarak antar mata. ±0 = menghadap depan.
 */
function hitungYaw(pos: { x: number; y: number }[]): number {
  const rata = (a: { x: number }[]) => a.reduce((s, q) => s + q.x, 0) / a.length;
  const mataA = rata(pos.slice(36, 42));
  const mataB = rata(pos.slice(42, 48));
  const lebar = Math.abs(mataB - mataA) || 1;
  return (pos[30].x - (mataA + mataB) / 2) / lebar;
}

export function SelfieCamera({ onCapture, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>("memuat");
  const [petunjuk, setPetunjuk] = useState<string | null>(null);
  const [progres, setProgres] = useState(0);
  const [bolehManual, setBolehManual] = useState(false);
  const [dialog, setDialog] = useState<{ judul: string; pesan: string; blob: Blob; info: InfoSelfie } | null>(null);

  const faseRef = useRef<Fase>("memuat");
  const arahPertama = useRef<1 | -1>(1);
  const ubahFase = (f: Fase) => { faseRef.current = f; setFase(f); };

  // ---- kamera --------------------------------------------------------
  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
          audio: false,
        });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => { /* autoplay ditolak — tetap tampil */ });
        }
      } catch (err: unknown) {
        const msg = String((err as { name?: string })?.name || err);
        if (msg.includes("NotAllowed") || msg.includes("Permission")) setError("Izinkan akses kamera di browser");
        else if (msg.includes("NotFound")) setError("Kamera depan tidak ditemukan");
        else setError("Gagal membuka kamera");
      }
    })();
    return () => {
      stopped = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  /** Ambil frame saat ini (dicerminkan seperti pratinjau). */
  const ambilFrame = useCallback((): Promise<Blob | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return Promise.resolve(null);
    const w = video.videoWidth || 720;
    const h = video.videoHeight || 960;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -w, 0, w, h);
    ctx.restore();
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85));
  }, []);

  // ---- deteksi wajah & gerak kepala -----------------------------------
  useEffect(() => {
    if (error) return;
    let berhenti = false;
    let faceapi: FaceApi | null = null;
    const mulai = Date.now();

    const putaran = async () => {
      if (berhenti) return;
      const video = videoRef.current;
      const f = faseRef.current;
      if (!faceapi || !video || video.readyState < 2 || f === "selesai" || f === "manual") {
        if (!berhenti && f !== "selesai" && f !== "manual") setTimeout(putaran, 150);
        return;
      }
      try {
        const hasil = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
          .withFaceLandmarks(true);

        if (hasil.length === 0) setPetunjuk("Wajah tidak terlihat");
        else if (hasil.length > 1) setPetunjuk("Pastikan hanya 1 wajah");
        else {
          const d = hasil[0];
          const lebarWajah = d.detection.box.width / (video.videoWidth || 1);
          if (lebarWajah < 0.22) setPetunjuk("Dekatkan wajah ke kamera");
          else {
            setPetunjuk(null);
            const yaw = hitungYaw(d.landmarks.positions);
            if (f === "cari") {
              if (Math.abs(yaw) <= AMBANG_HADAP) ubahFase("toleh1");
            } else if (f === "toleh1") {
              setProgres(Math.min(1, Math.abs(yaw) / AMBANG_TOLEH));
              if (Math.abs(yaw) >= AMBANG_TOLEH) {
                arahPertama.current = yaw > 0 ? 1 : -1;
                setProgres(0);
                ubahFase("toleh2");
              }
            } else if (f === "toleh2") {
              const ke = -arahPertama.current * yaw; // positif = ke arah sebaliknya
              setProgres(Math.max(0, Math.min(1, ke / AMBANG_TOLEH)));
              if (ke >= AMBANG_TOLEH) { setProgres(0); ubahFase("hadap"); }
            } else if (f === "hadap" && Math.abs(yaw) <= AMBANG_HADAP) {
              ubahFase("selesai");
              const blob = await ambilFrame();
              if (blob && !berhenti) {
                setDialog({
                  judul: "Info",
                  pesan: "Wajah terverifikasi — gerakan kepala sesuai.",
                  blob,
                  info: { verifikasiWajah: true },
                });
              }
              return;
            }
          }
        }
      } catch {
        /* frame gagal diproses — coba frame berikutnya */
      }
      if (Date.now() - mulai > BATAS_TUNGGU_MS) setBolehManual(true);
      if (!berhenti) setTimeout(putaran, 120);
    };

    siapkanFaceApi()
      .then((api) => {
        if (berhenti) return;
        faceapi = api;
        ubahFase("cari");
        putaran();
      })
      .catch(() => {
        // Offline / perangkat tidak mendukung: tetap bisa absen dengan foto biasa.
        if (berhenti) return;
        ubahFase("manual");
        setPetunjuk("Verifikasi wajah tidak tersedia — ambil foto biasa");
      });

    return () => { berhenti = true; };
  }, [error, ambilFrame]);

  const jepretManual = async () => {
    const blob = await ambilFrame();
    if (blob) onCapture(blob, { verifikasiWajah: false });
  };

  const verifikasiBerjalan = fase === "cari" || fase === "toleh1" || fase === "toleh2" || fase === "hadap";
  const warnaIkon =
    fase === "selesai" ? "#16a34a" : fase === "manual" ? "#ffffff" : fase === "memuat" ? "#9ca3af" : "#dc2626";

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-black">
      {/* Header */}
      <div
        className="h-[58px] flex items-center gap-3 px-3 text-white flex-shrink-0"
        style={{ background: "var(--grad)" }}
      >
        <button
          onClick={onCancel}
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-transparent border-none text-white active:scale-95"
          aria-label="Kembali"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="font-bold text-[1.05rem]">Ambil Foto</div>
      </div>

      {/* Kamera */}
      <div className="relative flex-1 overflow-hidden bg-black">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div className="bg-red-500/20 text-red-200 px-4 py-3 rounded-xl text-[0.85rem] text-center max-w-[320px]">
              {error}
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        )}

        {/* Bingkai wajah */}
        {!error && (
          <div
            className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 w-[64%] max-w-[300px] aspect-[3/4] rounded-[50%] border-[3px] pointer-events-none transition-colors"
            style={{
              borderColor: fase === "selesai" ? "#16a34a" : petunjuk ? "#f59e0b" : "rgba(255,255,255,.85)",
              boxShadow: "0 0 0 9999px rgba(0,0,0,.35)",
            }}
          />
        )}

        {/* Instruksi */}
        {!error && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-black/85 px-7 pt-3 pb-3 rounded-b-2xl text-center min-w-[180px]">
            <div className="text-white font-extrabold text-[1.3rem] leading-tight whitespace-nowrap">{INSTRUKSI[fase]}</div>
            <Camera size={34} className="mx-auto mt-1" style={{ color: warnaIkon }} />
            {(fase === "toleh1" || fase === "toleh2") && (
              <div className="mt-2 h-[5px] w-full rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full bg-[#22c55e] transition-[width] duration-100" style={{ width: `${progres * 100}%` }} />
              </div>
            )}
          </div>
        )}

        {/* Petunjuk */}
        {!error && petunjuk && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/75 text-[#fbbf24] text-[0.78rem] font-bold whitespace-nowrap">
            {petunjuk}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Tombol rana */}
      <div className="h-[132px] flex-shrink-0 flex flex-col items-center justify-center gap-2 bg-[#6b7280]/90">
        <button
          onClick={jepretManual}
          disabled={!!error || (verifikasiBerjalan && !bolehManual) || fase === "memuat" || fase === "selesai"}
          className="w-[78px] h-[78px] rounded-full flex items-center justify-center text-white border-none shadow-xl active:scale-95 disabled:opacity-45 transition-opacity"
          style={{ background: "var(--brand-strong)" }}
          aria-label="Ambil foto"
        >
          <Camera size={30} />
        </button>
        <div className="text-[0.65rem] text-white/85 font-semibold text-center px-6 leading-snug">
          {fase === "manual"
            ? "Tekan untuk mengambil foto"
            : bolehManual && verifikasiBerjalan
              ? "Verifikasi lama? Tekan untuk foto biasa (ditandai belum terverifikasi)"
              : "Ikuti instruksi di atas — foto diambil otomatis"}
        </div>
      </div>

      {/* Dialog hasil */}
      {dialog && (
        <div className="absolute inset-0 z-10 bg-black/40 flex items-center justify-center px-8">
          <div className="w-full max-w-[340px] rounded-[28px] bg-[#efe9f1] px-6 pt-6 pb-4 shadow-2xl">
            <div className="font-bold text-[#1f1f1f] text-[1rem]">{dialog.judul}</div>
            <div className="text-[#2b2b2b] text-[0.92rem] mt-4 leading-snug">{dialog.pesan}</div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => onCapture(dialog.blob, dialog.info)}
                className="px-5 py-2 rounded-full text-[#1d8fe1] font-bold text-[0.95rem] bg-transparent border-none active:bg-black/5"
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
