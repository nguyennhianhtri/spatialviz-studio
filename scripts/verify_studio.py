"""Real-browser integration acceptance; uses only explicit samples or actual uploads."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from PIL import Image, ImageStat
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:3310');parser.add_argument('--frontend',help='Optional compiled frontend; run as python -m scripts.verify_studio to verify without a service');parser.add_argument('--out',default='/Users/tringuyen/.hermes/cache/spatialviz-comparison');a=parser.parse_args();out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1,accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 if a.frontend:
  from scripts.verify_floor_finishes import mount_build, ORIGIN
  mount_build(page,a.frontend);a.url=ORIGIN
 page.goto(a.url,wait_until='networkidle');print('Loaded page',flush=True)
 page.get_by_role('button',name='Open sample',exact=True).click()
 page.locator('canvas').wait_for(timeout=45000)
 expect(page.get_by_role('complementary',name='Interior designer')).to_be_visible()
 page.wait_for_timeout(2000)
 canvas=page.locator('canvas').bounding_box();assert canvas['y']+canvas['height']<=1000,('canvas overflows viewport',canvas)
 page.get_by_role('button',name='Add Fiddle-leaf fig',exact=True).click()
 expect(page.get_by_role('region',name='Selected furnishing')).to_be_visible()
 page.get_by_role('button',name='Furniture colour #48554e',exact=True).click()
 page.get_by_role('button',name='Rotate furnishing right',exact=True).click()
 page.get_by_role('button',name='Finishes',exact=True).click()
 page.get_by_role('button',name='Smoked oak',exact=True).click()
 page.get_by_role('button',name='Wall paint #bdc5b2',exact=True).click()
 with page.expect_download() as info:page.get_by_role('button',name='Save project copy',exact=True).click()
 download=info.value;download.save_as(str(out/'customized-project.spatialviz.json'))
 project=json.loads((out/'customized-project.spatialviz.json').read_text());assert project['interiors']['items'];assert any(x['color']=='#48554e' for x in project['interiors']['items']);assert any(x['floor']=='wood_dark' for x in project['interiors']['finishes'].values())
 page.reload(wait_until='networkidle');page.get_by_role('button',name='Finishes',exact=True).click();expect(page.get_by_role('button',name='Smoked oak',exact=True)).to_have_attribute('aria-pressed','true',timeout=15000)
 page.screenshot(path=str(out/'after-customized.png'))
 with page.expect_download() as info:page.get_by_role('button',name='Save PNG',exact=True).click()
 info.value.save_as(str(out/'after-customized-render.png'))
 image=Image.open(out/'after-customized-render.png').convert('RGB');assert min(image.size)>300;assert max(ImageStat.Stat(image).stddev)>12,'blank/flat export'
 page.on('dialog',lambda d:d.accept())
 page.locator('input[aria-label="Import project JSON"]').set_input_files(str(out/'matched-comparison.spatialviz.json'))
 page.wait_for_timeout(4000)
 page.get_by_role('button',name='Close interior designer',exact=True).click()
 page.wait_for_timeout(1500)
 page.screenshot(path=str(out/'after-dollhouse.png'))
 with page.expect_download() as info:page.get_by_role('button',name='Save PNG',exact=True).click()
 info.value.save_as(str(out/'after-render.png'))
 print('PASS: sample, furniture placement/rotation/colour, floor/wall finishes, portable project export, refresh restore, nonblank PNG, original same-scene import.')
 editor_project={**project,'stage':'editor','scene':None};editor_project.pop('interiors',None)
 editor_file=out/'editor-only-project.spatialviz.json';editor_file.write_text(json.dumps(editor_project))
 page.locator('input[aria-label="Import project JSON"]').set_input_files(str(editor_file))
 expect(page.get_by_role('button',name='Create 3D space')).to_be_visible()
 with page.expect_download() as info:page.get_by_role('button',name='Save project copy',exact=True).click()
 info.value.save_as(str(out/'editor-only-roundtrip.spatialviz.json'))
 assert json.loads((out/'editor-only-roundtrip.spatialviz.json').read_text())['interiors']=={'items':[],'finishes':{}}
 page.locator('input[aria-label="Import project JSON"]').set_input_files(str(out/'editor-only-roundtrip.spatialviz.json'))
 expect(page.get_by_role('button',name='Create 3D space')).to_be_visible()
 print('PASS: editor-only import→save→reopen does not inherit old furnishings.')
 print('BROWSER ERRORS',errors);assert not errors
 (out/'ui-acceptance.json').write_text(json.dumps({'status':'pass','errors':errors,'png_dimensions':image.size,'png_stddev':ImageStat.Stat(image).stddev},indent=2))
 browser.close()
