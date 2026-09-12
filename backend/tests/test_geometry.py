import copy
import unittest

from fastapi.testclient import TestClient
from app.main import app


def layout():
    return {'rooms': [{'id': 'measured-room', 'name': 'Study', 'type': 'office',
                      'x_mm': 0, 'y_mm': 0, 'width_mm': 4172, 'height_mm': 3003}],
            'doors': [{'id': 'entry', 'x_mm': 0, 'y_mm': 1500, 'width_mm': 830,
                       'type': 'hinged', 'orientation': 'vertical'}],
            'windows': [{'id': 'window-east', 'x_mm': 4172, 'y_mm': 1500,
                         'width_mm': 1137, 'rotation': 90}],
            'overall_width_mm': 4172, 'overall_height_mm': 3003}


class GenerateTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def test_preserves_ids_millimeter_precision_and_opening_orientation(self):
        response = self.client.post('/api/generate-3d', json=layout())
        self.assertEqual(response.status_code, 200, response.text)
        scene = response.json()['scene']
        self.assertEqual(scene['rooms'][0]['id'], 'measured-room')
        self.assertEqual(scene['rooms'][0]['polygon'][2], [4.172, 3.003])
        self.assertEqual(scene['doors'][0]['orientation'], 'vertical')
        self.assertEqual(scene['windows'][0]['rotation'], 90)
        self.assertEqual(scene['windows'][0]['width_m'], 1.137)
        self.assertNotEqual(scene['doors'][0]['wall_id'], 'w1')

    def test_openings_must_fit_actual_room_edges(self):
        for change in [{'x_mm': 1000}, {'width_mm': 5000}, {'y_mm': 100},
                       {'rotation': 0}]:
            data = layout(); data['doors'][0].update(change)
            result = self.client.post('/api/generate-3d', json=data)
            self.assertEqual(result.status_code, 422, result.text[:100])

    def test_legacy_missing_orientation_is_inferred_only_from_a_unique_edge_axis(self):
        data = layout(); data['doors'][0].pop('orientation')
        result = self.client.post('/api/generate-3d', json=data)
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()['scene']['doors'][0]['orientation'], 'vertical')

    def test_nonfinite_json_is_rejected_without_internal_serialization_error(self):
        data = layout()
        import json
        body = json.dumps(data).replace('4172', 'NaN', 1)
        response = self.client.post('/api/generate-3d', content=body, headers={'Content-Type': 'application/json'})
        self.assertEqual(response.status_code, 422)

    def test_rejects_unbounded_invalid_and_duplicate_geometry(self):
        cases = []
        for value in [0, -1, 100001]:
            data = layout(); data['rooms'][0]['width_mm'] = value; cases.append(data)
        data = layout(); data['overall_height_mm'] = 0; cases.append(data)
        data = layout(); data['rooms'][0]['x_mm'] = 4000; cases.append(data)
        data = layout(); data['rooms'] *= 257; cases.append(data)
        data = layout(); data['doors'] *= 513; cases.append(data)
        data = layout(); data['windows'] *= 513; cases.append(data)
        data = layout(); data['doors'][0]['id'] = 'measured-room'; cases.append(data)
        data = layout(); data['rooms'].append(copy.deepcopy(data['rooms'][0])); cases.append(data)
        data = layout(); data['doors'][0]['width_mm'] = -100; cases.append(data)
        data = layout(); data['doors'][0]['orientation'] = 'diagonal'; cases.append(data)
        data = layout(); data['windows'][0]['rotation'] = 45; cases.append(data)
        for index, data in enumerate(cases):
            with self.subTest(case=index):
                response = self.client.post('/api/generate-3d', json=data)
                self.assertEqual(response.status_code, 422, response.text[:150])


if __name__ == '__main__':
    unittest.main()
