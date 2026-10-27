import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { School, Teacher, TeacherAttendance } from "@/types/entities";
import { isHariEfektif, todayStr } from "@/lib/utils";

export interface RekapGuruCtx {
  school: School | null;
  teacher: Teacher | null;
  guru: Teacher;
  bulan: number;             // 1-12
  tahun: number;
  records: TeacherAttendance[];
  periode: string;           // e.g. "Oktober 2026"
  liburSet?: Set<string>;    // tanggal libur (YYYY-MM-DD) dari kalender akademik
}

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function daysInMonth(tahun: number, bulan: number): number {
  return new Date(tahun, bulan, 0).getDate();
}

function fmtTime(t?: string): string {
  if (!t) return "-";
  // Accept HH:MM:SS or HH:MM; strip to HH:MM for display
  return t.slice(0, 5);
}

function durasiJamMenit(masuk?: string, pulang?: string): string {
  if (!masuk || !pulang) return "-";
  const [h1, m1] = masuk.split(":").map(Number);
  const [h2, m2] = pulang.split(":").map(Number);
  if ([h1, m1, h2, m2].some((n) => isNaN(n))) return "-";
  const totalM = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (totalM <= 0) return "-";
  const h = Math.floor(totalM / 60);
  const m = totalM % 60;
  return `${h}j ${m}m`;
}

function statusMasukLabel(s?: string): string {
  if (!s) return "-";
  if (s === "ONTIME") return "Tepat";
  if (s === "LATE") return "Terlambat";
  if (s === "FAR") return "Luar Area";
  return s;
}

function statusHariLabel(s?: string): string {
  if (!s) return "H";
  const map: Record<string, string> = { H: "Hadir", S: "Sakit", I: "Izin", A: "Alpha", T: "Terlambat" };
  return map[s] || s;
}

interface Row {
  tanggal: string;
  hari: string;
  jamMasuk: string;
  jamPulang: string;
  durasi: string;
  statusMasuk: string;
  statusHari: string;
  catatan: string;
}

interface Summary {
  totalHari: number;
  hadir: number;
  terlambat: number;
  sakit: number;
  izin: number;
  alpha: number;
  luarArea: number;
}

function buildRowsAndSummary(ctx: RekapGuruCtx): { rows: Row[]; summary: Summary } {
  const dMax = daysInMonth(ctx.tahun, ctx.bulan);
  const byDate = new Map<string, TeacherAttendance>();
  for (const r of ctx.records) byDate.set(r.tanggal, r);

  const rows: Row[] = [];
  const summary: Summary = {
    totalHari: 0,
    hadir: 0, terlambat: 0, sakit: 0, izin: 0, alpha: 0, luarArea: 0,
  };

  for (let d = 1; d <= dMax; d++) {
    const dateStr = `${ctx.tahun}-${String(ctx.bulan).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    // Lewati hari non-efektif (bukan hari masuk / libur) agar rekap konsisten.
    if (!isHariEfektif(dateStr, ctx.guru, ctx.liburSet)) continue;
    const dow = new Date(ctx.tahun, ctx.bulan - 1, d).getDay();
    const rec = byDate.get(dateStr);
    // Hari efektif yang sudah lewat tanpa presensi/izin = Alpha otomatis.
    const izinDitolak = rec?.statusIzin === "ditolak" && (rec.statusHari === "S" || rec.statusHari === "I");
    const sh = (izinDitolak ? undefined : rec?.statusHari) || (!rec?.jamMasuk && dateStr < todayStr() ? "A" : undefined);
    const sm = rec?.statusMasuk;

    rows.push({
      tanggal: dateStr.slice(8),
      hari: HARI[dow],
      jamMasuk: fmtTime(rec?.jamMasuk),
      jamPulang: fmtTime(rec?.jamPulang),
      durasi: durasiJamMenit(rec?.jamMasuk, rec?.jamPulang),
      statusMasuk: statusMasukLabel(sm),
      statusHari: statusHariLabel(sh || (rec?.jamMasuk ? "H" : undefined)),
      catatan: rec?.catatan || "",
    });

    if (rec?.jamMasuk) {
      summary.totalHari++;
      if (sm === "LATE" || sh === "T") summary.terlambat++;
      else if (sm === "FAR") summary.luarArea++;
      else summary.hadir++;
    }
    if (sh === "S") summary.sakit++;
    else if (sh === "I") summary.izin++;
    else if (sh === "A") summary.alpha++;
  }
  return { rows, summary };
}

/** Kop: logo + nama sekolah + judul + garis. Dipakai rekap per guru & rekap semua guru. */
function kopSekolah(doc: jsPDF, school: School | null, judul: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  if (school?.logoUrl) {
    try {
      const logo = school.logoUrl;
      if (logo.startsWith("data:image")) {
        doc.addImage(logo, "PNG", margin, 14, 18, 18);
      }
    } catch { /* skip */ }
  }

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(school?.nama || "Sekolah", pageW / 2, 22, { align: "center" });

  doc.setFontSize(11);
  doc.text(judul, pageW / 2, 30, { align: "center" });

  doc.setDrawColor(30, 64, 175);
  doc.setLineWidth(0.5);
  doc.line(margin, 35, pageW - margin, 35);
}

function buildKop(doc: jsPDF, ctx: RekapGuruCtx) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  kopSekolah(doc, ctx.school, "LAPORAN REKAP PRESENSI GURU");

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Nama Guru : ${ctx.guru.nama}`, margin, 43);
  if (ctx.guru.nip) doc.text(`NIP       : ${ctx.guru.nip}`, margin, 49);
  if (ctx.guru.jabatan) doc.text(`Jabatan   : ${ctx.guru.jabatan}`, margin, 55);
  doc.text(`Periode   : ${ctx.periode}`, pageW - margin, 43, { align: "right" });
  if (ctx.school?.jamMasukStandar) {
    doc.text(`Jam Standar: ${ctx.school.jamMasukStandar} - ${ctx.school.jamPulangStandar || "-"}`, pageW - margin, 49, { align: "right" });
  }

  doc.line(margin, 60, pageW - margin, 60);
  return 62;
}

export async function exportRekapGuruPDF(ctx: RekapGuruCtx): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const startY = buildKop(doc, ctx);
  const { rows, summary } = buildRowsAndSummary(ctx);

  const body = rows.map((r) => [
    r.tanggal, r.hari, r.jamMasuk, r.jamPulang, r.durasi, r.statusMasuk, r.statusHari, r.catatan,
  ]);

  autoTable(doc, {
    startY,
    head: [["Tgl", "Hari", "Masuk", "Pulang", "Durasi", "Status Masuk", "Status Hari", "Catatan"]],
    body,
    theme: "grid",
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    styles: { halign: "center" },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 16, halign: "left" },
      7: { cellWidth: 30, halign: "left" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // Footer summary
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY;
  const sumY = finalY + 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Ringkasan Bulan Ini", 14, sumY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const lines = [
    `Total hari masuk : ${summary.totalHari}`,
    `Tepat Waktu      : ${summary.hadir}`,
    `Terlambat        : ${summary.terlambat}`,
    `Di Luar Area     : ${summary.luarArea}`,
    `Sakit            : ${summary.sakit}`,
    `Izin             : ${summary.izin}`,
    `Alpha            : ${summary.alpha}`,
  ];
  lines.forEach((ln, i) => doc.text(ln, 14, sumY + 6 + i * 5));

  const filename = `Rekap_Guru_${ctx.guru.nama.replace(/\s+/g, "_")}_${ctx.periode.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}

export async function exportRekapGuruXLSX(ctx: RekapGuruCtx): Promise<void> {
  const wb = XLSX.utils.book_new();
  const { rows, summary } = buildRowsAndSummary(ctx);

  const header = ["Tanggal", "Hari", "Jam Masuk", "Jam Pulang", "Durasi", "Status Masuk", "Status Hari", "Catatan"];
  const info = [
    [`Sekolah : ${ctx.school?.nama || "-"}`],
    [`Guru    : ${ctx.guru.nama}`],
    [`NIP     : ${ctx.guru.nip || "-"}`],
    [`Jabatan : ${ctx.guru.jabatan || "-"}`],
    [`Periode : ${ctx.periode}`],
    [`Jam Standar : ${ctx.school?.jamMasukStandar || "-"} - ${ctx.school?.jamPulangStandar || "-"}`],
    [],
  ];
  const body = rows.map((r) => [
    r.tanggal, r.hari, r.jamMasuk, r.jamPulang, r.durasi, r.statusMasuk, r.statusHari, r.catatan,
  ]);
  const footer = [
    [],
    ["RINGKASAN"],
    ["Total hari masuk", summary.totalHari],
    ["Tepat Waktu", summary.hadir],
    ["Terlambat", summary.terlambat],
    ["Di Luar Area", summary.luarArea],
    ["Sakit", summary.sakit],
    ["Izin", summary.izin],
    ["Alpha", summary.alpha],
  ];

  const all = [...info, header, ...body, ...footer];
  const ws = XLSX.utils.aoa_to_sheet(all);
  ws["!cols"] = [{ wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 30 }];

  XLSX.utils.book_append_sheet(wb, ws, "Rekap Guru");

  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Rekap_Guru_${ctx.guru.nama.replace(/\s+/g, "_")}_${ctx.periode.replace(/\s+/g, "_")}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Rekap semua guru (kolektif) ──
export interface BarisKolektif {
  nama: string;
  hari: number;
  hadir: number;
  terlambat: number;
  sakit: number;
  izin: number;
  alpa: number;
  persen: number;
}

const HEAD_KOLEKTIF = ["No", "Nama", "Hari Efektif", "Hadir", "Terlambat", "Sakit", "Izin", "Alpa", "% Kehadiran"];

function barisKolektif(rows: BarisKolektif[]): (string | number)[][] {
  const body = rows.map((r, i) => [i + 1, r.nama, r.hari, r.hadir, r.terlambat, r.sakit, r.izin, r.alpa, `${r.persen}%`]);
  const t = rows.reduce(
    (a, r) => ({ hari: a.hari + r.hari, hadir: a.hadir + r.hadir, terlambat: a.terlambat + r.terlambat, sakit: a.sakit + r.sakit, izin: a.izin + r.izin, alpa: a.alpa + r.alpa }),
    { hari: 0, hadir: 0, terlambat: 0, sakit: 0, izin: 0, alpa: 0 }
  );
  const persen = t.hari ? Math.round(((t.hadir + t.terlambat) / t.hari) * 100) : 0;
  body.push(["", "TOTAL", t.hari, t.hadir, t.terlambat, t.sakit, t.izin, t.alpa, `${persen}%`]);
  return body;
}

const namaFile = (periode: string, ext: string) => `Rekap_Semua_Guru_${periode.replace(/\s+/g, "_")}.${ext}`;

export async function exportRekapKolektifPDF(school: School | null, periode: string, rows: BarisKolektif[]): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  kopSekolah(doc, school, `REKAP KEHADIRAN GURU ${periode.toUpperCase()}`);
  autoTable(doc, {
    startY: 40,
    head: [HEAD_KOLEKTIF],
    body: barisKolektif(rows),
    theme: "grid",
    headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
    styles: { halign: "center" },
    columnStyles: { 0: { cellWidth: 12 }, 1: { halign: "left" } },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (d) => { if (d.section === "body" && d.row.index === rows.length) d.cell.styles.fontStyle = "bold"; },
  });
  doc.save(namaFile(periode, "pdf"));
}

export async function exportRekapKolektifXLSX(school: School | null, periode: string, rows: BarisKolektif[]): Promise<void> {
  const ws = XLSX.utils.aoa_to_sheet([
    [`Sekolah : ${school?.nama || "-"}`],
    [`Rekap Kehadiran Guru ${periode}`],
    [],
    HEAD_KOLEKTIF,
    ...barisKolektif(rows),
  ]);
  ws["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap Semua Guru");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFile(periode, "xlsx");
  a.click();
  URL.revokeObjectURL(url);
}

export function periodeLabel(bulan: number, tahun: number): string {
  return `${MONTHS[bulan - 1]} ${tahun}`;
}
