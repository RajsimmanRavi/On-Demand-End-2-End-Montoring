#!/bin/bash

{
    if [ -f "/var/e2emonitoring/E2EWebServer/labBRASList_tmp2.csv" ]; then
        "/var/e2emonitoring/E2EWebServer/labBRASList_tmp2.csv" "/var/e2emonitoring/E2EWebServer/labBRASList_tmp.csv"
    fi
} || {
    echo "ERROR: COULD NOT REPLACE FILE!!"
}
