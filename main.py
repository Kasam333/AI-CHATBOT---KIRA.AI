from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import requests
import os
import sys
import json
import logging
import re
from datetime import datetime
from collections import defaultdict

import google.generativeai as genai
from gtts import gTTS
from pydub import AudioSegment
from pydub.utils import which
import noisereduce as nr
import numpy as np
from scipy.io import wavfile

import whisper
from openai import OpenAI
import pytz
import uuid
from openpyxl import Workbook
import base64
from pydantic import BaseModel
from typing import List, Optional



from prompts import MODEL_MAPPING_PROMPTS  # <-- keep this
# import mimetypes, pandas as pd
# from docx import Document
# import PyPDF2

from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime


# ---------------- FASTAPI APP ----------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1️⃣ Add FFmpeg bin folder to PATH
ffmpeg_bin = r"C:\AI\ai_models\model\ffmpeg\bin"
os.environ["PATH"] += os.pathsep + ffmpeg_bin

# ---------------- AUDIO CONFIG ----------------
from pydub import AudioSegment

AudioSegment.converter = os.path.join(ffmpeg_bin, "ffmpeg.exe")
AudioSegment.ffprobe = os.path.join(ffmpeg_bin, "ffprobe.exe")

# ---------------- CONFIG ----------------
USE_WHISPER_LOCAL = True
USE_WHISPER_API = False

whisper_model = whisper.load_model("tiny")
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

CONFIG_FILE = "odoo_config.json"

# Load configuration from file
def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)

config = load_config()
ODOO_URL = config["ODOO_URL"]
ODOO_DB = config["ODOO_DB"]
ODOO_USERNAME = config["ODOO_USERNAME"]
ODOO_PASSWORD = config["ODOO_PASSWORD"]
ODOO_DB_URL = config["ODOO_DB_URL"]

engine = create_engine(ODOO_DB_URL)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

@app.get("/get_config")
def get_config():
    return load_config()

@app.post("/save_config")
def save_config(data: dict):
    with open(CONFIG_FILE, "w") as f:
        json.dump(data, f, indent=4)
    return {"status": "success", "message": "Configuration updated successfully"}


class ChatLog(Base):
    __tablename__ = "user_chat_logs"  # will be created in Odoo DB

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    employee_id = Column(Integer, nullable=True)
    query = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, nullable=False)
    sender = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    audio_url = Column(String, nullable=True)
    excel_url = Column(String, nullable=True)
    image_url = Column(String, nullable=True)

Base.metadata.create_all(bind=engine)

# ---------------- LOGGER CONFIG ----------------
logging.basicConfig(
    level=logging.INFO,
    handlers=[logging.StreamHandler(sys.stdout)],
    format="%(asctime)s [%(levelname)s] %(message)s",
    encoding="utf-8"   # ✅ Python 3.9+
)
logger = logging.getLogger(__name__)

# ---------------- MEMORY ----------------
chat_histories = defaultdict(list)

# ---------------- HELPERS ----------------
def convert_utc_to_ist(utc_str: str) -> str:
    try:
        utc_dt = datetime.strptime(utc_str, "%Y-%m-%d %H:%M:%S")
        utc_dt = pytz.utc.localize(utc_dt)
        ist_dt = utc_dt.astimezone(pytz.timezone("Asia/Kolkata"))
        return ist_dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return utc_str

def format_for_speech(text: str) -> str:
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    lines = text.splitlines()
    spoken_lines = []
    for line in lines:
        line = line.strip()
        if line.startswith("- "):
            line = line[2:]
            if ":" in line:
                date, rest = line.split(":", 1)
                line = f"On {date.strip()}, {rest.strip()}"
        elif line.lower().startswith("total"):
            line = "In total, " + line[6:]
        spoken_lines.append(line)
    return " ".join(spoken_lines)

EXCEL_DIR = "generated_excels"
os.makedirs(EXCEL_DIR, exist_ok=True)

def generate_excel_file(data: list, model: str) -> str:
    wb = Workbook()
    ws = wb.active
    ws.title = model

    if not data:
        ws.append(["No records found"])
    else:
        headers = list(data[0].keys())
        ws.append(headers)
        for rec in data:
            row = []
            for h in headers:
                val = rec.get(h, "")
                if isinstance(val, (list, tuple)):
                    if len(val) == 2 and isinstance(val[1], str):
                        val = val[1]
                    else:
                        val = ", ".join(str(x) for x in val)
                row.append(val)
            ws.append(row)

    filename = f"{model}_{uuid.uuid4().hex}.xlsx"
    full_path = os.path.join(EXCEL_DIR, filename)
    wb.save(full_path)
    return filename  # only filename, not full path



# ---------------- ODOO HELPERS ----------------
def odoo_authenticate():
    payload = {
        "jsonrpc": "2.0",
        "method": "call",
        "params": {"service": "common", "method": "login", "args": [ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD]},
        "id": 1,
    }
    res = requests.post(ODOO_URL, json=payload).json()
    if "error" in res:
        raise Exception(f"Odoo login failed: {res['error']}")
    return res["result"]

@app.post("/login")
async def login(data: dict):
    role = data.get("role")
    email = data.get("email")
    password = data.get("password")

    # Authenticate with Odoo
    payload = {
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "service": "common",
            "method": "login",
            "args": [ODOO_DB, email, password]
        },
        "id": 1,
    }
    res = requests.post(ODOO_URL, json=payload).json()
    if "error" in res or not res.get("result"):
        return {"error": "Invalid credentials"}

    user_id = res["result"]

    # Get employee_id
    payload_emp = {
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "service": "object",
            "method": "execute_kw",
            "args": [
                ODOO_DB, user_id, password,
                "hr.employee", "search_read",
                [[["user_id", "=", user_id]]],
                {"fields": ["id"], "limit": 1}
            ],
        },
        "id": 1,
    }
    res_emp = requests.post(ODOO_URL, json=payload_emp).json()
    employee_id = res_emp.get("result", [{}])[0].get("id", None)

    # ✅ Get employee name directly
    employee_name = None
    if employee_id:
        employee_name = get_employee_name(employee_id, user_id, password)

    return {
        "role": role,
        "user_id": user_id,
        "employee_id": employee_id,
        "employee_name": employee_name,
    }


def get_employee_name(employee_id: int, uid: int, password: str):
    payload = {
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "service": "object",
            "method": "execute_kw",
            "args": [
                ODOO_DB, uid, password,
                "hr.employee", "read",
                [employee_id],
                {"fields": ["name"]}
            ],
        },
        "id": 1,
    }
    res = requests.post(ODOO_URL, json=payload).json()
    if res.get("result"):
        return res["result"][0].get("name", "")
    return None


@app.post("/get_employee_name")
async def get_employee_name_api(data: dict):
    employee_id = data.get("employee_id")
    user_id = data.get("user_id")
    password = data.get("password")   # ⚡ we need the same password used in login

    if not employee_id:
        return {"error": "Missing employee_id"}

    name = get_employee_name(int(employee_id), int(user_id), password)
    return {"employee_name": name}



def get_user_id_from_employee(employee_id: int):
    uid = odoo_authenticate()
    payload = {
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "service": "object",
            "method": "execute_kw",
            "args": [ODOO_DB, uid, ODOO_PASSWORD, "hr.employee", "search_read", [[["id", "=", employee_id]]], {"fields": ["user_id"]}],
        },
        "id": 1,
    }
    res = requests.post(ODOO_URL, json=payload).json()
    if res.get("result") and res["result"][0].get("user_id"):
        return res["result"][0]["user_id"][0]
    return None

def odoo_get_all_models():
    uid = odoo_authenticate()
    payload = {
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "service": "object",
            "method": "execute_kw",
            "args": [ODOO_DB, uid, ODOO_PASSWORD, "ir.model", "search_read", [[]], {"fields": ["model", "name"]}],
        },
        "id": 1,
    }
    res = requests.post(ODOO_URL, json=payload).json()
    return [m["model"] for m in res.get("result", [])]

def odoo_get_all_fields(model):
    uid = odoo_authenticate()
    payload = {
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "service": "object",
            "method": "execute_kw",
            "args": [ODOO_DB, uid, ODOO_PASSWORD, model, "fields_get", [], {"attributes": ["string", "type"]}],
        },
        "id": 1,
    }
    res = requests.post(ODOO_URL, json=payload).json()
    return list(res.get("result", {}).keys())

def odoo_query(model, domain=None, fields=None, limit=20, employee_id=None, user_id=None):
    uid = odoo_authenticate()
    domain = domain or []

    resolved_user_id = None
    if employee_id:
        resolved_user_id = get_user_id_from_employee(int(employee_id))

    # ✅ FIX: only cast if numeric
    if user_id and not resolved_user_id:
        if str(user_id).isdigit():
            resolved_user_id = int(user_id)

    # Replace employee_id / user_id dynamically
    for i, condition in enumerate(domain):
        field, operator, value = condition
        if field == "user_id" and resolved_user_id:
            domain[i][2] = resolved_user_id
        elif field == "employee_id" and employee_id:
            domain[i][2] = int(employee_id)

    if not fields or fields == ["*"]:
        fields = odoo_get_all_fields(model)

    payload = {
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "service": "object",
            "method": "execute_kw",
            "args": [
                ODOO_DB, uid, ODOO_PASSWORD,
                model, "search_read", [domain],
                {"fields": fields, "limit": limit}
            ],
        },
        "id": 1,
    }
    return requests.post(ODOO_URL, json=payload).json()


# ---------------- GEMINI HELPERS ----------------
def gemini_json_response(system_prompt, user_prompt, model="gemini-2.5-flash"):
    model_obj = genai.GenerativeModel(model)
    response = model_obj.generate_content([system_prompt, user_prompt])
    text = (response.text or "").strip()
    text = text.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(text)
    except Exception:
        if "{" in text and "}" in text:
            try:
                return json.loads(text[text.find("{"): text.rfind("}") + 1])
            except Exception:
                return {"error": "Invalid JSON", "raw": text}
        return {"answer": text}
    

# ---------------- MAIN ENDPOINT ----------------
@app.post("/ask")
async def ask(data: dict):
    query = data["query"]
    employee_id = data.get("employee_id")
    user_id = data.get("user_id") or 1
    role = data.get("role", "developer")

    # 🔘 Toggle states from frontend
    hrms_enabled = data.get("hrms_enabled")
    gemini_enabled = data.get("gemini_enabled")

    # Make sure they are proper booleans
    hrms_enabled = bool(hrms_enabled) if hrms_enabled is not None else False
    gemini_enabled = bool(gemini_enabled) if gemini_enabled is not None else True

    session_key = str(user_id or employee_id or "guest")
    if session_key not in chat_histories:
        chat_histories[session_key] = []
    chat_histories[session_key].append({"role": "user", "content": query})

    # 🧠 Routing based on toggle states
    if hrms_enabled and not gemini_enabled:
        logging.info("💼 HRMS-only mode enabled")
        return await process_hrms_query(query, employee_id, user_id, role, session_key)

    elif gemini_enabled and not hrms_enabled:
        logging.info("🤖 Gemini-only mode enabled (HRMS disabled)")
        return await process_gemini_query(query, session_key, user_id, employee_id)


    elif hrms_enabled and gemini_enabled:
        logging.info("🔗 Combined mode (HRMS + Gemini)")
        hrms_keywords = [
            # Core HR
            "employee", "manager", "department", "job", "team", "organization", "profile",

            # Attendance / Check-in/out
            "attendance", "check-in", "check in", "check-out", "check out", "worked hours", "hours worked",

            # Leaves
            "leave", "leaves", "holiday", "vacation", "sick leave", "paid leave", "unpaid leave",
            "remaining leaves", "leave balance", "allocated leave", "approved leave",

            # Payroll
            "salary", "payslip", "pay slip", "wage", "ctc", "earnings", "deduction", "net pay", "total salary",
            "month salary", "year salary",

            # Timesheets
            "timesheet", "time sheet", "logged hours", "project hours", "billable hours", "work log",

            # Projects & Tasks
            "project", "projects", "task", "tasks", "assigned tasks", "completed tasks", "deadline",

            # Clients / Partners
            "client", "customer", "partner", "customer list", "contact",

            # Assets
            "asset", "assets", "allocated asset", "returned asset", "company asset", "laptop", "id card", "phone",

            # Resource Calendar / Working Hours
            "working hours", "schedule", "calendar", "work schedule", "shift", "working time",

            # General Odoo / HRMS terms
            "odoo", "hrms", "employee record", "human resource", "attendance report", "leave report",
            "payslip report", "asset register", "project report", "task report", "download excel", "generate report",
            "export", "report", "excel", "summary"
        ]

        if any(k in query.lower() for k in hrms_keywords):
            return await process_hrms_query(query, employee_id, user_id, role, session_key)
        else:
            return await process_gemini_query(query, session_key, user_id, employee_id)

    else:
        return {"answer": "⚠️ Both HRMS and Gemini connectivity are disabled. Please enable at least one option."}


# ---------------------------------------------------------------------
# 🔹 HRMS Query Processing
# ---------------------------------------------------------------------
async def process_hrms_query(query, employee_id, user_id, role, session_key):
    models_text = "\n".join([f"- {m}" for m in odoo_get_all_models()])
    system_prompt = f"""
    You are an assistant that converts HR/business questions into Odoo ORM query instructions.
    Always return JSON in format:
    {{
      "model": "<odoo_model>",
      "domain": [["field", "operator", "value"]],
      "fields": ["*"],
      "limit": 20,
      "generate_excel": true/false
    }}
    Rules:
    - Expand month/year into [["date", ">=", "YYYY-MM-01"], ["date", "<=", "YYYY-MM-lastday"]]
    - Use ISO dates
    - If user asks for export/download/excel/report → set generate_excel=true
    Available models:
    {models_text}
    {MODEL_MAPPING_PROMPTS}
    """

    query_params = gemini_json_response(
        system_prompt,
        f"Role={role}, Employee={employee_id}, User={user_id}. Question: {query}"
    )

    if "error" in query_params or "answer" in query_params:
        return {"answer": query_params.get("answer", "Sorry, I couldn’t understand.")}

    # Odoo query
    logging.info(f"Gemini Query Mapping → Model: {query_params.get('model')} | Domain: {query_params.get('domain')} | Fields: {query_params.get('fields')}")
    raw_data = odoo_query(
        query_params["model"],
        query_params.get("domain"),
        query_params.get("fields"),
        query_params.get("limit", 20),
        employee_id,
        user_id,
    )
    processed_data = raw_data.get("result", [])
    for rec in processed_data:
        for k, v in rec.items():
            if isinstance(v, str) and len(v) >= 19 and v[4] == "-":
                rec[k] = convert_utc_to_ist(v)

    # Excel generation
    excel_url = None
    if query_params.get("generate_excel") and processed_data:
        excel_filename = generate_excel_file(processed_data, query_params["model"])
        excel_url = f"http://127.0.0.1:8000/get_excel/{excel_filename}"

    #  Gemini summary for HRMS data
    system_prompt = """
        You are a professional HR & Business Assistant chatbot for Odoo HRMS.

        Your goal:
        Generate a **detailed, conversational, and accurate explanation** of the query results for the end user.

        Output format:
        {
        "answer": "<long descriptive text>"
        }

        Response guidelines:
        - Write in **natural, friendly business tone** (like ChatGPT or a smart HR officer).
        - Always explain what data represents (e.g., "These are your validated leave records for October 2025").
        - Include summaries with numbers, totals, and insights.
        - If a report or list is shown, mention key highlights (first few records, totals, dates, etc.).
        - Mention **model name**, context, and filters applied (e.g., "based on your employee ID" or "filtered for this month").
        - When Excel is generated, tell the user clearly (e.g., "I've also generated an Excel report for download").
        - Use small emojis (📅, 💼, 🕒, 💰) if relevant.
        - Provide 3–5 sentences minimum per response.
        - Never respond abruptly with “Here’s your data” or “No data found”.
        """

    user_prompt = f"""
        User Role: {role}
        User Question: {query}
        Odoo Model: {query_params['model']}
        Domain Used: {json.dumps(query_params.get('domain', []), indent=2)}
        Odoo Records: {json.dumps(processed_data, indent=2)}
        Generate Excel: {query_params.get('generate_excel')}
    """

    summary = gemini_json_response(system_prompt, user_prompt)

    # Save chat logs
    chat_histories[session_key].append({"role": "assistant", "content": summary.get("answer", "")})
    await save_chat_to_db(user_id, employee_id, query, summary.get("answer", ""))

    return {
        "answer": summary.get("answer", "Sorry, I couldn’t understand."),
        "domain": query_params.get("domain", []),
        "model": query_params.get("model", "unknown"),
        "employee_id": employee_id,
        "user_id": user_id,
        "excel_url": excel_url,
    }


# ---------------------------------------------------------------------
# 🔹 Gemini General Query Processing
# ---------------------------------------------------------------------

def format_gemini_output(text: str) -> str:
    # Preserve Markdown & code blocks
    text = text.strip()
    text = re.sub(r'```(\w+)?\n', lambda m: f"```{m.group(1) or ''}\n", text)
    # Ensure at least one newline before/after code blocks
    text = re.sub(r'```', '\n```\n', text)
    return text

async def process_gemini_query(query, session_key, user_id=None, employee_id=None):
    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content(query)
    text = format_gemini_output(response.text or "Sorry, I couldn’t understand.")

    chat_histories[session_key].append({"role": "assistant", "content": text})

    # ✅ Save with correct user & employee info
    await save_chat_to_db(user_id=user_id, employee_id=employee_id, query=query, response=text)
    return {"answer": text}



# ---------------------------------------------------------------------
# 🔹 Save Chat to Database
# ---------------------------------------------------------------------
async def save_chat_to_db(user_id, employee_id, query, response):
    try:
        db = SessionLocal()
        new_chat = ChatLog(
            user_id=user_id,
            employee_id=employee_id,
            query=query,
            response=response
        )
        db.add(new_chat)
        db.commit()
        db.refresh(new_chat)

        # Save both user & assistant messages
        db.add_all([
            ChatMessage(chat_id=new_chat.id, sender="user", content=query),
            ChatMessage(chat_id=new_chat.id, sender="bot", content=response)
        ])
        db.commit()
        db.close()
    except Exception as e:
        logging.error(f"❌ Failed to save chat messages: {e}")


# ---------------- EXCEL DOWNLOAD ENDPOINT ----------------
@app.get("/get_excel/{file_name}")
async def get_excel(file_name: str):
    file_path = os.path.join(EXCEL_DIR, file_name)
    if not os.path.exists(file_path):
        return {"error": "File not found"}
    return FileResponse(file_path, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename=file_name)


# ---------------- VOICE ENDPOINT ----------------
@app.post("/ask_voice")
async def ask_voice(data: dict):
    ask_response = await ask(data)
    answer_text = ask_response["answer"]
    spoken_text = format_for_speech(answer_text)

    # ✅ Unique filename
    audio_filename = f"answer_{uuid.uuid4()}.mp3"
    gTTS(spoken_text, lang="en").save(audio_filename)

    return {
        "answer": answer_text,
        "spoken_text": spoken_text,
        "audio_url": f"http://127.0.0.1:8000/get_audio/{audio_filename}"
    }


@app.get("/get_audio/{file_name}")
async def get_audio(file_name: str):
    file_path = os.path.join("answer_audios", file_name)
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="audio/mpeg", filename=file_name)
    else:
        logging.error(f"❌ Audio not found at: {file_path}")
        return {"error": "File not found"}

os.makedirs("uploaded_images", exist_ok=True)
app.mount("/uploaded_images", StaticFiles(directory="uploaded_images"), name="uploaded_images")


# ---------------- TRANSCRIBE AUDIO ----------------
def transcribe_whisper_local(file_path):
    return whisper_model.transcribe(file_path)["text"].strip()

def transcribe_whisper_api(file_path):
    with open(file_path, "rb") as f:
        transcript = openai_client.audio.transcriptions.create(model="whisper-1", file=f)
    return transcript.text.strip()

async def convert_to_wav(file_path, target="input.wav"):
    audio = AudioSegment.from_file(file_path).set_channels(1).set_frame_rate(16000).set_sample_width(2)
    audio.export(target, format="wav")
    return target

# ---------------- VOICE TO VOICE ----------------
@app.post("/ask_voice_to_voice")
async def ask_voice_to_voice(
    file: UploadFile = File(...),
    employee_id: str = Form(None),
    user_id: str = Form(None),
    role: str = Form("developer")
):
    uploaded = "uploaded_audio"
    with open(uploaded, "wb") as f:
        f.write(await file.read())

    wav_path = await convert_to_wav(uploaded)
    rate, data = wavfile.read(wav_path)

    clean_path = "input_clean.wav"
    wavfile.write(clean_path, rate, nr.reduce_noise(y=data, sr=rate))

    # 🎤 Transcribe
    query_text = transcribe_whisper_local(clean_path) if USE_WHISPER_LOCAL else transcribe_whisper_api(clean_path)

    # 🤖 Get bot answer
    ask_response = await ask({
        "query": query_text,
        "employee_id": employee_id,
        "user_id": user_id,
        "role": role
    })
    answer_text = ask_response["answer"]

    # ✅ Log info
    logging.info(
        f"[ask_voice_to_voice] Employee={ask_response['employee_id']}, "
        f"User={ask_response['user_id']}, Role={role}, "
        f"Domain={ask_response.get('domain', 'default')}, Model={ask_response.get('model', 'gemini')}"
    )
    logging.info(f"[ask_voice_to_voice] Voice Query='{query_text}' → Answer='{answer_text[:80]}...'")

    # 🎵 Save answer in separate folder
    audio_dir = "answer_audios"
    os.makedirs(audio_dir, exist_ok=True)  # Create folder if not exists

    audio_filename = f"answer_{uuid.uuid4()}.mp3"
    audio_path = os.path.join(audio_dir, audio_filename)

    # ✅ Generate and flush the file safely
    tts = gTTS(format_for_speech(answer_text), lang="en")
    tts.save(audio_path)
    os.utime(audio_path, None)  # touch the file so it's recognized immediately
    
    # ✅ Log confirmation
    logging.info(f"✅ Audio generated at: {audio_path}")

    return {
        "query_text": query_text,
        "answer": answer_text,
        "audio_url": f"http://127.0.0.1:8000/get_audio/{audio_filename}"
    }
                                               



@app.post("/ask_image")
async def ask_image(
    file: UploadFile = File(...),
    query: str = Form("Describe this image"),
    employee_id: str = Form(None),
    user_id: str = Form(None),
    role: str = Form("developer")
):
    # 1️⃣ Save uploaded image
    image_dir = "uploaded_images"
    os.makedirs(image_dir, exist_ok=True)
    img_filename = f"uploaded_{uuid.uuid4().hex}.png"
    img_path = os.path.join(image_dir, img_filename)

    with open(img_path, "wb") as f:
        f.write(await file.read())

    # 2️⃣ Load image bytes
    with open(img_path, "rb") as f:
        image_bytes = f.read()

    # 3️⃣ Generate answer with Gemini
    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content([
        query,
        {"mime_type": file.content_type, "data": image_bytes}
    ])
    answer_text = (response.text or "Sorry, I couldn’t understand the image.").strip()

    # 4️⃣ Create a public image URL
    image_url = f"http://127.0.0.1:8000/{img_path.replace('\\', '/')}"

    # 5️⃣ Save to database (ChatLog + ChatMessage)
    try:
        db = SessionLocal()
        new_chat = ChatLog(
            user_id=user_id,
            employee_id=employee_id,
            query=query,
            response=answer_text
        )
        db.add(new_chat)
        db.commit()
        db.refresh(new_chat)

        db.add_all([
            ChatMessage(chat_id=new_chat.id, sender="user", content=query, image_url=image_url),
            ChatMessage(chat_id=new_chat.id, sender="bot", content=answer_text)
        ])
        db.commit()
        db.close()
    except Exception as e:
        logging.error(f"❌ Failed to save image chat: {e}")

    # 6️⃣ Add to in-memory history
    session_key = str(user_id or employee_id or "guest")
    chat_histories[session_key].append({"role": "user", "content": f"{query} (with image)"})
    chat_histories[session_key].append({"role": "assistant", "content": answer_text})

    # 7️⃣ Return structured response
    return {
        "answer": answer_text,
        "query": query,
        "employee_id": employee_id,
        "user_id": user_id,
        "image_url": image_url
    }

    
class ChatItem(BaseModel):
    chat_id: int
    created_at: str  # optional timestamp
    
class SettingsModel(BaseModel):
    hrms_enabled: bool = True
    gemini_enabled: bool = True

# ---------------- SETTINGS ENDPOINTS ----------------
SETTINGS_FILE = "settings.json"

@app.post("/save_settings")
async def save_settings(settings: SettingsModel):
    """
    Save chatbot configuration toggles (HRMS / Gemini enabled).
    """
    with open(SETTINGS_FILE, "w") as f:
        json.dump(settings.dict(), f)
    return {"success": True, "message": "Settings saved successfully"}

@app.get("/get_settings")
async def get_settings():
    """
    Load the current chatbot configuration.
    """
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, "r") as f:
            return json.load(f)
    # Default settings if file not found
    return {"hrms_enabled": True, "gemini_enabled": True}


@app.get("/get_chats/{employee_id}", response_model=List[ChatItem])
async def get_chats(employee_id: int):
    db: Session = SessionLocal()
    try:
        chats = db.query(ChatLog).filter(ChatLog.employee_id == employee_id).all()
        result = [
            {"chat_id": chat.id, "created_at": chat.timestamp.strftime("%Y-%m-%d %H:%M:%S")}
            for chat in chats
        ]
        return result
    finally:
        db.close()

class ChatMessageItem(BaseModel):
    chat_id: int
    sender: str
    content: str
    timestamp: str
    audio_url: Optional[str] = None
    excel_url: Optional[str] = None
    image_url: Optional[str] = None

@app.get("/get_chat_messages/{chat_id}", response_model=List[ChatMessageItem])
async def get_chat_messages(chat_id: int):
    db = SessionLocal()
    try:
        messages = db.query(ChatMessage).filter(ChatMessage.chat_id == chat_id).order_by(ChatMessage.timestamp).all()
        result = [
            ChatMessageItem(
                chat_id=msg.chat_id,
                sender=msg.sender,
                content=msg.content,
                timestamp=msg.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                audio_url=msg.audio_url,
                excel_url=msg.excel_url,
                image_url=msg.image_url
            )
            for msg in messages
        ]
        return result
    finally:
        db.close() 
        
@app.post("/new_chat/{employee_id}")
async def new_chat(employee_id: int):
    db = SessionLocal()
    try:
        new_chat = ChatLog(
            user_id=None,
            employee_id=employee_id,
            query="",
            response=""
        )
        db.add(new_chat)
        db.commit()
        db.refresh(new_chat)

        welcome_msg = ChatMessage(
            chat_id=new_chat.id,
            sender="bot",
            content="👋 New chat started! How can I help you today?"
        )
        db.add(welcome_msg)
        db.commit()

        return {
            "success": True,
            "chat_id": new_chat.id,
            "message": "New chat created successfully"
        }

    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}
    finally:
        db.close()

@app.delete("/delete_chat/{chat_id}")
async def delete_chat(chat_id: int):
    db = SessionLocal()
    try:
        # Delete related chat messages first
        db.query(ChatMessage).filter(ChatMessage.chat_id == chat_id).delete()
        # Then delete chat log
        db.query(ChatLog).filter(ChatLog.id == chat_id).delete()
        db.commit()
        return {"success": True, "message": "Chat deleted successfully"}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}
    finally:
        db.close()

