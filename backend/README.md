# Backend Storage Engine (FastAPI & Lighthouse)

This is the backend service for **The Onchain Architect**, built with FastAPI and Python 3.

It receives 3D building model files (`.ifc`, `.gltf`), hashes them with SHA-256, uploads them to IPFS and Filecoin through the Lighthouse SDK, and returns the IPFS CID and file hash to the client.

---

## How It Works

1. **Size check:** Rejects files over 50 MB both upfront and while reading chunk buffers so the server never runs out of memory.
2. **SHA-256 hashing:** Hashes the exact bytes received in memory.
3. **IFC validation:** For `.ifc` files, `validate_ifc_model` opens the file with `ifcopenshell` and returns the schema (for example IFC4) and the entity count. A file that does not parse is rejected with a 422 before anything is uploaded. Other formats such as `.gltf` skip this step. Geometry and element checks are not implemented yet.
4. **Lighthouse upload:** Writes bytes to an isolated temporary directory, uploads to Lighthouse, cleans up the temp directory, and extracts the CID.
5. **JSON response:** Returns `{ filename, file_hash, ipfs_cid, ifc_schema, ifc_entity_count }`. The two IFC fields are null for non-IFC files.

---

## API Endpoints

- **`GET /health`**  
  Quick health check endpoint. Returns `{"status": "ok"}`.
- **`POST /upload-model/`**  
  Accepts a `multipart/form-data` file upload. Returns:
  ```json
  {
    "filename": "model.ifc",
    "file_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "ipfs_cid": "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
  }
  ```

Interactive Swagger docs are live at `http://localhost:8000/docs` whenever the server is running.

---

## Local Setup

### 1. Create a virtual environment

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Add your Lighthouse API key (you can generate one for free at [files.lighthouse.storage](https://files.lighthouse.storage/)):

```env
LIGHTHOUSE_API_KEY=your_lighthouse_api_key_here
```

### 3. Run the server

```bash
uvicorn main:app --reload --port 8000
```

---

## Running Tests

We use `pytest` with `httpx` to test the API:

```bash
pytest tests
```

The tests mock the Lighthouse SDK so you don't need real API keys or an internet connection to run them. The suite covers:
- `/health` status check
- Empty file rejection (400)
- End-to-end upload and hashing with mocked CID response (200)
- Missing API key diagnostic error (500)
- Oversized file upload rejection (413)
- Invalid `.ifc` rejection (422) without calling Lighthouse
- `.gltf` upload skipping the IFC check
