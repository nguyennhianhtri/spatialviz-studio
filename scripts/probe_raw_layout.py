"""Operator diagnostic: preserve a real model response before geometry validation."""
import asyncio,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from app.vision import request_layout
from app.images import decode_image
from app.layout import ConfirmedLayout
async def main():
 image=Path(sys.argv[1]);out=Path(sys.argv[2])
 result=await request_layout(decode_image(image.read_bytes()),dimension_unit='mm')
 out.write_text(json.dumps(result,indent=2))
 try:
  layout=ConfirmedLayout.model_validate(result);print('VALID',len(layout.rooms),'rooms')
 except Exception as error:print(str(error))
asyncio.run(main())
