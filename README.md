# Cup

Private, password-unlocked iPhone bra-fit measurement app for Alissa.

## Current architecture

Cup is now **standalone**. There is no Google Sheet, Apps Script backend, Cloudflare service, database, or upload endpoint.

- `index.html` is only the password unlock screen.
- `cup.enc` is the AES-GCM encrypted Cup application.
- The password is not stored in this repository.
- After the correct password is entered, the app is decrypted in the browser for that session.
- Camera captures remain in browser memory only and disappear when the page is closed or reloaded.
- Measurements can optionally be saved to Safari local storage on that iPhone or exported manually as JSON.
- No Cup code intentionally uploads photographs or measurements anywhere.

## GitHub Pages deployment

Use GitHub Pages directly from this repository.

1. Repository Settings → Pages.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Branch: `main`.
4. Folder: `/ (root)`.
5. Save.

The resulting Pages URL will be publicly reachable, but the application payload itself is encrypted. A visitor without the password receives only the unlock screen and encrypted ciphertext.

## Password / encryption

The current encrypted payload uses:

- AES-256-GCM
- PBKDF2-SHA256
- 600,000 PBKDF2 iterations
- random salt and IV

Changing the password requires re-encrypting the application and replacing `cup.enc`.

## Privacy notes

No internet-hosted application can promise literally zero risk. This design avoids storing intimate photographs on GitHub or a backend and removes all measurement-upload functionality.

The automatic body-analysis runtime is currently downloaded from jsDelivr and the MediaPipe pose model from Google storage. Those services receive normal web-request metadata such as IP address and browser information, but Cup does not send the captured images to them. The pose analysis itself runs in the browser.

For even stricter isolation, the MediaPipe runtime/model can later be vendored into the repository so the unlocked app makes no third-party model requests.
