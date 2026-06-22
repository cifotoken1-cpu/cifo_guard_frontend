"""
Ukur delay snapshot kamera VIGI.

Pakai:
  python measure_delay.py            # benchmark grab dingin + warm buffer (tanpa perlu orang)
  python measure_delay.py event      # ukur delay NYATA event->frame (jalan di depan kamera)

Yang diukur:
  1. COLD GRAB  : waktu ffmpeg buka RTSP + ambil 1 frame (biaya per-event kalau TANPA warm buffer)
  2. WARM BUFFER: latency ambil frame on-demand dari buffer yg di-refresh background (+ umur frame)
  3. EVENT DELAY: dari kamera mendeteksi orang (event.time) sampai frame siap di sisi kita
"""
import sys, time, threading, subprocess, logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("delay")

from config import RTSP_URL, VIGI_HOST, VIGI_PORT, VIGI_USER, VIGI_PASS


def grab_once(timeout=10):
    """Grab 1 frame via ffmpeg RTSP. Return (jpeg_bytes, durasi_detik)."""
    t0 = time.time()
    try:
        p = subprocess.run(
            ["ffmpeg", "-rtsp_transport", "tcp", "-i", RTSP_URL,
             "-frames:v", "1", "-q:v", "5", "-f", "image2", "-loglevel", "error", "pipe:1"],
            capture_output=True, timeout=timeout,
        )
        return p.stdout, time.time() - t0
    except subprocess.TimeoutExpired:
        return b"", time.time() - t0


# ── 1. COLD GRAB benchmark ──────────────────────────────────────────────────
def bench_cold(n=5):
    log.info(f"=== COLD GRAB (RTSP {RTSP_URL.split('@')[-1]}) — {n} sampel ===")
    times = []
    for i in range(n):
        buf, dt = grab_once()
        ok = f"{len(buf)} bytes" if buf else "GAGAL"
        log.info(f"  grab #{i+1}: {dt:.2f} dtk  ({ok})")
        times.append(dt)
    if times:
        log.info(f"  -> COLD GRAB: min={min(times):.2f}  avg={sum(times)/len(times):.2f}  max={max(times):.2f} dtk")
    return times


# ── 2. WARM BUFFER demo ─────────────────────────────────────────────────────
class WarmBuffer:
    def __init__(self, interval=1.5):
        self.interval = interval
        self.frame = None
        self.ts = 0
        self._stop = False
    def _loop(self):
        while not self._stop:
            buf, _ = grab_once()
            if buf:
                self.frame = buf; self.ts = time.time()
            time.sleep(self.interval)
    def start(self):
        threading.Thread(target=self._loop, daemon=True).start()
    def stop(self):
        self._stop = True

def bench_warm(n=5):
    log.info(f"=== WARM BUFFER (refresh tiap 1.5 dtk) ===")
    wb = WarmBuffer(1.5); wb.start()
    log.info("  menunggu frame pertama...")
    while wb.frame is None:
        time.sleep(0.1)
    log.info("  buffer siap. Ambil 5x on-demand (jeda 2 dtk):")
    for i in range(n):
        t0 = time.time()
        frame = wb.frame                      # ambil instan dari memori
        latency = time.time() - t0
        age = time.time() - wb.ts             # umur frame saat diambil
        log.info(f"  ambil #{i+1}: latency={latency*1000:.1f} ms | umur frame={age:.2f} dtk")
        time.sleep(2)
    wb.stop()
    log.info("  -> WARM: latency ~0 ms; delay efektif = UMUR FRAME (maks ~1.5 dtk)")


# ── 3. EVENT DELAY (live) ───────────────────────────────────────────────────
def measure_event():
    from vigi_client import VigiClient
    from event_subscriber import EventSubscriber
    log.info("=== EVENT DELAY (live) — JALAN DI DEPAN KAMERA ===")
    log.info("Ctrl+C untuk berhenti.\n")
    client = VigiClient(host=VIGI_HOST, port=VIGI_PORT, username=VIGI_USER, password=VIGI_PASS)
    client.login()
    sub = EventSubscriber(client, events=["PeopleDetection"])
    n = 0
    try:
        for ev in sub.subscribe():
            t_recv = time.time()
            cam_t = ev.get("time")
            try: cam_t = int(cam_t)
            except (TypeError, ValueError): cam_t = None
            # delay kamera->terima (butuh jam kamera & lokal sinkron/NTP)
            d_event = (t_recv - cam_t) if cam_t else None
            # grab frame sekarang (simulasi cold), ukur
            buf, dt_grab = grab_once()
            t_ready = time.time()
            total = (t_ready - cam_t) if cam_t else None
            n += 1
            log.info(f"[event #{n}] {ev.get('event_type')}")
            if cam_t:
                log.info(f"   kamera deteksi (event.time) -> terima backend : {d_event:.2f} dtk")
            log.info(f"   grab frame (cold)                            : {dt_grab:.2f} dtk")
            if total is not None:
                log.info(f"   TOTAL kamera-deteksi -> frame-siap           : {total:.2f} dtk")
            log.info(f"   (dgn WARM BUFFER, bagian grab jadi ~0 -> hemat {dt_grab:.2f} dtk)\n")
    except KeyboardInterrupt:
        log.info(f"\nselesai. {n} event terukur.")
    finally:
        sub.stop()


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "bench"
    if mode == "event":
        measure_event()
    else:
        bench_cold()
        print()
        bench_warm()
        print()
        log.info("Untuk ukur delay NYATA saat ada orang lewat: python measure_delay.py event")
