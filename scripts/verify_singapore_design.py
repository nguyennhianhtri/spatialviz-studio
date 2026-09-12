"""Exercise Singapore presets on an actual saved uploaded plan; no inference or substituted geometry."""
import json,argparse
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from PIL import Image,ImageStat

def run(url,fixture,out):
 out.mkdir(parents=True,exist_ok=True);original=json.loads(fixture.read_text())
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='chrome',headless=True)
  page=browser.new_page(viewport={'width':1600,'height':1050},accept_downloads=True)
  page.set_default_timeout(90000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(url,wait_until='networkidle');page.get_by_label('Import project JSON',exact=True).set_input_files(str(fixture))
  expect(page.get_by_role('button',name='HDB warm',exact=True)).to_be_visible()
  def save(name):
   with page.expect_download() as d:page.get_by_role('button',name='Save project copy',exact=True).click()
   path=out/(name+'.spatialviz.json');d.value.save_as(str(path));return json.loads(path.read_text())
  def png(name):
   page.wait_for_timeout(1500)
   with page.expect_download(timeout=90000) as d:page.get_by_role('button',name='Save PNG',exact=True).click()
   path=out/(name+'.png');d.value.save_as(str(path));im=Image.open(path).convert('RGB');assert max(ImageStat.Stat(im).stddev)>12
  prior=save('before');png('before-overview')
  page.once('dialog',lambda d:d.dismiss());page.get_by_role('button',name='HDB warm',exact=True).click();assert save('cancelled')['interiors']==prior['interiors']
  living=max((r for r in original['scene']['rooms'] if r['type']=='living'),key=lambda r:r['area_sqm'])['id']
  for label,name in [('HDB warm','hdb'),('Condo contemporary','condo')]:
   page.once('dialog',lambda d:d.accept());page.get_by_role('button',name=label,exact=True).click()
   expect(page.get_by_role('status').filter(has_text=label+' applied')).to_be_visible()
   result=save(name);assert result['scene']==original['scene'];kinds={i['kind'] for i in result['interiors']['items']}
   assert 'ceiling-fan' in kinds and 'aircon' in kinds and 'sg-kitchen' in kinds,kinds
   assert ('washer' if name=='hdb' else 'laundry-tower') in kinds,kinds
   page.get_by_role('button',name='Fit',exact=True).click();png(name+'-overview')
   page.get_by_label('Design room',exact=True).select_option(living);page.get_by_role('button',name='Focus on this room').click();png(name+'-living')
   page.screenshot(path=str(out/(name+'-studio.png')))
   page.get_by_role('button',name='Undo interior change').click();assert save(name+'-undo')['interiors']!=(result['interiors'])
   page.get_by_role('button',name='Redo interior change').click();assert save(name+'-redo')['interiors']==result['interiors']
  page.reload(wait_until='networkidle');assert save('reloaded')['interiors']==result['interiors']
  page.once('dialog',lambda d:d.accept());page.get_by_label('Import project JSON',exact=True).set_input_files(str(out/'hdb.spatialviz.json'))
  assert save('reimported')['interiors']==json.loads((out/'hdb.spatialviz.json').read_text())['interiors']
  assert not errors,errors;browser.close()
 receipt={'status':'pass','checks':['both local designs','actual compiled meshes/PNG','cancel','unchanged source geometry','undo/redo','reload','project reimport'],'page_errors':errors,'inference_calls':0}
 (out/'acceptance.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:3314');a.add_argument('--fixture',type=Path,required=True);a.add_argument('--out',type=Path,required=True);v=a.parse_args();run(v.url,v.fixture,v.out)
