import mqtt from "mqtt";
import { updateRealtimeData } from "../realtime/route";

const connections = new Set<ReadableStreamDefaultController<Uint8Array>>();

const streamMqttClient = mqtt.connect("mqtt://103.210.35.166:1883", {
  clientId: "nextjs-stream-" + Math.random().toString(16).substr(2, 8),
  username: "mqtt",
  password: "mqtt",
});

let sensorData = {
  temperature: null as number | null,
  humidity: null as number | null,
  water_temp: null as number | null,
};

streamMqttClient.on("connect", () => {
  console.log("✅ Stream MQTT client connected successfully");
  streamMqttClient.subscribe(["sensor33/air", "sensor33/water"], (err) => {
    if (err) {
      console.error("❌ MQTT subscription error:", err);
    } else {
      console.log("✅ Subscribed to sensor33/air and sensor33/water");
    }
  });
});

streamMqttClient.on("error", (error) => {
  console.error("❌ MQTT connection error:", error);
});

streamMqttClient.on("offline", () => {
  console.warn("⚠️ MQTT client offline");
});

streamMqttClient.on("reconnect", () => {
  console.log("🔄 MQTT client reconnecting...");
});

streamMqttClient.on("message", (topic, message) => {
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

    const eventData = {
      id: Date.now().toString(),
      temperature: sensorData.temperature,
      humidity: sensorData.humidity,
      water_temp: sensorData.water_temp,
      timestamp: new Date().toISOString(),
    };

    const failed: ReadableStreamDefaultController<Uint8Array>[] = [];
    connections.forEach((controller) => {
      try {
        const chunk = `data: ${JSON.stringify(eventData)}\n\n`;
        controller.enqueue(new TextEncoder().encode(chunk));
      } catch (error) {
        failed.push(controller);
      }
    });

    failed.forEach((c) => connections.delete(c));
  } catch (error) {
    console.error("Error processing stream message:", error);
  }
});

export async function GET(request: Request) {
  const stream = new ReadableStream({
    start(controller) {
      connections.add(controller);

      const chunk = `data: ${JSON.stringify({ type: "connected" })}\n\n`;
      controller.enqueue(new TextEncoder().encode(chunk));

      const onAbort = () => {
        try {
          connections.delete(controller);
        } catch (e) {
        }
      };

      if (request && (request as any).signal) {
        try {
          (request as any).signal.addEventListener("abort", onAbort);
        } catch (e) {
        }
      }
    },
    cancel() {
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  });
}
