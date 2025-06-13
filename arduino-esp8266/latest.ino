#include <DHTesp.h>
#include <ESP8266WiFi.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <WiFiManager.h>
#include <PubSubClient.h> // Include MQTT library

const int DHT_PIN = D1;
const int DS18B20_PIN = D2;

DHTesp dht;
OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);

WiFiClient espClient;
PubSubClient client(espClient);

const char* mqtt_server = "103.210.35.166";
const int mqtt_port = 1883;
const char* mqtt_username = "mqtt";
const char* mqtt_password = "mqtt";

void setup() {
  Serial.begin(115200);

  // Initialize WiFiManager
  WiFiManager wifiManager;
  wifiManager.autoConnect("ESP-Config");

  Serial.println("Connected to WiFi");
  Serial.println(WiFi.localIP());

  dht.setup(DHT_PIN, DHTesp::DHT22);
  ds18b20.begin();

  client.setServer(mqtt_server, mqtt_port);

  // Reconnect if not connected
  reconnect();
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    String clientId = "ESP8266Client-" + String(random(0xffff), HEX);
    if (client.connect(clientId.c_str(), mqtt_username, mqtt_password)) {
      Serial.println(" connected!");
    } else {
      Serial.print(" failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  float temperatureDHT = dht.getTemperature();
  float humidity = dht.getHumidity();

  ds18b20.requestTemperatures();
  float temperatureDS18B20 = ds18b20.getTempCByIndex(0);

  if (isnan(temperatureDHT) || isnan(humidity) || temperatureDS18B20 == DEVICE_DISCONNECTED_C) {
    Serial.println("Failed to read from sensors!");
  } else {
    // Create JSON for Air (DHT22)
    String airPayload = "{";
    airPayload += "\"temperature\":" + String(temperatureDHT, 1) + ",";
    airPayload += "\"humidity\":" + String(humidity, 1);
    airPayload += "}";

    // Create JSON for Water (DS18B20)
    String waterPayload = "{";
    waterPayload += "\"temperature\":" + String(temperatureDS18B20, 1);
    waterPayload += "}";

    Serial.println("Air Payload: " + airPayload);
    Serial.println("Water Payload: " + waterPayload);

    // Publish to MQTT topics
    client.publish("sensor33/air", airPayload.c_str());
    client.publish("sensor33/water", waterPayload.c_str());
  }

  delay(5000);
}