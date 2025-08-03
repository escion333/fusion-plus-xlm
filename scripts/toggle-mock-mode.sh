#!/bin/bash

# Script to toggle between mock mode and real mode for the frontend

ENV_FILE="frontend/.env.local"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found!"
    exit 1
fi

# Check current mode
if grep -q "NEXT_PUBLIC_MOCK_MODE=true" "$ENV_FILE"; then
    echo "Switching from MOCK mode to REAL mode..."
    sed -i '' '/NEXT_PUBLIC_MOCK_MODE=/d' "$ENV_FILE"
    echo "✅ Real mode activated - Frontend will connect to actual services"
else
    echo "Switching from REAL mode to MOCK mode..."
    echo "NEXT_PUBLIC_MOCK_MODE=true" >> "$ENV_FILE"
    echo "✅ Mock mode activated - Frontend will use simulated data"
fi

echo ""
echo "Changes applied to $ENV_FILE"
echo "Please restart the frontend server for changes to take effect:"
echo "  cd frontend && npm run dev"