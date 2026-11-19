# Panduan: GitHub → Cloudflare Pages (+ database D1)

Struktur proyek:
- `public/`      → semua file website (HTML, CSS, JS, gambar)
- `functions/`   → API server (login admin, undangan member, tulisan)
- `migrations/`  → skema database D1
- `wrangler.toml` → konfigurasi Cloudflare

Password admin: **duroyparkur** (diset lewat langkah 6, tidak disimpan di file website/GitHub).

## 1. Siapkan alat (sekali saja)
1. Pasang Node.js LTS: https://nodejs.org
2. Pasang Git: https://git-scm.com
3. Punya akun GitHub dan akun Cloudflare (gratis).

## 2. Upload ke GitHub
1. Ekstrak ZIP ini, buka folder `portofoliobaru`.
2. Di github.com klik **New repository** → nama `portofolio-fandika` → **Create repository** (tanpa README).
3. Buka terminal di folder proyek, jalankan:
   ```
   git init
   git add .
   git commit -m "Portofolio pertama"
   git branch -M main
   git remote add origin https://github.com/USERNAME-ANDA/portofolio-fandika.git
   git push -u origin main
   ```
   (`setup-admin.local.ps1` otomatis TIDAK ikut ter-upload karena ada di `.gitignore`.)

## 3. Buat database D1
Di terminal, folder proyek:
```
npx wrangler login
npx wrangler d1 create portofolio-db
```
Salin `database_id` dari hasil perintah, buka `wrangler.toml`, ganti
`GANTI-DENGAN-DATABASE-ID-DARI-CLOUDFLARE` dengan ID tersebut. Lalu buat tabel:
```
npx wrangler d1 migrations apply portofolio-db --remote
```
Kirim perubahan ke GitHub:
```
git add wrangler.toml
git commit -m "Isi database id"
git push
```

## 4. Hubungkan Cloudflare ke repository GitHub
1. Dashboard Cloudflare → **Workers & Pages** → **Create** → tab **Pages** → **Connect to Git**.
2. Pilih akun GitHub, pilih repository `portofolio-fandika`, **Begin setup**.
3. Isi:
   - Project name: `portofolio-fandika`
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: *(kosongkan)*
   - Build output directory: `public`
4. Klik **Save and Deploy**. Tunggu sampai selesai; situs ada di `https://portofolio-fandika.pages.dev`.
5. Setiap kali Anda `git push`, Cloudflare otomatis deploy ulang.

> Binding D1 dibaca dari `wrangler.toml` (nama binding `DB`). Pastikan `database_id` sudah benar, lalu deploy ulang bila perlu
> (Deployments → ⋯ → Retry deployment).

## 5. Buat SETUP_TOKEN (kunci rahasia pembuatan admin)
1. Cloudflare → project Pages Anda → **Settings** → **Variables and Secrets** → **Add**.
2. Type: **Secret**, Name: `SETUP_TOKEN`, Value: teks acak panjang (contoh: 30+ huruf/angka acak). Simpan.
3. Lakukan **Retry deployment** agar secret terbaca.

## 6. Buat akun admin (password: duroyparkur)
**Windows (PowerShell)** — di folder proyek:
```
./setup-admin.local.ps1
```
Isi: alamat situs (`portofolio-fandika.pages.dev`), SETUP_TOKEN, email, nama. Password otomatis `duroyparkur`.

**Mac/Linux (terminal)**:
```
curl -X POST https://portofolio-fandika.pages.dev/api/setup \
  -H "Authorization: Bearer ISI_SETUP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"EMAIL_ANDA","displayName":"NAMA_ANDA","password":"duroyparkur"}'
```
Berhasil jika muncul "Admin berhasil dibuat".

Sesudahnya, **hapus secret SETUP_TOKEN** di Cloudflare (Settings → Variables and Secrets).

## 7. Login
Buka `https://portofolio-fandika.pages.dev/admin.html` → email admin + kata sandi `duroyparkur`.
Dari sana Anda bisa mengundang member (tautan berlaku 72 jam) dan menyetujui tulisan.

## Masalah umum
- **Error 500 / "Terjadi kesalahan server"** → `database_id` belum benar, atau migrasi belum dijalankan (langkah 3).
- **"Token setup belum dikonfigurasi"** → SETUP_TOKEN belum dibuat / belum Retry deployment.
- **"Admin sudah dibuat"** → admin sudah ada, langsung login.
- Lupa password admin → hubungi saya, kita reset lewat `wrangler d1 execute`.
