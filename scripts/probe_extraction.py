"""Live, isolated extraction experiment; does not modify the running service."""
import asyncio
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from app import vision
from app.images import decode_image
from app.extraction import extract_floor_plan
vision.SYSTEM_PROMPT += '\nScope: reconstruct the PRIVATE APARTMENT UNIT, not the whole drawing sheet. Exclude clearly external communal staircases, lift lobbies, and neighboring units; mention exclusions in warnings. A curved communal staircase outside the flat does not invalidate an otherwise orthogonal apartment. Include balconies belonging to the unit. Use separate rectangles with merge_group for L-shaped rooms and include optional merge_group in each room JSON.\n'
async def main():
 source=Path(sys.argv[1]);image=decode_image(source.read_bytes())
 try:
  result=await extract_floor_plan(image,source.name)
  Path(sys.argv[2]).write_text(json.dumps(result,indent=2))
  print(json.dumps({k:v for k,v in result.items() if k not in ['image_base64','inferred_layout']},indent=2))
  print(json.dumps(result['inferred_layout'],indent=2))
 except Exception as e:
  print(type(e).__name__,str(e));raise
asyncio.run(main())
