import { Expo, ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

interface RegisteredDevice {
  token: string;
  lastNotified: {
    temperature: number;
    humidity: number;
    waterTemp: number;
  };
  lastStatus: {
    temperature: string;
    humidity: string;
    waterTemp: string;
  };
}

let registeredDevices: RegisteredDevice[] = [];

const NOTIFICATION_INTERVAL = 30 * 60 * 1000;

const THRESHOLDS = {
  temperature: {
    critical: { min: 15, max: 35 },
    warning: { min: 18, max: 30 },
  },
  humidity: {
    critical: { min: 35, max: 85 },
    warning: { min: 40, max: 80 },
  },
  waterTemp: {
    critical: { min: 18, max: 30 },
    warning: { min: 20, max: 28 },
  },
};

function getStatus(
  metric: "temperature" | "humidity" | "waterTemp",
  value: number
): string {
  const threshold = THRESHOLDS[metric];
  if (value > threshold.critical.max || value < threshold.critical.min) {
    return "Critical";
  }
  if (value > threshold.warning.max || value < threshold.warning.min) {
    return "Warning";
  }
  return "Optimal";
}

function shouldSendNotification(
  device: RegisteredDevice,
  metric: "temperature" | "humidity" | "waterTemp",
  currentStatus: string
): boolean {
  const now = Date.now();
  const lastSent = device.lastNotified[metric];
  const lastStatus = device.lastStatus[metric];

  if (currentStatus !== lastStatus) {
    return true;
  }

  if (currentStatus === "Critical" && now - lastSent >= NOTIFICATION_INTERVAL) {
    return true;
  }

  return false;
}

async function sendPushNotifications(messages: ExpoPushMessage[]) {
  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error("Error sending push notifications:", error);
    }
  }

  return tickets;
}

export async function monitorAndNotify(sensorData: {
  temperature: number;
  humidity: number;
  water_temp: number;
}) {
  if (registeredDevices.length === 0) {
    return;   }

  const messages: ExpoPushMessage[] = [];

  for (const device of registeredDevices) {

    if (!Expo.isExpoPushToken(device.token)) {
      console.error(`Invalid push token: ${device.token}`);
      continue;
    }

    const tempStatus = getStatus("temperature", sensorData.temperature);
    if (shouldSendNotification(device, "temperature", tempStatus)) {
      const isCritical = tempStatus === "Critical";
      messages.push({
        to: device.token,
        sound: "default",
        title: isCritical
          ? "⚠️ Air Temperature Critical!"
          : "✅ Air Temperature Recovered",
        body: isCritical
          ? `Air Temperature is at critical level: ${sensorData.temperature.toFixed(
              1
            )}°C`
          : `Air Temperature has returned to normal: ${sensorData.temperature.toFixed(
              1
            )}°C`,
        priority: "high",
        data: {
          metric: "temperature",
          value: sensorData.temperature,
          status: tempStatus,
        },
      });
      device.lastNotified.temperature = Date.now();
      device.lastStatus.temperature = tempStatus;
    }

    const humidityStatus = getStatus("humidity", sensorData.humidity);
    if (shouldSendNotification(device, "humidity", humidityStatus)) {
      const isCritical = humidityStatus === "Critical";
      messages.push({
        to: device.token,
        sound: "default",
        title: isCritical ? "⚠️ Humidity Critical!" : "✅ Humidity Recovered",
        body: isCritical
          ? `Humidity is at critical level: ${sensorData.humidity.toFixed(1)}%`
          : `Humidity has returned to normal: ${sensorData.humidity.toFixed(
              1
            )}%`,
        priority: "high",
        data: {
          metric: "humidity",
          value: sensorData.humidity,
          status: humidityStatus,
        },
      });
      device.lastNotified.humidity = Date.now();
      device.lastStatus.humidity = humidityStatus;
    }

    const waterTempStatus = getStatus("waterTemp", sensorData.water_temp);
    if (shouldSendNotification(device, "waterTemp", waterTempStatus)) {
      const isCritical = waterTempStatus === "Critical";
      messages.push({
        to: device.token,
        sound: "default",
        title: isCritical
          ? "⚠️ Water Temperature Critical!"
          : "✅ Water Temperature Recovered",
        body: isCritical
          ? `Water Temperature is at critical level: ${sensorData.water_temp.toFixed(
              1
            )}°C`
          : `Water Temperature has returned to normal: ${sensorData.water_temp.toFixed(
              1
            )}°C`,
        priority: "high",
        data: {
          metric: "waterTemp",
          value: sensorData.water_temp,
          status: waterTempStatus,
        },
      });
      device.lastNotified.waterTemp = Date.now();
      device.lastStatus.waterTemp = waterTempStatus;
    }
  }

  if (messages.length > 0) {
    console.log(`Sending ${messages.length} notification(s)`);
    await sendPushNotifications(messages);
  }
}

export function registerDevice(token: string): boolean {
  if (!Expo.isExpoPushToken(token)) {
    console.error(`Invalid push token: ${token}`);
    return false;
  }

  const existing = registeredDevices.find((d) => d.token === token);
  if (existing) {
    console.log("Device already registered");
    return true;
  }

  registeredDevices.push({
    token,
    lastNotified: {
      temperature: 0,
      humidity: 0,
      waterTemp: 0,
    },
    lastStatus: {
      temperature: "Unknown",
      humidity: "Unknown",
      waterTemp: "Unknown",
    },
  });

  console.log(`Device registered: ${token}`);
  return true;
}

export function unregisterDevice(token: string): boolean {
  const initialLength = registeredDevices.length;
  registeredDevices = registeredDevices.filter((d) => d.token !== token);
  return registeredDevices.length < initialLength;
}

export function getRegisteredDevices(): string[] {
  return registeredDevices.map((d) => d.token);
}

export function resetAllNotificationStates() {
  registeredDevices.forEach((device) => {
    device.lastNotified = {
      temperature: 0,
      humidity: 0,
      waterTemp: 0,
    };
    device.lastStatus = {
      temperature: "Unknown",
      humidity: "Unknown",
      waterTemp: "Unknown",
    };
  });
  console.log("All notification states reset");
}
