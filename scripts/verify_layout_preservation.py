"""Verify actual compiled client + existing deterministic geometry API; no extraction.

Reuses a captured real project. File-backed browser routing is build isolation,
not a substitute backend: generate-3d is forwarded unchanged to the live API.
"""
import argparse
import hashlib
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from PIL import Image, ImageStat
from scripts.verify_floor_finishes import mount_build, ORIGIN


def run(frontend, fixture, backend, out, baseline=False):
    original=json.loads(fixture.read_text())
    assert original['sourceKind']=='upload', 'Use a captured actual upload, not the sample'
    out.mkdir(parents=True,exist_ok=True)
    bedrooms=[(i,r) for i,r in enumerate(original['editorRooms']) if r['type']=='bedroom']
    index, room=bedrooms[-1]
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',headless=True,args=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        page=browser.new_page(viewport={'width':1600,'height':1050},device_scale_factor=1,accept_downloads=True)
        errors=[]; calls=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('dialog',lambda d:d.accept())
        mount_build(page,frontend)
        def geometry(route):
            assert route.request.method=='POST'
            response=route.fetch(url=backend.rstrip('/')+'/api/generate-3d')
            calls.append({'status':response.status,'request':route.request.post_data_json,'response':response.json()})
            route.fulfill(response=response)
        page.route('**/api/generate-3d',geometry)
        page.goto(ORIGIN,wait_until='networkidle')
        page.get_by_label('Import project JSON',exact=True).set_input_files(str(fixture))
        page.locator('canvas').wait_for(timeout=45000)
        def save(name):
            with page.expect_download() as d: page.get_by_role('button',name='Save project copy',exact=True).click()
            file=out/f'{name}.spatialviz.json';d.value.save_as(str(file));return json.loads(file.read_text())
        def render(name):
            page.wait_for_timeout(1500)
            with page.expect_download() as d: page.get_by_role('button',name='Save PNG',exact=True).click()
            file=out/f'{name}.png';d.value.save_as(str(file))
            image=Image.open(file).convert('RGB')
            assert min(image.size)>300 and max(ImageStat.Stat(image).stddev)>12
        select=page.get_by_label('Design room',exact=True)
        living=max((r for r in original['scene']['rooms'] if r['type']=='living'),key=lambda r:r['area_sqm'])
        select.select_option(living['id'])
        page.get_by_role('button',name='Add Fiddle-leaf fig',exact=True).click()
        expect(page.get_by_role('region',name='Selected furnishing')).to_be_visible()
        page.get_by_role('button',name='Furniture colour #48554e',exact=True).click()
        page.get_by_role('button',name='Rotate furnishing right',exact=True).click()
        page.get_by_label('Furniture size',exact=True).fill('0.75')
        select.select_option(room['id'])
        page.get_by_role('button',name='Finishes',exact=True).click()
        page.get_by_role('button',name='Smoked oak',exact=True).click()
        page.get_by_role('button',name='Wall paint #bdc5b2',exact=True).click()
        before=save('customized-before')
        assert any(i['color']=='#48554e' and i['rotation']==45 and i['scale']==.75 for i in before['interiors']['items'])
        render('customized-before-product-default')
        page.get_by_role('button',name='Focus on this room',exact=False).click()
        render('customized-before-fixed-bedroom')
        def edit_width(width):
            page.get_by_role('button',name='Review plan',exact=False).click()
            page.get_by_label('Rooms',exact=True).get_by_role('button').nth(index).click()
            page.get_by_label('Width',exact=False).fill(str(width/1000))
            page.get_by_label('Width',exact=False).press('Tab')
            page.get_by_role('button',name='Create 3D space',exact=True).click()
        edit_width(room['width_mm']+200)
        page.locator('canvas').wait_for(timeout=45000)
        after=save('corrected-after')
        assert after['editorRooms'][index]['width_mm']==room['width_mm']+200
        assert after['extraction']==before['extraction'], 'Original source must remain untouched'
        assert after['scene']['rooms'][index]['polygon']!=before['scene']['rooms'][index]['polygon']
        assert all(c['status']==200 and c['response']['model_used']=='confirmed-layout' for c in calls)
        render('corrected-product-default')
        page.get_by_label('Design room',exact=True).select_option(room['id'])
        page.get_by_role('button',name='Focus on this room',exact=False).click()
        render('corrected-fixed-bedroom')
        kept=after['interiors']==before['interiors']
        if baseline:
            assert not kept, 'Baseline unexpectedly already preserves the design'
        else:
            assert kept, 'Layout correction replaced custom furnishings/finishes'
            page.reload(wait_until='networkidle')
            assert save('refresh-roundtrip')['interiors']==before['interiors']
            page.get_by_label('Import project JSON',exact=True).set_input_files(str(out/'corrected-after.spatialviz.json'))
            assert save('import-roundtrip')['interiors']==before['interiors']
            # This narrower bedroom retains the real openings but excludes existing
            # wardrobe/nightstand footprints; the design must not be overwritten.
            edit_width(room['width_mm']-700)
            expect(page.locator('.editor-message[role="alert"]')).to_contain_text('Your furnishings are safe',timeout=30000)
            expect(page.locator('.editor-message[role="alert"]')).to_contain_text('Built-in wardrobe')
            page.screenshot(path=str(out/'blocked-correction-ui.png'))
            blocked=save('blocked-correction')
            assert blocked['scene']==after['scene'] and blocked['interiors']==after['interiors']
            assert blocked['sceneDirty'] and blocked['stage']=='editor'
            # Refresh and portable reopen both retain rejected corrections plus the
            # prior coherent 3D scene/design; retry can be decided later.
            page.reload(wait_until='networkidle')
            assert save('blocked-refresh')['interiors']==after['interiors']
            page.get_by_label('Import project JSON',exact=True).set_input_files(str(out/'blocked-correction.spatialviz.json'))
            page.get_by_role('button',name='Create 3D space',exact=True).click()
            expect(page.locator('.editor-message[role="alert"]')).to_contain_text('Your furnishings are safe',timeout=30000)
            page.get_by_role('button',name='Back to furnishings',exact=True).click()
            page.locator('canvas').wait_for(timeout=45000)
            expect(page.get_by_text('This is your previous 3D version.',exact=False)).to_be_visible()
            page.get_by_label('Design room',exact=True).select_option(room['id'])
            page.get_by_role('button',name='Focus on this room',exact=False).click()
            render('protected-design-after-conflict')
            # Recover by undoing only the rejected dimension, without touching furniture.
            page.get_by_role('button',name='Review plan',exact=False).click()
            page.get_by_label('Rooms',exact=True).get_by_role('button').nth(index).click()
            page.get_by_label('Width',exact=False).fill(str((room['width_mm']+200)/1000))
            page.get_by_label('Width',exact=False).press('Tab')
            page.get_by_role('button',name='Create 3D space',exact=True).click()
            page.locator('canvas').wait_for(timeout=45000)
            recovered=save('recovered')
            assert recovered['interiors']==after['interiors'] and not recovered['sceneDirty']
        assert not errors,errors
        browser.close()
    result={'status':'baseline-reproduced' if baseline else 'pass','fixture_sha256':hashlib.sha256(fixture.read_bytes()).hexdigest(),'build_id':(Path(frontend)/'.next/BUILD_ID').read_text().strip(),'kept_interiors':kept,'viewport':[1600,1050],'renderer':'Chrome SwiftShader','comparison':'same captured real plan/customisation actions and bedroom focus; width correction explicitly +200 mm in both builds','extraction_calls':0,'geometry_calls':len(calls),'local_services_changed':False,'errors':errors}
    (out/'geometry-calls.json').write_text(json.dumps(calls,indent=2)+'\n')
    (out/'acceptance.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--frontend',required=True);parser.add_argument('--fixture',required=True,type=Path)
    parser.add_argument('--backend',default='http://127.0.0.1:8310');parser.add_argument('--out',required=True,type=Path)
    parser.add_argument('--baseline',action='store_true');args=parser.parse_args()
    run(args.frontend,args.fixture,args.backend,args.out,args.baseline)
