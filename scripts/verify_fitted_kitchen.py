"""Matched captured kitchen renders and direct, reversible furnishing customisation.
Private file-routed production build; no service lifecycle or extraction. 240s bound.
"""
import argparse
import hashlib
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from PIL import Image, ImageStat, ImageChops
from scripts.verify_floor_finishes import mount_build, ORIGIN


def run(frontend, fixture, out, candidate=False):
    out.mkdir(parents=True, exist_ok=True)
    original = json.loads(fixture.read_text())
    kitchen = next(i for i in original['interiors']['items'] if i['kind'] == 'sg-kitchen')
    room_id = kitchen['roomId']
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True, args=[
            '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = browser.new_page(viewport={'width':1600, 'height':1050}, device_scale_factor=1, accept_downloads=True)
        page.set_default_timeout(60000)
        page.on('pageerror', lambda e: errors.append(str(e)))
        mount_build(page, frontend)
        def png(name):
            page.wait_for_timeout(1600)
            with page.expect_download(timeout=70000) as d:
                page.get_by_role('button', name='Save PNG', exact=True).click(timeout=60000)
            path = out / (name + '.png')
            d.value.save_as(str(path))
            im = Image.open(path).convert('RGB')
            assert min(im.size) > 300 and max(ImageStat.Stat(im).stddev) > 12
            return path
        def save(name):
            with page.expect_download() as d:
                page.get_by_role('button', name='Save project copy', exact=True).click()
            path = out / (name + '.spatialviz.json')
            d.value.save_as(str(path))
            return json.loads(path.read_text())
        try:
            page.goto(ORIGIN, wait_until='networkidle')
            page.get_by_label('Import project JSON', exact=True).set_input_files(str(fixture))
            page.get_by_label('Design room', exact=True).select_option(room_id)
            page.get_by_role('button', name='Focus on this room').click()
            fixed = png('kitchen-fixed')
            before = save('before')
            assert before['scene'] == original['scene']
            assert before['interiors'] == original['interiors']
            if candidate:
                selector = page.get_by_label('Room furnishing', exact=True)
                options = selector.locator('option').evaluate_all('(els)=>els.map(e=>e.value).filter(Boolean)')
                assert set(options) == {i['id'] for i in before['interiors']['items'] if i['roomId'] == room_id}
                selector.select_option(kitchen['id'])
                expect(page.get_by_role('region', name='Selected furnishing')).to_be_visible()
                page.get_by_role('button', name='Furniture colour #48554e', exact=True).click()
                edited = save('edited')
                assert edited['scene'] == original['scene']
                expected = json.loads(json.dumps(before['interiors']))
                next(i for i in expected['items'] if i['id'] == kitchen['id'])['color'] = '#48554e'
                assert edited['interiors'] == expected
                # Deselect so only the material changes in the comparison, not the selection overlay.
                selector.select_option('')
                custom = png('kitchen-custom')
                assert ImageChops.difference(Image.open(fixed), Image.open(custom)).convert('RGB').getbbox()
                page.get_by_role('button', name='Undo interior change', exact=True).click()
                assert save('undo')['interiors'] == before['interiors']
                page.get_by_role('button', name='Redo interior change', exact=True).click()
                assert save('redo')['interiors'] == expected
                page.reload(wait_until='networkidle')
                assert save('reloaded')['interiors'] == expected
                page.once('dialog', lambda d:d.accept())
                page.get_by_label('Import project JSON', exact=True).set_input_files(str(out/'edited.spatialviz.json'))
                assert save('reimported')['interiors'] == expected
                page.get_by_label('Design room', exact=True).select_option(room_id)
                page.get_by_role('button', name='Focus on this room').click()
                selector.select_option(kitchen['id'])
                page.screenshot(path=str(out/'kitchen-controls.png'))
            assert not errors, errors
            result = {'status':'pass', 'candidate':candidate, 'fixture_sha256':hashlib.sha256(fixture.read_bytes()).hexdigest(),
                'build_id':(frontend/'.next/BUILD_ID').read_text().strip(), 'source_unchanged':True,
                'initial_interiors_unchanged':True, 'comparison':'same captured uploaded scene, existing HDB furnishings, finish, viewport, daylight and kitchen focus camera; only fitted kitchen mesh changes',
                'customisation':'direct room furnishing selection, only chosen item colour, undo/redo, reload and reimport' if candidate else None,
                'page_errors':errors, 'inference_calls':0, 'local_services_changed':False}
            (out/'acceptance.json').write_text(json.dumps(result, indent=2)+'\n')
            print(json.dumps(result), flush=True)
        except Exception as error:
            (out/'failure.json').write_text(json.dumps({'error':str(error), 'page_errors':errors}, indent=2)+'\n')
            page.screenshot(path=str(out/'failure.png'), timeout=10000)
            raise
        finally:
            browser.close()


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    for name in ['frontend', 'fixture', 'out']:
        p.add_argument('--'+name, type=Path, required=True)
    p.add_argument('--candidate', action='store_true')
    args = p.parse_args()
    run(args.frontend, args.fixture, args.out, args.candidate)
