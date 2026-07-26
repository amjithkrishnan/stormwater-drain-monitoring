========================================================================
SMART STORMWATER DRAIN MONITORING
Fog and Edge Computing (H9FECC) - CA Project
========================================================================
Student: Amjith
Course: MSc Cloud Computing, National College of Ireland
Module: H9FECC Fog and Edge Computing

PROJECT OVERVIEW
-----------------
This project monitors a network of stormwater drains to catch flooding
risk early, instead of relying on manual/reactive checks. It simulates
5 sensor types per drain, processes readings at a fog layer for
immediate risk scoring, and sends everything to a scalable AWS backend
that feeds a live dashboard.

ARCHITECTURE
------------
Sensor Simulators (Python, on EC2)
    -> Fog Node (Python, on EC2)
        -> HTTPS POST -> API Gateway
            -> SQS Queue (StormwaterQueue)
                -> Lambda (IngestStormwaterData)
                    -> DynamoDB (StormwaterReadings table)
Dashboard (React, built with Vite)
    -> API Gateway GET /readings (queried per drain_id)
        -> Lambda (GetStormwaterData)
            -> DynamoDB (query)

Scalability: SQS decouples ingestion from processing, all 3 Lambdas
scale automatically with load, and DynamoDB runs in on-demand
(PAY_PER_REQUEST) mode so it scales with read/write volume without
any manual provisioning.

Drains are grouped into 3 zones (North/Central/South) on the dashboard
so it's quicker to spot which area has a problem, with zone + severity
filters to narrow things down further.

Sensor types simulated (5):
  1. water_level_cm      - drain water level
  2. flow_rate_lpm        - flow rate (litres/min)
  3. rainfall_mm          - rainfall intensity
  4. turbidity_ntu        - water turbidity
  5. blockage_vibration_g - vibration proxy for blockage detection

SOURCE FILES IN THIS SUBMISSION
--------------------------------
sensors.py               - sensor simulator (5 sensor types, 6 drains,
                            3 zones)
fog_node.py               - fog layer: local risk scoring + dispatch to
                            the cloud backend
lambda_ingest_proxy.py     - Lambda: API Gateway -> SQS forwarder
lambda_ingest.py           - Lambda: SQS -> DynamoDB writer
lambda_get.py              - Lambda: API Gateway GET /readings -> DynamoDB
stormwater-dashboard/      - React (Vite) dashboard source
StormwaterDashboard.jsx    - copy of the dashboard component (kept at
                            the project root too, for quick reference)
.github/workflows/         - GitHub Actions workflow that auto-deploys
deploy-lambdas.yml           the 3 Lambda functions on push (see Step 12)

========================================================================
INSTALLATION INSTRUCTIONS (EC2 Ubuntu)
========================================================================
------------------------------------------------------------------------
STEP 1 - UPDATE SYSTEM & INSTALL BASE PACKAGES
------------------------------------------------------------------------
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv git unzip zip curl

------------------------------------------------------------------------
STEP 2 - CREATE PROJECT DIRECTORY & VIRTUAL ENVIRONMENT
------------------------------------------------------------------------
mkdir -p ~/stormwater-project && cd ~/stormwater-project
python3 -m venv venv
source venv/bin/activate

------------------------------------------------------------------------
STEP 3 - INSTALL PYTHON PACKAGES
------------------------------------------------------------------------
pip install --upgrade pip
pip install boto3 requests

(boto3    - AWS SDK, used by the Lambda functions
 requests - fog_node.py uses this to POST to API Gateway)

------------------------------------------------------------------------
STEP 4 - INSTALL & CONFIGURE AWS CLI
------------------------------------------------------------------------
sudo apt install -y awscli
aws configure
   AWS Access Key ID:     <from AWS Academy "AWS Details" > "AWS CLI">
   AWS Secret Access Key: <from AWS Academy "AWS Details" > "AWS CLI">
   Default region name:   us-east-1
   Default output format: json

------------------------------------------------------------------------
STEP 5 - CREATE THE SQS QUEUE
------------------------------------------------------------------------
aws sqs create-queue --queue-name StormwaterQueue --region us-east-1

------------------------------------------------------------------------
STEP 6 - CREATE THE DYNAMODB TABLE
------------------------------------------------------------------------
aws dynamodb create-table \
  --table-name StormwaterReadings \
  --attribute-definitions \
      AttributeName=drain_id,AttributeType=S \
      AttributeName=timestamp,AttributeType=S \
  --key-schema \
      AttributeName=drain_id,KeyType=HASH \
      AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

------------------------------------------------------------------------
STEP 7 - CREATE THE THREE LAMBDA FUNCTIONS
------------------------------------------------------------------------

  a) IngestProxy           - triggered by API Gateway POST /ingest,
                             forwards the request body to SQS
  b) IngestStormwaterData  - triggered by SQS, writes to DynamoDB
  c) GetStormwaterData     - triggered by API Gateway GET /readings,
                             reads from DynamoDB

Via CLI (adjust function name/handler/zip per function):
  zip lambda_ingest.zip lambda_ingest.py
  aws lambda create-function \
    --function-name IngestStormwaterData \
    --runtime python3.12 \
    --role arn:aws:iam::<ACCOUNT_ID>:role/LabRole \
    --handler lambda_ingest.lambda_handler \
    --zip-file fileb://lambda_ingest.zip \
    --timeout 15 \
    --region us-east-1

  (repeat for lambda_ingest_proxy.py -> IngestProxy, and
   lambda_get.py -> GetStormwaterData)

For IngestProxy, also set the QUEUE_URL environment variable to the
queue URL from Step 5:
  aws lambda update-function-configuration \
    --function-name IngestProxy \
    --environment "Variables={QUEUE_URL=<queue-url>}" \
    --region us-east-1

Wire the SQS trigger onto IngestStormwaterData:
  aws lambda create-event-source-mapping \
    --function-name IngestStormwaterData \
    --event-source-arn <StormwaterQueue ARN> \
    --batch-size 10 \
    --region us-east-1

------------------------------------------------------------------------
STEP 8 - CREATE API GATEWAY
------------------------------------------------------------------------
1. API Gateway > Create API > HTTP API, name it StormwaterAPI
2. Add route POST /ingest -> integrate with Lambda IngestProxy
3. Add route GET /readings -> integrate with Lambda GetStormwaterData
4. Enable CORS on the API (Access-Control-Allow-Origin: *,
   methods GET/POST/OPTIONS, headers Content-Type)
5. Confirm the $default stage has auto-deploy on, note the Invoke URL

------------------------------------------------------------------------
STEP 9 - RUN THE SENSOR SIMULATOR + FOG NODE
------------------------------------------------------------------------
cd ~/stormwater-project
source venv/bin/activate
export API_ENDPOINT="https://<your-api-id>/ingest"
python3 fog_node.py

(fog_node.py imports sensors.py's generator functions, applies local
threshold checks per reading, and POSTs each one to $API_ENDPOINT)

To keep it running in the background during a demo:
  sudo apt install -y tmux
  tmux new -s stormwater
  source venv/bin/activate
  export API_ENDPOINT="..."
  python3 fog_node.py
  (Ctrl+B then D to detach; `tmux attach -t stormwater` to reattach)

------------------------------------------------------------------------
STEP 10 - BUILD & HOST THE REACT DASHBOARD
------------------------------------------------------------------------
1. Install Node.js:
   curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
   sudo apt install -y nodejs

2. From inside stormwater-dashboard/:
   npm install
   npm install recharts lucide-react

3. Open src/StormwaterDashboard.jsx and set API_BASE (near the top)
   to your API Gateway Invoke URL from Step 9.

4. Build:
   npm run build

5. Serve the built dashboard from EC2:
   cd dist
   python3 -m http.server 80
   (ensure security group allows inbound TCP 80)
   Visit http://<EC2_PUBLIC_IP>/

   Or with nginx:
   sudo apt install -y nginx
   sudo rm -rf /var/www/html/*
   sudo cp -r dist/* /var/www/html/
   sudo systemctl restart nginx

For live-reload during development instead of rebuilding each time:
   npm run dev -- --host 0.0.0.0 --port 5173
   (open inbound TCP 5173 in the security group)
   Visit http://<EC2_PUBLIC_IP>:5173/

------------------------------------------------------------------------
STEP 12 - CI/CD: AUTO-DEPLOY LAMBDAS VIA GITHUB ACTIONS
------------------------------------------------------------------------
A GitHub Actions workflow (.github/workflows/deploy-lambdas.yml) is
included so that pushing a change to lambda_ingest.py, lambda_get.py,
or lambda_ingest_proxy.py on the main branch automatically re-deploys
that function via `aws lambda update-function-code`, instead of doing
it by hand every time.

To use it:
1. Push this project to a GitHub repo, with this folder as the repo
   root (so lambda_ingest.py etc. sit at the top level, matching the
   paths in the workflow file).
2. In the repo's Settings > Secrets and variables > Actions, add:
   - AWS_ACCESS_KEY_ID
   - AWS_SECRET_ACCESS_KEY
   - AWS_SESSION_TOKEN
   (all three from the AWS Academy Learner Lab "AWS Details" > "AWS CLI"
   panel - the session token is required because Academy Lab credentials
   are temporary, unlike a normal IAM user's long-lived keys)
3. Push a change to any of the three lambda_*.py files - the workflow
   runs automatically and updates that function's code in AWS.
