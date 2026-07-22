# Danjos Deck 🎛️⚡

> **Configurador Visual e Gerador de Firmware para Decks de Macros Customizados baseados em ESP32 / ESP32-S3.**

O **Danjos Deck** é uma plataforma completa e intuitiva desenvolvida em Next.js e TypeScript que permite criar, customizar e sincronizar visualmente layouts, ícones, atalhos e firmware para a criação de um Stream Deck / Macro Deck de hardware personalizado alimentado por ESP32.

---

## 🚀 Principais Recursos e Funcionalidades

### 🎨 Editor Visual e Design de Botões
- **Grade Estilo Stream Deck:** Visualização e edição em tempo real para decks de botões com telas OLED.
- **Gerenciador de Páginas e Navegação por Pastas:**
  - Suporte a múltiplas páginas e sub-pastas hierárquicas de macros.
  - **Navegação por Pastas (Folders):** Atribua a qualquer botão uma ação de Pasta para abrir sub-páginas específicas no deck.
  - **Ação de Voltar (Back):** Botão configurável de retorno para voltar para a página inicial ou pasta pai.
  - Funcionalidades para **adicionar, criar sub-pastas, renomear, duplicar, reordenar e excluir** páginas/pastas.
- **Personalização Estética Completa por Botão:**
  - **Biblioteca de Ícones Integrada:** Busca e seleção de ícones do *Google Material Symbols*.
  - **Layouts Ajustáveis:** Apenas Ícone, Ícone + Texto ao Lado, ou Ícone + Texto Abaixo.
  - **Controle Fino de Tipografia e Posição:** Tamanho de texto, tamanho de ícone e deslocamento nos eixos X/Y.
  - **Bordas Customizadas:** Opção de exibir ou ocultar bordas de contorno no display.
- **Renderizador de Bitmaps (1-bit):**
  - Conversão automática de canvas e ícones em matrizes de bytes monocromáticas (128x64 e 64x64 pixels) compatíveis com telas Adafruit SSD1306.

---

### ⚡ Tipos de Ações e Atalhos Suportados
O Danjos Deck permite mapear uma ampla variedade de ações para cada botão e encoder:

1. **Atalhos de Teclado (Keyboard HID):**
   - Teclas individuais ou combinações complexas com modificadores (`Ctrl`, `Shift`, `Alt`, `Win/Cmd/GUI`).
   - Suporte a teclas de função (`F1` a `F24`), teclado numérico, setas e teclas de sistema (ex: `F13` - `F24` perfeitas para OBS e Discord).
2. **Controle Multimídia (Consumer Control HID):**
   - Aumentar/Diminuir Volume, Mudo, Play/Pause, Parar, Avançar/Voltar Faixa e Ajuste de Brilho.
3. **Injeção de Texto (Text Automation):**
   - Digitação automática de textos pré-definidos e comandos rapidamente.
4. **Emulação de Mouse (Mouse HID):**
   - Cliques (Botão Esquerdo, Direito ou do Meio), Movimentação precisa nos eixos X/Y e Rolagem/Scroll.
5. **Ações em Código C++ NATIVO:**
   - Escreva blocos de código C++ que serão executados diretamente no microcontrolador ESP32 para automações avançadas de hardware ou integrações específicas.
6. **Sequências de Macros (Macros Multistep):**
   - Crie filas de execução contendo múltiplos passos encadeados (combinação de teclado, texto, cliques de mouse e atrasos/delays em milissegundos).
7. **Encoders Rotativos DUPLOS:**
   - Mapeie ações independentes para Rotação Horária (CW), Rotação Anti-Horária (CCW) e Clique para até 2 Encoders Rotativos (ex: Controle de Volume, Scroll ou Brilho).

---

### 🔌 Sincronização Rápida e Flexível

- **Sincronização USB via Web Serial API:**
  - Transfira suas configurações, ícones e layouts **diretamente do navegador para o ESP32 conectado via cabo USB**, sem precisar regravar o firmware toda vez que alterar uma ação.
- **Sincronização sem Fios via Wi-Fi:**
  - Envie atualizações pela rede local através de requisições HTTP REST diretamente para a API integrada no ESP32.
- **Exportação e Backup de Dados:**
  - Download do arquivo `config.txt` para carregamento manual no LittleFS.
  - Exportação e importação de backups completos em formato JSON.

---

### 🛠️ Configuração de Hardware e Pinos (GPIO)
- **Painel de Pinos Totalmente Customizável:**
  - Mapeie visualmente os pinos GPIO do ESP32 para os 6 botões principais, botões de navegação (`Anterior` / `Próxima` página), 2 Encoders Rotativos (CLK, DT, SW) e barramento I2C (SDA, SCL).
  - Opção para habilitar ou desabilitar botões/encoders individualmente.

---

### 📟 Monitor Serial Integrado
- Terminal serial no próprio navegador para depuração em tempo real (Baud rate 115200), recepção de logs do ESP32 e envio de comandos diretos.

---

### 📄 Gerador Automático de Firmware C++ (`.ino`)
- A aplicação gera o código fonte C++ completo pronto para compilação na **Arduino IDE** ou **PlatformIO**.
- **Bibliotecas e Recursos Integrados no Firmware:**
  - `USBHIDKeyboard`, `USBHIDMouse`, `USBHIDConsumerControl` (Suporte USB HID Nativo no ESP32-S3).
  - `Adafruit_SSD1306` + `Wire` + Multiplexador I2C `TCA9548A` para controle de múltiplas telas OLED.
  - Sistema de Arquivos `LittleFS` para persistência das páginas e imagens no flash.
  - Servidor `WebServer` HTTP + `ArduinoOTA` para atualizações de código sem fio.
  - Modo Economia de Energia / Standby automatizado por verificação de ping do computador.

---

### 🌐 Suporte Multilíngue (i18n)
- Interface de usuário disponível em **Português (PT-BR)** e **Inglês (EN)**.

---

## 🛠️ Como Funciona a Arquitetura

```
+-------------------------------------------------------+
|              Danjos Deck Web App (Next.js)             |
|  - Configuração visual de botões, ícones e layouts.   |
|  - Conversão para bitmaps 1-bit (128x64 / 64x64).     |
|  - Geração de protocolo de sincronização.             |
+--------------------------+----------------------------+
                           |
            +--------------+--------------+
            |                             |
  [ Web Serial (USB) ]           [ Wi-Fi (HTTP POST) ]
            |                             |
            +--------------+--------------+
                           |
                           v
+-------------------------------------------------------+
|                   ESP32 / ESP32-S3                    |
|  - Recebe e salva a configuração no LittleFS.         |
|  - Exibe layouts nos displays OLED (TCA9548A I2C).    |
|  - Lê botões e encoders rotativos.                    |
|  - Envia comandos nativos USB HID para o computador.  |
+-------------------------------------------------------+
```

1. **Design no Browser:** Você ajusta a aparência dos botões, atribui ações e organiza as páginas no editor web.
2. **Sincronização:** Com um único clique em **"Sincronizar"**, os dados de configuração e bitmaps dos ícones são transmitidos via Web Serial ou Wi-Fi.
3. **Execução no Hardware:** O ESP32 armazena a estrutura no **LittleFS**, atualiza os displays OLED e reage aos pressionamentos enviando comandos nativos de teclado/mouse USB HID para o seu computador.

---

## 🔌 Hardware Suportado e Sugerido

- **Microcontrolador:** ESP32-S3 (recomendado para USB HID Nativo) ou ESP32.
- **Displays:** Telas OLED 0.96" I2C SSD1306 (128x64 pixels).
- **Multiplexador I2C:** TCA9548A (para controlar até 6 ou 8 telas na mesma porta I2C).
- **Encoders Rotativos:** KY-040 (até 2 unidades).
- **Switches / Botões:** Pushbuttons ou switches mecânicos.

---

## 💻 Como Executar o Configurador Web Localmente

### Pré-requisitos
- **Node.js** v18 ou superior.
- **npm**, **yarn** ou **bun**.

### Passos
1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/danjos-deck.git
   cd danjos-deck
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
4. Abra o seu navegador em `http://localhost:3000`.

---

## 📜 Licença
Este projeto é de código aberto e está disponível sob a licença [MIT](LICENSE).
