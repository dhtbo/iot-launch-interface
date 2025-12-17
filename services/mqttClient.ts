import mqtt from 'mqtt';
import { MQTT_CONFIG } from '../constants';
import { LaunchState } from '../types';

type StatusCallback = (state: LaunchState) => void;

export class MqttService {
  private client: mqtt.MqttClient | null = null;
  private onStatusChange: StatusCallback;

  constructor(callback: StatusCallback) {
    this.onStatusChange = callback;
  }

  public connect() {
    console.log(`Connecting to MQTT at ${MQTT_CONFIG.URL}...`);
    
    this.client = mqtt.connect(MQTT_CONFIG.URL, {
      username: MQTT_CONFIG.USERNAME,
      password: MQTT_CONFIG.PASSWORD,
      keepalive: 60,
      protocolId: 'MQTT',
      protocolVersion: 4,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000,
    });

    this.client.on('connect', () => {
      console.log('MQTT Connected');
      this.client?.subscribe(MQTT_CONFIG.TOPIC, (err) => {
        if (!err) {
          console.log(`Subscribed to ${MQTT_CONFIG.TOPIC}`);
        }
      });
    });

    this.client.on('message', (topic, message) => {
      const msgString = message.toString();
      console.log(`Received: ${msgString}`);
      
      switch (msgString) {
        case 'step1':
          this.onStatusChange(LaunchState.WAVE_DETECTED);
          break;
        case 'step2':
          this.onStatusChange(LaunchState.HEART_DETECTED);
          break;
        case 'step3':
          this.onStatusChange(LaunchState.LAUNCHING);
          break;
        default:
          // Optional: Reset or ignore unknown
          break;
      }
    });

    this.client.on('error', (err) => {
      console.error('MQTT Error:', err);
    });
  }

  public disconnect() {
    if (this.client) {
      this.client.end();
    }
  }
}