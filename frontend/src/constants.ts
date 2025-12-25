export const MQTT_CONFIG = {
  URL: import.meta.env.VITE_MQTT_URL || 'ws://144.24.81.18:1888/ws',
  TOPIC: import.meta.env.VITE_MQTT_TOPIC || 'siot/launch_event',
  USERNAME: import.meta.env.VITE_MQTT_USERNAME || 'siot',
  PASSWORD: import.meta.env.VITE_MQTT_PASSWORD || 'dfrobot',
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
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://launchapi.ljcode.cn',
  API_KEY: import.meta.env.VITE_API_KEY || 'iot-secret',
};
