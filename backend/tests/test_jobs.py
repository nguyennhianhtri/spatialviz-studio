import unittest,time
from unittest.mock import AsyncMock,patch
from fastapi.testclient import TestClient
from app.main import app
from tests.test_extraction import plan_image
class ExtractionJobTests(unittest.TestCase):
 def test_job_accepts_upload_and_returns_the_real_pipeline_result_on_poll(self):
  with patch('app.jobs.extract_floor_plan',new=AsyncMock(return_value={'test_fixture':True})):
   with TestClient(app) as client:
    response=client.post('/api/extraction-jobs',data={'dimension_unit':'mm'},files={'file':('plan.png',plan_image(),'image/png')})
    self.assertEqual(response.status_code,202,response.text)
    job=response.json()['id']
    for _ in range(50):
     state=client.get('/api/extraction-jobs/'+job).json()
     if state.get('status')=='complete':break
     time.sleep(.01)
    self.assertEqual(state['result'],{'test_fixture':True})
 def test_unknown_job_is_404(self):
  with TestClient(app) as client:self.assertEqual(client.get('/api/extraction-jobs/missing').status_code,404)
