#include <DHTesp.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <WiFiManager.h>  #include <WiFiClientSecure.h>  
const int DHT_PIN = D1;
const int DS18B20_PIN = D2;

DHTesp dht;
OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);

const char* SERVER_URL = "https://hydroponic-monitoring-v2.vercel.app/api/post";

void setup() {
  Serial.begin(115200);

  WiFiManager wifiManager;
  wifiManager.autoConnect("ESP-Config");

  Serial.println("\nConnected to Wi-Fi!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  dht.setup(DHT_PIN, DHTesp::DHT22);

  ds18b20.begin();
  delay(1000);
}

void loop() {
  float temperatureDHT = dht.getTemperature();
  float humidity = dht.getHumidity();

  ds18b20.requestTemperatures();
  float temperatureDS18B20 = ds18b20.getTempCByIndex(0);

  if (isnan(temperatureDHT) || isnan(humidity) || temperatureDS18B20 == DEVICE_DISCONNECTED_C) {
    Serial.println("Failed to read from sensors!");
  } else {
    Serial.printf("DHT22 Temp: %.1f°C\n", temperatureDHT);
    Serial.printf("Humidity: %.0f%%\n", humidity);
    Serial.printf("DS18B20 Temp: %.1f°C\n---\n", temperatureDS18B20);

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      WiFiClientSecure client;  
      client.setInsecure();

      client.setTimeout(15000);
      
      http.begin(client, SERVER_URL);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("User-Agent", "ESP8266");

      http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

      http.setTimeout(15000);

      String payload = "{\"temperatureDHT\":" + String(temperatureDHT, 1) + 
                       ",\"humidity\":" + String(humidity, 1) +
                       ",\"temperatureDS18B20\":" + String(temperatureDS18B20, 1) + "}";

      Serial.println("Sending payload:");
      Serial.println(payload);
      Serial.println("URL: " + String(SERVER_URL));

      int httpResponseCode = http.POST(payload);
      Serial.println("HTTP Response Code:");
      Serial.println(httpResponseCode);

      if (httpResponseCode > 0) {
        String response = http.getString();
        Serial.println("Response:");
        Serial.println(response);
        
        if (httpResponseCode == 200) {
          Serial.println("✅ Data sent successfully!");
        } else if (httpResponseCode >= 300 && httpResponseCode < 400) {
          Serial.println("⚠️ Redirect detected!");
          Serial.println("Response headers might contain redirect location");
        } else {
          Serial.println("❌ Server error!");
        }
      } else {
        Serial.println("❌ Connection error!");
        Serial.printf("Error code: %d\n", httpResponseCode);

        switch(httpResponseCode) {
          case HTTPC_ERROR_CONNECTION_REFUSED:
            Serial.println("Connection refused");
            break;
          case HTTPC_ERROR_SEND_HEADER_FAILED:
            Serial.println("Send header failed");
            break;
          case HTTPC_ERROR_SEND_PAYLOAD_FAILED:
            Serial.println("Send payload failed");
            break;
          case HTTPC_ERROR_NOT_CONNECTED:
            Serial.println("Not connected");
            break;
          case HTTPC_ERROR_CONNECTION_LOST:
            Serial.println("Connection lost");
            break;
          case HTTPC_ERROR_NO_STREAM:
            Serial.println("No stream");
            break;
          case HTTPC_ERROR_NO_HTTP_SERVER:
            Serial.println("No HTTP server");
            break;
          case HTTPC_ERROR_TOO_LESS_RAM:
            Serial.println("Too less RAM");
            break;
          case HTTPC_ERROR_ENCODING:
            Serial.println("Encoding error");
            break;
          case HTTPC_ERROR_STREAM_WRITE:
            Serial.println("Stream write error");
            break;
          case HTTPC_ERROR_READ_TIMEOUT:
            Serial.println("Read timeout");
            break;
          default:
            Serial.println("Unknown error");
            break;
        }
      }

      http.end();
    } else {
      Serial.println("WiFi not connected!");
    }
  }

  delay(5000);  }