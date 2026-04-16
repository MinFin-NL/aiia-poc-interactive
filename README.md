# AIIA PoC – AI Impact Assessment Tool

A proof-of-concept web application for completing AI Impact Assessments (AIIA) for the Dutch government (Ministerie van Infrastructuur en Waterstaat / IenW). The tool guides users through a structured assessment form and uses a locally running LLM to suggest text improvements.

## Architecture

| Layer | Technology |
|---|---|
| Frontend | Vue 3 + TypeScript + Vite |
| Rich text editor | Tiptap |
| State management | Pinia (with persistence) |
| Design system | NL RVO Component Library |
| PDF export | pdfmake |
| Backend API | FastAPI (Python) |
| LLM inference | Ollama (local) |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Python](https://www.python.org/) 3.13+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [Ollama](https://ollama.com/) running locally with a model pulled (default: `llama3.2`)

## Getting started

### 1. Pull the LLM model

```bash
ollama pull llama3.2
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Install backend dependencies

```bash
uv sync
```

### 4. Configure environment (optional)

Copy `.env.example` to `.env` to override defaults:

```bash
cp .env.example .env
```

Available variables:

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_MODEL` | `llama3.2` | Ollama model to use for text improvement |

### 5. Start the backend

```bash
uv run uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`.

### 6. Start the frontend

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/improve` | `POST` | Suggest an improved version of a text fragment |

### `POST /api/improve`

**Request body:**

```json
{
  "text": "Te verbeteren tekst...",
  "question_context": "Naam van de vraag of sectie (optioneel)"
}
```

**Response:**

```json
{
  "suggestion": "Verbeterde versie van de tekst",
  "rationale": "Één zin toelichting op de verbetering"
}
```

## License

Licensed under the [European Union Public Licence v1.2 (EUPL-1.2)](LICENSE).
