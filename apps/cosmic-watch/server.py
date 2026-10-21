from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import urlsplit
import json


APP_DIRECTORY = Path(__file__).resolve().parent
MAX_UPSTREAM_RESPONSE_BYTES = 8 * 1024 * 1024
UPSTREAMS = {
    "/api/sbdb_query.api": "https://ssd-api.jpl.nasa.gov/sbdb_query.api",
    "/api/horizons.api": "https://ssd.jpl.nasa.gov/api/horizons.api",
}


class CosmicWatchHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_DIRECTORY), **kwargs)

    def log_message(self, message_format, *args):
        if args and isinstance(args[0], str):
            args = (args[0].split("?", 1)[0], *args[1:])
        super().log_message(message_format, *args)

    def do_GET(self):
        parsed_path = urlsplit(self.path)
        upstream = UPSTREAMS.get(parsed_path.path)
        if upstream is not None:
            self.proxy_request(upstream, parsed_path.query)
            return
        if parsed_path.path.startswith("/api/"):
            self.send_error(404, "Unknown API route")
            return
        super().do_GET()

    def proxy_request(self, upstream, query):
        if len(query) > 8192:
            self.send_error(414, "API query is too long")
            return

        url = f"{upstream}?{query}" if query else upstream
        request = Request(url, headers={"User-Agent": "Cosmic-Watch/1.0"})
        try:
            with urlopen(request, timeout=30) as response:
                body = response.read(MAX_UPSTREAM_RESPONSE_BYTES + 1)
                content_type = response.headers.get("Content-Type", "application/json")
                status = response.status
        except HTTPError as error:
            body = error.read(MAX_UPSTREAM_RESPONSE_BYTES + 1)
            content_type = error.headers.get("Content-Type", "application/json")
            status = error.code
        except (TimeoutError, URLError) as error:
            self.send_json_error(502, f"JPL request failed: {error}")
            return

        if len(body) > MAX_UPSTREAM_RESPONSE_BYTES:
            self.send_json_error(502, "JPL response exceeded the allowed size")
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
    server = ThreadingHTTPServer(("127.0.0.1", 8000), CosmicWatchHandler)
    print("Cosmic Watch is running at http://127.0.0.1:8000/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Cosmic Watch.")
    finally:
        server.server_close()
