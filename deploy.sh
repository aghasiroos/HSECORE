#!/bin/bash
# ==============================================================================
# HSE Enterprise Management System - One-Click Auto Installer & Updater
# Fully dynamic: works on ANY server, ANY IP, and ANY domain without configuration.
# ==============================================================================

set -e

# Detect server public or local IP address automatically
DETECTED_IP=$(curl -s --max-time 3 https://api.ipify.org || curl -s --max-time 3 https://ifconfig.me || hostname -I | awk '{print $1}')
if [ -z "$DETECTED_IP" ]; then
  DETECTED_IP="127.0.0.1"
fi

echo "=================================================================="
echo " [HSE Management System] Auto Installer & Configurator"
echo " Detected Server IP : ${DETECTED_IP}"
echo "=================================================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "[!] Docker not found. Installing Docker & Docker Compose..."
    apt-get update && apt-get install -y docker.io docker-compose-v2 git curl
    systemctl enable --now docker
fi

# Ensure 2GB Swap exists to guarantee smooth build on 1GB/2GB VPS machines
SWAP_TOTAL=$(free -m | awk '/^Swap:/ {print $2}')
if [ "$SWAP_TOTAL" -lt 1024 ]; then
    echo "[+] Configuring 2GB Swap space for stable builds..."
    if [ ! -f /swapfile ]; then
        fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        echo '/swapfile none swap sw 0 0' >> /etc/fstab || true
    fi
fi

# Configure Nginx Reverse Proxy on Host if Nginx is installed
if command -v nginx &> /dev/null; then
    echo "[+] Host Nginx detected. Configuring port 80 -> 3000 reverse proxy..."
    cat << 'EOF' > /etc/nginx/sites-available/default
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
EOF
    nginx -t && (systemctl reload nginx || systemctl restart nginx)
    echo "[+] Nginx reverse proxy active on port 80!"
fi

# Validate .env and mandatory security variables before building or starting containers
if [ ! -f .env ]; then
    echo "[ERROR] .env file not found! Please run 'sudo ./install.sh' to configure PostgreSQL and security secrets safely."
    exit 1
fi

SQL_PW_VAL=$(grep -E '^SQL_PASSWORD=' .env | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)
JWT_SEC_VAL=$(grep -E '^JWT_SECRET=' .env | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)
PG_PORT_VAL=$(grep -E '^POSTGRES_PORT=' .env | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo "5432")

if [ -z "$SQL_PW_VAL" ] || [ "$SQL_PW_VAL" = "hse_secure_password_2026" ]; then
    echo "[FATAL SECURITY ERROR] SQL_PASSWORD in .env is missing or uses the prohibited default placeholder."
    echo "Please run 'sudo ./install.sh --step 5' to set a strong database password."
    exit 1
fi

if [ -z "$JWT_SEC_VAL" ] || [ "${#JWT_SEC_VAL}" -lt 32 ]; then
    echo "[FATAL SECURITY ERROR] JWT_SECRET in .env is missing or shorter than 32 characters."
    exit 1
fi

# Allow firewall ports if ufw is active (never expose PostgreSQL 5432 publicly)
if command -v ufw &> /dev/null && ufw status | grep -q "Status: active"; then
    echo "[+] Configuring UFW firewall rules (allowing HTTP/HTTPS and restricting PostgreSQL to Docker bridge)..."
    ufw allow 80/tcp || true
    ufw allow 443/tcp || true
    ufw allow from 127.0.0.1 to any port "${PG_PORT_VAL}" proto tcp || true
    ufw allow from 172.16.0.0/12 to any port "${PG_PORT_VAL}" proto tcp || true
    ufw allow in on docker0 to any port "${PG_PORT_VAL}" proto tcp || true
    ufw deny "${PG_PORT_VAL}/tcp" || true
fi

# Allow Docker forwarding in iptables
iptables -P FORWARD ACCEPT 2>/dev/null || true

# Clean legacy dist to avoid stale bundle artifacts
rm -rf dist

echo "[+] Building and launching container with Docker Compose..."
# If user provided a git repository, pull latest updates
if [ -d .git ]; then
    echo "[+] Fetching latest updates from git repository..."
    git pull || true
fi

# Rebuild and start container dynamically
docker compose -f docker-compose.server.yml up -d --build --remove-orphans

echo ""
echo "=================================================================="
echo " [SUCCESS] HSE Enterprise System is now UP and RUNNING!"
echo " Open in your browser:"
echo " -> Standard Web (Port 80) : http://${DETECTED_IP}"
echo "=================================================================="
