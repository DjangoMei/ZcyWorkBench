from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from rapidocr_onnxruntime import RapidOCR


PROFILE_ID = "652012110000000024014637"


def fetch(url: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 Chrome/138 Safari/537.36"
            ),
            "Referer": "https://www.xiaohongshu.com/",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def walk(value: Any):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def note_payload(html: str, note_id: str) -> dict[str, Any]:
    match = re.search(r"window\.__INITIAL_STATE__=(.*?)</script>", html, re.S)
    if not match:
        raise RuntimeError("页面没有可读取的笔记数据")
    payload = re.sub(r"(?<=[:\[,])undefined(?=[,}\]])", "null", match.group(1))
    state = json.loads(payload)
    candidates = [
        item
        for item in walk(state)
        if item.get("noteId") == note_id and isinstance(item.get("imageList"), list)
    ]
    if not candidates:
        raise RuntimeError("没有找到笔记图片列表")
    return max(candidates, key=lambda item: len(item.get("imageList", [])))


def extract_note_urls(page_source: str) -> list[str]:
    pattern = re.compile(
        rf'"(https://www\.xiaohongshu\.com/user/profile/{PROFILE_ID}/[^\"]+)"'
    )
    return list(dict.fromkeys(pattern.findall(page_source)))


def image_url(image: dict[str, Any]) -> str:
    direct = image.get("urlDefault") or image.get("urlPre")
    if direct:
        return str(direct).replace("http://", "https://", 1)
    for info in image.get("infoList", []):
        if info.get("imageScene") == "WB_DFT" and info.get("url"):
            return str(info["url"]).replace("http://", "https://", 1)
    raise RuntimeError("图片缺少可下载地址")


def ocr_image(engine: RapidOCR, url: str) -> str:
    array = np.frombuffer(fetch(url), dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError("图片解码失败")
    result, _ = engine(image)
    if not result:
        return ""
    return "\n".join(str(line[1]).strip() for line in result if str(line[1]).strip())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--page", type=Path, default=Path("app/page.tsx"))
    parser.add_argument("--urls-file", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    if args.urls_file:
        urls = json.loads(args.urls_file.read_text(encoding="utf-8"))
    else:
        urls = extract_note_urls(args.page.read_text(encoding="utf-8"))
    engine = RapidOCR()
    report: list[dict[str, Any]] = []

    for note_index, url in enumerate(urls, start=1):
        note_id_match = re.search(r"/([0-9a-f]{24})\?", url)
        if not note_id_match:
            continue
        note_id = note_id_match.group(1)
        html = fetch(url).decode("utf-8", errors="replace")
        note = note_payload(html, note_id)
        images = note.get("imageList", [])
        image_texts = []
        for image_index, image in enumerate(images, start=1):
            try:
                text = ocr_image(engine, image_url(image))
                image_texts.append({"index": image_index, "text": text})
            except Exception as error:  # keep the remaining images readable
                image_texts.append({"index": image_index, "text": "", "error": str(error)})
        report.append(
            {
                "noteId": note_id,
                "title": note.get("title", ""),
                "publishedAt": note.get("time"),
                "url": url,
                "imageCount": len(images),
                "images": image_texts,
            }
        )
        print(
            f"[{note_index}/{len(urls)}] {note_id}: {len(images)} images",
            flush=True,
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"saved {sum(item['imageCount'] for item in report)} images to {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
