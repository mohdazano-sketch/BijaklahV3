import React, { useState, useEffect } from 'react';


// ---- Persistence: family profile (multiple children) saved to localStorage ----
// Subscription lives at the FAMILY level (one payment unlocks all children).
// Each child has their own name/age/completedLevels so progress never mixes.
const STORAGE_KEY = 'bijaklah_family_v1';

function loadFamily() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.children)) return parsed;
    }
  } catch (e) {
    // Corrupted data or localStorage unavailable (e.g. private browsing) —
    // fall through to a fresh empty family so the app still works, just
    // without persistence for that session.
  }
  return { children: [], isSubscribed: false };
}

function saveFamily(family) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(family));
  } catch (e) {
    // Storage full or unavailable — fail silently, app still works in-memory
    // for the current session.
  }
}

function makeChildId() {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---- Content data: Klasifikasi Haiwan (Science Year 3-4) ----
const SUBJECTS = {
  sains: {
    id: 'sains',
    label: 'Sains',
    emoji: '🦁',
    skillLabel: 'haiwan dikenali',
  },
  matematik: {
    id: 'matematik',
    label: 'Matematik',
    emoji: '🔢',
    skillLabel: 'kiraan dikuasai',
  },
  literasibm: {
    id: 'literasibm',
    label: 'Literasi BM',
    emoji: '🔤',
    skillLabel: 'huruf & suku kata dikuasai',
  },
  literacyen: {
    id: 'literacyen',
    label: 'Literacy EN',
    emoji: '🔡',
    skillLabel: 'letters & sounds mastered',
  },
};

// Standard Prestasi (SPi) — Tahap 1-6, disesuaikan/diparafrasa daripada
// "Performance Standards Guide" rasmi DSKP Bahasa Inggeris Tahun 1 (KPM &
// Cambridge English, 2017), khusus bagi setiap kemahiran (strand).
// NOTA PENTING: Tahap SPi rasmi di sekolah dinilai GURU berdasarkan
// pemerhatian berterusan (contoh: berapa banyak bantuan murid perlukan).
// App ini menganggarkan tahap berdasarkan % ketepatan jawapan sahaja — ia
// panduan/anggaran, BUKAN penilaian rasmi PBD sekolah. Label ini mesti
// dipaparkan bersama anggaran tahap supaya ibu bapa tidak overclaim ia
// setara laporan sekolah.
const SPI_DESCRIPTORS = {
  listening: {
    1: 'Perlu banyak bantuan untuk mengenali bunyi asas; sukar memahami soalan atau arahan mudah walaupun dibantu.',
    2: 'Mengenali sebahagian bunyi dengan banyak bantuan; faham sedikit soalan/arahan mudah dengan bantuan.',
    3: 'Mengenali dan menyebut bunyi dengan bantuan; faham idea utama & butiran mudah dengan bantuan.',
    4: 'Mengenali dan menyebut bunyi dengan sedikit bantuan sahaja; faham dengan sedikit bantuan.',
    5: 'Mengenali dan menyebut bunyi dengan yakin; faham tanpa teragak-agak.',
    6: 'Mengenali dan menyebut bunyi secara berdikari; faham dengan pantas dan yakin tanpa bantuan.',
  },
  speaking: {
    1: 'Sukar menghasilkan perkataan/frasa bermakna walaupun dibantu banyak.',
    2: 'Menghasilkan sedikit perkataan/frasa dengan banyak bantuan.',
    3: 'Menghasilkan & memahami perkataan/frasa topik biasa dengan sedikit bantuan.',
    4: 'Menghasilkan & memahami dengan bantuan minimum; mula berinteraksi dalam perbualan mudah.',
    5: 'Bertutur dengan yakin dalam topik biasa; menjawab soalan tanpa teragak-agak.',
    6: 'Bertutur secara yakin dan berdikari; memulakan & mengekalkan perbualan mudah sendiri.',
  },
  reading: {
    1: 'Sukar mengenali bentuk huruf walaupun dibantu banyak.',
    2: 'Mengenali kebanyakan huruf dengan banyak bantuan; sukar faham idea utama walaupun dibaca berulang.',
    3: 'Mengenali semua huruf; mencantum/memisah bunyi dengan bantuan; faham idea utama dengan bantuan.',
    4: 'Mencantum/memisah bunyi tanpa teragak-agak; faham teks mudah dengan sedikit bantuan.',
    5: 'Membaca perkataan & pola bunyi dengan yakin; faham teks dengan yakin.',
    6: 'Membaca dan faham teks mudah secara berdikari dan yakin.',
  },
  writing: {
    1: 'Sukar menunjukkan kemahiran menulis asas walaupun ditunjuk cara.',
    2: 'Menunjukkan kemahiran menulis asas dengan sedikit kebolehbacaan, banyak bantuan.',
    3: 'Menulis perkataan/frasa mudah dengan ejaan & tanda baca betul, dengan bantuan.',
    4: 'Menulis perkataan/frasa dengan ejaan & tanda baca betul, bantuan minimum.',
    5: 'Menulis dengan yakin tanpa teragak-agak.',
    6: 'Menulis secara berdikari dan yakin, model bahasa yang baik.',
  },
};

// Anggarkan Tahap SPi (1-6) daripada peratus ketepatan jawapan dalam app.
function accuracyToSpiLevel(pct) {
  if (pct < 40) return 1;
  if (pct < 55) return 2;
  if (pct < 70) return 3;
  if (pct < 85) return 4;
  if (pct < 95) return 5;
  return 6;
}

// Generates fresh Tambah/Tolak questions (belasan 11-19, puluh 10-90) every
// time the level is played, so the question set never runs out and can't be
// memorised — no need to manually add new questions for this topic later.
function generateTambahTolakQuestions(count = 8) {
  const teensPool = [];
  for (let base = 11; base <= 19; base++) {
    for (let n = 1; n <= 9; n++) {
      if (base + n <= 20) teensPool.push({ q: `${base} + ${n} = ?`, a: base + n, step: 1 });
      if (base - n >= 1) teensPool.push({ q: `${base} − ${n} = ?`, a: base - n, step: 1 });
    }
  }

  const tens = [10, 20, 30, 40, 50, 60, 70, 80, 90];
  const tensPool = [];
  tens.forEach((base) => {
    tens.forEach((n) => {
      if (base + n <= 100) tensPool.push({ q: `${base} + ${n} = ?`, a: base + n, step: 10 });
      if (base - n >= 10) tensPool.push({ q: `${base} − ${n} = ?`, a: base - n, step: 10 });
    });
  });

  function pickRandom(pool, n) {
    const copy = [...pool];
    const picked = [];
    while (picked.length < n && copy.length > 0) {
      const idx = Math.floor(Math.random() * copy.length);
      picked.push(copy[idx]);
      copy.splice(idx, 1);
    }
    return picked;
  }

  function makeChoices(answer, step) {
    const choices = new Set([answer]);
    let guard = 0;
    while (choices.size < 4 && guard < 40) {
      guard++;
      const offset = (Math.floor(Math.random() * 4) + 1) * step * (Math.random() < 0.5 ? -1 : 1);
      const val = answer + offset;
      if (val > 0 && !choices.has(val)) choices.add(val);
    }
    return [...choices].sort(() => Math.random() - 0.5).map(String);
  }

  const half = Math.floor(count / 2);
  const picked = [...pickRandom(teensPool, half), ...pickRandom(tensPool, count - half)];
  return picked
    .sort(() => Math.random() - 0.5)
    .map(({ q, a, step }) => ({
      question: q,
      choices: makeChoices(a, step),
      answer: String(a),
    }));
}

// Generates fresh "which abacus shows this number" questions (nilai tempat /
// place value) every time the level is played. The question shows the
// TARGET NUMBER; the 4 answer choices are rendered as real abacus pictures
// (via AbacusVisual) and the child picks the one that's correctly set.
// 7 of the 8 questions are 2-digit (1-99, puluh & sa rods); 1 is a 3-digit
// "ratus" question (100-999, ratus/puluh/sa rods) so kids also see the
// hundreds rod, not just tens and ones.
function makeAbacusQuestion(answer, maxValue, rods) {
  const swapped = Number(String(answer).padStart(rods, '0').split('').reverse().join(''));

  const choices = new Set([answer]);
  if (swapped !== answer && swapped >= 0 && swapped <= maxValue) choices.add(swapped);
  let offset = 1;
  while (choices.size < 4 && offset <= maxValue) {
    if (answer + offset <= maxValue) choices.add(answer + offset);
    if (choices.size < 4 && answer - offset >= 0) choices.add(answer - offset);
    offset++;
  }

  return {
    question: `Sempoa mana tunjuk nombor ${answer}?`,
    choiceType: 'abacus',
    rods,
    choices: [...choices].sort(() => Math.random() - 0.5).map(String),
    answer: String(answer),
  };
}

function generateAbacusQuestions(count = 8) {
  const questions = [];
  const used = new Set();
  let guard = 0;

  // 1 "ratus" (hundreds, 3-digit) question
  const ratusAnswer = 100 + Math.floor(Math.random() * 900); // 100-999
  used.add(ratusAnswer);
  const ratusQuestion = makeAbacusQuestion(ratusAnswer, 999, 3);

  // Remaining questions: 2-digit (1-99, puluh & sa)
  while (questions.length < count - 1 && guard < 300) {
    guard++;
    const answer = 1 + Math.floor(Math.random() * 99); // 1-99
    if (used.has(answer)) continue;
    used.add(answer);
    questions.push(makeAbacusQuestion(answer, 99, 2));
  }

  // Insert the ratus question at a random position so it's not always last
  const insertAt = Math.floor(Math.random() * (questions.length + 1));
  questions.splice(insertAt, 0, ratusQuestion);
  return questions;
}

const LEVELS = [
  {
    id: 1,
    subject: 'sains',
    tahun: 1,
    dskpRef: 'Sains Tahun 1 · SK 3.1 Benda Hidup dan Benda Bukan Hidup',
    verified: true,
    name: "Peringkat 1",
    subtitle: "Benda Hidup & Benda Bukan Hidup",
    categories: [
      { id: 'hidup', label: 'Benda Hidup', emoji: '🌱', color: '#3B9B8F' },
      { id: 'bukanhidup', label: 'Benda Bukan Hidup', emoji: '🪨', color: '#8A968B' },
    ],
    animals: [
      { name: 'Kucing', emoji: '🐱', answer: 'hidup' },
      { name: 'Kerusi', emoji: '🪑', answer: 'bukanhidup' },
      { name: 'Pokok Bunga', emoji: '🌻', answer: 'hidup' },
      { name: 'Buku', emoji: '📖', answer: 'bukanhidup' },
      { name: 'Ikan', emoji: '🐟', answer: 'hidup' },
      { name: 'Basikal', emoji: '🚲', answer: 'bukanhidup' },
      { name: 'Ayam', emoji: '🐔', answer: 'hidup' },
      { name: 'Batu', emoji: '🪨', answer: 'bukanhidup' },
      { name: 'Rumput', emoji: '🌿', answer: 'hidup' },
      { name: 'Kereta Mainan', emoji: '🚗', answer: 'bukanhidup' },
    ],
  },
  {
    id: 2,
    subject: 'sains',
    tahun: 1,
    dskpRef: 'Sains Tahun 1 · SK 7.1 Magnet',
    verified: true,
    name: "Peringkat 2",
    subtitle: "Ditarik Magnet & Tidak Ditarik Magnet",
    categories: [
      { id: 'ditarik', label: 'Ditarik Magnet', emoji: '🧲', color: '#E8664A' },
      { id: 'tidakditarik', label: 'Tidak Ditarik Magnet', emoji: '🚫', color: '#4C7FB0' },
    ],
    animals: [
      { name: 'Paku Besi', emoji: '📌', answer: 'ditarik' },
      { name: 'Pensel Kayu', emoji: '✏️', answer: 'tidakditarik' },
      { name: 'Klip Kertas', emoji: '📎', answer: 'ditarik' },
      { name: 'Getah Pemadam', emoji: 'Getah Pemadam', answer: 'tidakditarik' },
      { name: 'Gunting Besi', emoji: '✂️', answer: 'ditarik' },
      { name: 'Daun', emoji: '🍃', answer: 'tidakditarik' },
      { name: 'Span Besi (Wayar Besi)', emoji: 'Span Besi', answer: 'ditarik' },
      { name: 'Botol Plastik', emoji: '🧴', answer: 'tidakditarik' },
    ],
  },
  {
    id: 21,
    subject: 'sains',
    tahun: 1,
    dskpRef: 'Sains Tahun 1 · SK 8.1 Penyerapan (Keupayaan Bahan Menyerap Air)',
    verified: true,
    name: "Peringkat 3",
    subtitle: "Objek Menyerap Air & Tidak Menyerap Air",
    categories: [
      { id: 'menyerap', label: 'Menyerap Air', emoji: '🧽', color: '#3B9B8F' },
      { id: 'tidakmenyerap', label: 'Tidak Menyerap Air', emoji: '💧', color: '#4C7FB0' },
    ],
    animals: [
      { name: 'Sapu Tangan', emoji: 'Sapu Tangan', answer: 'menyerap' },
      { name: 'Klip Kertas', emoji: '📎', answer: 'tidakmenyerap' },
      { name: 'Kertas Tisu', emoji: '🧻', answer: 'menyerap' },
      { name: 'Guli', emoji: '🔮', answer: 'tidakmenyerap' },
      { name: 'Span', emoji: '🧽', answer: 'menyerap' },
      { name: 'Penutup Botol', emoji: 'Penutup Botol', answer: 'tidakmenyerap' },
      { name: 'Tuala', emoji: 'Tuala', answer: 'menyerap' },
      { name: 'Sudu Logam', emoji: '🥄', answer: 'tidakmenyerap' },
    ],
  },
  {
    id: 3,
    subject: 'sains',
    tahun: 4,
    dskpRef: 'Sains Tahun 4 · 3.2 Haiwan Vertebrata',
    verified: true,
    name: "Peringkat 4",
    subtitle: "5 Kumpulan Vertebrata",
    categories: [
      { id: 'mamalia', label: 'Mamalia', emoji: '🐾', color: '#E8664A' },
      { id: 'burung', label: 'Burung', emoji: '🪶', color: '#3B9B8F' },
      { id: 'reptilia', label: 'Reptilia', emoji: '🦎', color: '#D9A441' },
      { id: 'ikan', label: 'Ikan', emoji: '🐟', color: '#4C7FB0' },
      { id: 'amfibia', label: 'Amfibia', emoji: '🐸', color: '#7CB342' },
    ],
    animals: [
      { name: 'Jerung', emoji: '🦈', answer: 'ikan' },
      { name: 'Kura-kura', emoji: '🐢', answer: 'reptilia' },
      { name: 'Ikan Emas', emoji: '🐠', answer: 'ikan' },
      { name: 'Beruang', emoji: '🐻', answer: 'mamalia' },
      { name: 'Burung Kakak Tua', emoji: '🦜', answer: 'burung' },
      { name: 'Paus', emoji: '🐋', answer: 'mamalia' },
      { name: 'Monyet', emoji: '🐒', answer: 'mamalia' },
      { name: 'Katak', emoji: '🐸', answer: 'amfibia' },
      { name: 'Salamander', emoji: '🦎', answer: 'amfibia' },
    ],
  },
  {
    id: 4,
    subject: 'matematik',
    tahun: 1,
    dskpRef: 'Matematik Tahun 1 · SK 1.6.1 Nilai Tempat (Nombor Satu Digit & Dua Digit)',
    verified: true, // diaudit terhadap DSKP Matematik Tahun 1 (Mei 2015)
    name: "Peringkat 1",
    subtitle: "Nombor Satu Digit & Nombor Dua Digit",
    categories: [
      { id: 'satudigit', label: 'Satu Digit (Sa Sahaja)', emoji: '🔢', color: '#4C7FB0' },
      { id: 'duadigit', label: 'Dua Digit (Ada Puluh)', emoji: '🔟', color: '#D9A441' },
    ],
    animals: [
      { name: '4', emoji: '🔢', answer: 'satudigit' },
      { name: '17', emoji: '🔢', answer: 'duadigit' },
      { name: '9', emoji: '🔢', answer: 'satudigit' },
      { name: '32', emoji: '🔢', answer: 'duadigit' },
      { name: '6', emoji: '🔢', answer: 'satudigit' },
      { name: '58', emoji: '🔢', answer: 'duadigit' },
      { name: '1', emoji: '🔢', answer: 'satudigit' },
      { name: '90', emoji: '🔢', answer: 'duadigit' },
    ],
  },
  {
    id: 5,
    subject: 'matematik',
    tahun: 1,
    dskpRef: 'Matematik Tahun 1 · SK 1.2.2(iii) Membandingkan Nilai Dua Nombor',
    verified: true, // diaudit terhadap DSKP Matematik Tahun 1 (Mei 2015)
    name: "Peringkat 2",
    subtitle: "Lebih Besar / Lebih Kecil daripada 10",
    categories: [
      { id: 'besar', label: 'Lebih Besar daripada 10', emoji: '⬆️', color: '#E8664A' },
      { id: 'kecil', label: 'Lebih Kecil daripada 10', emoji: '⬇️', color: '#3B9B8F' },
    ],
    animals: [
      { name: '15', emoji: '🔢', answer: 'besar' },
      { name: '6', emoji: '🔢', answer: 'kecil' },
      { name: '22', emoji: '🔢', answer: 'besar' },
      { name: '2', emoji: '🔢', answer: 'kecil' },
      { name: '18', emoji: '🔢', answer: 'besar' },
      { name: '9', emoji: '🔢', answer: 'kecil' },
      { name: '30', emoji: '🔢', answer: 'besar' },
    ],
  },
  {
    id: 6,
    subject: 'matematik',
    tahun: 1,
    dskpRef: 'Matematik Tahun 1 · SK 6.1.1 Perbendaharaan Kata Ukuran Panjang',
    verified: true, // diaudit terhadap DSKP Matematik Tahun 1 (Mei 2015); gantikan topik bentuk 2D yang bertindih dengan Peringkat 7
    name: "Peringkat 3",
    subtitle: "Panjang & Pendek",
    categories: [
      { id: 'panjang', label: 'Panjang', emoji: '🐍', color: '#E8664A' },
      { id: 'pendek', label: 'Pendek', emoji: '📎', color: '#4C7FB0' },
    ],
    animals: [
      { name: 'Ular', emoji: '🐍', answer: 'panjang' },
      { name: 'Butang', emoji: '🔘', answer: 'pendek' },
      { name: 'Tren', emoji: '🚂', answer: 'panjang' },
      { name: 'Klip Kertas', emoji: '📎', answer: 'pendek' },
      { name: 'Jambatan', emoji: '🌉', answer: 'panjang' },
      { name: 'Getah Pemadam', emoji: 'Getah Pemadam', answer: 'pendek' },
      { name: 'Tangga', emoji: '🪜', answer: 'panjang' },
      { name: 'Kekunci', emoji: '🔑', answer: 'pendek' },
    ],
  },
  {
    id: 7,
    subject: 'literasibm',
    tahun: 1,
    dskpRef: 'BM Tahun 1 · SK 1.1.1 & 2.1.1 Sebutan Vokal & Konsonan',
    strand: 'membaca',
    verified: true,
    name: "Peringkat 1",
    subtitle: "Huruf Vokal & Konsonan",
    categories: [
      { id: 'vokal', label: 'Vokal', emoji: '🔤', color: '#4C7FB0' },
      { id: 'konsonan', label: 'Konsonan', emoji: '🔠', color: '#D9A441' },
    ],
    animals: [
      { name: 'A', emoji: 'A', answer: 'vokal' },
      { name: 'B', emoji: 'B', answer: 'konsonan' },
      { name: 'E', emoji: 'E', answer: 'vokal' },
      { name: 'K', emoji: 'K', answer: 'konsonan' },
      { name: 'I', emoji: 'I', answer: 'vokal' },
      { name: 'M', emoji: 'M', answer: 'konsonan' },
      { name: 'O', emoji: 'O', answer: 'vokal' },
      { name: 'S', emoji: 'S', answer: 'konsonan' },
    ],
  },
  {
    id: 8,
    subject: 'literasibm',
    tahun: 1,
    dskpRef: 'BM Tahun 1 · SK 2.1.2 Perkataan Dua & Tiga Suku Kata',
    strand: 'membaca',
    verified: true,
    name: "Peringkat 2",
    subtitle: "Dua Suku Kata & Tiga Suku Kata",
    categories: [
      { id: 'dua', label: '2 Suku Kata', emoji: '🔤', color: '#3B9B8F' },
      { id: 'tiga', label: '3 Suku Kata', emoji: '🔤', color: '#E8664A' },
    ],
    animals: [
      { name: 'BOLA', emoji: 'BOLA', answer: 'dua' },
      { name: 'KERETA', emoji: 'KERETA', answer: 'tiga' },
      { name: 'MEJA', emoji: 'MEJA', answer: 'dua' },
      { name: 'BOTOL', emoji: 'BOTOL', answer: 'dua' },
      { name: 'PISANG', emoji: 'PISANG', answer: 'dua' },
      { name: 'PELANGI', emoji: 'PELANGI', answer: 'tiga' },
      { name: 'BUKU', emoji: 'BUKU', answer: 'dua' },
      { name: 'SEKOLAH', emoji: 'SEKOLAH', answer: 'tiga' },
    ],
  },
  {
    id: 9,
    subject: 'literasibm',
    tahun: 1,
    dskpRef: 'BM Tahun 1 · SP 5.1.1(i)(ii) Kata Nama Am & Kata Nama Khas',
    strand: 'tatabahasa',
    verified: true,
    name: "Peringkat 3",
    subtitle: "Nama Am & Nama Khas",
    categories: [
      { id: 'am', label: 'Nama Am', emoji: '🔤', color: '#4C7FB0' },
      { id: 'khas', label: 'Nama Khas', emoji: '🔠', color: '#E8664A' },
    ],
    animals: [
      { name: 'KUCING', emoji: 'KUCING', answer: 'am' },
      { name: 'Ali', emoji: 'Ali', answer: 'khas' },
      { name: 'MEJA', emoji: 'MEJA', answer: 'am' },
      { name: 'Melaka', emoji: 'Melaka', answer: 'khas' },
      { name: 'BUKU', emoji: 'BUKU', answer: 'am' },
      { name: 'Selangor', emoji: 'Selangor', answer: 'khas' },
      { name: 'GURU', emoji: 'GURU', answer: 'am' },
      { name: 'Aisyah', emoji: 'Aisyah', answer: 'khas' },
      { name: 'SEKOLAH', emoji: 'SEKOLAH', answer: 'am' },
      { name: 'KLIA', emoji: 'KLIA', answer: 'khas' },
    ],
  },
  {
    id: 10,
    subject: 'literasibm',
    tahun: 1,
    dskpRef: 'BM Tahun 1 · SP 5.1.2 & 5.1.3 Kata Kerja & Kata Adjektif',
    strand: 'tatabahasa',
    verified: true,
    name: "Peringkat 4",
    subtitle: "Kata Kerja & Kata Adjektif",
    categories: [
      { id: 'kerja', label: 'Kata Kerja', emoji: '🏃', color: '#3B9B8F' },
      { id: 'adjektif', label: 'Kata Adjektif', emoji: '🎨', color: '#D9A441' },
    ],
    animals: [
      { name: 'MAKAN', emoji: 'MAKAN', answer: 'kerja' },
      { name: 'MERAH', emoji: 'MERAH', answer: 'adjektif' },
      { name: 'BACA', emoji: 'BACA', answer: 'kerja' },
      { name: 'BESAR', emoji: 'BESAR', answer: 'adjektif' },
      { name: 'TULIS', emoji: 'TULIS', answer: 'kerja' },
      { name: 'TINGGI', emoji: 'TINGGI', answer: 'adjektif' },
      { name: 'MINUM', emoji: 'MINUM', answer: 'kerja' },
      { name: 'BULAT', emoji: 'BULAT', answer: 'adjektif' },
      { name: 'LARI', emoji: 'LARI', answer: 'kerja' },
      { name: 'COMEL', emoji: 'COMEL', answer: 'adjektif' },
    ],
  },
  {
    id: 11,
    subject: 'literasibm',
    tahun: 1,
    dskpRef: 'BM Tahun 1 · SP 5.3.1 Ayat Penyata & Ayat Tanya',
    strand: 'tatabahasa',
    verified: true,
    name: "Peringkat 5",
    subtitle: "Ayat Penyata & Ayat Tanya",
    categories: [
      { id: 'penyata', label: 'Ayat Penyata', emoji: '💬', color: '#3B9B8F' },
      { id: 'tanya', label: 'Ayat Tanya', emoji: '❓', color: '#E8664A' },
    ],
    animals: [
      { name: 'Saya suka membaca.', emoji: 'Saya suka membaca.', answer: 'penyata' },
      { name: 'Siapa nama awak?', emoji: 'Siapa nama awak?', answer: 'tanya' },
      { name: 'Ibu memasak nasi.', emoji: 'Ibu memasak nasi.', answer: 'penyata' },
      { name: 'Awak suka apa?', emoji: 'Awak suka apa?', answer: 'tanya' },
      { name: 'Kucing itu comel.', emoji: 'Kucing itu comel.', answer: 'penyata' },
      { name: 'Di mana rumah awak?', emoji: 'Di mana rumah awak?', answer: 'tanya' },
      { name: 'Ali pergi ke sekolah.', emoji: 'Ali pergi ke sekolah.', answer: 'penyata' },
      { name: 'Bila kita balik?', emoji: 'Bila kita balik?', answer: 'tanya' },
    ],
  },
  {
    id: 27,
    subject: 'literasibm',
    tahun: 1,
    type: 'spelling',
    dskpRef: 'BM Tahun 1 · Standard 3 (Menulis) — anggaran berdasarkan struktur KSSR BM, kod SK/SP tepat BELUM disahkan (PDF DSKP BM Tahun 1 belum dimuat naik)',
    strand: 'menulis',
    verified: false, // TODO: sahkan kod SK/SP tepat bila PDF DSKP BM Tahun 1 diupload
    name: "Peringkat 6",
    subtitle: "Eja Perkataan",
    words: [
      { word: 'BOLA', emoji: '🏀' },
      { word: 'PISANG', emoji: '🍌' },
      { word: 'KUCING', emoji: '🐱' },
      { word: 'MERAH', emoji: '🔴' },
      { word: 'BULAT', emoji: '🔵' },
      { word: 'COMEL', emoji: '🥰' },
      { word: 'LARI', emoji: '🏃' },
      { word: 'TULIS', emoji: '✏️' },
    ],
  },
  {
    id: 29,
    subject: 'literasibm',
    tahun: 1,
    type: 'quiz',
    bonus: true, // BUKAN core DSKP BM — kandungan silang kurikulum (susunan nombor tergolong Matematik)
    dskpRef: 'BM Tahun 1 · Kefahaman soalan "apa" (susunan nombor & abjad) — kandungan silang kurikulum, kod SK/SP tepat belum disahkan tanpa PDF DSKP BM Tahun 1',
    strand: 'membaca',
    verified: false, // TODO: sahkan kod SK/SP tepat bila PDF DSKP BM Tahun 1 diupload
    name: "Peringkat 7",
    subtitle: "Nombor & Huruf: Sebelum & Selepas",
    questions: [
      { question: 'Nombor apa selepas 9?', choices: ['8', '9', '10', '11'], answer: '10' },
      { question: 'Huruf apa sebelum M?', choices: ['K', 'L', 'M', 'N'], answer: 'L' },
      { question: 'Nombor apa sebelum 15?', choices: ['13', '14', '15', '16'], answer: '14' },
      { question: 'Huruf apa selepas F?', choices: ['E', 'F', 'G', 'H'], answer: 'G' },
      { question: 'Nombor apa selepas 19?', choices: ['18', '19', '20', '21'], answer: '20' },
      { question: 'Huruf apa sebelum S?', choices: ['Q', 'R', 'S', 'T'], answer: 'R' },
    ],
  },
  {
    id: 12,
    subject: 'literacyen',
    minAge: 4,
    bonus: true, // BUKAN topik DSKP Tahun 1 — vowel/consonant labelling bukan CS eksplisit
    verified: false,
    dskpRef: 'Pre-literacy tambahan · bukan Standard Kandungan/Pembelajaran eksplisit dalam DSKP Tahun 1 (fonik Tahun 1 fokus kepada blend/segment phoneme, bukan label vowel/consonant)',
    strand: 'reading',
    name: "Level 1",
    subtitle: "Vowels & Consonants",
    categories: [
      { id: 'vowel', label: 'Vowel', emoji: '🔤', color: '#4C7FB0' },
      { id: 'consonant', label: 'Consonant', emoji: '🔠', color: '#D9A441' },
    ],
    animals: [
      { name: 'A', emoji: 'A', answer: 'vowel' },
      { name: 'B', emoji: 'B', answer: 'consonant' },
      { name: 'E', emoji: 'E', answer: 'vowel' },
      { name: 'C', emoji: 'C', answer: 'consonant' },
      { name: 'I', emoji: 'I', answer: 'vowel' },
      { name: 'D', emoji: 'D', answer: 'consonant' },
      { name: 'O', emoji: 'O', answer: 'vowel' },
      { name: 'G', emoji: 'G', answer: 'consonant' },
    ],
  },
  {
    id: 13,
    subject: 'literacyen',
    minAge: 6,
    bonus: true, // BUKAN topik DSKP Tahun 1 — pattern magic-e/CVCe ialah Tahun 2
    verified: false,
    dskpRef: 'Pre-literacy tambahan · bukan Standard Kandungan/Pembelajaran eksplisit dalam DSKP Tahun 1 (pattern "magic e"/CVCe berada di luar jadual fonik Tahun 1, biasanya diajar Tahun 2)',
    strand: 'reading',
    name: "Level 2",
    subtitle: "Short Vowel vs Long Vowel Sound",
    categories: [
      { id: 'short', label: 'Short Sound', emoji: '🐱', color: '#E8664A' },
      { id: 'long', label: 'Long Sound', emoji: '🎂', color: '#3B9B8F' },
    ],
    animals: [
      { name: 'Cat', emoji: 'Cat', answer: 'short' },
      { name: 'Cake', emoji: 'Cake', answer: 'long' },
      { name: 'Pin', emoji: 'Pin', answer: 'short' },
      { name: 'Pine', emoji: 'Pine', answer: 'long' },
      { name: 'Hop', emoji: 'Hop', answer: 'short' },
      { name: 'Hope', emoji: 'Hope', answer: 'long' },
      { name: 'Rid', emoji: 'Rid', answer: 'short' },
      { name: 'Ride', emoji: 'Ride', answer: 'long' },
    ],
  },
  {
    id: 18,
    subject: 'literacyen',
    tahun: 1,
    dskpRef: 'English Tahun 1 · CS 2.1.5 & 4.2.4 Word Sets: Classroom Objects & Toys',
    strand: 'speaking',
    verified: true,
    name: "Level 3",
    subtitle: "Classroom Objects vs Toys",
    categories: [
      { id: 'objects', label: 'Classroom Object', emoji: '🎒', color: '#4C7FB0' },
      { id: 'toys', label: 'Toy', emoji: '🧸', color: '#E8664A' },
    ],
    animals: [
      { name: 'Pen', emoji: 'Pen', answer: 'objects' },
      { name: 'Kite', emoji: 'Kite', answer: 'toys' },
      { name: 'Book', emoji: 'Book', answer: 'objects' },
      { name: 'Ball', emoji: 'Ball', answer: 'toys' },
      { name: 'Ruler', emoji: 'Ruler', answer: 'objects' },
      { name: 'Doll', emoji: 'Doll', answer: 'toys' },
      { name: 'Bag', emoji: 'Bag', answer: 'objects' },
      { name: 'Car', emoji: 'Car', answer: 'toys' },
      { name: 'Pencil', emoji: 'Pencil', answer: 'objects' },
      { name: 'Bike', emoji: 'Bike', answer: 'toys' },
    ],
  },
  {
    id: 19,
    subject: 'literacyen',
    tahun: 1,
    dskpRef: 'English Tahun 1 · CS 2.1.5 & 4.2.4 Word Sets: Animals & Food',
    strand: 'speaking',
    verified: true,
    name: "Level 4",
    subtitle: "Animals vs Food",
    categories: [
      { id: 'animalcat', label: 'Animal', emoji: '🐾', color: '#3B9B8F' },
      { id: 'foodcat', label: 'Food', emoji: '🍎', color: '#D9A441' },
    ],
    animals: [
      { name: 'Dog', emoji: 'Dog', answer: 'animalcat' },
      { name: 'Cake', emoji: 'Cake', answer: 'foodcat' },
      { name: 'Cat', emoji: 'Cat', answer: 'animalcat' },
      { name: 'Apple', emoji: 'Apple', answer: 'foodcat' },
      { name: 'Elephant', emoji: 'Elephant', answer: 'animalcat' },
      { name: 'Banana', emoji: 'Banana', answer: 'foodcat' },
      { name: 'Duck', emoji: 'Duck', answer: 'animalcat' },
      { name: 'Pizza', emoji: 'Pizza', answer: 'foodcat' },
      { name: 'Frog', emoji: 'Frog', answer: 'animalcat' },
      { name: 'Sausage', emoji: 'Sausage', answer: 'foodcat' },
    ],
  },
  {
    id: 20,
    subject: 'literacyen',
    tahun: 1,
    dskpRef: 'English Tahun 1 · SK 1.1.1 & 3.1.2 Beginning Sounds',
    strand: 'listening',
    verified: true,
    name: "Level 5",
    subtitle: "Same Beginning Sound",
    audioMode: true, // pupil hears the word (speech synthesis), no text shown
    categories: [
      { id: 'bsound', label: 'Starts with B', emoji: '🅱️', color: '#4C7FB0' },
      { id: 'csound', label: 'Starts with C', emoji: '🇨', color: '#E8664A' },
    ],
    animals: [
      { name: 'Ball', emoji: 'Ball', answer: 'bsound' },
      { name: 'Cat', emoji: 'Cat', answer: 'csound' },
      { name: 'Bag', emoji: 'Bag', answer: 'bsound' },
      { name: 'Car', emoji: 'Car', answer: 'csound' },
      { name: 'Bike', emoji: 'Bike', answer: 'bsound' },
      { name: 'Cake', emoji: 'Cake', answer: 'csound' },
      { name: 'Book', emoji: 'Book', answer: 'bsound' },
      { name: 'Corn', emoji: 'Corn', answer: 'csound' },
    ],
  },
  {
    id: 22,
    subject: 'literacyen',
    tahun: 1,
    dskpRef: 'English Tahun 1 · CS 2.1.5 & 4.2.4 Word Sets: Shapes (Unit 2) & Colours (Introduction Unit & Unit 1)',
    strand: 'speaking',
    verified: true,
    name: "Level 6",
    subtitle: "Shapes vs Colours",
    categories: [
      { id: 'shapecat', label: 'Shape', emoji: '🔺', color: '#4C7FB0' },
      { id: 'colourcat', label: 'Colour', emoji: '🎨', color: '#E8664A' },
    ],
    animals: [
      { name: 'Triangle', emoji: 'Triangle', answer: 'shapecat' },
      { name: 'Yellow', emoji: 'Yellow', answer: 'colourcat' },
      { name: 'Circle', emoji: 'Circle', answer: 'shapecat' },
      { name: 'Red', emoji: 'Red', answer: 'colourcat' },
      { name: 'Square', emoji: 'Square', answer: 'shapecat' },
      { name: 'Blue', emoji: 'Blue', answer: 'colourcat' },
      { name: 'Rectangle', emoji: 'Rectangle', answer: 'shapecat' },
      { name: 'Green', emoji: 'Green', answer: 'colourcat' },
      { name: 'Diamond', emoji: 'Diamond', answer: 'shapecat' },
      { name: 'Purple', emoji: 'Purple', answer: 'colourcat' },
    ],
  },
  {
    id: 23,
    subject: 'literacyen',
    tahun: 1,
    dskpRef: 'English Tahun 1 · SK 2.1.1, 2.1.2 & 2.1.4 Fixed Phrases: Greet/Say Goodbye vs Questions',
    strand: 'speaking',
    verified: true,
    name: "Level 7",
    subtitle: "Greeting vs Question",
    categories: [
      { id: 'greetcat', label: 'Greeting', emoji: '👋', color: '#3B9B8F' },
      { id: 'questioncat', label: 'Question', emoji: '❓', color: '#D9A441' },
    ],
    animals: [
      { name: 'Hello!', emoji: 'Hello!', answer: 'greetcat' },
      { name: "What's your name?", emoji: "What's your name?", answer: 'questioncat' },
      { name: 'Bye!', emoji: 'Bye!', answer: 'greetcat' },
      { name: 'How old are you?', emoji: 'How old are you?', answer: 'questioncat' },
      { name: 'Good morning!', emoji: 'Good morning!', answer: 'greetcat' },
      { name: "What's this?", emoji: "What's this?", answer: 'questioncat' },
      { name: 'Hi there!', emoji: 'Hi there!', answer: 'greetcat' },
      { name: 'Is it a pen?', emoji: 'Is it a pen?', answer: 'questioncat' },
    ],
  },
  {
    id: 24,
    subject: 'literacyen',
    tahun: 1,
    dskpRef: 'English Tahun 1 · CS 2.1.5 & 4.2.4 Word Sets: Numbers (Introduction Unit 1–10 & Unit 4 11–20)',
    strand: 'speaking',
    verified: true,
    name: "Level 8",
    subtitle: "Numbers 1-10 vs Numbers 11-20",
    categories: [
      { id: 'onetoten', label: '1 to 10', emoji: '🔟', color: '#4C7FB0' },
      { id: 'eleventotwenty', label: '11 to 20', emoji: '2️⃣0️⃣', color: '#E8664A' },
    ],
    animals: [
      { name: 'Three', emoji: 'Three', answer: 'onetoten' },
      { name: 'Fourteen', emoji: 'Fourteen', answer: 'eleventotwenty' },
      { name: 'Seven', emoji: 'Seven', answer: 'onetoten' },
      { name: 'Eleven', emoji: 'Eleven', answer: 'eleventotwenty' },
      { name: 'Nine', emoji: 'Nine', answer: 'onetoten' },
      { name: 'Eighteen', emoji: 'Eighteen', answer: 'eleventotwenty' },
      { name: 'Two', emoji: 'Two', answer: 'onetoten' },
      { name: 'Twenty', emoji: 'Twenty', answer: 'eleventotwenty' },
    ],
  },
  {
    id: 25,
    subject: 'literacyen',
    tahun: 1,
    dskpRef: 'English Tahun 1 · SK 2.1.3 & 4.2.3 Express Basic Likes and Dislikes',
    strand: 'speaking',
    verified: true,
    name: "Level 9",
    subtitle: "Likes vs Dislikes",
    categories: [
      { id: 'likescat', label: 'Likes', emoji: '😊', color: '#3B9B8F' },
      { id: 'dislikescat', label: 'Dislikes', emoji: '😣', color: '#E8664A' },
    ],
    animals: [
      { name: 'I like dogs.', emoji: 'I like dogs.', answer: 'likescat' },
      { name: "I don't like snakes.", emoji: "I don't like snakes.", answer: 'dislikescat' },
      { name: 'I like cake.', emoji: 'I like cake.', answer: 'likescat' },
      { name: "I don't like broccoli.", emoji: "I don't like broccoli.", answer: 'dislikescat' },
      { name: 'I like cats.', emoji: 'I like cats.', answer: 'likescat' },
      { name: "I don't like spiders.", emoji: "I don't like spiders.", answer: 'dislikescat' },
      { name: 'I like pizza.', emoji: 'I like pizza.', answer: 'likescat' },
      { name: "I don't like mushrooms.", emoji: "I don't like mushrooms.", answer: 'dislikescat' },
    ],
  },
  {
    id: 26,
    subject: 'literacyen',
    tahun: 1,
    type: 'spelling',
    dskpRef: 'English Tahun 1 · SK 4.3.2 Spell Familiar High-Frequency Words Accurately (guna SK 3.1.3/3.1.4 Blend & Segment Phonemes CVC)',
    strand: 'writing',
    verified: true,
    name: "Level 10",
    subtitle: "Spell the Word",
    words: [
      { word: 'cat', emoji: '🐱' },
      { word: 'dog', emoji: '🐶' },
      { word: 'pen', emoji: '🖊️' },
      { word: 'bag', emoji: '🎒' },
      { word: 'hot', emoji: '🔥' },
      { word: 'run', emoji: '🏃' },
      { word: 'ten', emoji: '🔟' },
      { word: 'six', emoji: '6️⃣' },
    ],
  },
  {
    id: 30,
    subject: 'literacyen',
    tahun: 1,
    type: 'quiz',
    bonus: true, // BUKAN core DSKP English — kandungan silang kurikulum (susunan nombor tergolong Matematik)
    dskpRef: 'English Tahun 1 · Question comprehension ("What...before/after") — kandungan silang kurikulum, kod SK/LS tepat belum disahkan penuh terhadap DSKP',
    strand: 'reading',
    verified: false, // TODO: sahkan padanan SK/LS tepat, sama seperti Peringkat BM setara
    name: "Level 11",
    subtitle: "Number & Letter: Before & After",
    questions: [
      { question: 'What number comes after 9?', choices: ['8', '9', '10', '11'], answer: '10' },
      { question: 'What letter comes before M?', choices: ['K', 'L', 'M', 'N'], answer: 'L' },
      { question: 'What number comes before 15?', choices: ['13', '14', '15', '16'], answer: '14' },
      { question: 'What letter comes after F?', choices: ['E', 'F', 'G', 'H'], answer: 'G' },
      { question: 'What number comes after 19?', choices: ['18', '19', '20', '21'], answer: '20' },
      { question: 'What letter comes before S?', choices: ['Q', 'R', 'S', 'T'], answer: 'R' },
    ],
  },
  {
    id: 14,
    subject: 'matematik',
    tahun: 1,
    dskpRef: 'Matematik Tahun 1 · SK 3.1.1 Konsep Perdua & Perempat Pecahan Wajar',
    verified: true,
    name: "Peringkat 4",
    subtitle: "Satu Perdua, Satu Perempat, Dua Perempat & Tiga Perempat",
    categories: [
      { id: 'perdua', label: 'Satu Perdua', emoji: '◐', color: '#4C7FB0' },
      { id: 'perempat', label: 'Satu Perempat', emoji: '◔', color: '#D9A441' },
      { id: 'duaperempat', label: 'Dua Perempat', emoji: '◑', color: '#3B9B8F' },
      { id: 'tigaperempat', label: 'Tiga Perempat', emoji: '◕', color: '#E8664A' },
    ],
    animals: [
      { name: '1/2', emoji: '1/2', answer: 'perdua' },
      { name: 'SETENGAH', emoji: 'SETENGAH', answer: 'perdua' },
      { name: 'SEPARUH', emoji: 'SEPARUH', answer: 'perdua' },
      { name: '1/4', emoji: '1/4', answer: 'perempat' },
      { name: 'SUKU', emoji: 'SUKU', answer: 'perempat' },
      { name: '2/4', emoji: '2/4', answer: 'duaperempat' },
      { name: '3/4', emoji: '3/4', answer: 'tigaperempat' },
      { name: 'TIGA SUKU', emoji: 'TIGA SUKU', answer: 'tigaperempat' },
    ],
  },
  {
    id: 15,
    subject: 'matematik',
    tahun: 1,
    dskpRef: 'Matematik Tahun 1 · SK 4.1.1 Mata Wang Malaysia (Syiling & Wang Kertas)',
    verified: true,
    name: "Peringkat 5",
    subtitle: "Syiling & Wang Kertas",
    categories: [
      { id: 'syiling', label: 'Syiling', emoji: '🪙', color: '#D9A441' },
      { id: 'kertas', label: 'Wang Kertas', emoji: '💵', color: '#3B9B8F' },
    ],
    animals: [
      { name: '5 SEN', emoji: '5 SEN', answer: 'syiling' },
      { name: '10 SEN', emoji: '10 SEN', answer: 'syiling' },
      { name: '20 SEN', emoji: '20 SEN', answer: 'syiling' },
      { name: '50 SEN', emoji: '50 SEN', answer: 'syiling' },
      { name: 'RM1', emoji: 'RM1', answer: 'kertas' },
      { name: 'RM5', emoji: 'RM5', answer: 'kertas' },
      { name: 'RM10', emoji: 'RM10', answer: 'kertas' },
    ],
  },
  {
    id: 16,
    subject: 'matematik',
    tahun: 1,
    dskpRef: 'Matematik Tahun 1 · SP 5.1.1 Waktu Dalam Sehari',
    verified: true,
    name: "Peringkat 6",
    subtitle: "Pagi, Tengah Hari, Petang & Malam",
    categories: [
      { id: 'pagi', label: 'Pagi', emoji: '🌅', color: '#D9A441' },
      { id: 'tengahhari', label: 'Tengah Hari', emoji: '☀️', color: '#E8664A' },
      { id: 'petang', label: 'Petang', emoji: '🌇', color: '#3B9B8F' },
      { id: 'malam', label: 'Malam', emoji: '🌙', color: '#4C7FB0' },
    ],
    animals: [
      { name: 'BANGUN PAGI', emoji: 'BANGUN PAGI', answer: 'pagi' },
      { name: 'SARAPAN', emoji: 'SARAPAN', answer: 'pagi' },
      { name: 'REHAT SEKOLAH', emoji: 'REHAT SEKOLAH', answer: 'tengahhari' },
      { name: 'MAKAN TENGAHARI', emoji: 'MAKAN TENGAHARI', answer: 'tengahhari' },
      { name: 'BALIK SEKOLAH', emoji: 'BALIK SEKOLAH', answer: 'petang' },
      { name: 'MANDI PETANG', emoji: 'MANDI PETANG', answer: 'petang' },
      { name: 'MAKAN MALAM', emoji: 'MAKAN MALAM', answer: 'malam' },
      { name: 'TIDUR', emoji: 'TIDUR', answer: 'malam' },
    ],
  },
  {
    id: 17,
    subject: 'matematik',
    tahun: 1,
    dskpRef: 'Matematik Tahun 1 · SP 7.2.2 Garis Lurus & Lengkung Bentuk Dua Dimensi',
    verified: true,
    name: "Peringkat 7",
    subtitle: "Bentuk 2D: Sisi Lurus & Melengkung",
    categories: [
      { id: 'lurus2d', label: 'Sisi Lurus', emoji: '🔺', color: '#E8664A' },
      { id: 'lengkung2d', label: 'Sisi Melengkung', emoji: '⚪', color: '#4C7FB0' },
    ],
    animals: [
      { name: 'SEGITIGA', emoji: 'SEGITIGA', answer: 'lurus2d' },
      { name: 'SEGIEMPAT SAMA', emoji: 'SEGIEMPAT SAMA', answer: 'lurus2d' },
      { name: 'SEGIEMPAT TEPAT', emoji: 'SEGIEMPAT TEPAT', answer: 'lurus2d' },
      { name: 'BULATAN', emoji: 'BULATAN', answer: 'lengkung2d' },
      { name: 'BULATAN BESAR', emoji: 'BULATAN BESAR', answer: 'lengkung2d' },
      { name: 'BULATAN KECIL', emoji: 'BULATAN KECIL', answer: 'lengkung2d' },
    ],
  },
  {
    id: 31,
    subject: 'matematik',
    tahun: 1,
    dskpRef: 'Matematik Tahun 1 · SK 2.1.2–2.1.3 Simbol Tambah, Tolak & Sama Dengan',
    verified: true,
    name: "Peringkat 8",
    subtitle: "Ayat Tambah & Ayat Tolak",
    categories: [
      { id: 'tambah', label: 'Ayat Tambah', emoji: '➕', color: '#3B9B8F' },
      { id: 'tolak', label: 'Ayat Tolak', emoji: '➖', color: '#E8664A' },
    ],
    animals: [
      { name: '3 + 2 = 5', emoji: '➕', answer: 'tambah' },
      { name: '8 − 3 = 5', emoji: '➖', answer: 'tolak' },
      { name: '4 + 4 = 8', emoji: '➕', answer: 'tambah' },
      { name: '10 − 6 = 4', emoji: '➖', answer: 'tolak' },
      { name: '6 + 1 = 7', emoji: '➕', answer: 'tambah' },
      { name: '9 − 2 = 7', emoji: '➖', answer: 'tolak' },
      { name: '5 + 5 = 10', emoji: '➕', answer: 'tambah' },
      { name: '7 − 4 = 3', emoji: '➖', answer: 'tolak' },
    ],
  },
  {
    id: 28,
    subject: 'matematik',
    tahun: 1,
    type: 'quiz',
    dskpRef: 'Matematik Tahun 1 · Operasi Tambah & Tolak dalam lingkungan 100 (nombor belasan & puluh) — kod SK tepat belum disahkan tanpa PDF DSKP Matematik Tahun 1',
    verified: false, // TODO: sahkan kod SK tepat bila PDF DSKP Matematik Tahun 1 diupload
    name: "Peringkat 9",
    subtitle: "Tambah & Tolak (Belasan & Puluh)",
    generateQuestions: generateTambahTolakQuestions,
  },
  {
    id: 33,
    subject: 'matematik',
    tahun: 1,
    type: 'quiz',
    dskpRef: 'Matematik Tahun 1 · SK 1.6.1 Nilai Tempat (Nombor Satu Digit & Dua Digit) — divisualkan guna abacus/sempoa (puluh & sa)',
    verified: true,
    name: "Peringkat 10",
    subtitle: "Abacus: Baca Nombor",
    generateQuestions: generateAbacusQuestions,
  },
  {
    id: 32,
    subject: 'matematik',
    bonus: true, // BUKAN topik DSKP Tahun 1 — genap/ganjil rasmi diperkenalkan Tahun 2/3
    dskpRef: 'Bonus/Pengayaan — bukan DSKP Tahun 1 (genap/ganjil biasanya Tahun 2–3)',
    verified: true, // kandungan matematik betul, cuma di luar skop DSKP Tahun 1
    name: "Peringkat Bonus",
    subtitle: "Kumpulan Genap & Ganjil",
    categories: [
      { id: 'genap', label: 'Genap', emoji: '2️⃣', color: '#4C7FB0' },
      { id: 'ganjil', label: 'Ganjil', emoji: '1️⃣', color: '#D9A441' },
    ],
    animals: [
      { name: '4', emoji: '🔢', answer: 'genap' },
      { name: '7', emoji: '🔢', answer: 'ganjil' },
      { name: '10', emoji: '🔢', answer: 'genap' },
      { name: '3', emoji: '🔢', answer: 'ganjil' },
      { name: '8', emoji: '🔢', answer: 'genap' },
      { name: '5', emoji: '🔢', answer: 'ganjil' },
    ],
  },
];

// Groups LEVELS by subject, splitting each subject's levels into:
//  - main:  core DSKP-aligned progression (numbered Peringkat/Level, sequential)
//  - bonus: supplementary content outside Tahun 1 DSKP scope or cross-curricular
// Original array index (idx) is preserved on every entry — it stays the single
// source of truth used by onStart/finishLevel/completedLevels throughout the app.
function buildSubjectTracks() {
  const tracks = {};
  Object.keys(SUBJECTS).forEach((s) => {
    tracks[s] = { main: [], bonus: [] };
  });
  LEVELS.forEach((lvl, idx) => {
    const bucket = lvl.bonus ? 'bonus' : 'main';
    tracks[lvl.subject][bucket].push({ ...lvl, idx });
  });
  return tracks;
}
const SUBJECT_TRACKS = buildSubjectTracks();

// FREE TIER MODEL — "Daily Free Allowance" (like Duolingo hearts):
// Every free window, a non-subscriber may complete a capped number of NEW
// levels — specifically, the NEXT not-yet-completed level in each ELIGIBLE
// subject's progression. Finishing a level doesn't burn a permanent slot;
// it advances what's free next window.
//
//   Window 1 (first ever session): all 4 subjects, limit 4 — first
//   impression shows breadth across the whole app.
//   Window 2 onward: only 2 slots — English (always, since it's the only
//   subject with an SPi report right now, and that "wow" moment is what
//   drives the subscribe nudge) + one other subject that rotates
//   Sains → Matematik → Literasi BM → Sains → ... so the family isn't stuck
//   seeing only English after day 1.
//
// NOTE: this runs on the DEVICE CLOCK (no backend), since there's no server
// yet. A parent could bypass it by changing the phone's date — acceptable
// trade-off for an MVP, revisit once there's a real backend (Firebase/
// Supabase) with a trustworthy server-side clock.
const FREE_WINDOW_MS = 24 * 60 * 60 * 1000;
const ROTATING_FREE_SUBJECTS = ['sains', 'matematik', 'literasibm'];

// windowNumber is 1-indexed: 1 = the child's very first free window.
function getEligibleSubjectsForWindow(windowNumber) {
  if (windowNumber <= 1) {
    return { subjects: Object.keys(SUBJECTS), limit: 4 };
  }
  const rotateIdx = (windowNumber - 2) % ROTATING_FREE_SUBJECTS.length;
  return { subjects: ['literacyen', ROTATING_FREE_SUBJECTS[rotateIdx]], limit: 2 };
}

// For each subject, find the first not-yet-completed level in its main
// track — used both to compute today's eligible free levels, and (for
// subjects not eligible today) to correctly show the "premium" lock badge.
function getNextLevelPerSubject(completedLevels) {
  const result = {};
  Object.keys(SUBJECT_TRACKS).forEach((s) => {
    const track = SUBJECT_TRACKS[s].main;
    const next = track.find((l) => !completedLevels.some((c) => c.levelIdx === l.idx));
    if (next) result[s] = next.idx;
  });
  return result;
}

// Narrows getNextLevelPerSubject() down to only the subjects eligible in
// the child's CURRENT (or about-to-start) free window.
function getTodaysFreeLevels(completedLevels, child) {
  const status = getFreeWindowStatus(child);
  const { subjects: eligibleSubjects } = getEligibleSubjectsForWindow(status.windowNumber);
  const nextPerSubject = getNextLevelPerSubject(completedLevels);
  const result = {};
  eligibleSubjects.forEach((s) => {
    if (nextPerSubject[s] != null) result[s] = nextPerSubject[s];
  });
  return result;
}

// Computes a child's current free-window status from stored timestamps —
// always derived fresh (never trust a stale "remaining" number in storage),
// so an expired window is detected correctly no matter when this is called.
function getFreeWindowStatus(child) {
  const now = Date.now();
  const started = child.freeWindowStartedAt;
  const windowExpired = !started || now - started >= FREE_WINDOW_MS;
  if (windowExpired) {
    // About to enter the NEXT window (one more than however many completed so far).
    const windowNumber = (child.freeWindowCount || 0) + 1;
    const { limit } = getEligibleSubjectsForWindow(windowNumber);
    return { remaining: limit, limit, resetsInMs: 0, windowExpired: true, windowNumber };
  }
  const windowNumber = child.freeWindowCount || 1;
  const { limit } = getEligibleSubjectsForWindow(windowNumber);
  const remaining = Math.max(0, limit - (child.freeLevelsPlayedInWindow || 0));
  const resetsInMs = FREE_WINDOW_MS - (now - started);
  return { remaining, limit, resetsInMs, windowExpired: false, windowNumber };
}

function computeMastery(completedLevels) {
  // completedLevels: array of {levelIdx, score, total}
  let totalCorrect = 0;
  const bySubject = {};
  const byStrand = {};
  completedLevels.forEach(({ levelIdx, score }) => {
    const lvl = LEVELS[levelIdx];
    const subj = lvl.subject;
    bySubject[subj] = (bySubject[subj] || 0) + score;
    if (lvl.strand) {
      byStrand[lvl.strand] = (byStrand[lvl.strand] || 0) + score;
    }
    totalCorrect += score;
  });
  return { totalCorrect, bySubject, byStrand };
}

// Renders a real soroban-style abacus for a given value: each rod has 1
// "heaven" bead (worth 5 when pushed down toward the middle bar) and 4
// "earth" beads (worth 1 each when pushed up toward the middle bar).
// Beads resting away from the bar (against the frame) don't count.


function AbacusBead({ cx, cy, r, color }) {
  return (
    <g>
      <polygon
        points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
        fill={color}
        stroke="#6B4A1F"
        strokeWidth="1.5"
      />
      {/* small shine highlight for a cute glossy look */}
      <ellipse cx={cx - r * 0.3} cy={cy - r * 0.3} rx={r * 0.28} ry={r * 0.18} fill="#FFFFFF" opacity="0.7" />
    </g>
  );
}

const ABACUS_ROD_COLORS = ['#FF8A5B', '#4ECDC4', '#A78BFA', '#FFD93D', '#FF6FA5'];

function AbacusVisual({ value, rods = 2, width = 100 }) {
  const digits = [];
  let v = Math.max(0, Math.min(value, Math.pow(10, rods) - 1));
  for (let i = 0; i < rods; i++) {
    digits.unshift(v % 10);
    v = Math.floor(v / 10);
  }
  const rodLabels = ['Ribu', 'Ratus', 'Puluh', 'Sa'].slice(4 - rods);

  const rodWidth = 44;
  const beadR = 10;
  const barY = 58;
  const frameTop = 6;
  const frameBottom = 172;
  const svgWidth = rods * rodWidth + 20;
  const svgHeight = frameBottom + 26; // extra room for rod labels below frame

  return (
    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width={width} height={(width / svgWidth) * svgHeight}>
      <rect x="2" y={frameTop - 4} width={svgWidth - 4} height={frameBottom - frameTop + 8} rx="14"
        fill="#FFF3DC" stroke="#E0A75E" strokeWidth="3" />
      <rect x="4" y={barY - 3} width={svgWidth - 8} height="6" rx="3" fill="#8B5E34" />
      {digits.map((d, idx) => {
        const cx = 22 + idx * rodWidth;
        const rodColor = ABACUS_ROD_COLORS[idx % ABACUS_ROD_COLORS.length];
        const heavenActive = d >= 5;
        const earthActive = d % 5;
        const inactiveCount = 4 - earthActive;
        const activeYs = Array.from({ length: earthActive }, (_, i) => barY + beadR + 4 + i * (beadR * 2 + 3));
        const inactiveYs = Array.from({ length: inactiveCount }, (_, i) => frameBottom - beadR - 4 - i * (beadR * 2 + 3));
        return (
          <g key={idx}>
            <line x1={cx} y1={frameTop} x2={cx} y2={frameBottom} stroke="#B8895A" strokeWidth="2.5" />
            <AbacusBead cx={cx} cy={heavenActive ? barY - beadR - 4 : frameTop + beadR + 4} r={beadR} color={rodColor} />
            {[...activeYs, ...inactiveYs].map((cy, i) => (
              <AbacusBead key={i} cx={cx} cy={cy} r={beadR} color={rodColor} />
            ))}
            <text x={cx} y={svgHeight - 6} textAnchor="middle" fontSize="13" fontFamily="'Lexend', sans-serif"
              fontWeight="700" fill="#8A7355">{rodLabels[idx]}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 14 });
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.2;
        const colors = ['#E8664A', '#3B9B8F', '#D9A441', '#4C7FB0'];
        const color = colors[i % colors.length];
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: '-10%',
              width: 8,
              height: 8,
              background: color,
              borderRadius: 2,
              animation: `fall 0.9s ease-in ${delay}s forwards`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes fall {
          to { transform: translateY(160px) rotate(200deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function AddChildScreen({ onAddChild, onCancel, isFirstChild }) {
  const [name, setName] = useState('');
  const [age, setAge] = useState(null);
  const ages = [4, 5, 6, 7, 8];

  const canSubmit = name.trim().length > 0 && age !== null;

  return (
    <div style={{ textAlign: 'center', padding: '52px 24px' }}>
      <div style={{ fontSize: 48, marginBottom: 10 }}>🎂</div>
      <h1 style={{
        fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 22, color: '#2E4045', margin: '0 0 6px',
      }}>{isFirstChild ? 'Nak kenali anak dulu' : 'Tambah profil anak'}</h1>
      <p style={{ color: '#6B7A80', fontSize: 14, marginBottom: 22 }}>
        Setiap anak ada progres sendiri — senang untuk track ramai-ramai
      </p>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nama anak"
        style={{
          width: '100%', maxWidth: 280, padding: '14px 16px', borderRadius: 14,
          border: '2px solid #E4DFD3', fontSize: 16, fontFamily: "'Lexend', sans-serif",
          color: '#2E4045', marginBottom: 20, textAlign: 'center', boxSizing: 'border-box',
        }}
      />

      <p style={{ color: '#6B7A80', fontSize: 13, marginBottom: 10 }}>Umur anak?</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        {ages.map((a) => (
          <button
            key={a}
            onClick={() => setAge(a)}
            style={{
              width: 56, height: 56, borderRadius: 16,
              border: age === a ? '3px solid #3B9B8F' : 'none',
              background: '#FFFFFF', boxShadow: '0 3px 0 #E4DFD3',
              fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 18, color: '#2E4045',
              cursor: 'pointer',
            }}
          >{a}</button>
        ))}
      </div>
      <button
        onClick={() => setAge(9)}
        style={{
          background: 'none', border: 'none',
          color: age === 9 ? '#3B9B8F' : '#8A968B', fontSize: 13, cursor: 'pointer',
          textDecoration: 'underline', marginBottom: 26,
        }}
      >8 tahun ke atas</button>

      <div>
        <button
          onClick={() => canSubmit && onAddChild({ name: name.trim(), age })}
          disabled={!canSubmit}
          style={{
            padding: '14px 32px', borderRadius: 16, border: 'none',
            background: canSubmit ? '#3B9B8F' : '#D8D3C6',
            color: '#FFF', fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 15,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            boxShadow: canSubmit ? '0 3px 0 #2C7A70' : 'none',
          }}
        >Mula Main</button>
      </div>
      {!isFirstChild && onCancel && (
        <button onClick={onCancel} style={{
          marginTop: 14, background: 'none', border: 'none',
          color: '#8A968B', fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
        }}>Batal</button>
      )}
    </div>
  );
}

function ProfileSelectScreen({ children, onSelectChild, onAddChild }) {
  return (
    <div style={{ textAlign: 'center', padding: '52px 24px' }}>
      <div style={{ fontSize: 48, marginBottom: 10 }}>👋</div>
      <h1 style={{
        fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 22, color: '#2E4045', margin: '0 0 6px',
      }}>Sapa nak main?</h1>
      <p style={{ color: '#6B7A80', fontSize: 14, marginBottom: 26 }}>
        Pilih profil anak untuk teruskan progres dia
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 300, margin: '0 auto' }}>
        {children.map((child) => (
          <button
            key={child.id}
            onClick={() => onSelectChild(child.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px', borderRadius: 16, border: 'none',
              background: '#FFFFFF', boxShadow: '0 3px 0 #E4DFD3',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: '#FBEFE2',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>🙂</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 16, color: '#2E4045' }}>{child.name}</div>
              <div style={{ fontSize: 12, color: '#8A968B' }}>{child.age} tahun · {child.completedLevels.length} peringkat selesai</div>
            </div>
          </button>
        ))}
        <button
          onClick={onAddChild}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 18px', borderRadius: 16, border: '2px dashed #D8D3C6',
            background: 'none', cursor: 'pointer',
            fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 14, color: '#6B7A80',
          }}
        >➕ Tambah Anak</button>
      </div>
    </div>
  );
}

function HomeScreen({ onStart, completedLevels, isSubscribed, child, onChangeProfile }) {
  const isDone = (idx) => completedLevels.some((c) => c.levelIdx === idx);
  const nextPerSubject = child ? getTodaysFreeLevels(completedLevels, child) : {};
  const freeStatus = child ? getFreeWindowStatus(child) : { remaining: 4, limit: 4, resetsInMs: 0 };

  // Returns { locked, reason } — reason is 'daily-limit' (today's free slot
  // used up, come back later or subscribe) vs 'premium' (this level is
  // further ahead than today's free pick for that subject).
  const getLockInfo = (lvl) => {
    if (isSubscribed || isDone(lvl.idx)) return { locked: false, reason: null };
    const isTodaysFreePick = nextPerSubject[lvl.subject] === lvl.idx;
    if (!isTodaysFreePick) return { locked: true, reason: 'premium' };
    if (freeStatus.remaining <= 0) return { locked: true, reason: 'daily-limit' };
    return { locked: false, reason: null };
  };

  const hoursUntilReset = Math.max(1, Math.ceil(freeStatus.resetsInMs / (60 * 60 * 1000)));

  const renderLevelButton = (lvl) => {
    const { locked, reason } = getLockInfo(lvl);
    const done = isDone(lvl.idx);
    return (
      <button
        key={lvl.id}
        disabled={locked}
        onClick={() => onStart(lvl.idx)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '14px 18px',
          borderRadius: 16,
          border: 'none',
          background: locked ? '#EDEBE4' : '#FFFFFF',
          boxShadow: locked ? 'none' : '0 3px 0 #E4DFD3',
          cursor: locked ? 'not-allowed' : 'pointer',
          opacity: locked ? 0.6 : 1,
          textAlign: 'left',
          width: '100%',
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: locked ? '#D8D3C6' : '#FBEFE2',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>
          {locked ? (reason === 'daily-limit' ? '⏳' : '🔒') : done ? '⭐' : '▶️'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 16, color: '#2E4045' }}>{lvl.name}</div>
          <div style={{ fontSize: 12, color: '#8A968B' }}>{lvl.subtitle}</div>
        </div>
        {reason === 'premium' && <span style={{ fontSize: 11, color: '#B08B3A', fontWeight: 600 }}>PREMIUM</span>}
        {reason === 'daily-limit' && <span style={{ fontSize: 11, color: '#B08B3A', fontWeight: 600 }}>{hoursUntilReset} JAM LAGI</span>}
      </button>
    );
  };

  return (
    <div style={{ textAlign: 'center', padding: '32px 20px' }}>
      <div style={{ fontSize: 56, marginBottom: 8 }}>🦉</div>
      <h1 style={{
        fontFamily: "'Lexend', sans-serif", fontWeight: 700,
        fontSize: 30,
        color: '#2E4045',
        margin: '0 0 4px',
      }}>Hi Anak Bijak!</h1>
      <p style={{ color: '#6B7A80', fontSize: 15, margin: '0 0 4px' }}>
        Pilih subjek dan mula belajar!
      </p>
      {child && (
        <button onClick={onChangeProfile} style={{
          background: 'none', border: 'none', color: '#8A968B', fontSize: 12,
          cursor: 'pointer', textDecoration: 'underline', marginBottom: 24,
        }}>Main sebagai {child.name} · Tukar Anak</button>
      )}

      {!isSubscribed && (
        <div style={{
          background: '#FBEFE2', borderRadius: 14, padding: '10px 16px', marginBottom: 20,
          display: 'inline-block', fontSize: 13, color: '#B08B3A', fontWeight: 600,
        }}>
          ⭐ Baki percuma hari ini: {freeStatus.remaining}/{freeStatus.limit} peringkat
        </div>
      )}

      <div style={{ maxWidth: 340, margin: '0 auto' }}>
        {Object.keys(SUBJECTS).map((subjectId) => {
          const subj = SUBJECTS[subjectId];
          const track = SUBJECT_TRACKS[subjectId];
          if (track.main.length === 0 && track.bonus.length === 0) return null;
          return (
            <div key={subjectId} style={{ marginBottom: 28 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
                textAlign: 'left', padding: '0 2px',
              }}>
                <span style={{ fontSize: 22 }}>{subj.emoji}</span>
                <span style={{
                  fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 15, color: '#2E4045',
                }}>{subj.label}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {track.main.map(renderLevelButton)}
              </div>
              {track.bonus.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: '#B08B3A', textAlign: 'left',
                    padding: '0 2px', marginBottom: 8, letterSpacing: 0.5,
                  }}>✨ BONUS / PENGAYAAN</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {track.bonus.map(renderLevelButton)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isSubscribed && (
        <p style={{ marginTop: 8, fontSize: 12, color: '#9AA5A0' }}>
          4 peringkat baru percuma setiap hari. Langgan untuk buka semua terus, bila-bila masa.
        </p>
      )}
    </div>
  );
}

function GameScreen({ level, onFinish, onExit }) {
  const [queue, setQueue] = useState(() => [...level.animals].sort(() => Math.random() - 0.5));
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null); // 'correct' | 'wrong' | null
  const [score, setScore] = useState(0);
  const [shake, setShake] = useState(false);
  const [audioSupported, setAudioSupported] = useState(true); // falls back to text if speech never starts
  const [hasTappedSpeaker, setHasTappedSpeaker] = useState(false);

  const animal = queue[current];
  const progress = (current / queue.length) * 100;

  const speak = (text) => {
    setHasTappedSpeaker(true);
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported on this device/browser.');
      setAudioSupported(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
    if (enVoice) utter.voice = enVoice;
    utter.lang = 'en-US';
    utter.rate = 0.85;
    utter.pitch = 1.1;
    utter.onstart = () => setAudioSupported(true);
    utter.onerror = () => setAudioSupported(false);
    window.speechSynthesis.speak(utter);
    // Some browsers/webviews silently no-op speak() with no error and no onstart.
    // If nothing is actually speaking shortly after, assume TTS isn't working here.
    setTimeout(() => {
      if (!window.speechSynthesis.speaking) {
        setAudioSupported(false);
      }
    }, 600);
  };

  const handleCategoryTap = (catId) => {
    if (feedback) return;
    setSelected(catId);
    const isCorrect = catId === animal.answer;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) {
      setScore((s) => s + 1);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
    setTimeout(() => {
      setFeedback(null);
      setSelected(null);
      if (current + 1 >= queue.length) {
        onFinish(isCorrect ? score + 1 : score, queue.length);
      } else {
        setCurrent((c) => c + 1);
      }
    }, isCorrect ? 700 : 900);
  };

  return (
    <div style={{ padding: '20px 18px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <button onClick={onExit} style={{
          border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#8A968B',
        }}>←</button>
        <div style={{ flex: 1, height: 10, background: '#EDEBE4', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{
            width: `${progress}%`, height: '100%', background: '#3B9B8F',
            borderRadius: 6, transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{ fontSize: 13, color: '#6B7A80', fontWeight: 600 }}>{current}/{queue.length}</span>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 28, position: 'relative' }}>
        {feedback === 'correct' && <Confetti />}
        {level.audioMode ? (
          <button
            onClick={() => speak(animal.name)}
            style={{
              width: 110, height: 110, borderRadius: '50%', border: 'none',
              background: '#FFFFFF', boxShadow: '0 4px 0 #E4DFD3', cursor: 'pointer',
              fontSize: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto',
              transform: shake ? 'translateX(0)' : 'none',
              animation: shake ? 'shakeAnim 0.4s ease' : 'pulseAnim 1.4s ease-in-out infinite',
            }}
            aria-label="Play sound again"
          >🔊</button>
        ) : (
          <div style={{
            fontSize: animal.emoji.length > 4 ? 44 : animal.emoji.length > 1 ? 60 : 90,
            fontFamily: animal.emoji.length > 1 && /[A-Za-z]/.test(animal.emoji) ? "'Lexend', sans-serif" : 'inherit',
            color: '#2E4045',
            transform: shake ? 'translateX(0)' : 'none',
            animation: shake ? 'shakeAnim 0.4s ease' : 'popIn 0.3s ease',
            display: 'inline-block',
          }}>{animal.emoji}</div>
        )}
        {!level.audioMode && animal.name !== animal.emoji && (
          <div style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 22, color: '#2E4045', marginTop: 4 }}>
            {animal.name}
          </div>
        )}
        {level.audioMode && !audioSupported && hasTappedSpeaker && (
          <div style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 22, color: '#2E4045', marginTop: 10 }}>
            {animal.name}
          </div>
        )}
        {level.audioMode && (
          <div style={{ fontSize: 12, color: '#8A968B', marginTop: 8 }}>
            {!audioSupported && hasTappedSpeaker
              ? 'Bunyi tak disokong peranti ini — guna teks di atas'
              : 'Tap the speaker to hear the word'}
          </div>
        )}
        <style>{`
          @keyframes shakeAnim {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-8px); }
            75% { transform: translateX(8px); }
          }
          @keyframes popIn {
            0% { transform: scale(0.7); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes pulseAnim {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.06); }
          }
        `}</style>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: level.categories.length > 2 ? '1fr 1fr' : '1fr 1fr',
        gap: 12,
      }}>
        {level.categories.map((cat) => {
          const isSelected = selected === cat.id;
          const showCorrect = feedback && cat.id === animal.answer;
          const showWrong = feedback === 'wrong' && isSelected;
          return (
            <button
              key={cat.id}
              onClick={() => handleCategoryTap(cat.id)}
              disabled={!!feedback}
              style={{
                padding: '18px 10px',
                borderRadius: 16,
                border: `3px solid ${showCorrect ? '#3B9B8F' : showWrong ? '#E8664A' : 'transparent'}`,
                background: showCorrect ? '#E4F3EF' : showWrong ? '#FBE7E2' : '#FFFFFF',
                boxShadow: '0 3px 0 #E4DFD3',
                cursor: feedback ? 'default' : 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 4 }}>{cat.emoji}</div>
              <div style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 14, color: '#2E4045' }}>{cat.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SpellingGameScreen({ level, onFinish, onExit }) {
  const [queue] = useState(() => [...level.words].sort(() => Math.random() - 0.5));
  const [current, setCurrent] = useState(0);
  const [tiles, setTiles] = useState([]);
  const [typedLetters, setTypedLetters] = useState([]);
  const [hadMistake, setHadMistake] = useState(false);
  const [wrongTileId, setWrongTileId] = useState(null);
  const [wordFeedback, setWordFeedback] = useState(null); // 'correct' | null
  const [score, setScore] = useState(0);

  const item = queue[current];
  const progress = (current / queue.length) * 100;

  useEffect(() => {
    if (!item) return;
    const shuffled = item.word
      .split('')
      .map((letter, i) => ({ id: `${current}-${i}`, letter }))
      .sort(() => Math.random() - 0.5);
    setTiles(shuffled);
    setTypedLetters([]);
    setHadMistake(false);
    setWordFeedback(null);
  }, [current]);

  const handleTileTap = (tile) => {
    if (tile.used || wordFeedback) return;
    const expected = item.word[typedLetters.length];
    if (tile.letter === expected) {
      const nextTyped = [...typedLetters, tile.letter];
      setTiles((ts) => ts.map((t) => (t.id === tile.id ? { ...t, used: true } : t)));
      setTypedLetters(nextTyped);
      if (nextTyped.length === item.word.length) {
        setWordFeedback('correct');
        setTimeout(() => {
          setScore((s) => (hadMistake ? s : s + 1));
          if (current + 1 >= queue.length) {
            onFinish(hadMistake ? score : score + 1, queue.length);
          } else {
            setCurrent((c) => c + 1);
          }
        }, 800);
      }
    } else {
      setHadMistake(true);
      setWrongTileId(tile.id);
      setTimeout(() => setWrongTileId(null), 350);
    }
  };

  if (!item) return null;

  return (
    <div style={{ padding: '20px 18px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <button onClick={onExit} style={{
          border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#8A968B',
        }}>←</button>
        <div style={{ flex: 1, height: 10, background: '#EDEBE4', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{
            width: `${progress}%`, height: '100%', background: '#3B9B8F',
            borderRadius: 6, transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{ fontSize: 13, color: '#6B7A80', fontWeight: 600 }}>{current}/{queue.length}</span>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 24, position: 'relative' }}>
        {wordFeedback === 'correct' && <Confetti />}
        <div style={{ fontSize: 72, marginBottom: 12 }}>{item.emoji}</div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
          {item.word.split('').map((letter, i) => (
            <div key={i} style={{
              width: 40, height: 48, borderRadius: 10,
              border: `2px solid ${wordFeedback === 'correct' ? '#3B9B8F' : '#D8D2C4'}`,
              background: i < typedLetters.length ? '#E4F3EF' : '#FAF8F2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 22, color: '#2E4045',
              textTransform: 'uppercase',
            }}>
              {typedLetters[i] || ''}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 12 }}>
        {tiles.map((tile) => (
          <button
            key={tile.id}
            onClick={() => handleTileTap(tile)}
            disabled={tile.used || !!wordFeedback}
            style={{
              width: 52, height: 52, borderRadius: 12,
              border: `3px solid ${wrongTileId === tile.id ? '#E8664A' : 'transparent'}`,
              background: tile.used ? '#EDEBE4' : wrongTileId === tile.id ? '#FBE7E2' : '#FFFFFF',
              boxShadow: tile.used ? 'none' : '0 3px 0 #E4DFD3',
              opacity: tile.used ? 0.4 : 1,
              cursor: tile.used || wordFeedback ? 'default' : 'pointer',
              fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 22, color: '#2E4045',
              textTransform: 'uppercase',
              transform: wrongTileId === tile.id ? 'translateX(0)' : 'none',
              animation: wrongTileId === tile.id ? 'shakeAnim 0.35s ease' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {tile.letter}
          </button>
        ))}
        <style>{`
          @keyframes shakeAnim {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-6px); }
            75% { transform: translateX(6px); }
          }
        `}</style>
      </div>
    </div>
  );
}

function QuizScreen({ level, onFinish, onExit }) {
  const [queue] = useState(() => {
    const qs = level.generateQuestions ? level.generateQuestions() : level.questions;
    return [...qs].sort(() => Math.random() - 0.5);
  });
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null); // 'correct' | 'wrong' | null
  const [score, setScore] = useState(0);
  const [shake, setShake] = useState(false);

  const q = queue[current];
  const progress = (current / queue.length) * 100;

  const handleChoiceTap = (choice) => {
    if (feedback) return;
    setSelected(choice);
    const isCorrect = choice === q.answer;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) {
      setScore((s) => s + 1);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
    setTimeout(() => {
      setFeedback(null);
      setSelected(null);
      if (current + 1 >= queue.length) {
        onFinish(isCorrect ? score + 1 : score, queue.length);
      } else {
        setCurrent((c) => c + 1);
      }
    }, isCorrect ? 700 : 900);
  };

  if (!q) return null;

  return (
    <div style={{ padding: '20px 18px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <button onClick={onExit} style={{
          border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#8A968B',
        }}>←</button>
        <div style={{ flex: 1, height: 10, background: '#EDEBE4', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{
            width: `${progress}%`, height: '100%', background: '#3B9B8F',
            borderRadius: 6, transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{ fontSize: 13, color: '#6B7A80', fontWeight: 600 }}>{current}/{queue.length}</span>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 28, position: 'relative' }}>
        {feedback === 'correct' && <Confetti />}
        <div style={{
          fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 26, color: '#2E4045',
          padding: '0 8px', transform: shake ? 'translateX(0)' : 'none',
          whiteSpace: 'pre-line',
          animation: shake ? 'quizShake 0.4s ease' : 'quizPopIn 0.3s ease',
        }}>
          {q.question}
        </div>
        <style>{`
          @keyframes quizShake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-8px); }
            75% { transform: translateX(8px); }
          }
          @keyframes quizPopIn {
            0% { transform: scale(0.85); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
      }}>
        {q.choices.map((choice) => {
          const isSelected = selected === choice;
          const showCorrect = feedback && choice === q.answer;
          const showWrong = feedback === 'wrong' && isSelected;
          return (
            <button
              key={choice}
              onClick={() => handleChoiceTap(choice)}
              disabled={!!feedback}
              style={{
                padding: q.choiceType === 'abacus' ? '10px 6px' : '20px 10px',
                borderRadius: 16,
                border: `3px solid ${showCorrect ? '#3B9B8F' : showWrong ? '#E8664A' : 'transparent'}`,
                background: showCorrect ? '#E4F3EF' : showWrong ? '#FBE7E2' : '#FFFFFF',
                boxShadow: '0 3px 0 #E4DFD3',
                cursor: feedback ? 'default' : 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              {q.choiceType === 'abacus' ? (
                <AbacusVisual value={Number(choice)} rods={q.rods || 2} width={110} />
              ) : (
                <div style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 22, color: '#2E4045' }}>
                  {choice}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SummaryScreen({ score, total, onContinue, onHome, isLastFreeLevel }) {
  const pct = Math.round((score / total) * 100);
  const stars = pct >= 85 ? 3 : pct >= 60 ? 2 : 1;
  return (
    <div style={{ textAlign: 'center', padding: '40px 24px' }}>
      <div style={{ fontSize: 44, marginBottom: 8 }}>
        {'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}
      </div>
      <h2 style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 24, color: '#2E4045', margin: '0 0 6px' }}>
        Syabas!
      </h2>
      <p style={{ color: '#6B7A80', fontSize: 15, marginBottom: 28 }}>
        Betul {score} daripada {total} soalan
      </p>
      {isLastFreeLevel ? (
        <div style={{
          background: '#FBEFE2', borderRadius: 16, padding: '18px 16px', marginBottom: 20,
        }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🔓</div>
          <div style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 16, color: '#2E4045', marginBottom: 4 }}>
            Peringkat percuma habis!
          </div>
          <div style={{ fontSize: 13, color: '#8A7355' }}>
            Sambung dengan langganan untuk buka Reptilia, Ikan & topik baru setiap bulan
          </div>
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button onClick={onHome} style={{
          padding: '12px 22px', borderRadius: 14, border: 'none',
          background: '#EDEBE4', color: '#6B7A80', fontFamily: "'Lexend', sans-serif", fontWeight: 700,
          fontSize: 14, cursor: 'pointer',
        }}>Menu Utama</button>
        <button onClick={onContinue} style={{
          padding: '12px 22px', borderRadius: 14, border: 'none',
          background: '#3B9B8F', color: '#FFF', fontFamily: "'Lexend', sans-serif", fontWeight: 700,
          fontSize: 14, cursor: 'pointer', boxShadow: '0 3px 0 #2C7A70',
        }}>{isLastFreeLevel ? 'Lihat Langganan' : 'Sambung'}</button>
      </div>
    </div>
  );
}

function ParentReportScreen({ completedLevels, child, onContinue }) {
  const { bySubject } = computeMastery(completedLevels);
  const lastEntry = completedLevels[completedLevels.length - 1];
  const lastLevel = LEVELS[lastEntry.levelIdx];
  const subj = SUBJECTS[lastLevel.subject];
  const accuracy = Math.round((lastEntry.score / lastEntry.total) * 100);
  const childAge = child ? child.age : null;
  const childName = child ? child.name : null;

  // Fix 1: most Tahun 1 levels don't set an explicit minAge (only the 2 bonus
  // phonics levels do), so fall back to 7 — the official Tahun 1 age in
  // Malaysia — for any level tagged tahun:1. Without this, the "Advanced"
  // badge could basically never fire on core DSKP content.
  const effectiveMinAge = lastLevel.minAge || (lastLevel.tahun === 1 ? 7 : null);

  // Fix 2: 4-choice quiz has a 25% guess floor, 2-category sorting has a 50%
  // guess floor — 60% was too close to "just tapping randomly" for sorting
  // games. 80% gives a safe buffer above chance for both mechanics so the
  // "Advanced" claim actually reflects understanding, not luck.
  const isAdvanced = childAge && effectiveMinAge && childAge < effectiveMinAge && accuracy >= 80;
  const ageGap = isAdvanced ? effectiveMinAge - childAge : 0;

  const STRAND_LABELS = { listening: 'Mendengar', speaking: 'Bertutur', reading: 'Membaca', writing: 'Menulis' };
  const showSpi = lastLevel.subject === 'literacyen' && lastLevel.strand && SPI_DESCRIPTORS[lastLevel.strand];
  const spiLevel = showSpi ? accuracyToSpiLevel(accuracy) : null;
  const spiDescriptor = showSpi ? SPI_DESCRIPTORS[lastLevel.strand][spiLevel] : null;

  return (
    <div style={{ padding: '28px 20px' }}>
      {isAdvanced && (
        <div style={{
          background: '#3B9B8F', borderRadius: 20, padding: '16px 18px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ fontSize: 30 }}>🌟</div>
          <div>
            <div style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 15, color: '#FFF' }}>
              Tahap Advanced!
            </div>
            <div style={{ fontSize: 12, color: '#DDF2EE' }}>
              Untuk umur {childAge} tahun, peringkat ni biasanya untuk umur {effectiveMinAge}+ tahun — anak anda mendahului {ageGap} tahun!
            </div>
          </div>
        </div>
      )}
      {showSpi && (
        <div style={{
          background: '#FFFFFF', borderRadius: 20, padding: '16px 18px', marginBottom: 14,
          boxShadow: '0 3px 0 #E4DFD3',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: '#FBEFE2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 18, color: '#B08B3A',
            }}>{spiLevel}</div>
            <div>
              <div style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 14, color: '#2E4045' }}>
                Tahap Penguasaan (SPi) · {STRAND_LABELS[lastLevel.strand]}
              </div>
              <div style={{ fontSize: 11, color: '#9AA5A0' }}>Anggaran berdasarkan DSKP — bukan penilaian rasmi PBD sekolah</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#6B7A80', lineHeight: 1.5 }}>{spiDescriptor}</div>
        </div>
      )}
      <div style={{
        background: '#FFFFFF', borderRadius: 20, padding: '22px 20px',
        boxShadow: '0 3px 0 #E4DFD3', marginBottom: 18,
      }}>
        <div style={{ fontSize: 11, letterSpacing: 1, color: '#9AA5A0', fontWeight: 700, marginBottom: 6 }}>
          LAPORAN UNTUK IBU BAPA
        </div>
        <h2 style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 20, color: '#2E4045', margin: '0 0 16px' }}>
          {childName || 'Anak anda'} baru belajar {subj.emoji} {subj.label}
        </h2>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, background: '#E4F3EF', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 22, color: '#2C7A70' }}>{accuracy}%</div>
            <div style={{ fontSize: 11, color: '#5C8A82' }}>Ketepatan sesi ini</div>
          </div>
          <div style={{ flex: 1, background: '#FBEFE2', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 22, color: '#B5652E' }}>{bySubject[lastLevel.subject] || 0}</div>
            <div style={{ fontSize: 11, color: '#8A7355' }}>Jumlah {subj.skillLabel}</div>
          </div>
        </div>

        <div style={{ fontSize: 13, color: '#6B7A80', lineHeight: 1.6, background: '#FFF8EC', borderRadius: 12, padding: '10px 14px' }}>
          {accuracy >= 85
            ? `Cemerlang! ${childName || 'Anak anda'} dah kuasai topik ni dengan baik.`
            : accuracy >= 60
            ? `Progres baik. Sedikit lagi latihan untuk kuasai sepenuhnya.`
            : `Topik ni masih baru — biar dia ulang beberapa kali lagi, itu normal.`}
        </div>
      </div>

      <button onClick={onContinue} style={{
        width: '100%', padding: '14px', borderRadius: 14, border: 'none',
        background: '#3B9B8F', color: '#FFF', fontFamily: "'Lexend', sans-serif", fontWeight: 700,
        fontSize: 15, cursor: 'pointer', boxShadow: '0 3px 0 #2C7A70',
      }}>Teruskan</button>
      <p style={{ textAlign: 'center', fontSize: 11, color: '#9AA5A0', marginTop: 10 }}>
        📸 Ambil screenshot untuk simpan progres {childName || 'anak anda'}
      </p>
    </div>
  );
}

function DailyLimitPopupScreen({ limitTomorrow, onSubscribe, onGoHome }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>😘</div>
      <h1 style={{
        fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 22, color: '#2E4045', margin: '0 0 10px',
      }}>Hebat hari ni!</h1>
      <p style={{ color: '#6B7A80', fontSize: 15, lineHeight: 1.6, marginBottom: 28, maxWidth: 300, margin: '0 auto 28px' }}>
        Main {limitTomorrow} peringkat baru esok ya! Atau langgan sekarang untuk main semua terus 😘☺️
      </p>
      <button onClick={onSubscribe} style={{
        padding: '14px 32px', borderRadius: 16, border: 'none',
        background: '#3B9B8F', color: '#FFF', fontFamily: "'Lexend', sans-serif",
        fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 3px 0 #2C7A70',
        marginBottom: 14,
      }}>Langgan Sekarang</button>
      <div>
        <button onClick={onGoHome} style={{
          background: 'none', border: 'none', color: '#8A968B', fontSize: 13,
          cursor: 'pointer', textDecoration: 'underline',
        }}>Okay, esok saya sambung</button>
      </div>
    </div>
  );
}

function PaywallScreen({ onSubscribe, onBack }) {
  const [plan, setPlan] = useState('monthly');
  return (
    <div style={{ padding: '32px 22px', textAlign: 'center' }}>
      <div style={{ fontSize: 44, marginBottom: 6 }}>🌟</div>
      <h2 style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 22, color: '#2E4045', margin: '0 0 6px' }}>
        Buka Semua Peringkat
      </h2>
      <p style={{ color: '#6B7A80', fontSize: 14, marginBottom: 24 }}>
        7 hari percuma, batal bila-bila masa
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
        <button onClick={() => setPlan('yearly')} style={{
          padding: '14px 16px', borderRadius: 16,
          border: `2px solid ${plan === 'yearly' ? '#3B9B8F' : '#EDEBE4'}`,
          background: plan === 'yearly' ? '#E4F3EF' : '#FFF',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
        }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 15, color: '#2E4045' }}>Tahunan</div>
            <div style={{ fontSize: 12, color: '#8A968B' }}>RM99/tahun · RM8.25/bulan</div>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#3B9B8F', background: '#D2ECE7',
            padding: '3px 8px', borderRadius: 8,
          }}>JIMAT 45%</span>
        </button>
        <button onClick={() => setPlan('monthly')} style={{
          padding: '14px 16px', borderRadius: 16,
          border: `2px solid ${plan === 'monthly' ? '#3B9B8F' : '#EDEBE4'}`,
          background: plan === 'monthly' ? '#E4F3EF' : '#FFF',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
        }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 15, color: '#2E4045' }}>Bulanan</div>
            <div style={{ fontSize: 12, color: '#8A968B' }}>RM14.90/bulan</div>
          </div>
        </button>
      </div>

      <button onClick={onSubscribe} style={{
        width: '100%', padding: '14px', borderRadius: 14, border: 'none',
        background: '#3B9B8F', color: '#FFF', fontFamily: "'Lexend', sans-serif", fontWeight: 700,
        fontSize: 15, cursor: 'pointer', boxShadow: '0 3px 0 #2C7A70', marginBottom: 10,
      }}>Mula Percubaan Percuma</button>
      <button onClick={onBack} style={{
        background: 'none', border: 'none', color: '#8A968B', fontSize: 13, cursor: 'pointer',
      }}>Kembali</button>
    </div>
  );
}

export default function App() {
  const [family, setFamily] = useState(() => loadFamily());
  const [activeChildId, setActiveChildId] = useState(null);
  const [screen, setScreen] = useState(() => (loadFamily().children.length === 0 ? 'addChild' : 'profileSelect'));
  const [levelIdx, setLevelIdx] = useState(0);
  const [lastResult, setLastResult] = useState({ score: 0, total: 0 });

  // Persist the whole family (all children's progress + subscription) to
  // localStorage on every change, so nothing is lost when the app/tab closes.
  useEffect(() => {
    saveFamily(family);
  }, [family]);

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  const activeChild = family.children.find((c) => c.id === activeChildId) || null;
  const completedLevels = activeChild ? activeChild.completedLevels : [];
  const isSubscribed = family.isSubscribed;

  const updateActiveChild = (updater) => {
    setFamily((prev) => ({
      ...prev,
      children: prev.children.map((c) => (c.id === activeChildId ? updater(c) : c)),
    }));
  };

  const handleAddChild = ({ name, age }) => {
    const newChild = {
      id: makeChildId(), name, age, completedLevels: [],
      freeWindowStartedAt: null, freeLevelsPlayedInWindow: 0, freeWindowCount: 0,
    };
    setFamily((prev) => ({ ...prev, children: [...prev.children, newChild] }));
    setActiveChildId(newChild.id);
    setScreen('home');
  };

  const handleSelectChild = (childId) => {
    setActiveChildId(childId);
    setScreen('home');
  };

  const startLevel = (idx) => {
    setLevelIdx(idx);
    setScreen('game');
  };

  const finishLevel = (score, total) => {
    setLastResult({ score, total });
    const isFirstTimeCompletion = !completedLevels.some((c) => c.levelIdx === levelIdx);

    updateActiveChild((c) => {
      const updated = { ...c, completedLevels: [...c.completedLevels, { levelIdx, score, total }] };
      if (isFirstTimeCompletion && !isSubscribed) {
        const status = getFreeWindowStatus(c);
        if (status.windowExpired) {
          updated.freeWindowStartedAt = Date.now();
          updated.freeWindowCount = (c.freeWindowCount || 0) + 1;
          updated.freeLevelsPlayedInWindow = 1;
        } else {
          updated.freeLevelsPlayedInWindow = (c.freeLevelsPlayedInWindow || 0) + 1;
        }
      }
      return updated;
    });
    setScreen('summary');
  };

  const handleSummaryContinue = () => {
    setScreen('report');
  };

  const handleReportContinue = () => {
    if (!isSubscribed && activeChild && getFreeWindowStatus(activeChild).remaining <= 0) {
      // Friendly popup first (right after the exciting SPi report) instead of
      // slamming straight into the paywall — softer nudge, parent's choice.
      setScreen('dailyLimitPopup');
      return;
    }
    // Continue within the SAME subject's main-track progression (not the next
    // global array index) — subjects are independent tracks, so finishing
    // Sains Peringkat 1 should offer Sains Peringkat 2, not an unrelated
    // Matematik or BM level that happens to sit next in the flat array.
    const currentSubject = LEVELS[levelIdx].subject;
    const track = SUBJECT_TRACKS[currentSubject].main;
    const posInTrack = track.findIndex((l) => l.idx === levelIdx);
    const next = track[posInTrack + 1];
    if (next) {
      startLevel(next.idx);
    } else {
      setScreen('home');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FFF8EC',
      fontFamily: "'Lexend', sans-serif",
      display: 'flex',
      justifyContent: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {screen === 'addChild' && (
          <AddChildScreen
            isFirstChild={family.children.length === 0}
            onAddChild={handleAddChild}
            onCancel={() => setScreen('profileSelect')}
          />
        )}
        {screen === 'profileSelect' && (
          <ProfileSelectScreen
            children={family.children}
            onSelectChild={handleSelectChild}
            onAddChild={() => setScreen('addChild')}
          />
        )}
        {screen === 'home' && (
          <HomeScreen
            onStart={startLevel}
            completedLevels={completedLevels}
            isSubscribed={isSubscribed}
            child={activeChild}
            onChangeProfile={() => setScreen('profileSelect')}
          />
        )}
        {screen === 'game' && (
          LEVELS[levelIdx].type === 'spelling' ? (
            <SpellingGameScreen
              level={LEVELS[levelIdx]}
              onFinish={finishLevel}
              onExit={() => setScreen('home')}
            />
          ) : LEVELS[levelIdx].type === 'quiz' ? (
            <QuizScreen
              level={LEVELS[levelIdx]}
              onFinish={finishLevel}
              onExit={() => setScreen('home')}
            />
          ) : (
            <GameScreen
              level={LEVELS[levelIdx]}
              onFinish={finishLevel}
              onExit={() => setScreen('home')}
            />
          )
        )}
        {screen === 'summary' && (
          <SummaryScreen
            score={lastResult.score}
            total={lastResult.total}
            isLastFreeLevel={!isSubscribed && activeChild ? getFreeWindowStatus(activeChild).remaining <= 0 : false}
            onContinue={handleSummaryContinue}
            onHome={() => setScreen('home')}
          />
        )}
        {screen === 'report' && (
          <ParentReportScreen
            completedLevels={completedLevels}
            child={activeChild}
            onContinue={handleReportContinue}
          />
        )}
        {screen === 'dailyLimitPopup' && (
          <DailyLimitPopupScreen
            limitTomorrow={
              activeChild
                ? getEligibleSubjectsForWindow(getFreeWindowStatus(activeChild).windowNumber + 1).limit
                : 2
            }
            onSubscribe={() => setScreen('paywall')}
            onGoHome={() => setScreen('home')}
          />
        )}
        {screen === 'paywall' && (
          <PaywallScreen
            onSubscribe={() => {
              setFamily((prev) => ({ ...prev, isSubscribed: true }));
              setScreen('home');
            }}
            onBack={() => setScreen('home')}
          />
        )}
      </div>
    </div>
  );
}
