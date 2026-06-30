import { DanjosDeckConfig, ButtonAction, ActionType } from './types';

export const generateFirmware = (config: DanjosDeckConfig, ssid: string = '', password: string = '') => {
  const pins = config.pins;

  // Helper to generate embedded C++ code for buttons
  const generateEmbeddedActions = () => {
    let code = '';
    config.pages.forEach((page, pIdx) => {
      page.buttons.forEach((btn, bIdx) => {
        if (btn.action.type === 'cpp' && btn.action.cpp) {
          code += `if (b == ${bIdx} && p == ${pIdx}) {\n${btn.action.cpp.code}\nreturn;\n}\n`;
        } else if (btn.action.type === 'text' && btn.action.text) {
          code += `if (b == ${bIdx} && p == ${pIdx}) {\nKeyboard.print("${btn.action.text.replace(/"/g, '\\"')}");\nreturn;\n}\n`;
        }
      });
    });
    // Encoder actions
    if (config.encoder1.cwAction.type === 'cpp' && config.encoder1.cwAction.cpp) code += `if (b == 6 && p == 0) {\n${config.encoder1.cwAction.cpp.code}\nreturn;\n}\n`;
    else if (config.encoder1.cwAction.type === 'text' && config.encoder1.cwAction.text) code += `if (b == 6 && p == 0) {\nKeyboard.print("${config.encoder1.cwAction.text.replace(/"/g, '\\"')}");\nreturn;\n}\n`;
    
    if (config.encoder1.ccwAction.type === 'cpp' && config.encoder1.ccwAction.cpp) code += `if (b == 7 && p == 0) {\n${config.encoder1.ccwAction.cpp.code}\nreturn;\n}\n`;
    else if (config.encoder1.ccwAction.type === 'text' && config.encoder1.ccwAction.text) code += `if (b == 7 && p == 0) {\nKeyboard.print("${config.encoder1.ccwAction.text.replace(/"/g, '\\"')}");\nreturn;\n}\n`;
    
    if (config.encoder1.btnAction.type === 'cpp' && config.encoder1.btnAction.cpp) code += `if (b == 8 && p == 0) {\n${config.encoder1.btnAction.cpp.code}\nreturn;\n}\n`;
    else if (config.encoder1.btnAction.type === 'text' && config.encoder1.btnAction.text) code += `if (b == 8 && p == 0) {\nKeyboard.print("${config.encoder1.btnAction.text.replace(/"/g, '\\"')}");\nreturn;\n}\n`;
    
    if (config.encoder2.cwAction.type === 'cpp' && config.encoder2.cwAction.cpp) code += `if (b == 9 && p == 0) {\n${config.encoder2.cwAction.cpp.code}\nreturn;\n}\n`;
    else if (config.encoder2.cwAction.type === 'text' && config.encoder2.cwAction.text) code += `if (b == 9 && p == 0) {\nKeyboard.print("${config.encoder2.cwAction.text.replace(/"/g, '\\"')}");\nreturn;\n}\n`;
    
    if (config.encoder2.ccwAction.type === 'cpp' && config.encoder2.ccwAction.cpp) code += `if (b == 10 && p == 0) {\n${config.encoder2.ccwAction.cpp.code}\nreturn;\n}\n`;
    else if (config.encoder2.ccwAction.type === 'text' && config.encoder2.ccwAction.text) code += `if (b == 10 && p == 0) {\nKeyboard.print("${config.encoder2.ccwAction.text.replace(/"/g, '\\"')}");\nreturn;\n}\n`;
    
    if (config.encoder2.btnAction.type === 'cpp' && config.encoder2.btnAction.cpp) code += `if (b == 11 && p == 0) {\n${config.encoder2.btnAction.cpp.code}\nreturn;\n}\n`;
    else if (config.encoder2.btnAction.type === 'text' && config.encoder2.btnAction.text) code += `if (b == 11 && p == 0) {\nKeyboard.print("${config.encoder2.btnAction.text.replace(/"/g, '\\"')}");\nreturn;\n}\n`;

    return code;
  };

  return `
#include <Arduino.h>
#include "USB.h"
#include "USBHIDKeyboard.h"
#include "USBHIDConsumerControl.h"
#include "USBHIDMouse.h"
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <LittleFS.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoOTA.h>
#include "ping/ping_sock.h"

// --- PINS (Hardcoded Defaults) ---
int PIN_BTN[6] = {
  \${pins?.btn1Enabled !== false ? (pins?.btn1 ?? 1) : -1}, 
  \${pins?.btn2Enabled !== false ? (pins?.btn2 ?? 2) : -1}, 
  \${pins?.btn3Enabled !== false ? (pins?.btn3 ?? 3) : -1}, 
  \${pins?.btn4Enabled !== false ? (pins?.btn4 ?? 4) : -1}, 
  \${pins?.btn5Enabled !== false ? (pins?.btn5 ?? 5) : -1}, 
  \${pins?.btn6Enabled !== false ? (pins?.btn6 ?? 6) : -1}
};
int PIN_PREV = \${pins?.btnPrevEnabled !== false ? (pins?.btnPrev ?? 7) : -1};
int PIN_NEXT = \${pins?.btnNextEnabled !== false ? (pins?.btnNext ?? 15) : -1};
int PIN_ENC1_CLK = \${pins?.enc1Enabled !== false ? (pins?.enc1Clk ?? 16) : -1};
int PIN_ENC1_DT = \${pins?.enc1Enabled !== false ? (pins?.enc1Dt ?? 17) : -1};
int PIN_ENC1_BTN = \${pins?.enc1Enabled !== false ? (pins?.enc1Btn ?? 18) : -1};
int PIN_ENC2_CLK = \${pins?.enc2Enabled !== false ? (pins?.enc2Clk ?? 20) : -1};
int PIN_ENC2_DT = \${pins?.enc2Enabled !== false ? (pins?.enc2Dt ?? 21) : -1};
int PIN_ENC2_BTN = \${pins?.enc2Enabled !== false ? (pins?.enc2Btn ?? 41) : -1};
int PIN_SDA = \${pins ? pins.sda : 8};
int PIN_SCL = \${pins ? pins.scl : 9};

// --- DISPLAY SETTINGS ---
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define TCAADDR 0x70

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
USBHIDKeyboard Keyboard;
USBHIDConsumerControl Consumer;
USBHIDMouse Mouse;
WebServer server(80);

// --- STATE ---
int currentPage = 0;
int totalPages = 1;
bool isSyncing = false;

const char* wifi_ssid = "\${ssid}";
const char* wifi_password = "\${password}";
String pc_ip = "${config.pcIp || ''}";
bool screensOn = true;
unsigned long lastPingTime = 0;
const unsigned long PING_INTERVAL = 60000; // 1 minute
bool last_ping_result = false;

static void my_ping_success(esp_ping_handle_t hdl, void *args) {
  last_ping_result = true;
}

static void my_ping_timeout(esp_ping_handle_t hdl, void *args) {
  last_ping_result = false;
}

bool pingIP(const String& ip_str) {
  if (ip_str == "") return false;
  IPAddress ip;
  if (!ip.fromString(ip_str)) return false;
  
  ip_addr_t target_addr;
  IP_ADDR4(&target_addr, ip[0], ip[1], ip[2], ip[3]);
  
  esp_ping_config_t ping_config = ESP_PING_DEFAULT_CONFIG();
  ping_config.target_addr = target_addr;
  ping_config.count = 1;
  
  esp_ping_callbacks_t cbs = {
    .on_ping_success = my_ping_success,
    .on_ping_timeout = my_ping_timeout,
    .on_ping_end = NULL,
    .cb_args = NULL
  };
  
  last_ping_result = false;
  esp_ping_handle_t ping_handle;
  if (esp_ping_new_session(&ping_config, &cbs, &ping_handle) == ESP_OK) {
    esp_ping_start(ping_handle);
    delay(100);
    esp_ping_stop(ping_handle);
    esp_ping_delete_session(ping_handle);
  }
  return last_ping_result;
}

void updateDisplays();

void setDisplaysOn(bool on) {
  if (screensOn == on) return;
  screensOn = on;
  for (int i = 0; i < 6; i++) {
    tcaselect(i);
    if (on) {
      display.ssd1306_command(SSD1306_DISPLAYON);
    } else {
      display.ssd1306_command(SSD1306_DISPLAYOFF);
    }
  }
  if (on) {
    updateDisplays();
  }
}

struct Action {
  uint8_t type; // 0=none, 1=kb, 2=cons, 3=mouse, 4=seq, 5=cpp
  uint8_t mod;
  uint16_t key;
  int16_t val1; // for mouse x/scroll
  int16_t val2; // for mouse y
};

struct Step {
  uint8_t type;
  uint8_t mod;
  uint16_t key;
  int16_t val1;
  int16_t val2;
  uint16_t delayMs;
};

Action actions[12][8]; // 6 buttons + 2 encoders(3 each) = 12 total, max 8 pages
Step macros[12][8][10]; // Max 10 steps per macro
uint8_t macroLen[12][8];

bool lastBtnState[6] = {HIGH, HIGH, HIGH, HIGH, HIGH, HIGH};
bool lastPrevState = HIGH;
bool lastNextState = HIGH;

int lastClk1 = HIGH;
bool lastBtnState1 = HIGH;
int lastClk2 = HIGH;
bool lastBtnState2 = HIGH;

void tcaselect(uint8_t i) {
  if (i > 7) return;
  Wire.beginTransmission(TCAADDR);
  Wire.write(1 << i);
  Wire.endTransmission();
}

void loadPins() {
  File f = LittleFS.open("/pins.txt", "r");
  if (!f) return;
  while(f.available()) {
    String line = f.readStringUntil('\\n');
    line.trim();
    if (line.startsWith("P ")) {
      int id = line.substring(2, line.indexOf(' ', 2)).toInt();
      int val = line.substring(line.lastIndexOf(' ') + 1).toInt();
      switch(id) {
        case 0: PIN_BTN[0]=val; break;
        case 1: PIN_BTN[1]=val; break;
        case 2: PIN_BTN[2]=val; break;
        case 3: PIN_BTN[3]=val; break;
        case 4: PIN_BTN[4]=val; break;
        case 5: PIN_BTN[5]=val; break;
        case 6: PIN_PREV=val; break;
        case 7: PIN_NEXT=val; break;
        case 8: PIN_ENC1_CLK=val; break;
        case 9: PIN_ENC1_DT=val; break;
        case 10: PIN_ENC1_BTN=val; break;
        case 11: PIN_ENC2_CLK=val; break;
        case 12: PIN_ENC2_DT=val; break;
        case 13: PIN_ENC2_BTN=val; break;
        case 14: PIN_SDA=val; break;
        case 15: PIN_SCL=val; break;
      }
    }
  }
  f.close();
}

void loadConfig() {
  totalPages = 1;
  memset(actions, 0, sizeof(actions));
  memset(macroLen, 0, sizeof(macroLen));
  pc_ip = "${config.pcIp || ''}";

  File f = LittleFS.open("/config.txt", "r");
  if (!f) return;
  while (f.available()) {
    String line = f.readStringUntil('\\n');
    line.trim();
    if (line.startsWith("PAGES ")) {
      totalPages = line.substring(6).toInt();
    } else if (line.startsWith("PCIP ")) {
      pc_ip = line.substring(5);
      pc_ip.trim();
    } else if (line.startsWith("ACT ")) {
      // ACT <b> <p> <t> <m> <k> <v1> <v2>
      int b, p, t, m, k, v1, v2;
      sscanf(line.c_str(), "ACT %d %d %d %d %d %d %d", &b, &p, &t, &m, &k, &v1, &v2);
      if (b < 12 && p < 8) {
        actions[b][p] = { (uint8_t)t, (uint8_t)m, (uint16_t)k, (int16_t)v1, (int16_t)v2 };
      }
    } else if (line.startsWith("SEQ ")) {
      // SEQ <b> <p> <s> <t> <mod> <k> <v1> <v2> <d>
      int b, p, s, t, mod, k, v1, v2, d;
      sscanf(line.c_str(), "SEQ %d %d %d %d %d %d %d %d %d", &b, &p, &s, &t, &mod, &k, &v1, &v2, &d);
      if (b < 12 && p < 8 && s < 10) {
        macros[b][p][s] = { (uint8_t)t, (uint8_t)mod, (uint16_t)k, (int16_t)v1, (int16_t)v2, (uint16_t)d };
        if (s + 1 > macroLen[b][p]) macroLen[b][p] = s + 1;
      }
    }
  }
  f.close();
}

void updateDisplays() {
  if (isSyncing) return;
  for (int i = 0; i < 6; i++) {
    tcaselect(i);
    display.clearDisplay();
    String filename = "/b_" + String(i) + "_" + String(currentPage) + ".bin";
    File f = LittleFS.open(filename, "r");
    if (f) {
      uint8_t buf[1024];
      f.read(buf, 1024);
      display.drawBitmap(0, 0, buf, 128, 64, SSD1306_WHITE);
      f.close();
    } else {
      display.setTextSize(1);
      display.setTextColor(SSD1306_WHITE);
      display.setCursor(10, 28);
      display.print("No Image");
    }
    display.display();
  }
}

void runStep(uint8_t t, uint8_t m, uint16_t k, int16_t v1, int16_t v2) {
  if (t == 1) { // KB
    if (m & 1) Keyboard.press(KEY_LEFT_CTRL);
    if (m & 2) Keyboard.press(KEY_LEFT_SHIFT);
    if (m & 4) Keyboard.press(KEY_LEFT_ALT);
    if (m & 8) Keyboard.press(KEY_LEFT_GUI);
    if (m & 16) Keyboard.press(KEY_RIGHT_CTRL);
    if (m & 32) Keyboard.press(KEY_RIGHT_SHIFT);
    if (m & 64) Keyboard.press(KEY_RIGHT_ALT);
    if (m & 128) Keyboard.press(KEY_RIGHT_GUI);
    if (k > 0) Keyboard.press(k);
    delay(10);
    Keyboard.releaseAll();
  } else if (t == 2) { // CONS
    Consumer.press(k);
    Consumer.release();
  } else if (t == 3) { // MOUSE
    if (k == 1) Mouse.click(MOUSE_LEFT);
    else if (k == 2) Mouse.click(MOUSE_RIGHT);
    else if (k == 3) Mouse.click(MOUSE_MIDDLE);
    else if (k == 4) Mouse.move(v1, v2, 0);
    else if (k == 5) Mouse.move(0, 0, v1);
  }
}

void executeAction(int b, int p) {
  if (!screensOn) return;
  // Hardcoded C++ Actions
  ${generateEmbeddedActions()}

  Action a = actions[b][p];
  if (a.type == 4) { // Macro
    for (int i = 0; i < macroLen[b][p]; i++) {
      Step s = macros[b][p][i];
      if (s.type == 4) delay(s.delayMs); // Delay step
      else runStep(s.type, s.mod, s.key, s.val1, s.val2);
      if (s.delayMs > 0 && s.type != 4) delay(s.delayMs);
    }
  } else {
    runStep(a.type, a.mod, a.key, a.val1, a.val2);
  }
}

void processCommand(String cmd) {
  if (cmd == "CLEAR") {
    isSyncing = true;
    File root = LittleFS.open("/");
    File file = root.openNextFile();
    while(file){
      String fileName = String(file.name());
      if (!fileName.startsWith("/")) fileName = "/" + fileName;
      LittleFS.remove(fileName);
      file = root.openNextFile();
    }
    Serial.println("OK");
  } else if (cmd == "SAVE") {
    isSyncing = false;
    loadConfig();
    updateDisplays();
    Serial.println("OK");
  } else if (cmd.startsWith("ACT ") || cmd.startsWith("SEQ ") || cmd.startsWith("PAGES ") || cmd.startsWith("PCIP ")) {
    File f = LittleFS.open("/config.txt", "a");
    f.println(cmd);
    f.close();
    Serial.println("OK");
  } else if (cmd.startsWith("P ")) {
    File f = LittleFS.open("/pins.txt", "a");
    f.println(cmd);
    f.close();
    Serial.println("OK");
  } else if (cmd.startsWith("BITMAP ")) {
    int space1 = cmd.indexOf(' ', 7);
    int b = cmd.substring(7, space1).toInt();
    int p = cmd.substring(space1 + 1).toInt();
    Serial.println("READY");
    uint8_t buf[1024];
    size_t read = Serial.readBytes(buf, 1024);
    if (read == 1024) {
      String filename = "/b_" + String(b) + "_" + String(p) + ".bin";
      File file = LittleFS.open(filename, "w");
      file.write(buf, 1024);
      file.close();
      Serial.println("OK");
    } else {
      Serial.println("ERROR");
    }
  }
}

void setup() {
  Serial.begin(115200);
  if (!LittleFS.begin(true)) Serial.println("FS Error");
  loadPins();

  Wire.begin(PIN_SDA, PIN_SCL);
  for (int i=0; i<6; i++) {
    if (PIN_BTN[i] != -1) pinMode(PIN_BTN[i], INPUT_PULLUP);
  }
  if (PIN_PREV != -1) pinMode(PIN_PREV, INPUT_PULLUP);
  if (PIN_NEXT != -1) pinMode(PIN_NEXT, INPUT_PULLUP);
  if (PIN_ENC1_CLK != -1) pinMode(PIN_ENC1_CLK, INPUT_PULLUP);
  if (PIN_ENC1_DT != -1) pinMode(PIN_ENC1_DT, INPUT_PULLUP);
  if (PIN_ENC1_BTN != -1) pinMode(PIN_ENC1_BTN, INPUT_PULLUP);
  if (PIN_ENC2_CLK != -1) pinMode(PIN_ENC2_CLK, INPUT_PULLUP);
  if (PIN_ENC2_DT != -1) pinMode(PIN_ENC2_DT, INPUT_PULLUP);
  if (PIN_ENC2_BTN != -1) pinMode(PIN_ENC2_BTN, INPUT_PULLUP);

  for (int i=0; i<6; i++) {
    tcaselect(i);
    if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
      display.clearDisplay();
      display.display();
    }
  }

  Keyboard.begin();
  Consumer.begin();
  Mouse.begin();
  USB.begin();

  if (String(wifi_ssid) != "") {
    WiFi.mode(WIFI_STA);
    WiFi.begin(wifi_ssid, wifi_password);
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 10) { delay(500); attempts++; }
    if (WiFi.status() == WL_CONNECTED) {
      ArduinoOTA.begin();
      server.enableCORS(true);
      server.on("/", []() {
        String html = "<html><body><h1>Danjos Deck</h1><p>IP: " + WiFi.localIP().toString() + "</p></body></html>";
        server.send(200, "text/html", html);
      });
      server.on("/command", HTTP_POST, []() {
        if (server.hasArg("plain")) { processCommand(server.arg("plain")); server.send(200, "text/plain", "OK"); }
      });
      server.on("/upload", HTTP_POST, []() { server.send(200, "text/plain", "OK"); }, []() {
        HTTPUpload& upload = server.upload();
        if (upload.status == UPLOAD_FILE_START) {
          String filename = upload.filename;
          if (!filename.startsWith("/")) filename = "/" + filename;
          File f = LittleFS.open(filename, "w");
          if (f) f.close();
        } else if (upload.status == UPLOAD_FILE_WRITE) {
          String filename = upload.filename;
          if (!filename.startsWith("/")) filename = "/" + filename;
          File f = LittleFS.open(filename, "a");
          if (f) { f.write(upload.buf, upload.currentSize); f.close(); }
        } else if (upload.status == UPLOAD_FILE_END) {
          if (upload.filename == "config.json" || upload.filename == "/config.json") {
            loadConfig();
            updateDisplays();
          }
        }
      });
      server.begin();
      
      // Mostrar IP em todas as telas
      for(int i = 0; i < 6; i++) {
        tcaselect(i);
        display.clearDisplay();
        display.setTextSize(1);
        display.setTextColor(SSD1306_WHITE);
        display.setCursor(0, 10);
        display.print("WiFi Connected");
        display.setCursor(0, 30);
        display.print("IP:");
        display.setCursor(0, 45);
        display.print(WiFi.localIP().toString());
        display.display();
      }
      delay(5000);
    }
  }
  loadConfig();
  updateDisplays();
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) { ArduinoOTA.handle(); server.handleClient(); }
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();
    if (cmd.length() > 0) processCommand(cmd);
  }

  // Monitor computer IP ping status to auto-off screens
  if (WiFi.status() == WL_CONNECTED && pc_ip != "") {
    unsigned long currentMillis = millis();
    if (currentMillis - lastPingTime >= PING_INTERVAL || lastPingTime == 0) {
      lastPingTime = currentMillis;
      bool success = pingIP(pc_ip);
      setDisplaysOn(success);
    }
  } else {
    // Re-enable displays if WiFi is not connected or IP is empty
    setDisplaysOn(true);
  }

  if (isSyncing) return;

  for (int i = 0; i < 6; i++) {
    if (PIN_BTN[i] != -1) {
      bool state = digitalRead(PIN_BTN[i]);
      if (state == LOW && lastBtnState[i] == HIGH) { executeAction(i, currentPage); delay(200); }
      lastBtnState[i] = state;
    }
  }

  if (PIN_PREV != -1) {
    bool prevState = digitalRead(PIN_PREV);
    if (prevState == LOW && lastPrevState == HIGH) {
      if (totalPages > 0) { currentPage = (currentPage - 1 + totalPages) % totalPages; updateDisplays(); }
      delay(200);
    }
    lastPrevState = prevState;
  }

  if (PIN_NEXT != -1) {
    bool nextState = digitalRead(PIN_NEXT);
    if (nextState == LOW && lastNextState == HIGH) {
      if (totalPages > 0) { currentPage = (currentPage + 1) % totalPages; updateDisplays(); }
      delay(200);
    }
    lastNextState = nextState;
  }

  // Encoder 1
  if (PIN_ENC1_CLK != -1 && PIN_ENC1_DT != -1) {
    int clk1 = digitalRead(PIN_ENC1_CLK);
    if (clk1 != lastClk1 && clk1 == 1) {
      if (digitalRead(PIN_ENC1_DT) != clk1) executeAction(6, 0);
      else executeAction(7, 0);
      delay(50);
    }
    lastClk1 = clk1;
  }
  if (PIN_ENC1_BTN != -1) {
    bool btn1 = digitalRead(PIN_ENC1_BTN);
    if (btn1 == LOW && lastBtnState1 == HIGH) { executeAction(8, 0); delay(200); }
    lastBtnState1 = btn1;
  }

  // Encoder 2
  if (PIN_ENC2_CLK != -1 && PIN_ENC2_DT != -1) {
    int clk2 = digitalRead(PIN_ENC2_CLK);
    if (clk2 != lastClk2 && clk2 == 1) {
      if (digitalRead(PIN_ENC2_DT) != clk2) executeAction(9, 0);
      else executeAction(10, 0);
      delay(50);
    }
    lastClk2 = clk2;
  }
  if (PIN_ENC2_BTN != -1) {
    bool btn2 = digitalRead(PIN_ENC2_BTN);
    if (btn2 == LOW && lastBtnState2 == HIGH) { executeAction(11, 0); delay(200); }
    lastBtnState2 = btn2;
  }
}
`;
};
