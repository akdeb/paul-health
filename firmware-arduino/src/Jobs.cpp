#include "Jobs.h"

#include "Config.h"
#include "ArduinoJson.h"
#include <HTTPClient.h>
#include <Preferences.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include <esp_sleep.h>

static constexpr const char *NVS_JOB_FIRE_KEY = "job_fire_at";
static constexpr const char *NVS_JOB_CHECK_KEY = "job_check_at";
static constexpr uint64_t JOB_REFRESH_INTERVAL_SECONDS = 300;

static uint64_t getNextPeriodicCheckEpoch(time_t now)
{
    if (now <= 0) {
        return 0;
    }

    const uint64_t nowEpoch = static_cast<uint64_t>(now);
    return ((nowEpoch / JOB_REFRESH_INTERVAL_SECONDS) + 1) *
        JOB_REFRESH_INTERVAL_SECONDS;
}

static void persistJobContext(
    const String &timezone,
    const String &nextJobId,
    uint64_t nextJobFireEpoch,
    uint64_t nextCheckEpoch
)
{
    preferences.begin("auth", false);
    preferences.putString("timezone", timezone);
    preferences.putString("next_job_id", nextJobId);
    preferences.putULong64(NVS_JOB_FIRE_KEY, nextJobFireEpoch);
    preferences.putULong64(NVS_JOB_CHECK_KEY, nextCheckEpoch);
    preferences.end();

    timezoneGlobal = timezone;
    nextJobIdGlobal = nextJobId;
    nextJobFireAtEpochGlobal = nextJobFireEpoch;
    nextJobCheckAtEpochGlobal = nextCheckEpoch;
}

void printEpochDebug(const char *label, uint64_t epochSeconds)
{
    Serial.printf("%s: %llu", label, epochSeconds);

    if (epochSeconds == 0) {
        Serial.println(" (unset)");
        return;
    }

    time_t raw = static_cast<time_t>(epochSeconds);
    struct tm timeInfo;
    if (localtime_r(&raw, &timeInfo)) {
        char buffer[64];
        strftime(buffer, sizeof(buffer), "%Y-%m-%d %H:%M:%S %Z", &timeInfo);
        Serial.printf(" (%s)\n", buffer);
        return;
    }

    Serial.println(" (failed to format)");
}

void printStoredSessionContext()
{
    Serial.println("=== Stored auth/job context (NVS mirror) ===");
    Serial.printf("auth_token length: %u\n", authTokenGlobal.length());
    Serial.println("timezone: " + timezoneGlobal);
    Serial.println("next_job_id: " + (nextJobIdGlobal.isEmpty() ? String("(empty)") : nextJobIdGlobal));
    printEpochDebug("job_fire_at (NVS)", nextJobFireAtEpochGlobal);
    printEpochDebug("job_check_at (NVS)", nextJobCheckAtEpochGlobal);
    Serial.println("===========================================");
}

void printCurrentClockDebug()
{
    time_t now = time(nullptr);
    Serial.printf("Current epoch: %lld\n", static_cast<long long>(now));

    if (now <= 0) {
        Serial.println("Current local time: unavailable (NTP not synced yet)");
        return;
    }

    struct tm timeInfo;
    if (localtime_r(&now, &timeInfo)) {
        char buffer[64];
        strftime(buffer, sizeof(buffer), "%Y-%m-%d %H:%M:%S %Z", &timeInfo);
        Serial.printf("Current local time: %s\n", buffer);
    }
}

void loadJobContextFromNVS()
{
    preferences.begin("auth", false);
    timezoneGlobal = preferences.getString("timezone", "UTC");
    nextJobIdGlobal = preferences.getString("next_job_id", "");
    nextJobFireAtEpochGlobal = preferences.getULong64(NVS_JOB_FIRE_KEY, 0);
    nextJobCheckAtEpochGlobal = preferences.getULong64(NVS_JOB_CHECK_KEY, 0);
    preferences.end();
}

void printJobScheduleSnapshot(const char *label)
{
    Serial.printf("=== %s ===\n", label);
    Serial.println("timezone: " + timezoneGlobal);
    Serial.println("next_job_id: " + (nextJobIdGlobal.isEmpty() ? String("(empty)") : nextJobIdGlobal));
    printEpochDebug("job_fire_at (NVS)", nextJobFireAtEpochGlobal);
    printEpochDebug("job_check_at (NVS)", nextJobCheckAtEpochGlobal);

    time_t now = time(nullptr);
    Serial.printf("current_epoch: %lld\n", static_cast<long long>(now));
    if (now > 0) {
        struct tm timeInfo;
        if (localtime_r(&now, &timeInfo)) {
            char buffer[64];
            strftime(buffer, sizeof(buffer), "%Y-%m-%d %H:%M:%S %Z", &timeInfo);
            Serial.printf("current_local_time: %s\n", buffer);
        }
    }
    Serial.println("========================");
}

bool syncNtpClock()
{
    configTime(0, 0, "pool.ntp.org", "time.google.com", "time.nist.gov");

    for (int i = 0; i < 20; i++) {
        time_t now = time(nullptr);
        if (now > 1700000000) {
            return true;
        }
        delay(250);
    }

    return false;
}

String getDueJobIdNow()
{
    if (nextJobIdGlobal.isEmpty() || nextJobFireAtEpochGlobal == 0) {
        return "";
    }

    time_t now = time(nullptr);
    if (now <= 0) {
        return "";
    }

    const int64_t delta = static_cast<int64_t>(nextJobFireAtEpochGlobal) -
        static_cast<int64_t>(now);

    // Treat as due when we are up to 60s early or up to 10m late.
    if (delta <= 60 && delta >= -600) {
        return nextJobIdGlobal;
    }

    return "";
}

bool refreshNextJobSchedule()
{
    if (authTokenGlobal.isEmpty()) {
        return false;
    }

    Serial.println("[JOBS] Refreshing next job schedule from backend...");

    HTTPClient http;

    #ifdef DEV_MODE
    http.begin("http://" + String(backend_server) + ":" + String(backend_port) +
                 "/api/next_job");
    #else
    WiFiClientSecure client;
    client.setCACert(Vercel_CA_cert);
    http.begin(client, "https://" + String(backend_server) + "/api/next_job");
    #endif

    http.addHeader("Authorization", "Bearer " + String(authTokenGlobal));
    http.setTimeout(10000);

    int httpCode = http.GET();
    if (httpCode != HTTP_CODE_OK) {
        Serial.printf("[JOBS] next_job request failed: %d\n", httpCode);
        http.end();
        return false;
    }

    String payload = http.getString();
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (error) {
        Serial.print("[JOBS] next_job JSON parsing failed: ");
        Serial.println(error.c_str());
        http.end();
        return false;
    }

    String timezone = doc["timezone"] | String("UTC");
    String nextJobId = doc["next_job"]["job_id"] | String("");
    uint64_t nextJobFireEpoch = doc["next_job"]["fire_at_epoch"] | static_cast<uint64_t>(0);
    uint64_t nextCheckEpoch = getNextPeriodicCheckEpoch(time(nullptr));

    persistJobContext(timezone, nextJobId, nextJobFireEpoch, nextCheckEpoch);

    printJobScheduleSnapshot("Updated next job schedule");

    http.end();
    return true;
}

bool shouldStartWebsocketForCurrentWake()
{
    activeJobIdGlobal = "";

    const bool ntpSynced = syncNtpClock();
    Serial.printf("[TIME] NTP sync %s\n", ntpSynced ? "ok" : "failed");
    printJobScheduleSnapshot("Job schedule snapshot at wake");

    const esp_sleep_wakeup_cause_t wakeCause = esp_sleep_get_wakeup_cause();
    const bool isTimerWake = wakeCause == ESP_SLEEP_WAKEUP_TIMER;

    if (!isTimerWake) {
        Serial.println("[JOBS] Non-timer wake detected; starting websocket without scheduled job lookup.");
        return true;
    }

    deviceState = WAITING;
    Serial.println("[JOBS] Timer wake entering WAITING state for job check.");

    const String dueJobId = getDueJobIdNow();
    if (!dueJobId.isEmpty()) {
        activeJobIdGlobal = dueJobId;
        deviceState = IDLE;
        Serial.println("[JOBS] Timer wake hit a due scheduled job: " + activeJobIdGlobal);
        Serial.println("[JOBS] Handing LED control back to the active websocket session.");
        return true;
    }

    const bool refreshed = refreshNextJobSchedule();
    Serial.printf("[JOBS] Timer wake /api/next_job sync %s\n", refreshed ? "ok" : "failed");
    deviceState = IDLE;
    Serial.println("[JOBS] No scheduled job due on timer wake. Going back to sleep.");
    return false;
}

void configureSleepWakeFromJobs()
{
    time_t now = time(nullptr);
    uint64_t wakeEpoch = 0;

    if (now > 0) {
        const uint64_t nextPeriodicCheckEpoch = getNextPeriodicCheckEpoch(now);
        if (nextJobCheckAtEpochGlobal != nextPeriodicCheckEpoch) {
            nextJobCheckAtEpochGlobal = nextPeriodicCheckEpoch;
            persistJobContext(
                timezoneGlobal,
                nextJobIdGlobal,
                nextJobFireAtEpochGlobal,
                nextJobCheckAtEpochGlobal
            );
            Serial.println("job_check_at aligned to the next 5-minute boundary.");
        }

        if (nextJobFireAtEpochGlobal > static_cast<uint64_t>(now)) {
            wakeEpoch = nextJobFireAtEpochGlobal;
            Serial.println("Next wake target chosen from job_fire_at");
        }

        if (
            nextJobCheckAtEpochGlobal > static_cast<uint64_t>(now) &&
            (wakeEpoch == 0 || nextJobCheckAtEpochGlobal < wakeEpoch)
        ) {
            wakeEpoch = nextJobCheckAtEpochGlobal;
            Serial.println("Next wake target chosen from job_check_at");
        }

        if (wakeEpoch > static_cast<uint64_t>(now)) {
            const uint64_t wakeDelaySeconds = wakeEpoch - static_cast<uint64_t>(now);
            printEpochDebug("scheduled_wake_epoch", wakeEpoch);
            esp_sleep_enable_timer_wakeup(wakeDelaySeconds * 1000000ULL);
            Serial.printf("Scheduled timer wake in %llu seconds\n", wakeDelaySeconds);
        } else {
            Serial.println("No future job_fire_at/job_check_at found; timer wake not scheduled.");
        }
        return;
    }

    Serial.println("scheduled_wake_epoch: unavailable (RTC clock not set)");
}
