#include <DHTesp.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <WiFiManager.h>  // Include WiFiManager

const int DHT_PIN = D5;
const int DS18B20_PIN = D4;  // Change to your actual GPIO pin

DHTesp dht;
OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);

const char* SERVER_URL = "http://10.201.1.93:3000/api/post";  

void setup() {
    Serial.begin(115200);

    // Initialize WiFiManager
    WiFiManager wifiManager;
    wifiManager.autoConnect("ESP-Config");  // AP mode with SSID "ESP-Config"

    Serial.println("\nConnected to Wi-Fi!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());

    // Initialize DHT22
    dht.setup(DHT_PIN, DHTesp::DHT22);
    
    // Initialize DS18B20
    ds18b20.begin();
    delay(1000);
}

void loop() {
    float temperatureDHT = dht.getTemperature();
    float humidity = dht.getHumidity();

    // Request DS18B20 temperature
    ds18b20.requestTemperatures();
    float temperatureDS18B20 = ds18b20.getTempCByIndex(0);  // Get temperature in Celsius

    if (isnan(temperatureDHT) || isnan(humidity) || temperatureDS18B20 == DEVICE_DISCONNECTED_C) {
        Serial.println("Failed to read from sensors!");
    } else {
        Serial.printf("DHT22 Temp: %.1f°C\n", temperatureDHT);
        Serial.printf("Humidity: %.0f%%\n", humidity);
        Serial.printf("DS18B20 Temp: %.1f°C\n---\n", temperatureDS18B20);

        if (WiFi.status() == WL_CONNECTED) {
            HTTPClient http;
            WiFiClient client;
            http.begin(client, SERVER_URL);  
            http.addHeader("Content-Type", "application/json");
            
            String payload = String("{\"temperatureDHT\":") + String(temperatureDHT, 1) + 
                             ",\"humidity\":" + String(humidity, 0) +
                             ",\"temperatureDS18B20\":" + String(temperatureDS18B20, 1) + "}";

            int httpResponseCode = http.POST(payload);
            Serial.println(httpResponseCode);

            if (httpResponseCode > 0) {
                Serial.println("Data sent successfully!");
            } else {
                Serial.println("Error sending data");
                Serial.printf("Response code: %d\n", httpResponseCode);
            }
            
            http.end();
        }
    }

    delay(1000);
}
