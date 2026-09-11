"""Small, disclosed alignment of *inferred* opening centres. Never alters reviewed rooms."""
import copy
import math

def align_inferred_openings(raw:dict,max_shift_mm:float=180):
    result=copy.deepcopy(raw);adjustments=[]
    rooms=result.get('rooms',[])
    try:
        for opening in result.get('doors',[])+result.get('windows',[]):
            x,y,width=opening['x_mm'],opening['y_mm'],opening['width_mm']
            if not all(isinstance(n,(int,float)) and math.isfinite(n) for n in (x,y,width)) or width<=0:continue
            orientation=opening.get('orientation');candidates=[]
            for room in rooms:
                rx,ry,rw,rh=(room[k] for k in ('x_mm','y_mm','width_mm','height_mm'))
                if orientation=='horizontal' and rw>=width:
                    nx=min(max(x,rx+width/2),rx+rw-width/2)
                    for ny in (ry,ry+rh):candidates.append((math.hypot(nx-x,ny-y),nx,ny))
                elif orientation=='vertical' and rh>=width:
                    ny=min(max(y,ry+width/2),ry+rh-width/2)
                    for nx in (rx,rx+rw):candidates.append((math.hypot(nx-x,ny-y),nx,ny))
            if not candidates:continue
            shift,nx,ny=min(candidates)
            if 1e-6<shift<=max_shift_mm:
                opening['x_mm'],opening['y_mm']=nx,ny
                adjustments.append({'id':opening.get('id','opening'),'original_center_mm':[x,y],'aligned_center_mm':[nx,ny],'shift_mm':round(shift,2)})
    except (KeyError,TypeError,ValueError):
        # Malformed payloads remain the schema validator's responsibility.
        return copy.deepcopy(raw),[]
    return result,adjustments
