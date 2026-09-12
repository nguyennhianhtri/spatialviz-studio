"""Live upload → actual Azure extraction → review → actual backend geometry → PNG."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:3310');p.add_argument('--image',required=True);p.add_argument('--out',required=True);a=p.parse_args();out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as pw:
 browser=pw.chromium.launch(channel='chrome',headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1,accept_downloads=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(a.url,wait_until='networkidle')
 captured={}
 def capture_job(response):
  if '/api/extraction-jobs/' in response.url and response.request.method=='GET':
   value=response.json()
   if value.get('status') in {'complete','failed'}:captured.update(value)
 page.on('response',capture_job)
 with page.expect_response(lambda r:r.url.endswith('/api/extraction-jobs') and r.request.method=='POST',timeout=30000) as response:
  page.locator('input[aria-label="Choose floor plan file"]').set_input_files(a.image)
 print('Upload job HTTP',response.value.status,flush=True);assert response.value.status==202,response.value.text()
 page.wait_for_function("() => document.querySelector('.editor-actionbar') || document.querySelector('.inline-error')",timeout=280000)
 job_id=response.value.json()['id']
 captured=page.request.get(a.url+'/api/extraction-jobs/'+job_id).json()
 assert captured.get('status')=='complete',captured or page.locator('body').inner_text()
 data=captured['result'];(out/'browser-extraction.json').write_text(json.dumps(data,indent=2));print('Actual extraction complete',flush=True)
 expect(page.get_by_role('button',name='Create 3D space')).to_be_visible(timeout=15000)
 expect(page.get_by_alt_text('Original uploaded floor plan — compare all dimensions and room boundaries')).to_be_visible()
 page.screenshot(path=str(out/'source-review.png'))
 with page.expect_response(lambda r:r.url.endswith('/api/generate-3d'),timeout=30000) as response:
  page.get_by_role('button',name='Create 3D space').click()
 result=response.value;print('Geometry HTTP',result.status,flush=True);assert result.status==200,result.text();scene=result.json();(out/'generated-scene.json').write_text(json.dumps(scene,indent=2))
 page.locator('canvas').wait_for(timeout=45000);page.wait_for_timeout(3000)
 page.get_by_role('button',name='Close interior designer').click();page.wait_for_timeout(1000)
 page.screenshot(path=str(out/'uploaded-plan-dollhouse.png'))
 with page.expect_download() as download:page.get_by_role('button',name='Save PNG',exact=True).click()
 download.value.save_as(str(out/'uploaded-plan-render.png'))
 with page.expect_download() as download:page.get_by_role('button',name='Save project copy',exact=True).click()
 download.value.save_as(str(out/'uploaded-plan.spatialviz.json'))
 assert not errors,errors
 print('PASS live upload→review→3D→export;',len(scene['scene']['rooms']),'room sections; source hash',data['source_hash'],flush=True)
 browser.close()
