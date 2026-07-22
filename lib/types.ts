export type ActionType = 'keyboard' | 'text' | 'consumer' | 'mouse' | 'cpp' | 'sequence' | 'folder' | 'back' | 'none';

export type ConsumerAction =
  | 'VOLUME_INCREMENT'
  | 'VOLUME_DECREMENT'
  | 'PLAY_PAUSE'
  | 'MUTE'
  | 'SCAN_NEXT_TRACK'
  | 'SCAN_PREV_TRACK'
  | 'STOP'
  | 'BRIGHTNESS_INCREMENT'
  | 'BRIGHTNESS_DECREMENT';

export interface KeyModifiers {
  leftGui: boolean;
  leftCtrl: boolean;
  leftShift: boolean;
  leftAlt: boolean;
  rightCtrl: boolean;
  rightShift: boolean;
  rightAlt: boolean;
}

export interface KeyboardAction {
  modifiers: KeyModifiers;
  key: string; // e.g. 'c', 'F13', 'KEY_RIGHT_CTRL', 'HID_KEY_APPLICATION', 'SPACE'
}

export interface MouseAction {
  actionType: 'move' | 'click' | 'scroll';
  x?: number;
  y?: number;
  button?: 'left' | 'right' | 'middle';
  amount?: number; // for scroll
}

export interface CppAction {
  code: string;
}

export interface FolderAction {
  targetPageId?: string;
  targetPageIndex?: number;
}

export interface SequenceStep {
  type: 'keyboard' | 'text' | 'consumer' | 'mouse' | 'delay';
  keyboard?: KeyboardAction;
  text?: string;
  consumer?: ConsumerAction;
  mouse?: MouseAction;
  delayMs?: number;
}

export interface ButtonAction {
  type: ActionType;
  keyboard?: KeyboardAction;
  text?: string;
  consumer?: ConsumerAction;
  mouse?: MouseAction;
  cpp?: CppAction;
  sequence?: SequenceStep[];
  folder?: FolderAction;
}

export interface ButtonState {
  label: string;
  bitmap: number[]; // 1024 bytes, empty array = use default border bitmap
  action: ButtonAction;
  iconName?: string;
  iconLayout?: 'icon-only' | 'icon-text-side' | 'icon-text-below';
  iconSize?: number;
  iconXOffset?: number;
  iconYOffset?: number;
  textSize?: number;
  textXOffset?: number;
  textYOffset?: number;
  showBorder?: boolean;
}

export interface EncoderConfig {
  cwAction: ButtonAction;    // clockwise = volume up by default
  ccwAction: ButtonAction;   // counter-clockwise = volume down
  btnAction: ButtonAction;   // press = play/pause
}

export interface PinConfig {
  btn1: number;
  btn2: number;
  btn3: number;
  btn4: number;
  btn5: number;
  btn6: number;
  btnPrev: number;
  btnNext: number;
  enc1Clk: number;
  enc1Dt: number;
  enc1Btn: number;
  enc2Clk: number;
  enc2Dt: number;
  enc2Btn: number;
  sda: number;
  scl: number;
  btn1Enabled?: boolean;
  btn2Enabled?: boolean;
  btn3Enabled?: boolean;
  btn4Enabled?: boolean;
  btn5Enabled?: boolean;
  btn6Enabled?: boolean;
  btnPrevEnabled?: boolean;
  btnNextEnabled?: boolean;
  enc1Enabled?: boolean;
  enc2Enabled?: boolean;
}

export interface PageConfig {
  id: string;
  name: string;
  parentId?: string;
  isFolder?: boolean;
  buttons: ButtonState[]; // exactly 6 buttons per page
}

export interface DanjosDeckConfig {
  pages: PageConfig[];
  encoder1: EncoderConfig;
  encoder2: EncoderConfig;
  pins: PinConfig;
  pcIp?: string;
}
