"""Bounded ephemeral jobs keep inference outside reverse-proxy request timeouts."""
import asyncio
import secrets
import time
from typing import Literal
from fastapi import APIRouter,File,Form,HTTPException,UploadFile
from app.images import read_image_upload
from app.extraction import extract_floor_plan

router=APIRouter()
jobs:dict[str,dict]={}
tasks:set[asyncio.Task]=set()
MAX_JOBS=8

def prune():
    expired=[key for key,value in jobs.items() if time.monotonic()-value['created']>3600 and value['status']!='processing']
    for key in expired:jobs.pop(key,None)
    finished=sorted(((value['created'],key) for key,value in jobs.items() if value['status']!='processing'))
    while len(jobs)>=MAX_JOBS and finished:jobs.pop(finished.pop(0)[1],None)

@router.post('/api/extraction-jobs',status_code=202)
async def create_job(file:UploadFile=File(...),dimension_unit:Literal['auto','mm','cm','m','ft']=Form('auto')):
    prune()
    if len(jobs)>=MAX_JOBS:raise HTTPException(429,'The layout service is busy. Please retry shortly.')
    image=await read_image_upload(file)
    if len(jobs)>=MAX_JOBS:raise HTTPException(429,'The layout service is busy. Please retry shortly.')
    job_id=secrets.token_urlsafe(24)
    job={'id':job_id,'created':time.monotonic(),'status':'processing'};jobs[job_id]=job
    filename=(file.filename or 'upload.png').replace('\\','/').rsplit('/',1)[-1][:255]
    async def run():
        try:
            job['result']=await extract_floor_plan(image,filename,dimension_unit=dimension_unit)
            job['status']='complete'
        except HTTPException as exc:
            job.update(status='failed',error=exc.detail,error_status=exc.status_code)
        except Exception:
            job.update(status='failed',error='Could not read this plan. Your existing project is unchanged.',error_status=500)
    task=asyncio.create_task(run());tasks.add(task);task.add_done_callback(tasks.discard)
    return {'id':job_id,'status':'processing'}

@router.get('/api/extraction-jobs/{job_id}')
async def get_job(job_id:str):
    job=jobs.get(job_id)
    if not job:raise HTTPException(404,'This temporary job has expired. Retry your upload.')
    return {key:value for key,value in job.items() if key!='created'}
