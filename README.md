# Discord Status Manager

An Android app for setting a fully custom Discord Rich Presence (RPC) status — with support for keeping it live 24/7, even when the app or Discord isn't open.

## Features

-  **Custom RPC text** — set your own details and state text
-  **Custom images/icons** — large and small image assets for your status
-  **Custom buttons** — add clickable links to your status
-  **Timestamps** — show elapsed or remaining time
-  **24/7 uptime** — status stays live via a server, even when the app is closed
-  **Login with Discord token**
-  **No problem with 2FA authentication while logging in**

## Installation

1. Go to the [Releases](https://github.com/Haruki9767/Discord-status-manager/releases/) page
2. Download the latest APK
3. Install it on your Android device (you may need to allow installs from unknown sources)

## Usage

1. Open the app and log in with your Discord token
2. Configure your custom status — text, images, buttons, and timestamps
3. Enable the always-on server option if you want your status to stay live without keeping the app open

> ⚠️ **Note on Discord tokens:** Using a self-bot or automating your account through your personal token is against Discord's Terms of Service and carries a risk of account action. Use at your own discretion.

## Web Version-

https://discord-activity.cc.cd/

## Building from source

This is a standard Gradle-based Android project.

```bash
git clone https://github.com/Haruki9767/Discord-status-manager.git
cd Discord-status-manager
./gradlew assembleDebug
```

The built APK will be output under `app/build/outputs/apk/`.

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request with improvements or bug fixes.

## License

This project is **source-available**, not open source. You're free to view the code, build it for personal use, and submit contributions — but redistribution, forking, and commercial use are not permitted without written permission. See [LICENSE](LICENSE.md) for full terms.
