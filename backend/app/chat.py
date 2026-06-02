"""Chat agent — answers spatial questions about a SceneGraph using GPT."""

import json
import logging

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from openai import AzureOpenAI

from app.config import settings
from app.models import SceneGraph

logger = logging.getLogger(__name__)

AGENT_SYSTEM_PROMPT = """You are the Planner Copilot for SpatialViz Studio. You help city planners, facilities managers, and housing authorities understand floor plans.

You have access to the SceneGraph JSON of the current floor plan. Use it to answer questions accurately with specific measurements and room references.

## Capabilities
1. **Spatial Analysis** — room dimensions, total area, room counts, layout efficiency
2. **Accessibility Audit** — wheelchair path analysis (min 0.9m corridors, 1.5m turning circles), doorway widths (min 0.85m for wheelchair), grab-bar placement suggestions
3. **Furniture Advice** — suggest furniture placement based on room type and dimensions, check if standard furniture fits
4. **Sightline Analysis** — visibility from entry points, natural light assessment based on window positions

## Rules
- Always reference specific room names and measurements from the SceneGraph
- When checking accessibility, use Singapore BCA Code standards: min 0.9m clear door width, 1.2m corridor width, 1.5m x 1.5m wheelchair turning space in bathrooms
- For furniture, use standard dimensions: single bed 0.9x1.9m, double bed 1.5x1.9m, dining table 0.8x1.2m, sofa 0.9x2.0m
- Be concise but specific. Reference room IDs and actual polygon dimensions.
- If a question is unrelated to spatial analysis, politely redirect.
"""


def _get_client() -> AzureOpenAI:
    if settings.AZURE_OPENAI_API_KEY:
        return AzureOpenAI(
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            api_key=settings.AZURE_OPENAI_API_KEY,
            api_version=settings.AZURE_OPENAI_API_VERSION,
        )
    token_provider = get_bearer_token_provider(
        DefaultAzureCredential(),
        "https://cognitiveservices.azure.com/.default",
    )
    return AzureOpenAI(
        azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
        azure_ad_token_provider=token_provider,
        api_version=settings.AZURE_OPENAI_API_VERSION,
    )


async def chat_with_scene(message: str, scene: SceneGraph | None) -> str:
    """Send a user message + scene context to GPT and return the response."""
    client = _get_client()

    scene_context = ""
    if scene:
        scene_context = f"\n\n## Current Floor Plan (SceneGraph)\n```json\n{scene.model_dump_json(indent=2)}\n```"

    response = client.chat.completions.create(
        model=settings.AZURE_OPENAI_DEPLOYMENT,
        messages=[
            {
                "role": "system",
                "content": AGENT_SYSTEM_PROMPT + scene_context,
            },
            {"role": "user", "content": message},
        ],
        max_completion_tokens=1024,
    )

    return response.choices[0].message.content or "I couldn't generate a response."
