# Problem Solving Session: Tidak Ada User Story & Acceptance Criteria — Panic Button

**Date:** 2026-04-29
**Problem Solver:** Asman
**Problem Category:** Product Documentation / Delivery Risk

---

## 🎯 PROBLEM DEFINITION

### Initial Problem Statement

Tidak adanya dokumen user story dan acceptance criteria untuk fitur panic button menyebabkan blindspot bagi product owner, sehingga QA, user tester, dan developer tidak memiliki panduan yang jelas tentang kesuksesan fitur.

### Refined Problem Statement

Fitur Panic Button (CIFO Guard v1.0.0) sudah terimplementasi sebagian, namun tidak memiliki dokumen **User Story**, **Acceptance Criteria**, **Test Cases**, dan **Definition of Done**. Akibatnya QA hanya mampu mencatat bug ad-hoc (terbukti hanya 4 item ditemukan dari QA report), developer tidak tahu scope yang benar, dan deadline sprint terancam karena tidak ada definisi "selesai" yang disepakati.

### Problem Context

- Fitur Panic Button sudah sebagian terimplementasi
- QA report ("CIFO Guard v1.0.0 Panic Button") hanya berisi 4 item — sangat sparse untuk sistem panic button
- Bug #4 menunjukkan masalah logika kritis: "Timer panic tetap berjalan meskipun status sudah resolved"
- Bug #2 menunjukkan scope yang tidak jelas: "Dari 4 tombol, hanya 1 yang berfungsi" — QA tidak tahu tombol mana yang seharusnya berfungsi
- QA dan developer bingung tentang langkah selanjutnya
- Deadline sprint terancam

### Success Criteria

Tersedianya dokumen lengkap yang diserahkan kepada QA, user tester, dan developer:
1. **User Story** — narasi kebutuhan dari perspektif pengguna
2. **Acceptance Criteria** — kondisi terukur yang mendefinisikan "selesai"
3. **Test Cases** — skenario test yang exhaustive berbasis AC
4. **Definition of Done** — checklist final sebelum fitur dinyatakan release-ready

---

## 🔍 DIAGNOSIS AND ROOT CAUSE ANALYSIS

### Problem Boundaries (Is/Is Not)

| Dimensi | IS (Ada masalah di sini) | IS NOT (Tidak ada masalah di sini) |
|---------|--------------------------|-------------------------------------|
| **Fitur** | Panic Button (CIFO Guard v1.0.0) | Fitur lain di sistem (kamera, sidebar, media) |
| **Dokumen** | User Story, AC, Test Cases, DoD — semua belum ada untuk panic button | Kemampuan membuat dokumen (terbukti: UX spec NLS HITECH NIAGA sangat komprehensif) |
| **Tim** | QA bingung (hanya 4 item), Developer tidak tahu scope benar | Skill teknis tim (implementasi sudah sebagian berjalan) |
| **Waktu** | Sprint saat ini — deadline terancam | Sprint sebelumnya (masalah baru muncul sekarang) |
| **Dampak** | QA tidak bisa test exhaustively, Developer tidak tahu definisi "selesai" | Infrastruktur backend (sudah berjalan), database, server |
| **Pola** | Panic button fitur — tidak ada source of truth | Proyek lain di tim yang memiliki dokumentasi |

**Pola yang muncul dari Is/Is Not:**
- Masalah **terisolasi di satu fitur** (panic button) — bukan masalah seluruh sistem
- Tim **punya kapabilitas dokumentasi** (bukti: NLS UX spec) tapi tidak diterapkan di sini
- Gap terjadi di **fase perencanaan sprint**, bukan di fase eksekusi

### Root Cause Analysis

**Metode: Five Whys**

| Layer | Pernyataan |
|-------|-----------|
| Gejala | Panic button tidak punya User Story, AC, Test Cases, DoD |
| Why 1 | Tidak ada yang membuat dokumen |
| Why 2 | Tidak ada yang ditugaskan — tidak ada ownership jelas |
| Why 3 | Tanpa AI terlalu berat — waktu, format, tim kecil & overloaded |
| Why 4 | Tidak ada DoR (Definition of Ready) sebagai checkpoint wajib |
| **★ Why 5 — ROOT CAUSE** | **Tim belum pernah setup proses formal (DoR/DoD) sebagai gating sebelum development dimulai** |

### Contributing Factors

- **People:** Tim kecil, semua orang overloaded — tidak ada kapasitas untuk menulis dokumen manual
- **Process:** Tidak ada DoR — development bisa dimulai tanpa dokumen siap
- **Tools:** Sebelum ada AI, biaya membuat dokumentasi terlalu tinggi
- **Knowledge:** Format user story + AC + test cases tidak terstandardisasi di tim

### System Dynamics

Ini adalah **vicious cycle:**

```
Tidak ada proses DoR
    ↓
Development dimulai tanpa dokumen
    ↓
QA test secara blind → sedikit bug ditemukan
    ↓
Blindspot makin besar → fitur "selesai" tapi belum tentu benar
    ↓
Deadline terancam karena scope tidak jelas
    ↓
Makin tidak ada waktu untuk buat dokumen
    ↓
[kembali ke atas]
```

**Leverage point:** Putus siklus di titik pertama — install DoR sebagai checkpoint wajib, dengan AI sebagai enabler agar biaya dokumentasi menjadi rendah.

---

## 📊 ANALYSIS

### Force Field Analysis

**Driving Forces (Mendorong ke Solusi):**
- ★ AI tersedia — biaya membuat dokumentasi sekarang sangat rendah
- ★ Deadline terancam — urgensi tinggi, tidak bisa tunda
- ★ PO sadar ada blindspot — ada awareness dan kemauan berubah
- QA report sudah ada (4 bug) — ada starting point nyata
- Tim punya capability dokumentasi (terbukti dari NLS UX spec)

**Restraining Forces (Menghambat):**
- ★★ Tidak ada template standar User Story + AC di tim — setiap orang harus mulai dari nol
- ★★ Tidak ada DoR — tidak ada sistem yang enforce proses baru agar konsisten
- ★★ Sprint deadline — waktu terbatas, dokumentasi terasa "mewah"

### Constraint Identification

**Constraint utama (bottleneck):**
> *Tidak ada template standar* — ini yang paling membatasi. Bahkan jika ada waktu dan kemauan, tim tidak tahu harus mulai dari mana atau format apa yang dipakai.

**Constraint nyata vs asumsi:**
| Constraint | Nyata atau Asumsi? |
|-----------|-------------------|
| Tidak ada waktu | **Asumsi** — dengan AI, dokumen bisa selesai dalam 1-2 jam bukan berhari-hari |
| Tidak ada yang bisa buat dokumen | **Asumsi** — capability ada, hanya butuh template + AI |
| Tidak ada template | **Nyata** — harus dibuat dari nol |
| Tidak ada DoR | **Nyata** — harus di-install sebagai proses baru |

### Key Insights

1. **Hambatan terbesar bukan waktu — tapi tidak ada template.** Dengan AI + template yang tepat, dokumentasi lengkap bisa selesai hari ini.
2. **Solusi dua lapis dibutuhkan:** (a) selesaikan dokumen panic button sekarang, (b) install template + DoR agar tidak terulang.
3. **AI adalah game changer** — restraining force #3 (waktu) praktis dieliminasi dengan AI. Driving forces jauh lebih kuat dari restraining forces saat ini.

---

## 💡 SOLUTION GENERATION

### Methods Used

1. **Assumption Busting** — menghancurkan asumsi lama yang menghambat dokumentasi dibuat
2. **Reverse Brainstorming** — membalik pertanyaan: "bagaimana cara memastikan tidak ada dokumentasi?" lalu inversikan hasilnya

### Generated Solutions

| # | Ide | Kategori |
|---|-----|----------|
| 1 | Buat User Story + AC panic button sekarang pakai AI | Quick Win |
| 2 | Buat template standar User Story + AC yang bisa di-reuse | Template |
| 3 | Generate Test Cases dari AC secara otomatis | Template |
| 4 | Buat checklist DoD panic button | Quick Win |
| 5 | Install DoR sebagai checkpoint wajib awal setiap sprint | Proses |
| 6 | "Documentation Sprint" 1 hari untuk catch up semua backlog | Quick Win |
| 7 | Single source of truth — semua dokumen di `/docs` terstruktur | Proses |
| 8 | Dokumen wajib ada sebelum PR bisa di-merge | Proses |
| 9 | AC langsung generate test script skeleton | Otomasi |
| 10 | Weekly doc review 15 menit di standup | Proses |
| 11 | Reverse-engineer AC dari QA report yang sudah ada | Quick Win |
| 12 | Living document yang update dari conversation AI | Inovatif |

### Creative Alternatives

- **Ide #11 (reverse-engineer):** 4 bug di QA report bukan hanya bug list — mereka adalah petunjuk AC yang hilang. Bug #4 "timer panic berjalan meski resolved" = AC: *"timer HARUS berhenti ketika status = resolved"*
- **Ide #9 (AC → test skeleton):** Setiap baris AC yang ditulis format Given/When/Then langsung bisa jadi skeleton test case — QA tinggal isi detail, bukan mulai dari nol

---

## ⚖️ SOLUTION EVALUATION

### Evaluation Criteria

| Kriteria | Bobot | Alasan |
|----------|-------|--------|
| Impact | 30% | Harus selesaikan root cause, bukan gejala |
| Speed | 25% | Deadline terancam — solusi harus bisa dieksekusi hari ini |
| Effort | 20% | Tim kecil + overloaded — effort rendah kritis |
| Sustainability | 15% | Harus cegah recurrence di sprint berikutnya |
| Risk | 10% | Hindari solusi yang bisa break workflow yang ada |

### Solution Analysis

Top solusi berdasarkan weighted score (skala 1-5):

| Solusi | Score |
|--------|-------|
| User Story + AC panic button via AI | 4.35 |
| DoD checklist panic button | 4.35 |
| Generate Test Cases dari AC | 4.10 |
| Template standar User Story + AC | 4.10 |
| Reverse-engineer AC dari QA report | 3.85 |
| Install DoR checkpoint tiap sprint | 3.35 |

### Recommended Solution

**Solusi 2 Lapis:**

**LAPIS 1 — Eksekusi sekarang:**
Gabungkan solusi #1 + #11 + #3 + #4:
- Reverse-engineer AC dari 4 bug di QA report sebagai starting point
- Generate User Story + AC lengkap untuk panic button via AI
- Generate Test Cases dari AC (format Given/When/Then)
- Buat DoD checklist panic button

**LAPIS 2 — Prevent recurrence:**
Gabungkan solusi #2 + #5 + #7:
- Template standar User Story + AC untuk dipakai di sprint berikutnya
- Install DoR sebagai checkpoint wajib
- Struktur `/docs` sebagai single source of truth

### Solution Rationale

1. **Mengapa Lapis 1 dulu:** Deadline terancam — deliverable ke QA, developer, user tester harus ada sekarang
2. **Mengapa reverse-engineer dari QA report:** 4 bug yang ada sudah mengungkap sebagian AC yang hilang — ini adalah shortcut yang valid
3. **Mengapa template (Lapis 2):** Tanpa template, masalah yang sama akan terulang di sprint berikutnya walau sekarang sudah diselesaikan
4. **Asumsi kunci:** AI tersedia dan bisa digunakan untuk generate dokumen — terbukti valid

---

## 🚀 IMPLEMENTATION PLAN

### Implementation Approach

- **Lapis 1:** Big bang — semua dokumen panic button selesai dalam satu sesi hari ini
- **Lapis 2:** Phased — template + DoR di-install di awal sprint berikutnya

### Action Steps

**LAPIS 1 — Hari Ini**

| # | Action | Owner | Input | Output |
|---|--------|-------|-------|--------|
| 1 | Reverse-engineer AC dari 4 bug QA report | PO + AI | QA report | Draft AC awal |
| 2 | Buat User Story lengkap panic button | PO + AI | Draft AC | User Story |
| 3 | Expand AC — happy path + edge cases | PO + AI | User Story | AC lengkap |
| 4 | Generate Test Cases (Given/When/Then) | PO + AI | AC lengkap | Test Cases |
| 5 | Buat DoD checklist panic button | PO + AI | User Story + AC | DoD |
| 6 | Serahkan ke QA + Developer + User Tester | PO | Semua dokumen | Deliverable ✓ |

**LAPIS 2 — Sprint Berikutnya**

| # | Action | Owner | Output |
|---|--------|-------|--------|
| 7 | Template standar User Story + AC | PO + AI | Template reusable |
| 8 | Setup folder `/docs` di repo | Developer | Single source of truth |
| 9 | Define DoR checklist (max 5 poin) | PO + Tim | DoR dokumen |
| 10 | Sosialisasi DoR ke seluruh tim | PO | Tim aligned |

### Timeline

- **Hari ini:** Step 1–6 selesai → dokumen diserahkan ke QA + dev + user tester
- **Sprint berikutnya (hari pertama):** Step 7–10 selesai → proses baru aktif

### Resources Needed

- AI (tersedia) — eksekutor utama dokumentasi
- PO (Asman) — domain knowledge + review + approval
- QA report screenshot — input untuk reverse-engineer AC
- 1–2 jam waktu fokus untuk Lapis 1

### Responsible Parties

| Peran | Tanggung Jawab |
|-------|---------------|
| Product Owner (Asman) | Domain knowledge, review, serahkan dokumen |
| AI | Draft User Story, AC, Test Cases, DoD, Template |
| Developer | Terima dokumen, clarify jika ada gap dengan implementasi |
| QA | Terima Test Cases, validasi completeness |
| User Tester | Terima User Story + AC sebagai panduan testing |

---

## 📈 MONITORING AND VALIDATION

_[akan diisi di Step 8]_

---

_Generated using BMAD Creative Intelligence Suite - Problem Solving Workflow_
