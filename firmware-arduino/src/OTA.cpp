#include "OTA.h"
#include "HttpsOTAUpdate.h"
#include "esp_ota_ops.h"

HttpsOTAStatus_t otastatus;

const char *ota_firmware_url = "https://raw.githubusercontent.com/akdeb/paul-health/refs/heads/main/releases/latest/firmware.bin";

const char *server_certificate = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFBjCCAu6gAwIBAgIRAMISMktwqbSRcdxA9+KFJjwwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMjQwMzEzMDAwMDAw
WhcNMjcwMzEyMjM1OTU5WjAzMQswCQYDVQQGEwJVUzEWMBQGA1UEChMNTGV0J3Mg
RW5jcnlwdDEMMAoGA1UEAxMDUjEyMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
CgKCAQEA2pgodK2+lP474B7i5Ut1qywSf+2nAzJ+Npfs6DGPpRONC5kuHs0BUT1M
5ShuCVUxqqUiXXL0LQfCTUA83wEjuXg39RplMjTmhnGdBO+ECFu9AhqZ66YBAJpz
kG2Pogeg0JfT2kVhgTU9FPnEwF9q3AuWGrCf4yrqvSrWmMebcas7dA8827JgvlpL
Thjp2ypzXIlhZZ7+7Tymy05v5J75AEaz/xlNKmOzjmbGGIVwx1Blbzt05UiDDwhY
XS0jnV6j/ujbAKHS9OMZTfLuevYnnuXNnC2i8n+cF63vEzc50bTILEHWhsDp7CH4
WRt/uTp8n1wBnWIEwii9Cq08yhDsGwIDAQABo4H4MIH1MA4GA1UdDwEB/wQEAwIB
hjAdBgNVHSUEFjAUBggrBgEFBQcDAgYIKwYBBQUHAwEwEgYDVR0TAQH/BAgwBgEB
/wIBADAdBgNVHQ4EFgQUALUp8i2ObzHom0yteD763OkM0dIwHwYDVR0jBBgwFoAU
ebRZ5nu25eQBc4AIiMgaWPbpm24wMgYIKwYBBQUHAQEEJjAkMCIGCCsGAQUFBzAC
hhZodHRwOi8veDEuaS5sZW5jci5vcmcvMBMGA1UdIAQMMAowCAYGZ4EMAQIBMCcG
A1UdHwQgMB4wHKAaoBiGFmh0dHA6Ly94MS5jLmxlbmNyLm9yZy8wDQYJKoZIhvcN
AQELBQADggIBAI910AnPanZIZTKS3rVEyIV29BWEjAK/duuz8eL5boSoVpHhkkv3
4eoAeEiPdZLj5EZ7G2ArIK+gzhTlRQ1q4FKGpPPaFBSpqV/xbUb5UlAXQOnkHn3m
FVj+qYv87/WeY+Bm4sN3Ox8BhyaU7UAQ3LeZ7N1X01xxQe4wIAAE3JVLUCiHmZL+
qoCUtgYIFPgcg350QMUIWgxPXNGEncT921ne7nluI02V8pLUmClqXOsCwULw+PVO
ZCB7qOMxxMBoCUeL2Ll4oMpOSr5pJCpLN3tRA2s6P1KLs9TSrVhOk+7LX28NMUlI
usQ/nxLJID0RhAeFtPjyOCOscQBA53+NRjSCak7P4A5jX7ppmkcJECL+S0i3kXVU
y5Me5BbrU8973jZNv/ax6+ZK6TM8jWmimL6of6OrX7ZU6E2WqazzsFrLG3o2kySb
zlhSgJ81Cl4tv3SbYiYXnJExKQvzf83DYotox3f0fwv7xln1A2ZLplCb0O+l/AK0
YE0DS2FPxSAHi0iwMfW2nNHJrXcY3LLHD77gRgje4Eveubi2xxa+Nmk/hmhLdIET
iVDFanoCrMVIpQ59XWHkzdFmoHXHBV7oibVjGSO7ULSQ7MJ1Nz51phuDJSgAIU7A
0zrLnOrAj/dfrlEWRhCvAgbuwLZX1A2sjNjXoPOHbsPiy+lO1KF8/XY7
-----END CERTIFICATE-----
)EOF";

void markOTAUpdateComplete() {
    HTTPClient http;
    
    // Construct the JSON payload
    JsonDocument doc;
    doc["authToken"] = authTokenGlobal;
    
    String jsonString;
    serializeJson(doc, jsonString);

    // Initialize HTTPS connection with client
    #ifdef DEV_MODE
    http.begin("http://" + String(backend_server) + ":" + String(backend_port) + "/api/ota_update_handler");
    #else
    WiFiClientSecure client;
    client.setCACert(Vercel_CA_cert);  // Using the existing server certificate
    http.begin(client, "https://" + String(backend_server) + "/api/ota_update_handler");
    #endif

    http.addHeader("Content-Type", "application/json");
    http.setTimeout(10000);  // Add timeout for reliability
    
    // Make the POST request
    int httpCode = http.POST(jsonString);
    
    // ... existing code ...
    if (httpCode > 0) {
        if (httpCode == HTTP_CODE_OK) {
            Serial.println("OTA status updated successfully");
             setOTAStatusInNVS(OTA_IDLE);
        } else {
            Serial.printf("OTA status update failed with code: %d\n", httpCode);
        }
    } else {
        Serial.printf("HTTP request failed: %s\n", http.errorToString(httpCode).c_str());
    }
    
    http.end();
}

void getOTAStatusFromNVS()
{
    preferences.begin("ota", false);
    otaState = (OtaStatus)preferences.getUInt("status", OTA_IDLE);
    preferences.end();
}

void setOTAStatusInNVS(OtaStatus status)
{
    preferences.begin("ota", false);
    preferences.putUInt("status", status);
    preferences.end();
    otaState = status;
}

void loopOTA()
{
    otastatus = HttpsOTA.status();
    if (otastatus == HTTPS_OTA_SUCCESS)
    {
        Serial.println("Firmware written successfully. To reboot device, call API ESP.restart() or PUSH restart button on device");
        setOTAStatusInNVS(OTA_COMPLETE);
        ESP.restart();
    }
    else if (otastatus == HTTPS_OTA_FAIL)
    {
        Serial.println("Firmware Upgrade Fail");
        setOTAStatusInNVS(OTA_IDLE);
        ESP.restart();
    }
}

void HttpEvent(HttpEvent_t *event)
{
    switch (event->event_id)
    {
    case HTTP_EVENT_ERROR:
        Serial.println("Http Event Error");
        break;
    case HTTP_EVENT_ON_CONNECTED:
        Serial.println("Http Event On Connected");
        break;
    case HTTP_EVENT_HEADER_SENT:
        Serial.println("Http Event Header Sent");
        break;
    case HTTP_EVENT_ON_HEADER:
        Serial.printf("Http Event On Header, key=%s, value=%s\n", event->header_key, event->header_value);
        break;
    case HTTP_EVENT_ON_DATA:
        break;
    case HTTP_EVENT_ON_FINISH:
        Serial.println("Http Event On Finish");
        break;
    case HTTP_EVENT_DISCONNECTED:
        Serial.println("Http Event Disconnected");
        break;
    }
}

void performOTAUpdate()
{
    Serial.println("Starting OTA Update...");
    Serial.println("OTA URL: " + String(ota_firmware_url));
    HttpsOTA.onHttpEvent(HttpEvent);
    HttpsOTA.begin(ota_firmware_url, server_certificate);
}
