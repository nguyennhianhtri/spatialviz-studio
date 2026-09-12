"""A controlled Azure HTTP fixture tests wiring, NOT real model accuracy."""
import base64
import hashlib
import io
import json
import unittest
from unittest.mock import patch

import httpx
from openai import AzureOpenAI
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from tests.test_geometry import layout


def plan_image(fmt='PNG', size=(256, 192)):
    image = Image.new('RGB', size, 'white')
    draw = ImageDraw.Draw(image)
    draw.rectangle((20, 20, size[0]-20, size[1]-20), outline='black', width=3)
    draw.text((40, 55), 'Study 4172 x 3003 mm', fill='black')
    output = io.BytesIO(); image.save(output, format=fmt)
    return output.getvalue()


class VisionExtractionTests(unittest.TestCase):
    def setUp(self):
        config = patch.multiple(settings, AZURE_OPENAI_ENDPOINT='https://fixture.openai.azure.com',
                                AZURE_OPENAI_DEPLOYMENT='test-vision', AZURE_OPENAI_API_KEY='fixture-key',
                                AZURE_CU_ENDPOINT='', AZURE_CU_ANALYZER='', AZURE_CU_API_KEY='')
        config.start(); self.addCleanup(config.stop)
        self.client = TestClient(app); self.addCleanup(self.client.close)
        self.requests = []
        self.output = {**layout(), 'scale_basis': 'annotated',
                       'scale_evidence': '4172 x 3003 mm dimension annotations', 'warnings': []}
        def respond(request):
            self.requests.append(json.loads(request.content))
            return httpx.Response(200, json={
                'id': 'fixture', 'object': 'chat.completion', 'created': 1, 'model': 'test-vision',
                'choices': [{'index': 0, 'finish_reason': 'stop', 'message': {
                    'role': 'assistant', 'content': json.dumps(self.output)}}]})
        def client(*args, **kwargs):
            return AzureOpenAI(azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
                               api_version=settings.AZURE_OPENAI_API_VERSION, api_key='fixture-key',
                               http_client=httpx.Client(transport=httpx.MockTransport(respond)), max_retries=0)
        provider = patch('app.vision._get_client', side_effect=client)
        provider.start(); self.addCleanup(provider.stop)
        # The legacy mandatory CU path must fail rather than discovering credentials during RED.
        import app.extraction as extraction
        if hasattr(extraction, '_get_cu_token'):
            guard = patch('app.extraction._get_cu_token', side_effect=RuntimeError('CU disabled in test'))
            guard.start(); self.addCleanup(guard.stop)

    def test_decoded_image_drives_azure_request_and_response_without_cu(self):
        for fmt, size in [('PNG', (256, 192)), ('JPEG', (320, 200))]:
            body = plan_image(fmt, size)
            self.output['rooms'][0]['name'] = fmt + ' fixture room'
            response = self.client.post('/api/extract', files={'file': ('misleading.bin', body, 'application/octet-stream')})
            self.assertEqual(response.status_code, 200, response.text)
            data = response.json()
            self.assertEqual((data['page_width'], data['page_height']), size)
            self.assertEqual(data['source_hash'], hashlib.sha256(body).hexdigest())
            self.assertEqual(data['inferred_layout']['rooms'][0]['name'], fmt + ' fixture room')
            self.assertEqual(data['inferred_layout']['rooms'][0]['width_mm'], 4172)
            self.assertEqual(data['dimensions'], [])  # Not fabricated OCR measurements
            self.assertTrue(data['warnings'])
            self.assertEqual(data['provenance']['provider'], 'azure_openai')
            request = self.requests[-1]
            url = request['messages'][1]['content'][-1]['image_url']['url']
            self.assertEqual(url, 'data:' + data['image_mime'] + ';base64,' + data['image_base64'])
            with Image.open(io.BytesIO(base64.b64decode(url.split(',')[1]))) as image:
                self.assertEqual(image.size, size)
        self.assertEqual(len(self.requests), 2)

    def test_invalid_report_response_never_becomes_a_canned_score(self):
        from app.demo_scene import DEMO_SCENE
        response = self.client.post('/api/report', json={'scene': DEMO_SCENE.model_dump()})
        self.assertEqual(response.status_code, 502, response.text[:200])

    def test_scale_must_be_supported_by_annotations_not_fabricated_defaults(self):
        for change in [{'scale_basis': 'estimated'}, {'scale_evidence': ''}, {'scale_basis': None}]:
            with self.subTest(change=change):
                original = dict(self.output)
                self.output.update(change)
                response = self.client.post('/api/extract', files={'file': ('plan.png', plan_image(), 'image/png')})
                self.assertEqual(response.status_code, 422, response.text[:150])
                self.output = original

    def test_model_refusal_returns_actionable_error_not_invalid_scene(self):
        self.output = {'error': 'The photo is not a dimensioned floor plan.'}
        response = self.client.post('/api/extract', files={'file': ('plan.png', plan_image(), 'image/png')})
        self.assertEqual(response.status_code, 422)
        self.assertIn('dimensioned floor plan', response.json()['detail'])

    def test_model_specific_warnings_are_retained_and_bounded(self):
        self.output['warnings'] = ['Window width is estimated from the calibrated drawing.']
        response = self.client.post('/api/extract', files={'file': ('plan.png', plan_image(), 'image/png')})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn(self.output['warnings'][0], response.json()['warnings'])
        self.output['warnings'] = ['too many'] * 101
        response = self.client.post('/api/extract', files={'file': ('plan.png', plan_image(), 'image/png')})
        self.assertEqual(response.status_code, 502)

    def test_bad_model_geometry_is_rejected_without_repair(self):
        for change in [{'rooms': []}, {'overall_width_mm': -1}, {'doors': [{}]}]:
            original = dict(self.output)
            self.output.update(change)
            response = self.client.post('/api/extract', files={'file': ('plan.png', plan_image(), 'image/png')})
            self.assertEqual(response.status_code, 502, response.text[:150])
            self.output = original


if __name__ == '__main__':
    unittest.main()
