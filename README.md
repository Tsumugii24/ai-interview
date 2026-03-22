## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in `.env` to your Gemini API key
3. Run the app:
   `npm run dev`

---

## Deploy to Remote Server

When deploying to a remote server (e.g. Linux cloud server), there are two important requirements to be aware of:

### 1. HTTPS / Secure Context Required

The app uses browser APIs (`navigator.mediaDevices`) for camera and microphone access. These APIs are only available in **Secure Contexts**:

- `https://` connections
- `localhost` / `127.0.0.1`

If you access the app via plain `http://<server-ip>`, the camera and microphone will not work. Choose one of the following solutions:

#### Solution A: Chrome Insecure Origin Flag (Quick, for personal use)

1. In Chrome, navigate to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
2. Enter your server address, e.g. `http://123.45.67.89:5005`
3. Set to **Enabled** and restart Chrome

> ⚠️ This only applies to your own browser. Each user needs to configure this manually.

#### Solution B: Reverse Proxy with Auto HTTPS via Caddy (Recommended for production)

Install [Caddy](https://caddyserver.com/) on your server. It automatically provisions and renews TLS certificates:

```
your-domain.com {
    reverse_proxy localhost:5005
}
```

> Requires a domain name pointing to your server IP.

#### Solution C: Nginx + Self-Signed Certificate (No domain needed)

```bash
# Generate a self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/self-signed.key \
  -out /etc/ssl/certs/self-signed.crt
```

Then configure Nginx to reverse proxy to port 5005 with SSL. Users will see a browser security warning on first visit and need to click "Proceed" to continue.

### 2. Gemini API Region Restrictions

The Gemini Live API WebSocket connection is made **directly from the user's browser** to Google's servers. Google restricts access based on the user's IP location.

If you see the error:

```
Session closed. Code: 1007 Reason: User location is not supported for the API use.
```

This means the user's network is in an unsupported region. To resolve this:

- **Use a VPN/proxy on the client side** so that the browser's outbound IP is in a supported region (e.g. US, Japan, etc.)
- Note: this restriction applies to the **browser's network**, not the server's. Even if your server is in a supported region, the user still needs a supported network because the WebSocket connects directly from the browser.
