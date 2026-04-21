# Poll Master - Full Stack Voting Application

A real-time polling application built with **Flask** and **React**. Users can create polls with 2-4 dynamic options, cast votes, and view results with live-updating progress bars.

## 📸 App Preview

### 1. Creating a Poll
![Poll Creation Interface](./screenshots/create_poll.png)

### 2. Viewing Results
![Poll Results with Progress Bars](./screenshots/results.png)

## 🚀 Features
- **Dynamic Poll Creation:** Add/remove options (constrained to 2-4 as per requirements).
- **Live Results:** Visual progress bars with percentage calculation.
- **Production-Ready Storage:** Managed **MySQL (Aiven)** for persistence, with SQLite fallback for local development.
- **Duplicate Vote Prevention:** Client-side tracking using LocalStorage.
- **Professional UI:** Styled with Tailwind CSS principles and Lucide-React icons.
- **RESTful API:** Clean separation of concerns between Frontend and Backend.

## 🛠️ Tech Stack
- **Backend:** Python (Flask), Flask-SQLAlchemy, Flask-CORS, PyMySQL.
- **Frontend:** React (Vite), Axios, Lucide-React.
- **Database:** MySQL (Aiven) / SQLite (Local).


## 📁 Project Structure
- **/backend**: Flask API, database models, and PyMySQL integration.

- **/frontend**: React components, dynamic forms, and Tailwind-styled UI.

- **api.js**: Centralized API configuration for easy deployment switching.



## 🏃‍♂️ How to Run

### 1. Backend Setup
1. Navigate to the backend folder:
```bash
cd backend
```
2. Create and activate a virtual environment:

```Bash
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate
```
3. Install dependencies:

```Bash
pip install Flask Flask-Cors Flask-SQLAlchemy PyMySQL cryptography
```
4. Start the Flask server:

```Bash
python app.py
```
The API will be running at http://127.0.0.1:5000

### 2. Frontend Setup
1. Open a new terminal and navigate to the frontend folder:

```Bash
cd frontend
```
2. Install dependencies:

```Bash
npm install
```
3. Start the Vite development server:

```Bash
npm run dev
```
Open the URL provided in the terminal (usually http://localhost:5173).


## 📝 Evaluation Requirements Met
- **Functionality**: Create, vote, and delete operations fully operational.

- **Data Aggregation**: Real-time percentage math and total vote tracking.

- **Persistence-**: Data survives server restarts via Managed MySQL.

- **UX**: Dynamic 2-4 option fields and responsive progress bars.

- **Security-**: Prevention of duplicate voting and SQL injection protection (via SQLAlchemy).

