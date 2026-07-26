"""
lambda_get.py

Handles GET /readings for the dashboard - queries DynamoDB and sends
back the recent readings as JSON. Supports a drain_id filter so the
dashboard can pull history for just one drain at a time.

Function name: GetStormwaterData
Runtime: Python 3.12

Query params:
  ?drain_id=drain-01   -> only return readings for this drain
  ?limit=50            -> how many to return (default 50)
"""

import json
import os
import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ.get("TABLE_NAME", "StormwaterReadings")
table = dynamodb.Table(TABLE_NAME)

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
}


def lambda_handler(event, context):
    params = event.get("queryStringParameters") or {}
    drain_id = params.get("drain_id")
    limit = int(params.get("limit", 50))

    if drain_id:
        response = table.query(
            KeyConditionExpression=Key("drain_id").eq(drain_id),
            ScanIndexForward=False,  # most recent first
            Limit=limit,
        )
        items = response.get("Items", [])
    else:
        response = table.scan(Limit=limit)
        items = response.get("Items", [])
        items.sort(key=lambda r: r.get("timestamp", ""), reverse=True)

    return {
        "statusCode": 200,
        "headers": CORS_HEADERS,
        "body": json.dumps(items),
    }
