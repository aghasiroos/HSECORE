#!/bin/bash
# Universal startup script for HSE System on ANY server and ANY IP
export NODE_ENV=production
PORT="${PORT:-3000}"

echo "================================================="
echo " Starting HSE Management System..."
echo " Listening dynamically on port ${PORT} (0.0.0.0)"
echo " Accessible via any Server IP or configured Domain"
echo "================================================="

# Run compiled production server
node dist/server.cjs
