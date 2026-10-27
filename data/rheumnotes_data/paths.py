from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = REPO_ROOT / "shared" / "schema" / "content-bundle.schema.json"
MEDIA_DIR = REPO_ROOT / "media"
DATA_DIR = REPO_ROOT / "data"
SOURCES_DIR = DATA_DIR / "sources"
OUTPUT_DIR = DATA_DIR / "output"

# Hand-written PsA content committed before the pipeline existed.
LEGACY_TOPICS = REPO_ROOT / "topics.yaml"
LEGACY_LESSONS_DIR = REPO_ROOT / "lessons"
LEGACY_QUIZZES = REPO_ROOT / "quizzes.yaml"
LEGACY_MEDIA = MEDIA_DIR / "media.yaml"
