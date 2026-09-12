import copy,unittest
from unittest.mock import AsyncMock,patch
from app.images import decode_image
from app.extraction import extract_floor_plan
from tests.test_extraction import plan_image
from tests.test_geometry import layout
class RepairTests(unittest.IsolatedAsyncioTestCase):
 async def test_invalid_inference_gets_one_image_grounded_correction_not_a_demo(self):
  good={**layout(),'scale_basis':'annotated','scale_evidence':'4172 x 3003 mm','warnings':[]}
  bad=copy.deepcopy(good);bad['doors']=[{'id':'d','x_mm':2000,'y_mm':1500,'width_mm':800,'orientation':'horizontal','type':'hinged'}]
  with patch('app.extraction.request_layout',new=AsyncMock(side_effect=[bad,good])) as infer:
   result=await extract_floor_plan(decode_image(plan_image()),'plan.png')
   self.assertEqual(infer.await_count,2)
   self.assertEqual(result['inferred_layout']['rooms'][0]['name'],good['rooms'][0]['name'])
   self.assertEqual(result['provenance']['geometry_review_passes'],2)
