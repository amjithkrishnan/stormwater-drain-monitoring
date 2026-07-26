"""
lambda_ingest_proxy.py

I needed this because API Gateway HTTP APIs don't have a simple direct
integration to SQS, so this is just a thin function sitting in between:
it takes whatever fog_node.py posts to /ingest and forwards it onto
StormwaterQueue, which then triggers IngestStormwaterData to do the
actual DynamoDB write.

Function name: IngestProxy
Trigger: API Gateway - POST /ingest
"""

import json
import os
import boto3

sqs = boto3.client("sqs")
QUEUE_URL = os.environ["QUEUE_URL"]  # set this as a Lambda env var


def lambda_handler(event, context):
    try:
        body = event.get("body", "{}")
        # HTTP API may base64-encode the body depending on content type
        if event.get("isBase64Encoded"):
            import base64
            body = base64.b64decode(body).decode("utf-8")

        # Validate it's JSON before forwarding
        json.loads(body)

        sqs.send_message(QueueUrl=QUEUE_URL, MessageBody=body)

        return {
            "statusCode": 202,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"status": "queued"}),
        }
    except Exception as exc:  # noqa: BLE001
        print(f"Error forwarding to SQS: {exc}")
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": str(exc)}),
        }
