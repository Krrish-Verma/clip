#!/bin/sh
set -eu

awslocal s3api create-bucket --bucket clip 2>/dev/null || true
awslocal s3api put-bucket-cors \
  --bucket clip \
  --cors-configuration file:///etc/localstack/init/cors.json
