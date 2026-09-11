"""Bounded, decoded uploads. A filename or MIME claim is not evidence of an image."""
import hashlib
import io
import warnings
from dataclasses import dataclass

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_IMAGE_PIXELS = 24_000_000
MAX_IMAGE_SIDE = 12_000


@dataclass(frozen=True)
class DecodedImage:
    data: bytes
    mime: str
    width: int
    height: int
    source_hash: str


def decode_image(data: bytes) -> DecodedImage:
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, 'Image exceeds the 20 MiB upload limit.')
    if not data:
        raise HTTPException(422, 'The uploaded image is empty.')
    if data.startswith(b'%PDF'):
        raise HTTPException(415, 'PDF rasterization is not enabled. Export a PNG or JPEG first.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                fmt = image.format
                if fmt not in {'PNG', 'JPEG'}:
                    raise HTTPException(415, 'Only decoded PNG and JPEG images are supported.')
                width, height = image.size
                if width * height > MAX_IMAGE_PIXELS or max(width, height) > MAX_IMAGE_SIDE:
                    raise HTTPException(413, 'Image exceeds the 24 megapixel / 12000 pixel side limit.')
                if getattr(image, 'n_frames', 1) != 1:
                    raise HTTPException(415, 'Animated images are not supported.')
                image.verify()
            # verify() checks container integrity; load() also checks the pixel stream.
            with Image.open(io.BytesIO(data)) as image:
                image.load()
                image = ImageOps.exif_transpose(image).convert('RGB')
                output = io.BytesIO()
                image.save(output, format=fmt, **({'quality': 95} if fmt == 'JPEG' else {}))
                width, height = image.size
    except HTTPException:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise HTTPException(413, 'Image is too large to decode safely.') from exc
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError) as exc:
        raise HTTPException(422, 'Cannot decode a complete PNG or JPEG image.') from exc
    return DecodedImage(output.getvalue(), 'image/png' if fmt == 'PNG' else 'image/jpeg',
                        width, height, hashlib.sha256(data).hexdigest())


async def read_image_upload(file: UploadFile) -> DecodedImage:
    # Read at most limit+1 bytes, never file.read() with unbounded application allocation.
    try:
        data = await file.read(MAX_UPLOAD_BYTES + 1)
        return await run_in_threadpool(decode_image, data)
    finally:
        await file.close()
