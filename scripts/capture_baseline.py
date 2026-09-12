"""Capture immutable original UI using its explicitly labelled built-in demo.
Only the /api/demo-scene route is fulfilled, with the exact original repo fixture.
This is renderer comparison evidence, NOT an AI-extraction test.
"""
import ast
import json
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser()
parser.add_argument('--url',default='http://127.0.0.1:3311')
parser.add_argument('--source',default='/tmp/spatialviz-before-source')
parser.add_argument('--out',default='/Users/tringuyen/.hermes/cache/spatialviz-comparison')
a=parser.parse_args()
out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
tree=ast.parse((Path(a.source)/'backend/app/demo_scene.py').read_text())
assignment=next(n for n in tree.body if isinstance(n,ast.Assign))
scene=ast.literal_eval(assignment.value.args[0])
(out/'comparison-scene.json').write_text(json.dumps(scene,indent=2))
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/api/demo-scene',lambda route:route.fulfill(status=200,content_type='application/json',body=json.dumps(scene),headers={'Access-Control-Allow-Origin':'*'}))
 page.goto(a.url,wait_until='networkidle')
 page.get_by_text('Upload a floor plan',exact=True).wait_for()
 page.wait_for_timeout(700)
 page.screenshot(path=str(out/'before-upload.png'))
 page.get_by_role('button',name='or try a demo floor plan').click()
 page.locator('canvas').wait_for(timeout=45000)
 page.wait_for_timeout(5000)
 page.screenshot(path=str(out/'before-dollhouse.png'))
 page.locator('canvas').screenshot(path=str(out/'before-render.png'))
 print(page.locator('body').inner_text()[:5000]);print('Errors',errors)
 (out/'before-capture.json').write_text(json.dumps({'source_commit':'acf9fd9','viewport':[1440,1000],'input':'original explicit demo scene, fixture reproduced verbatim','kind':'render comparison; not extraction accuracy','errors':errors},indent=2))
 browser.close()
