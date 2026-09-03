from app.core.config import Settings


def test_settings_default_values():
    settings = Settings()
    assert settings.PROJECT_NAME == "Controle Estatístico de Processos (CEP)"
    assert settings.API_V1_STR == "/api/v1"
    assert settings.ALGORITHM == "HS256"
    assert "mysql+asyncmy://" in settings.DATABASE_URL
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES > 0
