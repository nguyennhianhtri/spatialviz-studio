import unittest
from app.layout import ConfirmedLayout
class BoundaryPrecisionTests(unittest.TestCase):
 def test_binary_float_roundoff_does_not_put_a_boundary_window_outside_the_plan(self):
  data={'rooms':[{'id':'r','name':'Balcony','type':'balcony','x_mm':0,'y_mm':8305.8,'width_mm':1000,'height_mm':1676.4}],'doors':[],'windows':[{'id':'w','x_mm':500,'y_mm':9982.2,'width_mm':850,'orientation':'horizontal'}],'overall_width_mm':1000,'overall_height_mm':8305.8+1676.4}
  self.assertEqual(ConfirmedLayout.model_validate(data).windows[0].y_mm,9982.2)
