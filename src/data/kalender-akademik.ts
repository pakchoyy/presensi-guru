import { CalendarEntryType, CalendarSource } from "@/types/enums";
import type { AcademicCalendarEntry } from "@/types/entities";

export function generateDefaultCalendar(
  tahunAjaranId: number,
  tahunAjaranLabel: string
): AcademicCalendarEntry[] {
  const [startYear] = tahunAjaranLabel.split("/").map(Number);
  const entries: AcademicCalendarEntry[] = [];
  let idCounter = 1;

  const addLibur = (label: string, date: string) => {
    entries.push({
      id: tahunAjaranId * 1000 + idCounter++,
      tahunAjaranId,
      tanggal: date,
      jenis: CalendarEntryType.HARI_LIBUR,
      keterangan: label,
      sumber: CalendarSource.BAWAAN,
    });
  };

  // Hari libur nasional Indonesia 2026
  addLibur("Tahun Baru 2026", "2026-01-01");
  addLibur("Isra Mi'raj Nabi Muhammad SAW", "2026-01-16");
  addLibur("Tahun Baru Imlek 2577", "2026-02-17");
  addLibur("Hari Raya Nyepi", "2026-03-19");
  addLibur("Wafat Isa Al Masih", "2026-04-03");
  addLibur("Hari Buruh Internasional", "2026-05-01");
  addLibur("Kenaikan Isa Al Masih", "2026-05-14");
  addLibur("Hari Raya Waisak 2570", "2026-05-31");
  addLibur("Hari Lahir Pancasila", "2026-06-01");
  addLibur("Idul Adha 1447 H", "2026-06-08");
  addLibur("Tahun Baru Islam 1448 H", "2026-06-27");
  addLibur("Hari Kemerdekaan RI", "2026-08-17");
  addLibur("Maulid Nabi Muhammad SAW", "2026-09-06");
  addLibur("Hari Raya Natal", "2026-12-25");

  // Hari libur 2027
  addLibur("Tahun Baru 2027", "2027-01-01");

  return entries;
}
