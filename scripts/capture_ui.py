import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:3310')
parser.add_argument('--out', required=True)
parser.add_argument('--mobile', action='store_true')
parser.add_argument('--sample', action='store_true')
args=parser.parse_args()
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome', headless=True, args=['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':390 if args.mobile else 1440,'height':844 if args.mobile else 1000}, device_scale_factor=1)
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(args.url, wait_until='networkidle')
    if args.sample:
        page.get_by_role('button', name='Open sample', exact=True).click()
        page.locator('canvas').wait_for(timeout=45000)
        page.wait_for_timeout(5000)
    else:
        page.wait_for_timeout(700)
    Path(args.out).parent.mkdir(parents=True,exist_ok=True)
    page.screenshot(path=args.out)
    print(page.locator('body').inner_text()[:9000])
    print('ERRORS:',errors)
    browser.close()
