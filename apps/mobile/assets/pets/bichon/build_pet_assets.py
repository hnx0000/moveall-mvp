from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source"
FRAME_SIZE = 512
CONTENT_SIZE = 420
BASELINE = 470

ANIMATIONS = {
    "idle": {"source": "idle-sheet.png", "frames": 6, "duration_ms": 150, "loop": True},
    "walk": {"source": "walk-sheet.png", "frames": 8, "duration_ms": 95, "loop": True},
    "reaction": {"source": "reaction-sheet.png", "frames": 6, "duration_ms": 260, "loop": False},
}


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A").point(lambda value: 255 if value > 12 else 0)
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError("Sprite frame is empty")
    return bbox


def split_strip(image: Image.Image, frame_count: int) -> list[Image.Image]:
    alpha = image.getchannel("A")
    occupancy = [sum(1 for y in range(image.height) if alpha.getpixel((x, y)) > 12) for x in range(image.width)]
    nominal = image.width / frame_count
    boundaries = [0]
    for index in range(1, frame_count):
        center = round(index * nominal)
        radius = max(8, round(nominal * 0.16))
        start = max(boundaries[-1] + 1, center - radius)
        end = min(image.width - 1, center + radius)
        boundaries.append(min(range(start, end + 1), key=lambda x: (occupancy[x], abs(x - center))))
    boundaries.append(image.width)
    return [keep_largest_component(image.crop((left, 0, right, image.height))) for left, right in zip(boundaries, boundaries[1:])]


def keep_largest_component(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    width, height = image.size
    active = bytearray(1 if value > 12 else 0 for value in alpha.get_flattened_data())
    visited = bytearray(width * height)
    largest: list[int] = []
    for start in range(width * height):
        if not active[start] or visited[start]:
            continue
        visited[start] = 1
        queue = deque([start])
        component: list[int] = []
        while queue:
            current = queue.popleft()
            component.append(current)
            x, y = current % width, current // width
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < width and 0 <= ny < height:
                    neighbor = ny * width + nx
                    if active[neighbor] and not visited[neighbor]:
                        visited[neighbor] = 1
                        queue.append(neighbor)
        if len(component) > len(largest):
            largest = component
    keep = bytearray(width * height)
    for index in largest:
        keep[index] = 1
    pixels = list(image.get_flattened_data())
    cleaned = [(r, g, b, a if keep[index] else 0) for index, (r, g, b, a) in enumerate(pixels)]
    output = Image.new("RGBA", image.size)
    output.putdata(cleaned)
    return output


def normalize(frames: list[Image.Image]) -> list[Image.Image]:
    boxes = [alpha_bbox(frame) for frame in frames]
    max_width = max(right - left for left, _, right, _ in boxes)
    max_height = max(bottom - top for _, top, _, bottom in boxes)
    scale = min(CONTENT_SIZE / max_width, CONTENT_SIZE / max_height)
    output: list[Image.Image] = []
    for frame, (left, top, right, bottom) in zip(frames, boxes):
        sprite = frame.crop((left, top, right, bottom))
        size = (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale)))
        sprite = sprite.resize(size, Image.Resampling.NEAREST)
        canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        canvas.alpha_composite(sprite, ((FRAME_SIZE - sprite.width) // 2, BASELINE - sprite.height))
        output.append(canvas)
    return output


def save_animation(name: str, config: dict[str, object]) -> dict[str, object]:
    image = Image.open(SOURCE / str(config["source"])).convert("RGBA")
    frames = normalize(split_strip(image, int(config["frames"])))
    frame_dir = ROOT / "frames" / name
    frame_dir.mkdir(parents=True, exist_ok=True)
    for index, frame in enumerate(frames):
        frame.save(frame_dir / f"{index:02}.png", optimize=True)

    sheet = Image.new("RGBA", (FRAME_SIZE * len(frames), FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * FRAME_SIZE, 0))
    sheet.save(ROOT / f"{name}-sheet.png", optimize=True)

    duration = int(config["duration_ms"])
    frames[0].save(
        ROOT / f"{name}.webp",
        save_all=True,
        append_images=frames[1:],
        duration=duration,
        loop=0 if config["loop"] else 1,
        lossless=True,
        method=6,
    )
    return {
        "sheet": f"{name}-sheet.png",
        "preview": f"{name}.webp",
        "frameDirectory": f"frames/{name}",
        "frameCount": len(frames),
        "frameWidth": FRAME_SIZE,
        "frameHeight": FRAME_SIZE,
        "durationMs": duration,
        "loop": bool(config["loop"]),
    }


def main() -> None:
    manifest = {
        "id": "bichon",
        "displayName": "구름 비숑",
        "formatVersion": 1,
        "animations": {name: save_animation(name, config) for name, config in ANIMATIONS.items()},
        "reactionOrder": ["joy", "curious", "excited", "surprised", "sleepy", "affectionate"],
    }
    (ROOT / "pet.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
