export const MQTT_CONFIG = {
  URL: import.meta.env.VITE_MQTT_URL || 'ws://144.24.81.18:1888/ws',
  TOPIC: import.meta.env.VITE_MQTT_TOPIC || 'siot/launch_event',
  USERNAME: import.meta.env.VITE_MQTT_USERNAME || 'siot',
  PASSWORD: import.meta.env.VITE_MQTT_PASSWORD || 'dfrobot',
};

export const VISUAL_CONFIG = {
  TEXT_MAP: {
    WAITING: '',
    WAVE_DETECTED: '梦想起航',
    HEART_DETECTED: '蓄势待发',
    LAUNCHING: '正式启航',
  }
};

export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://launchapi.ljcode.cn',
  API_KEY: import.meta.env.VITE_API_KEY || 'iot-secret',
};
