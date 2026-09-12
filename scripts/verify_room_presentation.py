"""Captured local interiors → actual compiled room focus → reversible editing.
No server lifecycle, inference, or synthetic backend responses. 240s command bound.
"""
import argparse
import hashlib
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from PIL import Image, ImageStat
from scripts.verify_floor_finishes import mount_build, ORIGIN


def run(frontend, fixture, out, candidate=False):
    out.mkdir(parents=True, exist_ok=True)
    original = json.loads(fixture.read_text())
    living = max((r for r in original['scene']['rooms'] if r['type']=='living'), key=lambda r:r['area_sqm'])['id']
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True, args=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        page = browser.new_page(viewport={'width':1600,'height':1050}, device_scale_factor=1, accept_downloads=True)
        page.set_default_timeout(60000)
        errors=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        mount_build(page, frontend)
        page.goto(ORIGIN, wait_until='networkidle')
        page.get_by_label('Import project JSON', exact=True).set_input_files(str(fixture))
        def png(name):
            print('Exporting '+name, flush=True)
            page.wait_for_timeout(1600)
            with page.expect_download(timeout=70000) as d:
                page.get_by_role('button', name='Save PNG', exact=True).click(timeout=60000)
            path=out/(name+'.png'); d.value.save_as(str(path))
            im=Image.open(path).convert('RGB')
            assert min(im.size)>300 and max(ImageStat.Stat(im).stddev)>12
        def save(name):
            with page.expect_download() as d:
                page.get_by_role('button', name='Save project copy', exact=True).click()
            path=out/(name+'.spatialviz.json'); d.value.save_as(str(path))
            return json.loads(path.read_text())
        try:
            png('whole-home-fixed')
            before=save('before')
            page.get_by_label('Design room', exact=True).select_option(living)
            page.get_by_role('button', name='Focus on this room').click()
            png('living-presentation')
            after=save('focused')
            assert after['scene']==original['scene']
            assert after['interiors']==before['interiors']
            if candidate:
                show_all=page.get_by_role('button', name='Show whole home', exact=True)
                expect(show_all).to_be_visible()
                expect(page.get_by_text('Other rooms hidden · ceiling omitted',exact=True)).to_be_visible()
                # A room finish remains editable, reversible and portable while focused.
                page.get_by_role('button',name='Finishes',exact=True).click()
                page.get_by_role('button',name='Smoked oak',exact=True).click()
                edited=save('edited')
                assert edited['interiors']['finishes'][living]['floor']=='wood_dark'
                assert edited['interiors']['items']==before['interiors']['items']
                assert edited['scene']==original['scene']
                page.get_by_role('button',name='Undo interior change',exact=True).click()
                assert save('undo')['interiors']==before['interiors']
                page.get_by_role('button',name='Redo interior change',exact=True).click()
                assert save('redo')['interiors']==edited['interiors']
                page.get_by_role('button',name='Undo interior change',exact=True).click()
                page.screenshot(path=str(out/'room-focus-ui.png'))
                show_all.click()
                expect(show_all).to_have_count(0)
                page.get_by_role('button',name='Fit',exact=True).click()
                assert save('whole-home-restored')['interiors']==before['interiors']
                page.reload(wait_until='networkidle')
                assert save('reloaded')['interiors']==before['interiors']
                page.once('dialog',lambda d:d.accept())
                page.get_by_label('Import project JSON',exact=True).set_input_files(str(out/'focused.spatialviz.json'))
                assert save('reimported')['interiors']==before['interiors']
            assert not errors,errors
            result={'status':'pass','candidate':candidate,'fixture_sha256':hashlib.sha256(fixture.read_bytes()).hexdigest(),'build_id':(frontend/'.next/BUILD_ID').read_text().strip(),'source_unchanged':True,'furnishings_unchanged':True,'comparison':'same uploaded plan, furnishings, palette, daylight, viewport and whole-home camera; room-presentation intentionally changes camera and hides other rooms, not improved materials','page_errors':errors,'inference_calls':0,'local_services_changed':False}
            (out/'acceptance.json').write_text(json.dumps(result,indent=2)+'\n')
            print(json.dumps(result),flush=True)
        except Exception as error:
            (out/'failure.json').write_text(json.dumps({'error':str(error),'page_errors':errors},indent=2))
            raise
        finally:
            browser.close()

if __name__=='__main__':
    a=argparse.ArgumentParser()
    for name in ['frontend','fixture','out']: a.add_argument('--'+name,type=Path,required=True)
    a.add_argument('--candidate',action='store_true')
    v=a.parse_args(); run(v.frontend,v.fixture,v.out,v.candidate)
