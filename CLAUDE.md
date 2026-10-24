<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Hemat deploy Vercel

- Kuota deploy Vercel (Hobby) 100 per hari untuk seluruh tim, dipakai bersama project Siswa, Guru, dan Store.
- Branch selain `main` tidak di-build (Ignored Build Step). Pakai branch kerja untuk perubahan yang belum final.
- Gabungkan perubahan kecil jadi satu push ke `main`. Jangan push per commit kecil.
- Push ke `main` hanya untuk perubahan yang siap tayang. Perbaikan teks atau rapi-rapi ditunda dan digabung dengan perubahan berikutnya, kecuali ada masalah mendesak.
- Jangan memicu deploy ulang tanpa kebutuhan (commit kosong, redeploy berulang).
