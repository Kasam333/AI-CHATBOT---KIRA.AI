<h1 align="center">🤖 KIRA.AI – Smart HR & Business Chatbot</h1>

<p align="center">
    <img width="436" height="235" alt="Screenshot 2025-10-28 175600" src="https://github.com/user-attachments/assets/f0d28528-236a-4002-950f-87d5570df900" />
</p>

<p align="center">
  <b>An AI-powered HR & Business Chatbot</b> integrated with <b>Odoo 18, Google Gemini, and OpenAI Whisper</b>.<br>
  Handles HR operations, voice chats, reports, and even image-based queries — all in one platform.
</p>

---

## 🎥 Project Demo Video
[Watch Demo on LinkedIn](https://www.linkedin.com/posts/kasam-ali-mukhi-712902249_part-1-im-excited-to-share-something-activity-7399019195008552960-eNDC?utm_source=share&utm_medium=member_android&rcm=ACoAAD2JTX4BlaF_KtDMwQTLp6SNrje1GVnZ6bk)

## ✨ Overview

**KIRA.AI** simplifies HR and business communication using **FastAPI**, **PostgreSQL**, and **Generative AI**.  
It provides both **text and voice-based** interaction modes, seamlessly integrated with Odoo’s real-time data via JSON-RPC.

---

## 🚀 Features

### 🧠 AI-Powered Chat
- Chat naturally using **Google Gemini**.
- Handles contextual queries like:
  > “Show my attendance for this week”  
  > “Generate packaging report for today”

### 💼 Deep Odoo Integration
- Real-time connection with **Odoo 18 JSON-RPC API**
- Fetch and display live data:
  - Attendance records  
  - Invoices  
  - Stock moves and reports  

### 🗣️ Voice-to-Voice Communication
- Speak to KIRA.AI and get spoken responses.  
- Uses:
  - **OpenAI Whisper** for Speech-to-Text (STT)
  - **gTTS** for Text-to-Speech (TTS)

### 🖼️ Image Intelligence
- Upload any image (invoice, report, chart, etc.)  
- Ask KIRA.AI to interpret or extract insights from it.

### 📊 Excel Report Automation
- Auto-generate Excel reports using **openpyxl**.
- Download formatted reports instantly.

### 🧾 Smart Chat Logging & Role Access
- All conversations stored in **PostgreSQL**.  
- Role-based access: `Admin`, `Developer`, `QA`, `Client`.

### 💬 Sleek Web Interface
- Built with **HTML, CSS, and JavaScript**.
- Includes:
  - Voice recording
  - Image upload
  - Configuration modals
  - Smooth animations

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|---------------|
| **Backend** | Python 3.10+, FastAPI, SQLAlchemy, PostgreSQL |
| **AI / NLP** | Google Gemini API, OpenAI Whisper, gTTS, pydub, noisereduce, numpy, scipy |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Integrations** | Odoo 18 JSON-RPC, openpyxl (Excel) |

---

## 📸 Screenshots

| Chat Interface | Voice Query | Configuration | Excel Report |
|:----------------:|:------------:|:---------------:|:---------------:|
| <img width="959" height="537" alt="Screenshot 2025-10-28 173519" src="https://github.com/user-attachments/assets/712bdfa7-5fbd-49b6-b1c7-af31c8e099c7" /> | ![Voice](https://via.placeholder.com/300x180?text=Voice+Query) | <img width="958" height="436" alt="Screenshot 2025-10-28 175123" src="https://github.com/user-attachments/assets/df9b381a-ae57-45ac-a0cc-8379d32b3d22" /> <img width="585" height="368" alt="Screenshot 2025-10-28 175329" src="https://github.com/user-attachments/assets/2bb45fa2-f489-4a27-8e78-0fc236f5fc06" /> <img width="476" height="301" alt="Screenshot 2025-10-28 175418" src="https://github.com/user-attachments/assets/df881d22-e21f-411d-8c6d-58ab55f77d60" />

 | ![Report](https://via.placeholder.com/300x180?text=Excel+Report) |

---

## 🔧 Installation Guide

### **Prerequisites**
- Python `>=3.10`
- PostgreSQL
- API keys for **Google Gemini** & **OpenAI Whisper**
- `pip` package manager

---

### **1️⃣ Clone the Repository**
```bash
git clone https://github.com/yourusername/kira-ai-chatbot.git
cd kira-ai-chatbot


2️⃣ Create a Virtual Environment
python -m venv venv
venv\Scripts\activate    # On Windows
# or
source venv/bin/activate # On Linux/Mac

3️⃣ Install Dependencies
pip install -r requirements.txt

4️⃣ Add Configuration

Create a file named odoo_config.json in the project root:

{
  "ODOO_URL": "http://localhost:8069/jsonrpc",
  "ODOO_DB": "your_odoo_db",
  "ODOO_USERNAME": "admin",
  "ODOO_PASSWORD": "admin",
  "ODOO_DB_URL": "postgresql://user:password@localhost:5432/your_odoo_db"
}

5️⃣ Set Environment Variables

Create a file named .env:

GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key

6️⃣ Run the FastAPI Server
uvicorn main:app --reload

7️⃣ Access the App

Open your browser:
👉 http://127.0.0.1:8000

🌟 Future Enhancements:

🗂️ Multi-chat sessions with contextual memory
🧾 Export chat results as PDF & Excel
📱 Mobile app (Flutter + Firebase) integration
🌍 Multi-language voice support
🔔 WhatsApp alerts via Ultramsg API
📄 License

This project is licensed under the MIT License.

📬 Contact

👨‍💻 Developer: Kasamali Mukhi
📧 Email: mukhikasamali.333@gmail.com.com
🌐 GitHub: kasam333
🔗 LinkedIn: linkedin.com/in/your-profile

<p align="center"> 💡 <i>“KIRA.AI — bridging HR, data, and intelligence with voice and vision.”</i> </p> ```
