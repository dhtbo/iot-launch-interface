export const MQTT_CONFIG = {
  URL: 'ws://144.24.81.18:1888/ws',
  TOPIC: 'siot/launch_event',
  USERNAME: 'siot',
  PASSWORD: 'dfrobot',
};

export const VISUAL_CONFIG = {
  TEXT_MAP: {
    WAITING: '',
    WAVE_DETECTED: '能量汇聚',
    HEART_DETECTED: '情感注入',
    LAUNCHING: '启动程序',
  }
};

export const API_CONFIG = {
  BASE_URL: 'http://localhost:3002',
  API_KEY: 'iot-secret',
};
