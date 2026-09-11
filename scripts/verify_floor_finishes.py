"""Exercise compiled client bytes without starting/stopping any local app service.

Routes serve only files from the supplied build in an isolated browser context.
No backend responses, inference, external assets, or plan substitutions are permitted.
"""
import argparse
import hashlib
import json
import mimetypes
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright, expect
from PIL import Image, ImageChops, ImageStat

ORIGIN='https://spatialviz-candidate.invalid'

def mount_build(page, frontend):
    frontend=Path(frontend).resolve()
    def serve(route):
        url=urlparse(route.request.url)
        assert url.netloc=='spatialviz-candidate.invalid', f'Unexpected external request: {url.netloc}'
        name=unquote(url.path)
        if name=='/': file=frontend/'.next/server/app/index.html'
        elif name.startswith('/_next/static/'): file=frontend/'.next/static'/name.removeprefix('/_next/static/')
        else: file=frontend/'public'/name.lstrip('/')
        file=file.resolve()
        assert file.is_relative_to(frontend), 'Path outside build'
        if file.is_file():
            route.fulfill(path=str(file),content_type=mimetypes.guess_type(file)[0] or 'application/octet-stream')
        else:
            assert not name.startswith('/api/'), f'Unexpected backend call: {name}'
            route.fulfill(status=404,body='Not found')
    page.route('**/*',serve)

def run(frontend,fixture,out,prefix,journey):
    out.mkdir(parents=True,exist_ok=True)
    original=json.loads(fixture.read_text())
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        page=browser.new_page(viewport={'width':1600,'height':1050},device_scale_factor=1,accept_downloads=True)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('dialog',lambda d:d.accept())
        mount_build(page,frontend)
        page.goto(ORIGIN,wait_until='networkidle')
        page.get_by_label('Import project JSON',exact=True).set_input_files(str(fixture))
        page.locator('canvas').wait_for(timeout=45000)
        def export(name):
            page.wait_for_timeout(1500)
            with page.expect_download() as download: page.get_by_role('button',name='Save PNG',exact=True).click()
            file=out/f'{prefix}-{name}.png';download.value.save_as(str(file))
            image=Image.open(file).convert('RGB')
            assert min(image.size)>300 and max(ImageStat.Stat(image).stddev)>12
            return file
        export('product-default')
        select=page.get_by_label('Design room',exact=True)
        options=select.locator('option').evaluate_all('(els)=>els.map(e=>({value:e.value,text:e.textContent}))')
        living=next(x for x in options if 'LIVING' in x['text'].upper())
        kitchen=next(x for x in options if 'KITCHEN' in x['text'].upper())
        select.select_option(living['value'])
        page.get_by_role('button',name='Focus on this room').click()
        export('fixed-living-view')
        if journey:
            # The same room/camera while material changes, including a wet-room override.
            select.select_option(kitchen['value'])
            page.get_by_role('button',name='Focus on this room').click()
            page.get_by_role('button',name='Finishes',exact=True).click()
            files=[]
            for label,value in [('Natural oak','wood_light'),('Ivory tile','tile_white'),('Warm concrete','concrete'),('Smoked oak','wood_dark')]:
                page.get_by_role('button',name=label,exact=True).click()
                expect(page.get_by_role('button',name=label,exact=True)).to_have_attribute('aria-pressed','true')
                files.append(export(value))
            for a,b in zip(files,files[1:]):
                assert ImageChops.difference(Image.open(a),Image.open(b)).convert('RGB').getbbox(), 'Finish did not visibly change'
            with page.expect_download() as download: page.get_by_role('button',name='Save project copy',exact=True).click()
            saved=out/'finish-roundtrip.spatialviz.json';download.value.save_as(str(saved))
            restored=json.loads(saved.read_text())
            assert restored['interiors']['finishes'][kitchen['value']]['floor']=='wood_dark'
            assert restored['interiors']['items']==original['interiors']['items'],'finish edit changed furniture'
            assert restored['scene']==original['scene'],'finish edit changed source geometry'
            page.reload(wait_until='networkidle')
            page.get_by_label('Design room',exact=True).select_option(kitchen['value'])
            page.get_by_role('button',name='Finishes',exact=True).click()
            expect(page.get_by_role('button',name='Smoked oak',exact=True)).to_have_attribute('aria-pressed','true')
            page.get_by_label('Import project JSON',exact=True).set_input_files(str(saved))
            page.get_by_label('Design room',exact=True).select_option(kitchen['value'])
            page.get_by_role('button',name='Finishes',exact=True).click()
            expect(page.get_by_role('button',name='Smoked oak',exact=True)).to_have_attribute('aria-pressed','true')
            page.screenshot(path=str(out/f'{prefix}-finish-ui.png'))
        assert not errors,errors
        browser.close()
    result={'status':'pass','prefix':prefix,'fixture_sha256':hashlib.sha256(fixture.read_bytes()).hexdigest(),'build_id':(Path(frontend)/'.next/BUILD_ID').read_text().strip(),'viewport':[1600,1050],'renderer':'Chrome SwiftShader','fixed_view':'identical fixture, living-room focus action, daylight/default style','journey':journey,'errors':errors,'inference_calls':0,'local_services_changed':False}
    (out/f'{prefix}-evidence.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--frontend',required=True);parser.add_argument('--fixture',type=Path,required=True);parser.add_argument('--out',type=Path,required=True);parser.add_argument('--prefix',default='candidate');parser.add_argument('--journey',action='store_true');args=parser.parse_args()
    run(args.frontend,args.fixture,args.out,args.prefix,args.journey)
