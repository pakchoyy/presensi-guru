export function Footer() {
  return (
    <footer
      className="hidden lg:block w-full text-white text-center py-[8px] px-5 flex-shrink-0"
      style={{
        background: "linear-gradient(135deg,#14b8a6,#0d9488,#0f766e)",
      }}
    >
      <div className="text-[0.72rem] font-semibold mb-[2px]">Presensi Siswa</div>
      <div className="text-[0.62rem] text-white/60">
        &copy; 2026 Bantu Guru Yuk by{" "}
        <a
          href="https://www.tiktok.com/@pak.choyy"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline hover:opacity-100"
        >
          @pak.choyy
        </a>
        {" "}&bull; v1.0.0
      </div>
    </footer>
  );
}
