"""Real captured project → explicit room arrangement → undo/redo → save/reopen.
Serve compiled client files in Playwright, never operate app services or invoke inference.
"""
import argparse
import hashlib
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from scripts.verify_floor_finishes import mount_build, ORIGIN


def run(frontend, fixture, out):
    out.mkdir(parents=True, exist_ok=True)
    original = json.loads(fixture.read_text())
    bedrooms = [r['id'] for r in original['scene']['rooms'] if r['type'] == 'bedroom']
    assert bedrooms
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True, args=['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = browser.new_page(viewport={'width':1600,'height':1050}, device_scale_factor=1, accept_downloads=True)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        mount_build(page, frontend)
        page.goto(ORIGIN, wait_until='networkidle')
        page.get_by_label('Import project JSON', exact=True).set_input_files(str(fixture))
        page.locator('canvas').wait_for(timeout=45000)
        def png(name):
            page.wait_for_timeout(1600)
            # Cold SwiftShader initialization can block the renderer past 30s.
            # Keep the actual export assertion and full production render quality;
            # grant only the first capture a bounded cold-start allowance.
            cold_start = name == 'before-product-default'
            print(f'Exporting {name}', flush=True)
            with page.expect_download(timeout=70000 if cold_start else 30000) as download:
                page.get_by_role('button', name='Save PNG', exact=True).click(timeout=60000 if cold_start else 30000)
            download.value.save_as(str(out/f'{name}.png'))
        def project(name):
            with page.expect_download() as download:
                page.get_by_role('button', name='Save project copy', exact=True).click()
            path = out/f'{name}.spatialviz.json'
            download.value.save_as(str(path))
            return json.loads(path.read_text())
        png('before-product-default')
        page.get_by_label('Design room', exact=True).select_option(bedrooms[-1])
        page.get_by_role('button', name='Focus on this room').click()
        png('before-fixed-bedroom')
        arrange = page.get_by_role('button', name='Arrange bedroom', exact=True)
        expect(arrange).to_be_visible(timeout=3000)  # Red-capable against unchanged build.
        before = project('before')
        messages = []
        def cancel(dialog):
            messages.append(dialog.message)
            dialog.dismiss()
        page.once('dialog', cancel)
        arrange.click()
        assert project('cancelled')['interiors'] == before['interiors']
        assert 'replace' in messages[0].lower() and 'undo' in messages[0].lower()
        for room_id in bedrooms:
            page.get_by_label('Design room', exact=True).select_option(room_id)
            old = project(f'{room_id}-prior')
            page.once('dialog', lambda d: d.accept())
            arrange.click()
            expect(page.get_by_role('status').filter(has_text='Bedroom arranged')).to_be_visible()
            new = project(f'{room_id}-arranged')
            assert new['scene'] == original['scene']
            assert new['interiors']['finishes'] == old['interiors']['finishes']
            assert [i for i in new['interiors']['items'] if i['roomId'] != room_id] == [i for i in old['interiors']['items'] if i['roomId'] != room_id]
            room_items = [i for i in new['interiors']['items'] if i['roomId'] == room_id]
            bed = next(i for i in room_items if i['kind'] == 'bed')
            wardrobe = next(i for i in room_items if i['kind'] == 'wardrobe')
            assert abs(bed['rotation'] - wardrobe['rotation']) % 180 == 90
            axis = 'x' if bed['rotation'] % 180 == 0 else 'z'
            clear_aisle = abs(bed[axis]-wardrobe[axis]) - .825*bed['scale'] - .35*wardrobe['scale']
            assert clear_aisle >= .6-1e-8, f'Clear aisle includes handles: {clear_aisle}'
            page.get_by_role('button', name='Undo interior change', exact=True).click()
            assert project(f'{room_id}-undo')['interiors'] == old['interiors']
            page.get_by_role('button', name='Redo interior change', exact=True).click()
            assert project(f'{room_id}-redo')['interiors'] == new['interiors']
        page.get_by_label('Design room', exact=True).select_option(bedrooms[-1])
        page.get_by_role('button', name='Focus on this room').click()
        png('after-fixed-bedroom')
        page.screenshot(path=str(out/'arrangement-ui.png'))
        saved = project('arranged-final')
        page.reload(wait_until='networkidle')
        assert project('reloaded')['interiors'] == saved['interiors']
        page.get_by_label('Import project JSON', exact=True).set_input_files(str(out/'arranged-final.spatialviz.json'))
        assert project('reimported')['interiors'] == saved['interiors']
        png('after-product-default')
        assert not errors, errors
        browser.close()
    result = {'status':'pass', 'fixture_sha256':hashlib.sha256(fixture.read_bytes()).hexdigest(), 'build_id':(frontend/'.next/BUILD_ID').read_text().strip(), 'bedrooms':bedrooms, 'checks':['cancel leaves design intact','room-only replacement','finishes/source unchanged','undo/redo','save/reload/import','side-wall storage'], 'comparison':'same captured geometry, camera focus action, lights and materials; only explicit bedroom furnishings replaced', 'inference_calls':0, 'local_services_changed':False, 'page_errors':errors}
    (out/'acceptance.json').write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(result))


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    for key in ['frontend','fixture','out']:
        parser.add_argument('--'+key, type=Path, required=True)
    args=parser.parse_args()
    run(args.frontend,args.fixture,args.out)
