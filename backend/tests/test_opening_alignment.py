import copy,unittest
from app.opening_alignment import align_inferred_openings
class OpeningAlignmentTests(unittest.TestCase):
 def test_minor_opening_overhang_moves_only_the_inferred_opening_with_disclosure(self):
  raw={'rooms':[{'id':'bath','x_mm':1066,'y_mm':1200,'width_mm':914,'height_mm':2082}], 'doors':[{'id':'door','x_mm':1780,'y_mm':3282,'width_mm':700,'orientation':'horizontal'}],'windows':[]}
  before=copy.deepcopy(raw);out,adjustments=align_inferred_openings(raw)
  self.assertEqual(raw,before)
  self.assertEqual(out['rooms'],before['rooms'])
  self.assertEqual(out['doors'][0]['x_mm'],1630)
  self.assertEqual(adjustments[0]['shift_mm'],150)
 def test_large_mismatch_is_not_patched_into_a_different_wall(self):
  raw={'rooms':[{'id':'r','x_mm':0,'y_mm':0,'width_mm':3000,'height_mm':3000}],'doors':[{'id':'d','x_mm':1500,'y_mm':1500,'width_mm':900,'orientation':'horizontal'}],'windows':[]}
  out,adjustments=align_inferred_openings(raw)
  self.assertEqual(out,raw);self.assertEqual(adjustments,[])
