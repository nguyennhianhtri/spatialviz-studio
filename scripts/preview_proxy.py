"""Single-user temporary review proxy. Capability-gated; no uploads stored here.
Not a production authentication system. Expires after 24h and caps costly extraction calls.
Run behind an HTTPS tunnel, never expose the inference server directly.
"""
import asyncio
import hmac
import os
import secrets
import time
from urllib.parse import quote
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import Response, RedirectResponse, PlainTextResponse

app=FastAPI(docs_url=None,redoc_url=None,openapi_url=None)
CAPABILITY=os.environ.get('PREVIEW_ACCESS_TOKEN') or secrets.token_urlsafe(32)
UPSTREAM=os.environ.get('PREVIEW_UPSTREAM','http://127.0.0.1:3312')
START=time.monotonic()
MAX_EXTRACTIONS=20
extractions=0
lock=asyncio.Lock()
print('PRIVATE_REVIEW_PATH=/?access='+quote(CAPABILITY),flush=True)

@app.api_route('/{path:path}',methods=['GET','HEAD','POST'])
async def proxy(path:str,request:Request):
 global extractions
 if time.monotonic()-START>86400:return PlainTextResponse('This review session has expired.',status_code=410)
 access=request.query_params.get('access')
 if access and hmac.compare_digest(access,CAPABILITY):
  response=RedirectResponse('/',status_code=303)
  response.set_cookie('spatialviz_review',CAPABILITY,httponly=True,secure=True,samesite='lax',max_age=86400)
  response.headers['Referrer-Policy']='no-referrer'
  return response
 if not hmac.compare_digest(request.cookies.get('spatialviz_review',''),CAPABILITY):
  return PlainTextResponse('Private review. Open the personal review link shared with you.',status_code=403)
 allowed=(path=='' or path.startswith('_next/') or path.startswith('sample-plans/') or path.startswith('api/extraction-jobs/') or path in {'favicon.ico','api/extract','api/extraction-jobs','api/generate-3d','api/health'})
 if not allowed:return PlainTextResponse('Not found',status_code=404)
 if request.method=='POST' and path not in {'api/extract','api/extraction-jobs','api/generate-3d'}:return Response(status_code=405)
 body=bytearray()
 async for chunk in request.stream():
  body.extend(chunk)
  if len(body)>22*1024*1024:return PlainTextResponse('Upload too large',status_code=413)
 if path in {'api/extract','api/extraction-jobs'} and request.method=='POST':
  async with lock:
   if extractions>=MAX_EXTRACTIONS:return Response('{"detail":"This private review has reached its 20-plan extraction limit. Your saved designs still work."}',status_code=429,media_type='application/json')
   extractions+=1
 headers={k:v for k,v in request.headers.items() if k.lower() in {'content-type','accept'}}
 try:
  async with httpx.AsyncClient(timeout=200) as client:
   result=await client.request(request.method,UPSTREAM+'/'+path,content=bytes(body),headers=headers,params=dict(request.query_params))
  response=Response(result.content,status_code=result.status_code,headers={k:v for k,v in result.headers.items() if k.lower() in {'content-type','cache-control','etag','vary'}})
  response.headers['Referrer-Policy']='no-referrer'
  response.headers['X-Robots-Tag']='noindex, nofollow'
  response.headers['Cache-Control']='private, no-store' if path.startswith('api/') or path=='' else 'private, max-age=3600'
  return response
 except httpx.HTTPError:
  return Response('{"detail":"The preview service is not reachable. Your work remains saved in this browser."}',status_code=502,media_type='application/json')
