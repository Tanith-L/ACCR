"""Load source documents (PDF, Markdown, plain text) into page-addressable text."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader

from .legacy import slugify

SUPPORTED = {".pdf": "application/pdf", ".md": "text/markdown", ".txt": "text/plain"}


@dataclass
class SourceDocument:
    id: str
    title: str
    path: Path
    media_type: str
    pages: list[str]  # pages[0] is page 1

    @property
    def is_pdf(self) -> bool:
        return self.media_type == "application/pdf"

    def page_text(self, page: int | None) -> str:
        if page is None or not 1 <= page <= len(self.pages):
            return "\n\n".join(self.pages)
        return self.pages[page - 1]

    def as_source_record(self, credit: str | None = None) -> dict:
        return {"id": self.id, "title": self.title, "file": self.path.name, "url": None,
                "media_type": self.media_type, "credit": credit}


def load_document(path: Path) -> SourceDocument:
    path = Path(path)
    media_type = SUPPORTED.get(path.suffix.lower())
    if media_type is None:
        raise ValueError(f"unsupported source type {path.suffix}: {path}")
    if media_type == "application/pdf":
        pages = [(p.extract_text() or "") for p in PdfReader(path).pages]
    else:
        # Text sources: a form feed or a line with only '---page---' splits pages.
        text = path.read_text()
        pages = [p.strip() for p in text.replace("\n---page---\n", "\f").split("\f")]
    return SourceDocument(id=slugify(path.stem), title=path.stem.replace("_", " "),
                          path=path, media_type=media_type, pages=pages)


def load_documents(paths: list[Path]) -> list[SourceDocument]:
    docs = [load_document(p) for p in paths]
    ids = [d.id for d in docs]
    if len(set(ids)) != len(ids):
        raise ValueError(f"two source files map to the same id: {ids}")
    return docs
