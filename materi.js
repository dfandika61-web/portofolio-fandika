const lessons = {
  "hello-world": {
    number: "01",
    title: "Hello World",
    language: "PHP",
    intro: "Hello World adalah program sederhana untuk mencoba menjalankan kode dan menampilkan tulisan ke layar. Dari contoh kecil ini, saya mulai mengenal cara program memberi hasil.",
    learned: "Saya belajar bahwa perintah echo dapat menampilkan teks. Ini menjadi langkah awal sebelum membuat program dengan logika yang lebih lengkap.",
    code: '<?php\necho "Hello, World!";\n?>',
  },
  php: {
    number: "02",
    title: "Belajar PHP",
    language: "PHP",
    intro: "PHP adalah bahasa pemrograman yang bisa dijalankan di sisi server. Saya mempelajari dasar sintaks, variabel, dan cara mengolah data sebelum ditampilkan di halaman.",
    learned: "Saya mulai memahami variabel dan output sederhana menggunakan echo. PHP juga bisa dipakai untuk menghubungkan halaman website dengan database.",
    code: '<?php\n$nama = "Duroy";\necho "Halo, " . $nama;\n?>',
  },
  mysql: {
    number: "03",
    title: "MySQL & Database",
    language: "SQL",
    intro: "Database membantu menyimpan data agar dapat diatur dan digunakan kembali. Saya belajar mengenal MySQL serta perintah dasar untuk membuat dan membaca data.",
    learned: "Saya mengenal database, tabel, dan query dasar. Contoh ini membuat database latihan dan menampilkan isi tabel siswa.",
    code: "CREATE DATABASE belajar_rpl;\nUSE belajar_rpl;\n\nCREATE TABLE siswa (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  nama VARCHAR(100)\n);\n\nSELECT * FROM siswa;",
  },
  html: {
    number: "04",
    title: "HTML",
    language: "HTML",
    intro: "HTML digunakan untuk menyusun struktur halaman website. Dengan elemen seperti heading, paragraf, dan tautan, saya bisa menentukan isi yang tampil di browser.",
    learned: "Saya belajar menyusun dokumen HTML dengan elemen yang punya fungsi masing-masing, lalu menghubungkannya ke file CSS untuk mengatur tampilan.",
    code: '<!doctype html>\n<html lang="id">\n  <body>\n    <h1>Halo, dunia!</h1>\n    <p>Ini halaman pertama saya.</p>\n  </body>\n</html>',
  },
  css: {
    number: "05",
    title: "CSS",
    language: "CSS",
    intro: "CSS mengatur tampilan halaman HTML, mulai dari warna dan ukuran teks sampai tata letak. Dengan CSS, halaman sederhana bisa dibuat lebih rapi dan mudah dibaca.",
    learned: "Saya belajar menghubungkan aturan CSS dengan elemen HTML, mengatur warna dan jarak, serta membuat halaman menyesuaikan ukuran layar.",
    code: "body {\n  background: #dedddb;\n  color: #10100f;\n  font-family: sans-serif;\n}\n\nh1 {\n  color: #e44838;\n}",
  },
};

const topic = new URLSearchParams(window.location.search).get("topik");
const lesson = topic ? lessons[topic] : undefined;
const content = document.querySelector("[data-lesson-content]");
const error = document.querySelector("[data-lesson-error]");

if (!lesson) {
  content.hidden = true;
  error.hidden = false;
  document.title = "Materi tidak ditemukan — Fandika";
} else {
  document.title = `${lesson.title} — Catatan Belajar Fandika`;
  document.querySelector("[data-lesson-number]").textContent = `MATERI / ${lesson.number}`;
  document.querySelector("[data-lesson-title]").textContent = lesson.title;
  document.querySelector("[data-lesson-intro]").textContent = lesson.intro;
  document.querySelector("[data-code-language]").textContent = lesson.language;
  document.querySelector("[data-lesson-code]").textContent = lesson.code;
  document.querySelector("[data-lesson-learned]").textContent = lesson.learned;

  const otherLessons = document.querySelector("[data-other-lessons]");
  Object.entries(lessons)
    .filter(([id]) => id !== topic)
    .forEach(([id, otherLesson]) => {
      const link = document.createElement("a");
      link.href = `materi.html?topik=${encodeURIComponent(id)}`;
      link.textContent = otherLesson.title;
      otherLessons.append(link);
    });
}
