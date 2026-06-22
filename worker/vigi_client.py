"""
VIGI Camera OpenAPI client — Python port of backend/services/vigi/vigiAuth.js
Handles doAuth SHA-256 two-step authentication and authenticated API calls.
"""

import hashlib
import logging
import ssl
import urllib3
import requests
from requests.adapters import HTTPAdapter

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


class _LegacyTLSAdapter(HTTPAdapter):
    """Allow TLS 1.0/1.1/1.2 for VIGI cameras with old firmware."""
    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        ctx.minimum_version = ssl.TLSVersion.TLSv1
        kwargs["ssl_context"] = ctx
        return super().init_poolmanager(*args, **kwargs)


class VigiClient:
    def __init__(self, host: str, port: int = 20443, username: str = "admin", password: str = ""):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.stok = None
        self.base_url = f"https://{host}:{port}"
        self._session = requests.Session()
        self._session.verify = False
        self._session.mount("https://", _LegacyTLSAdapter())

    def _post(self, path: str, body: dict, timeout: int = 10, retries: int = 3) -> dict:
        for attempt in range(retries):
            try:
                res = self._session.post(
                    f"{self.base_url}{path}",
                    json=body,
                    timeout=timeout,
                    headers={"Connection": "close"},
                )
                return res.json()
            except requests.exceptions.ConnectionError as e:
                if attempt < retries - 1:
                    wait = 2 * (attempt + 1)
                    logger.warning(f"[vigi] connection error, retry {attempt+1}/{retries} in {wait}s: {e}")
                    import time
                    time.sleep(wait)
                    self._session.close()
                    self._session = requests.Session()
                    self._session.verify = False
                    self._session.mount("https://", _LegacyTLSAdapter())
                else:
                    raise

    def login(self) -> str:
        challenge = self._post("/", {"method": "doAuth", "params": None})

        auth_info = challenge.get("authenticate")
        if not auth_info:
            raise RuntimeError(f"VIGI challenge failed: {challenge}")

        realm = auth_info["realm"]
        nonce = auth_info["nonce"]
        algorithm = auth_info["algorithm"]
        uri = auth_info["uri"]
        method = auth_info["method"]

        if algorithm != "SHA-256":
            raise RuntimeError(f"Unsupported algorithm: {algorithm}")

        a1 = _sha256(f"{self.username}:{realm}:{self.password}")
        a2 = _sha256(f"{method}:{uri}")
        response = _sha256(f"{a1}:{nonce}:{a2}")

        result = self._post("/", {
            "method": "doAuth",
            "params": {"nonce": nonce, "response": response},
        })

        if result.get("errCode") != 0 or not result.get("stok"):
            raise RuntimeError(f"VIGI login failed: errCode={result.get('errCode')}")

        self.stok = result["stok"]
        logger.info(f"[vigi] authenticated, stok={self.stok[:8]}...")
        return self.stok

    def call(self, method: str, params: dict = None, _retry: bool = False) -> dict:
        if not self.stok:
            self.login()

        res = self._session.post(
            f"{self.base_url}/stok={self.stok}",
            json={"method": method, "params": params or {}},
            timeout=10,
        )
        data = res.json()

        if data.get("errCode") == -10020 and not _retry:
            logger.info("[vigi] stok expired, re-authenticating...")
            self.stok = None
            self.login()
            return self.call(method, params, _retry=True)

        return data

    def enable_people_detection(self, sensitivity: int = 50, push_interval: int = 15):
        # Set push interval FIRST — same as backend index.js line 101
        try:
            interval_result = self.call("setMsgpushInterval", {"event_interval": push_interval})
            logger.info(f"[vigi] setMsgpushInterval={push_interval}s: errCode={interval_result.get('errCode')}")
        except Exception as e:
            logger.warning(f"[vigi] setMsgpushInterval failed (non-fatal): {e}")

        current = self.call("getPeopleDetectionSwitch")
        logger.info(f"[vigi] current PeopleDetection: {current}")

        params = current.get("result", {})
        params["enabled"] = "on"
        params["msg_push_enabled"] = "on"
        params["sensitivity"] = sensitivity

        result = self.call("setPeopleDetectionSwitch", params)
        err = result.get("errCode")
        if err != 0:
            raise RuntimeError(
                f"setPeopleDetectionSwitch failed: errCode={err}. "
                "Camera may not support PeopleDetection — check getEventEnhanceCapability."
            )
        logger.info("[vigi] PeopleDetection enabled + push on")

        cap = self.call("getEventEnhanceCapability")
        logger.info(f"[vigi] getEventEnhanceCapability: {cap}")
        return result
