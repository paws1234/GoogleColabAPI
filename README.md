# Prompt Chat

A browser-based chat client for the OpenAI-compatible chat-completions API used by `pytest.py`. Run the app in Docker so Python and its dependencies do not need to be installed on your computer.

## Start

Install and start Docker Desktop (or Docker Engine with the Compose plugin), then run from this folder:

```sh
docker compose up --build
```

Open [http://localhost:8000](http://localhost:8000). Stop the app with `Ctrl+C`; run `docker compose down` to remove its container.

The default API URL is the one previously configured in `pytest.py`. To use a different compatible endpoint, set `API_URL` before starting:

```sh
API_URL=https://your-api.example/v1/chat/completions docker compose up --build
```

The browser session has a recent-chat list and a **New chat** button (also `Ctrl+K` / `⌘K`). Use **Settings** in the top bar to change the API endpoint; the selection is stored in that browser. To restore the configured endpoint, choose **Use default** and save. API URLs must use HTTP or HTTPS and resolve only to public IP addresses.

Conversations are kept in memory while the page remains open and are sent to the API as chat context.
