#!/bin/sh

# Disable IPv6 configuration - remove IPv6 listen directive
sed -i 's/listen \[::\]:80/#listen \[::\]:80/' /etc/nginx/conf.d/default.conf
