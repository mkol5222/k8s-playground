#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <domain>"
  exit 1
fi

STATUS=$(./cgwaf.ts dns cert-cnames | jq --arg D $1 -r '.[]|select(.domain == $D)|.certificateValidationStatus')
echo $STATUS

if [ "$STATUS" == "SUCCESS" ]; then
  exit 0
fi
if [ "$STATUS" == "" ]; then
    echo "Domain not found"
  exit 1
fi

echo "Waiting for validation to complete..."

while [ "$STATUS" != "SUCCESS" ]; do
  sleep 5
  STATUS=$(./cgwaf.ts dns cert-cnames | jq --arg D $1 -r '.[]|select(.domain == $D)|.certificateValidationStatus')
  echo $(date) $STATUS
done