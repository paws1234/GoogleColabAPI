import ipaddress
import os
import socket
from urllib.parse import urlsplit

import requests
from flask import Flask, jsonify, render_template, request


API_URL = os.environ.get(
    "API_URL",
    "https://metal-masks-peel.loca.lt/v1/chat/completions",
)
API_HEADERS = {"Bypass-Tunnel-Reminder": "true"}

app = Flask(__name__, static_folder="public/static", static_url_path="/static")


def validate_api_url(api_url):
    if not isinstance(api_url, str) or not api_url or len(api_url) > 2048:
        raise ValueError("Enter a valid API URL.")

    try:
        parsed = urlsplit(api_url)
        hostname = parsed.hostname
        port = parsed.port
    except ValueError as error:
        raise ValueError("Enter a valid API URL.") from error

    if (
        parsed.scheme not in {"http", "https"}
        or not hostname
        or parsed.username
        or parsed.password
        or parsed.fragment
    ):
        raise ValueError("Use an HTTP or HTTPS URL without credentials or a fragment.")

    try:
        address = ipaddress.ip_address(hostname)
        addresses = [address]
    except ValueError:
        try:
            addresses = [
                ipaddress.ip_address(info[4][0])
                for info in socket.getaddrinfo(hostname, port or (443 if parsed.scheme == "https" else 80))
            ]
        except OSError as error:
            raise ValueError("The API hostname could not be resolved.") from error

    if not addresses or any(not address.is_global for address in addresses):
        raise ValueError("API URLs must resolve only to public IP addresses.")

    return api_url


@app.get("/")
def index():
    return render_template("index.html", default_api_url=API_URL)


@app.post("/api/chat")
def chat():
    data = request.get_json(silent=True)
    messages = data.get("messages") if isinstance(data, dict) else None
    api_url = data.get("api_url", API_URL) if isinstance(data, dict) else API_URL

    if not isinstance(messages, list) or not messages:
        return jsonify(error="Send valid JSON with at least one chat message."), 400

    try:
        validate_api_url(api_url)
    except ValueError as error:
        return jsonify(error=str(error)), 400

    for message in messages:
        if (
            not isinstance(message, dict)
            or message.get("role") not in {"user", "assistant"}
            or not isinstance(message.get("content"), str)
            or not message["content"].strip()
        ):
            return (
                jsonify(error="Each message needs a user or assistant role and non-empty text."),
                400,
            )

    try:
        response = requests.post(
            api_url,
            json={
                "messages": messages,
                "max_tokens": 2048,
                "temperature": 0.7,
            },
            headers=API_HEADERS,
            timeout=60,
            allow_redirects=False,
        )
        if 300 <= response.status_code < 400:
            return jsonify(error="The chat API redirected. Update the API URL to the final endpoint."), 502
        response.raise_for_status()
    except requests.RequestException as error:
        return jsonify(error=f"Could not reach the chat API: {error}"), 502

    try:
        result = response.json()
        reply = result["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError):
        return jsonify(error="The chat API returned an invalid response."), 502

    if not isinstance(reply, str) or not reply.strip():
        return jsonify(error="The chat API returned an empty response."), 502

    return jsonify(reply=reply)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
