"""Local web server for the Cosmic Watch browser app.

The server delivers the app's HTML, CSS, and JavaScript files, then forwards
requests to the two NASA/JPL APIs used by those files.
"""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import urlsplit
import json


# Resolve paths from this file so the server works correctly from any directory.
APP_DIRECTORY = Path(__file__).resolve().parent

# Do not accept arbitrarily large upstream responses.
MAX_UPSTREAM_RESPONSE_BYTES = 8 * 1024 * 1024

# Only these local API paths are allowed to reach JPL. Each path is mapped to
# the external service that provides the requested data.
UPSTREAMS = {
    "/api/sbdb_query.api": "https://ssd-api.jpl.nasa.gov/sbdb_query.api",
    "/api/horizons.api": "https://ssd.jpl.nasa.gov/api/horizons.api",
}


class CosmicWatchHandler(SimpleHTTPRequestHandler):
    """Serve Cosmic Watch files and proxy approved JPL API requests."""

    def __init__(self, *args, **kwargs):
        # Tell the built-in static file server to serve this app's directory.
        super().__init__(*args, directory=str(APP_DIRECTORY), **kwargs)

    def log_message(self, message_format, *args):
        # Keep long API query strings out of the server log.
        if args and isinstance(args[0], str):
            args = (args[0].split("?", 1)[0], *args[1:])
        super().log_message(message_format, *args)

    def do_GET(self):
        # Separate the URL path from its query parameters before handling it.
        parsed_path = urlsplit(self.path)
        upstream = UPSTREAMS.get(parsed_path.path)

        # Forward known API paths to JPL and preserve their query parameters.
        if upstream is not None:
            self.proxy_request(upstream, parsed_path.query)
            return

        # API paths that are not in the allowlist are reported as unavailable.
        if parsed_path.path.startswith("/api/"):
            self.send_error(404, "Unknown API route")
            return

        # Everything else is an ordinary static file or directory request.
        super().do_GET()

    def proxy_request(self, upstream, query):
        # Reject unusually large query strings before sending them to JPL.
        if len(query) > 8192:
            self.send_error(414, "API query is too long")
            return

        # Build the JPL URL, omitting the question mark when there is no query.
        url = f"{upstream}?{query}" if query else upstream
        request = Request(url, headers={"User-Agent": "Cosmic-Watch/1.0"})
        try:
            # JPL requests can take time, so allow up to 30 seconds.
            with urlopen(request, timeout=30) as response:
                body = response.read(MAX_UPSTREAM_RESPONSE_BYTES + 1)
                content_type = response.headers.get("Content-Type", "application/json")
                status = response.status
        except HTTPError as error:
            # Preserve JPL's HTTP status and response body for browser-side errors.
            body = error.read(MAX_UPSTREAM_RESPONSE_BYTES + 1)
            content_type = error.headers.get("Content-Type", "application/json")
            status = error.code
        except (TimeoutError, URLError) as error:
            # A timeout or network failure is reported as a bad gateway.
            self.send_json_error(502, f"JPL request failed: {error}")
            return

        # Stop oversized responses here instead of passing them to the browser.
        if len(body) > MAX_UPSTREAM_RESPONSE_BYTES:
            self.send_json_error(502, "JPL response exceeded the allowed size")
            return

        # Return the original JPL status and content type to the browser.
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_json_error(self, status, message):
        # Send errors in a consistent JSON format for the browser app.
        body = json.dumps({"error": message}).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    # Start a threaded server on localhost; it is not intended for public use.
    server = ThreadingHTTPServer(("127.0.0.1", 8000), CosmicWatchHandler)
    print("Cosmic Watch is running at http://127.0.0.1:8000/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Cosmic Watch.")
    finally:
        server.server_close()
