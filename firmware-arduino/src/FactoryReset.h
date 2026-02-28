#include <Config.h>
#include <nvs_flash.h>

void setResetComplete() {
    HTTPClient http;
    WiFiClientSecure client;
    client.setCACert(Vercel_CA_cert);  // Using the existing server certificate
    
    // Construct the JSON payload
    JsonDocument doc;
    doc["authToken"] = authTokenGlobal;
    
    String jsonString;
    serializeJson(doc, jsonString);

    // Initialize HTTPS connection with client
    #ifdef DEV_MODE
    http.begin("http://" + String(backend_server) + ":" + String(backend_port) + "/api/factory_reset_handler");
    #else
    http.begin(client, "https://" + String(backend_server) + "/api/factory_reset_handler");
    #endif

    http.addHeader("Content-Type", "application/json");
    http.setTimeout(10000);  // Add timeout for reliability
    
    // Make the POST request
    int httpCode = http.POST(jsonString);
    
    // ... existing code ...
    if (httpCode > 0) {
        if (httpCode == HTTP_CODE_OK) {
            Serial.println("Factory reset status updated successfully");
        } else {
            Serial.printf("Factory reset status update failed with code: %d\n", httpCode);
        }
    } else {
        Serial.printf("HTTP request failed: %s\n", http.errorToString(httpCode).c_str());
    }
    
    http.end();
}

void quickAuthTokenReset() {
    preferences.begin("auth", false);
    preferences.putString("auth_token", "");
    preferences.end();
}

void quickFactoryResetDevice() {
    // Erase the NVS partition
    esp_err_t err = nvs_flash_erase();
    if (err != ESP_OK) {
        Serial.printf("Error erasing NVS: %d\n", err);
        return;
    }
    
    // Reinitialize NVS
    err = nvs_flash_init();
    if (err != ESP_OK) {
        Serial.printf("Error initializing NVS: %d\n", err);
        return;
    }

    // clear auth token from global variable
    authTokenGlobal = "";
}

/* factoryResetDevice
    clear NVS
*/
void factoryResetDevice() {
    Serial.println("Clearing everything from NVS");

    // kinda hacky but mark reset complete first and then clear the auth token from NVS
    setResetComplete();
    quickFactoryResetDevice();
}

