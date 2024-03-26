#!/bin/bash

# self signed cert
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout tls.key -out tls.crt -subj "/CN=example.com"
# make k8s secret from it
kubectl create secret tls example-com-tls --key tls.key --cert tls.crt