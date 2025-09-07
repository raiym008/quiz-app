## quiz-app

Білім алушыларға арналған викторина жүйесі
Мақсаты: өзім үйренемін деген адамдар үшін көмек беру

## Функциялар
- Админ панель арқылы пәндер мен тақырыптарды қосу, өзгерту, өшіру
- Тақырып бойынша тест тапсыру
- Суреті бар сұрақтар мен көп нұсқалы жауаптар
- Нәтижелерді көрсету

## Технологиялар
- **Frontend:** React + Vite + TypeScript
- **Backend:** FastAPI (Python)
- **Database:** (өз таңдауың, мысалы: PostgreSQL немесе SQLite)

## Керек кітапханалар

### Backend (FastAPI)
- `fastapi`
- `uvicorn`
- `sqlalchemy` (немесе `tortoise-orm`, егер ORM қолдансаң)
- `pydantic`
- `python-multipart` (файл/сурет жүктеу үшін)
- `passlib[bcrypt]` (құпиясөз хэштеу үшін)
- `alembic` (егер миграция жасайтын болсаң)

### Frontend (React + Vite + TypeScript)
- `react`, `react-dom`
- `vite`
- `typescript`
- `axios` (API-мен байланысу үшін)
- `react-router-dom` (беттер арасында ауысу үшін)
- `zustand` немесе `redux` (стейт-менеджмент қажет болса)
- `bootstrap` (UI үшін)
- `@mui/material` (егер Material UI қолдансаң)

## Орнату
```bash
git clone https://github.com/raiym008/quiz-app.git
cd quiz-app```

