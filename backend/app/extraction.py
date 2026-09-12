"""Image-driven extraction with bounded, image-grounded geometry review."""
import base64
import time
from fastapi import HTTPException
from pydantic import ValidationError
from app.config import settings
from app.images import DecodedImage
from app.layout import ConfirmedLayout
from app.opening_alignment import align_inferred_openings
from app.vision import request_layout

def validate_evidence(raw):
    if isinstance(raw.get('error'),str) and raw['error'].strip():
        raise HTTPException(422,'Cannot extract this image: '+raw['error'][:500])
    if raw.get('scale_basis')!='annotated' or not isinstance(raw.get('scale_evidence'),str) or not raw['scale_evidence'].strip():
        raise HTTPException(422,'The model could not establish reliable annotated dimensions. Choose the correct units and upload a legibly dimensioned plan; no metric layout was invented.')
    warnings=raw.get('warnings',[])
    if len(raw['scale_evidence'])>2000 or not isinstance(warnings,list) or len(warnings)>100 or any(not isinstance(w,str) or len(w)>1000 for w in warnings):
        raise HTTPException(502,'Vision returned oversized or invalid provenance metadata.')
    return warnings

async def extract_floor_plan(image:DecodedImage,filename:str,endpoint=None,deployment=None,dimension_unit='auto')->dict:
    start=time.monotonic()
    raw=await request_layout(image,endpoint,deployment,dimension_unit=dimension_unit)
    for review in range(2):
        model_warnings=validate_evidence(raw)
        raw_model_layout=raw
        aligned,opening_adjustments=align_inferred_openings(raw)
        try:
            layout=ConfirmedLayout.model_validate({**aligned,'source_file':filename})
            break
        except ValidationError as exc:
            errors=[str(e['loc'])+': '+e['msg'] for e in exc.errors()[:20]]
            if review==1:raise HTTPException(502,'The layout could not pass geometry review: '+'; '.join(errors)[:500]+'. Your file is preserved; try a clearer crop.') from exc
            raw=await request_layout(image,endpoint,deployment,dimension_unit=dimension_unit,previous=raw_model_layout,errors=errors)
    return {
        'dimensions':[],'room_labels':[],'shape_hints':[],
        'page_width':image.width,'page_height':image.height,
        'image_base64':base64.b64encode(image.data).decode('ascii'),'image_mime':image.mime,
        'inferred_layout':layout.model_dump(exclude_none=True),
        'raw_inferred_layout':raw_model_layout if opening_adjustments else None,
        'processing_time_ms':int((time.monotonic()-start)*1000),'cu_time_ms':0,
        'inference_time_ms':int((time.monotonic()-start)*1000),'source_hash':image.source_hash,
        'warnings':['AI-interpreted geometry is not a survey. Verify all dimensions and openings before use.',
                    'No separate OCR stage was run; dimensions and room_labels arrays are empty.',*model_warnings,
                    *[f"Opening {a['id']} aligned by {a['shift_mm']} mm to its inferred wall. Check against the source; original coordinates retained." for a in opening_adjustments]],
        'provenance':{'provider':'azure_openai','model':deployment or settings.AZURE_OPENAI_DEPLOYMENT,
                      'pipeline':'decoded-image-to-vision','ocr_used':False,'geometry_review_passes':review+1,
                      'scale_basis':raw.get('scale_basis'),'scale_evidence':raw.get('scale_evidence'),
                      'dimension_unit_setting':dimension_unit,'opening_adjustments':opening_adjustments,
                      'coordinate_system':'top-left origin; x right, y down; millimetres',
                      'image_transform':'EXIF orientation applied, RGB re-encoded; source_hash hashes original upload'},
    }
