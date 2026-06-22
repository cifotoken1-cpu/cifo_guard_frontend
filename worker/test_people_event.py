#!/usr/bin/env python3
"""
Test PeopleDetection event push dari kamera VIGI C240.
"""

import logging
from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)

from vigi_client import VigiClient
from event_subscriber import EventSubscriber
from config import VIGI_HOST, VIGI_PORT, VIGI_USER, VIGI_PASS

print(f"[test] Connecting to VIGI camera at {VIGI_HOST}:{VIGI_PORT}")

client = VigiClient(host=VIGI_HOST, port=VIGI_PORT, username=VIGI_USER, password=VIGI_PASS)
client.login()
print("[test] Authenticated OK")

# Enable PeopleDetection
print("\n[test] Enabling PeopleDetection + push...")
client.enable_people_detection()
print("  OK — PeopleDetection enabled")

# Subscribe
print("\n[test] Subscribing ke PeopleDetection events...")
print("[test] Jalan di depan kamera. Ctrl+C untuk stop.")
print("[test] Heartbeat setiap 15s — kalau 'heartbeat' muncul berarti stream hidup.\n")

sub = EventSubscriber(client, events=["PeopleDetection"], heartbeat=15)

event_count = 0
try:
    for event in sub.subscribe():
        event_count += 1
        print(f"\n  *** EVENT #{event_count}: {event} ***\n")
except KeyboardInterrupt:
    sub.stop()

print(f"\n[test] Done. {event_count} event(s) received.")
