export const MQTT_CONFIG = {
  // WebSocket connection string
  URL: 'ws://144.24.81.18:1888/ws',
  TOPIC: 'siot/launch_event',
  // User should fill these if authentication is enabled on the broker
  USERNAME: 'siot', 
  PASSWORD: 'dfrobot',
};

export const VISUAL_CONFIG = {
  TEXT_MAP: {
    WAITING: '等待进入',
    WAVE_DETECTED: '能量汇聚',
    HEART_DETECTED: '情感注入',
    LAUNCHING: '启动程序',
  }
};

export const API_CONFIG = {
  BASE_URL: 'http://localhost:3000',
  API_KEY: 'iot-secret',
};
