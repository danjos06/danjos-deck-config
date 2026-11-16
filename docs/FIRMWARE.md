# Danjos Deck v2 - Firmware

The app (Export > `.ino`) generates `danjos_deck_firmware.ino` for an **ESP32-S3** using the
**arduino-esp32 core 3.x** and native USB (TinyUSB HID keyboard + consumer control + mouse).

## Arduino IDE settings

| Setting | Value |
|---|---|
| Board | ESP32S3 Dev Module (or your S3 board) |
| USB Mode | **USB-OTG (TinyUSB)** (the sketch stops with `#error` otherwise) |
| USB CDC On Boot | **Enabled** (Serial is the sync/debug port, 115200) |
| Partition Scheme | any scheme with a data partition (e.g. "Default 4MB with spiffs"); the sketch uses LittleFS |
| Core | `esp32` by Espressif, **3.x** |

## Libraries

- Library Manager: **Adafruit SSD1306** and **Adafruit GFX Library** (accept the dependency prompts).
- Everything else comes with the core: `USB`, `USBHIDKeyboard/ConsumerControl/Mouse`, `Wire`, `LittleFS`,
  `WiFi`, `WebServer`, `ESPmDNS`, `ArduinoOTA`, `ping/ping_sock.h`.

## Flashing

1. In the app, fill Wi-Fi SSID/password (optional), hostname, pins and PC IP, then **Export** the `.ino`.
2. Open it in the Arduino IDE, apply the settings above, select the port (hold BOOT + tap RESET if the board
   is not listed) and **Upload**. Later updates can be sent over Wi-Fi (ArduinoOTA, hostname = `<hostname>.local`).

Credentials are compiled into the sketch only; there are no defaults. Empty SSID = Wi-Fi code is skipped.

## First boot

- Every screen shows its **compiled default bitmap** (or a border + key number if the key had none); actions,
  macros, folders and pages come from **compiled defaults**, so a freshly flashed board works with no sync.
- With Wi-Fi configured, the screens show the IP for 2 s once connected (also after every reconnect). The
  device is also reachable as `http://<hostname>.local/`. Wi-Fi reconnects automatically (non-blocking).
- A sync (`CLEAR` ... `SAVE`) writes `/config.txt`, `/pins.txt` and `/b_<key>_<page>.bin` to LittleFS. From then on
  those files win; a bitmap file is used only if it is exactly 1024 bytes, otherwise the compiled default is shown.
- **Baked at flash time** (keyed by key + page index, re-flash after changing): `text` actions, `cpp` actions and the
  default bitmaps. Encoders use slots 6..11 on page 0.

## Behaviour notes

- Inputs: 25 ms lock-out debounce on every pin, action fires on the falling edge (active LOW, `INPUT_PULLUP`).
  Prev/next skip folder pages. `back` goes to the page index stored in the action (parent), else page 0.
- Encoders: 4-state quadrature decoder, one action per detent. `ENC_STEPS_PER_DETENT` (default 4, typical KY-040)
  is a `#define` near the top; use 2 or 1 for encoders with fewer transitions per detent. Direction convention is the
  legacy one (CLK rising edge while DT is low = clockwise = slots 6 / 9).
- Macros are **blocking** (max 10 steps): HTTP, serial and inputs pause while one runs.
- PC ping: if a PC IP is set, an ICMP echo is sent every 60 s (non-blocking, esp_ping callbacks); no reply turns the
  screens off and ignores keys. Skipped when the PC IP is empty.
- Sync watchdog: if the device stays in sync mode for 60 s without any command/upload it behaves like `SAVE`
  (prints `SYNC_TIMEOUT`), so a failed sync can no longer freeze it.
- Pin changes (`P` lines) are read from `/pins.txt` at **boot**; reset the board after syncing pins.

## Protocol summary

Same line protocol over **Serial (115200, `\n` terminated)** and **HTTP `POST /command`** (`text/plain`, one line, trimmed).
Serial replies: `OK` for every accepted command, `READY`/`OK`/`ERROR` for `BITMAP`. HTTP always answers `OK`
(`400 EMPTY` for an empty body). Unknown commands are ignored.

| Command | Meaning |
|---|---|
| `CLEAR` | enter sync mode, delete every file in LittleFS |
| `PAGES <n>` | number of pages (1..8) |
| `FOLDER <page> 1` | mark a page as folder (skipped by prev/next) |
| `PCIP <ip>` | PC address for the ping power-save |
| `P <id> <value>` | pin / hardware value, appended to `/pins.txt`, applied at boot |
| `ACT <b> <p> <type> <mod> <key> <v1> <v2>` | action (b 0..11, p 0..7); types 0 none, 1 key, 2 consumer, 3 mouse, 4 macro, 5 folder, 6 back |
| `SEQ <b> <p> <step> <type> <mod> <key> <v1> <v2> <delayMs>` | macro step (0..9); step type 4 = delay |
| `BITMAP <b> <p>` | Serial only: device answers `READY`, host sends 1024 raw bytes, device answers `OK`/`ERROR` |
| `SAVE` | leave sync mode, reload `/config.txt`, redraw |

`P` ids: `0..5` buttons, `6` prev, `7` next, `8/9/10` enc1 CLK/DT/SW, `11/12/13` enc2 CLK/DT/SW, `14` SDA, `15` SCL,
**new:** `16` mux address, `17` OLED address, `18..23` mux channel of screen 0..5. Unknown ids are ignored; `-1` disables a pin.

HTTP routes: `GET /` (HTML containing "Danjos Deck"), `POST /command`, `POST /upload` (multipart, field `file`, only
`b_[0-5]_[0-7].bin` of exactly 1024 bytes or `config.json`; anything else answers `400 BAD_UPLOAD`), and new
`GET /info` returning

```json
{"name":"Danjos Deck","fw":"2.0.0","pages":1,"page":0,"ip":"192.168.0.50","screensOn":true}
```

CORS is enabled (`Access-Control-Allow-Origin: *`).

## Compatibility notes

- Legacy key codes were verified against `USBHIDKeyboard.h` / `USBHIDConsumerControl.h` of arduino-esp32.
- `HID_KEY_APPLICATION` (0x65) is the legacy value and types the letter `e`; use `KEY_MENU` (0xED) for the Menu key.
- Mouse X/Y and scroll are 8-bit (-127..127).
