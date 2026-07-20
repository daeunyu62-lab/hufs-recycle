ALLOWED_IMAGE_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def extension_for_mime_type(content_type: str) -> str | None:
    return ALLOWED_IMAGE_MIME_TYPES.get(content_type)


def is_valid_image_content(content_type: str, content: bytes) -> bool:
    if content_type == "image/jpeg":
        return content.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/webp":
        return (
            len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP"
        )
    return False
