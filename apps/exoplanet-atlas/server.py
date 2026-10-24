from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen
import json


APP_DIRECTORY = Path(__file__).resolve().parent
MAX_UPSTREAM_RESPONSE_BYTES = 8 * 1024 * 1024
EXOPLANET_QUERY = """
SELECT hostname, sy_dist, st_spectype, st_teff, pl_name, pl_rade,
       pl_bmasse, pl_orbper, pl_eqt, pl_dens, pl_insol, pl_orbsmax
FROM pscomppars
WHERE sy_dist IS NOT NULL AND sy_dist > 0
ORDER BY sy_dist ASC
"""
EXOPLANET_ARCHIVE_URL = (
    "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?"
    + urlencode({"query": EXOPLANET_QUERY, "format": "json"})
)


class ExoplanetAtlasHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_DIRECTORY), **kwargs)

    def do_GET(self):
        request_path = urlsplit(self.path).path
        if request_path == "/api/exoplanets":
            self.proxy_exoplanet_query()
            return
        if request_path.startswith("/api/"):
            self.send_error(404, "Unknown API route")
            return
        super().do_GET()

    def proxy_exoplanet_query(self):
        request = Request(
            EXOPLANET_ARCHIVE_URL,
            headers={"User-Agent": "Project-Stargate-Exoplanet-Atlas/1.0"},
        )
        try:
            with urlopen(request, timeout=45) as response:
                body = response.read(MAX_UPSTREAM_RESPONSE_BYTES + 1)
                content_type = response.headers.get("Content-Type", "application/json")
                status = response.status
        except HTTPError as error:
            body = error.read(MAX_UPSTREAM_RESPONSE_BYTES + 1)
            content_type = error.headers.get("Content-Type", "application/json")
            status = error.code
        except (TimeoutError, URLError) as error:
            self.send_json_error(502, "NASA Exoplanet Archive request failed: {}".format(error))
            return

        if len(body) > MAX_UPSTREAM_RESPONSE_BYTES:
            self.send_json_error(502, "NASA Exoplanet Archive response exceeded the allowed size")
            return

        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_json_error(self, status, message):
        body = json.dumps({"error": message}).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8000), ExoplanetAtlasHandler)
    print("Exoplanet Atlas is running at http://127.0.0.1:8000/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Exoplanet Atlas.")
    finally:
        server.server_close()
