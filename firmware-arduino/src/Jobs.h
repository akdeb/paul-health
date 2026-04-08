#ifndef JOBS_H
#define JOBS_H

#include <Arduino.h>

void printEpochDebug(const char *label, uint64_t epochSeconds);
void printStoredSessionContext();
void printCurrentClockDebug();
void printJobScheduleSnapshot(const char *label);
void loadJobContextFromNVS();
bool syncNtpClock();
String getDueJobIdNow();
bool refreshNextJobSchedule();
void prepareJobContextBeforeWebsocket();
void configureSleepWakeFromJobs();

#endif
