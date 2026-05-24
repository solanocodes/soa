#!/bin/bash
set -e

echo "========================================="
echo "  SOA Backend — Railway Deploy Script"
echo "========================================="
echo ""

# Check for Railway CLI
if ! command -v railway &> /dev/null; then
  echo "Installing Railway CLI..."
  npm install -g @railway/cli
fi

# Check login
echo "Checking Railway auth..."
if ! railway whoami 2>/dev/null; then
  echo "Please login to Railway:"
  railway login
fi

echo ""
echo "Creating Railway project..."
railway init --name soa-backend

echo ""
echo "Adding PostgreSQL database..."
railway add --plugin postgresql

echo ""
echo "Setting environment variables..."
railway variables set \
  NODE_ENV=production \
  JWT_SECRET=$(openssl rand -hex 32) \
  JWT_REFRESH_SECRET=$(openssl rand -hex 32) \
  PORT=3000

echo ""
echo "========================================="
echo "  MANUAL STEP: Add your API keys"
echo "========================================="
echo ""
echo "Go to your Railway dashboard and add these env vars:"
echo "  STRIPE_SECRET_KEY=sk_..."
echo "  STRIPE_WEBHOOK_SECRET=whsec_..."
echo "  OPENAI_API_KEY=sk-..."
echo "  RESEND_API_KEY=re_..."
echo "  ONESIGNAL_APP_ID=..."
echo "  ONESIGNAL_API_KEY=..."
echo ""
echo "Press Enter when ready to continue (or Ctrl+C to add keys first)..."
read -r

echo ""
echo "Deploying backend..."
cd backend
railway up --detach

echo ""
echo "Waiting for deploy to finish..."
sleep 30

echo ""
echo "Running database migrations..."
railway run npm run migrate

echo ""
echo "Seeding channels + admin user..."
railway run npm run seed

echo ""
echo "========================================="
echo "  Deploy complete!"
echo "========================================="
echo ""
echo "Your backend URL:"
railway domain
echo ""
echo "Default admin login:"
echo "  Email: sean@simplyoptionsacademy.com"
echo "  Password: changeme123"
echo ""
echo "Next steps:"
echo "  1. Add your API keys in the Railway dashboard"
echo "  2. Run: railway run npm run import  (to load historical data)"
echo "  3. Update EXPO_PUBLIC_API_URL in frontend to your Railway URL"
echo "  4. Run the Expo app: cd frontend && npx expo start"
echo ""
