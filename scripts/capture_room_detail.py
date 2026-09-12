from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path.home()/'.hermes/cache/spatialviz-comparison'
with sync_playwright() as p:
 b=p.chromium.launch(channel='chrome',headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1600,'height':1050},device_scale_factor=1,accept_downloads=True)
 page.goto('http://127.0.0.1:3312',wait_until='networkidle')
 page.locator('input[aria-label="Import project JSON"]').set_input_files(str(out/'live-redhill/uploaded-plan.spatialviz.json'))
 page.locator('canvas').wait_for(timeout=45000)
 select=page.get_by_label('Design room',exact=True)
 options=select.locator('option').evaluate_all('(els)=>els.map(e=>({value:e.value,text:e.textContent}))')
 living=next(x for x in options if 'LIVING' in x['text'].upper())
 select.select_option(living['value'])
 page.get_by_role('button',name='Focus on this room').click()
 page.wait_for_timeout(2500)
 page.screenshot(path=str(out/'room-designer-detail.png'))
 with page.expect_download() as download:page.get_by_role('button',name='Save PNG',exact=True).click()
 download.value.save_as(str(out/'room-detail-render.png'))
 print('Captured real editable living-room detail.')
 b.close()
