#include <Arduino.h>
#include <WiFi.h>
#include <nvs_flash.h>

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
}


void setup() {
    Serial.begin(115200);
    delay(1000);

	// wipe NVS and clear all globals vars
	quickFactoryResetDevice();

    WiFi.mode(WIFI_STA);  // Ensure WiFi is initialized
}

void loop() {
    // Print MAC address using the simple WiFi.macAddress() method
    Serial.print("Wi-Fi MAC Address: ");
    Serial.println(WiFi.macAddress());
    
    // Delay for 1 second before printing again
    delay(1000);    
}