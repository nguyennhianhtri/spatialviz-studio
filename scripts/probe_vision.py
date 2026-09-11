"""Bounded operator-run probe of an explicitly supplied Azure deployment."""
import argparse
import base64
import json
import subprocess
from pathlib import Path
import httpx

parser = argparse.ArgumentParser()
parser.add_argument('--endpoint', required=True)
parser.add_argument('--model', required=True)
parser.add_argument('--image', required=True)
args = parser.parse_args()
token = json.loads(subprocess.check_output(['az', 'account', 'get-access-token', '--resource', 'https://cognitiveservices.azure.com/', '-o', 'json']))['accessToken']
image = base64.b64encode(Path(args.image).read_bytes()).decode()
response = httpx.post(args.endpoint.rstrip('/') + '/openai/v1/chat/completions', headers={'Authorization': 'Bearer ' + token}, json={'model': args.model, 'messages': [{'role': 'user', 'content': [{'type': 'text', 'text': 'Read this floor plan image. Return only JSON with bedroom_count, room_labels, overall_width_mm. Do not invent invisible dimensions.'}, {'type': 'image_url', 'image_url': {'url': 'data:image/png;base64,' + image}}]}], 'max_completion_tokens': 1500}, timeout=180)
print('HTTP', response.status_code)
if response.is_success:
    data = response.json()
    print(json.dumps({'model': data.get('model'), 'content': data['choices'][0]['message']['content'], 'usage': data.get('usage')}, indent=2))
else:
    print(response.text[:1500])
    raise SystemExit(1)
