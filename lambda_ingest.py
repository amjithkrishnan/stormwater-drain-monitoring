"""
lambda_ingest.py

This gets triggered by SQS (StormwaterQueue) whenever a message lands
in the queue. It just unpacks the JSON that fog_node.py sent and
writes it into the StormwaterReadings table in DynamoDB.

Function name: IngestStormwaterData
Runtime: Python 3.12
"""

import json
import os
import boto3

dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ.get("TABLE_NAME", "StormwaterReadings")
table = dynamodb.Table(TABLE_NAME)


def lambda_handler(event, context):
    processed = 0
    failures = []

    for record in event.get("Records", []):
        try:
            body = json.loads(record["body"])
            item = {
                "drain_id": body["drain_id"],
                "timestamp": body["timestamp"],
                "reading_id": body.get("reading_id"),
                "water_level_cm": str(body.get("water_level_cm")),
                "flow_rate_lpm": str(body.get("flow_rate_lpm")),
                "rainfall_mm": str(body.get("rainfall_mm")),
                "turbidity_ntu": str(body.get("turbidity_ntu")),
                "blockage_vibration_g": str(body.get("blockage_vibration_g")),
                "risk_level": body.get("risk_level", "UNKNOWN"),
                "risk_flags": body.get("risk_flags", []),
            }
            table.put_item(Item=item)
            processed += 1
        except Exception as exc:  # noqa: BLE001
            failures.append({"itemIdentifier": record.get("messageId")})
            print(f"Failed to process record: {exc}")

    print(f"Processed {processed} readings, {len(failures)} failures")

    # Returning batchItemFailures lets SQS retry only the failed messages
    return {"batchItemFailures": failures}
