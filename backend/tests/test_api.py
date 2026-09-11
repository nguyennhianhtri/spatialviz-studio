"""Backend contract tests; no credentials or network required."""
import io
import os
import unittest
from unittest.mock import patch

from PIL import Image
from fastapi.testclient import TestClient


class StartupTests(unittest.TestCase):
    def test_starts_without_dotenv_or_azure_identity(self):
        # Optional integrations must not prevent the offline editor from booting.
        with patch.dict(os.environ, {}, clear=True):
            from app.main import app
            with TestClient(app) as client:
                response = client.get('/health')
        self.assertEqual(response.status_code, 200)


class OfflineTests(unittest.TestCase):
    def setUp(self):
        from app.main import app
        from app.config import settings
        self.config = patch.multiple(settings, AZURE_OPENAI_ENDPOINT='', AZURE_CU_ENDPOINT='')
        self.config.start()
        self.addCleanup(self.config.stop)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def test_readiness_distinguishes_running_from_extraction_available(self):
        data = self.client.get('/health').json()
        self.assertIs(data.get('extraction_available'), False)
        self.assertEqual(data['supported_upload_types'], ['image/png', 'image/jpeg'])

    def test_unconfigured_uploads_never_return_demo_or_call_cu(self):
        for endpoint in ['/api/extract', '/api/analyze', '/api/compare']:
            with self.subTest(endpoint=endpoint):
                result = self.client.post(endpoint, files={'file': ('plan.png', image_bytes(), 'image/png')})
                self.assertEqual(result.status_code, 503, result.text)
                self.assertNotIn('rooms', result.json())
        self.assertEqual(self.client.get('/api/demo-scene').status_code, 200)

    def test_unconfigured_report_and_chat_fail_explicitly(self):
        from app.demo_scene import DEMO_SCENE
        scene = DEMO_SCENE.model_dump()
        for endpoint, payload in [('/api/report', {'scene': scene}),
                                  ('/api/chat', {'scene': scene, 'message': 'How wide is the entry?'})]:
            response = self.client.post(endpoint, json=payload)
            self.assertEqual(response.status_code, 503, response.text)

    def test_scene_inputs_reject_unbounded_lists_duplicate_ids_and_invalid_dimensions(self):
        from app.demo_scene import DEMO_SCENE
        cases = []
        data = DEMO_SCENE.model_dump(); data['doors'][0]['width_m'] = -1; cases.append(data)
        data = DEMO_SCENE.model_dump(); data['doors'][0]['id'] = data['rooms'][0]['id']; cases.append(data)
        data = DEMO_SCENE.model_dump(); data['rooms'] *= 100; cases.append(data)
        for data in cases:
            response = self.client.post('/api/report', json={'scene': data})
            self.assertEqual(response.status_code, 422)

    def test_global_saved_layout_endpoints_are_retired(self):
        result = self.client.post('/api/save-layout', json={'rooms': []})
        self.assertEqual(result.status_code, 410)
        self.assertEqual(self.client.get('/api/saved-layout').status_code, 410)


class UploadValidationTests(OfflineTests):
    def test_decode_rejects_invalid_bytes_before_ai_readiness(self):
        cases = [
            ('fake.png', b'not an image', 'image/png', 422),
            ('cut.png', image_bytes()[:45], 'image/png', 422),
            ('plan.pdf', b'%PDF-1.7', 'application/pdf', 415),
            ('fake.png', image_bytes('GIF'), 'image/png', 415),
            ('empty.jpg', b'', 'image/jpeg', 422),
        ]
        for endpoint in ['/api/extract', '/api/analyze', '/api/compare']:
            for name, body, mime, status in cases:
                with self.subTest(endpoint=endpoint, name=name):
                    result = self.client.post(endpoint, files={'file': (name, body, mime)})
                    self.assertEqual(result.status_code, status, result.text)


def image_bytes(fmt='PNG', size=(128, 96), color='white'):
    output = io.BytesIO()
    Image.new('RGB', size, color).save(output, format=fmt)
    return output.getvalue()


if __name__ == '__main__':
    unittest.main()
