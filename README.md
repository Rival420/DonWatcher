# Donwatcher Installation & Quick Start

Follow these steps to get Donwatch up and running on your local machine.

---

## 1. Clone the repository

```bash
git clone https://github.com/rival420/Donwatcher.git
cd Donwatcher
````

---

## 2. Create & activate a Python virtual environment

```bash
# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate

# Windows (PowerShell)
python -m venv .venv
.venv\Scripts\Activate.ps1
```

---

## 3. Install dependencies

Make sure you have a `requirements.txt` in the project root (it should include at least: `fastapi`, `uvicorn`, `aiofiles`, `defusedxml`, `pydantic`, `python-multipart`).

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 4. Run the application

By default Donwatcher will start on port 8080 and bind to all interfaces:

```bash
uvicorn main:app --reload --port 8080 --host 0.0.0.0
```

* `--reload` enables hot‑reloading on code changes.
* To use a different port, change `--port`.

---

## 5. Open in your browser

* **Dashboard:**  [http://localhost:8080](http://localhost:8080)
* **Analyze page:**  [http://localhost:8080/analyze](http://localhost:8080/analyze)

---

## 6. Next steps

* Upload PingCastle XML reports via the **Dashboard**.
* Browse **Reports** to see parsed data.
* Go to **Analyze** for historical charts and recurring findings.

Enjoy using Donwatcher! 😊
