import pytest
from app.core.config import settings
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


@pytest.mark.asyncio
async def test_mysql_connection():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT 1 + 1 AS resultado, DATABASE() AS banco;")
        )
        row = result.fetchone()
        assert row is not None
        assert row[0] == 2
        assert row[1] == "cep_db"
    await engine.dispose()


@pytest.mark.asyncio
async def test_get_db_session_generator():
    from app.core.database import get_db_session

    async for session in get_db_session():
        result = await session.execute(text("SELECT 1 AS ok;"))
        assert result.scalar() == 1

