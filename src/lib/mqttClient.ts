import mqtt from "mqtt";
import { updateRealtimeData } from "@/app/api/realtime/route";

let mqttClient: mqtt.MqttClient | null = null;
let isInitialized = false;

const sensorData = {
  temperature: null as number | null,
  humidity: null as number | null,
  water_temp: null as number | null,
};

export function initializeMqttClient() {
  if (isInitialized) {
    console.log("MQTT client already initialized");
    return mqttClient;
  }

  console.log("🚀 Initializing MQTT client...");

  mqttClient = mqtt.connect("mqtt://103.210.35.166:1883", {
    clientId: "nextjs-hydro-" + Math.random().toString(16).substr(2, 8),
    username: "mqtt",
    password: "mqtt",
  });

  mqttClient.on("connect", () => {
    console.log("✅ MQTT client connected successfully");
    mqttClient!.subscribe(["sensor33/air", "sensor33/water"], (err) => {
      if (err) {
        console.error("❌ MQTT subscription error:", err);
      } else {
        console.log("✅ Subscribed to sensor33/air and sensor33/water");
      }
    });
  });

  mqttClient.on("message", (topic, message) => {
    try {
      console.log(`📨 MQTT message received on topic: ${topic}`);
      const data = JSON.parse(message.toString());
      console.log(`📊 Parsed data:`, data);

      if (topic === "sensor33/air") {
        sensorData.temperature = data.temperature;
        sensorData.humidity = data.humidity;
        console.log(
          `🌡️  Air: temp=${data.temperature}°C, humidity=${data.humidity}%`
        );
      } else if (topic === "sensor33/water") {
        sensorData.water_temp = data.temperature;
        console.log(`💧 Water: temp=${data.temperature}°C`);
      }

      console.log(`🔄 Updating realtime data...`);
      updateRealtimeData({
        temperature: sensorData.temperature ?? undefined,
        humidity: sensorData.humidity ?? undefined,
        water_temp: sensorData.water_temp ?? undefined,
      });
      console.log(`✅ Realtime data updated successfully`);
    } catch (error) {
      console.error("❌ Error processing MQTT message:", error);
    }
  });

  mqttClient.on("error", (error) => {
    console.error("❌ MQTT connection error:", error);
  });

  mqttClient.on("offline", () => {
    console.warn("⚠️ MQTT client offline");
  });

  mqttClient.on("reconnect", () => {
    console.log("🔄 MQTT client reconnecting...");
  });

  isInitialized = true;
  return mqttClient;
}

export function getMqttClient() {
  if (!mqttClient) {
    return initializeMqttClient();
  }
  return mqttClient;
}

export function getSensorData() {
  return sensorData;
}

if (typeof window === "undefined") {
  console.log("🔧 Server-side detected, auto-initializing MQTT client...");
  initializeMqttClient();
}
